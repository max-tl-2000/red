/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  getTeamMemberByDirectEmailIdentifier,
  getTeamMemberEmailIdentifierByOutsideDedicatedEmail,
  getTeamMemberEmailIdentifierByOutsideDedicatedEmails,
} from '../../dal/teamsRepo';
import {
  loadProgramForIncomingCommByEmail,
  loadProgramByMarketingSessionEmailIdentifier,
  getProgramEmailIdentifierByOutsideDedicatedEmail,
  getProgramEmailIdentifierByOutsideDedicatedEmails,
} from '../../dal/programsRepo';
import { getPartyBy } from '../../dal/partyRepo';
import loggerModule from '../../../common/helpers/logger';
import { CommTargetType } from './targetUtils';
import { getEmailAddressWithoutDomain } from '../../../common/helpers/utils';
import { EMAIL_ADDRESS as emailAddressRegex, EMAIL_FROM_NAME as emailFromNameRegex } from '../../../common/regex';
import { getAnonymousEmailIdFromEmail } from '../../helpers/mails';
import { getCommonUserByAnonymousEmailId, getPersonIdByTenantIdAndUserId } from '../../../auth/server/services/common-user';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getTargetForProgram } from './targetProcessorHelpers';

const logger = loggerModule.child({ subType: 'comms' });

// source: cristi@reva.tech
// outside dedicated email: cristi@craftingsoftware.com
// destination: cristi+dev@cristi.dev.mail.reva.tech
//
// messageData content:
// { to: [ 'cristi+dev@cristi.dev.mail.reva.tech' ],
//   from: 'cristi@craftingsoftware.com',
//   text: '---------- Forwarded message ----------\nFrom: Cristi Luca <cristi@reva.tech>\nDate: Thu, Sep 22, 2016 at 10:09 AM\nSubject: email-subject\nTo: Cristi Luca <cristi@craftingsoftware.com>\n\n\nemail-content\n',
//   headers: { ... }
//   fromName: 'Cristi Luca' }
const checkForManualForwardedEmail = async (ctx, messageData) => {
  const { from: fromAddress, text } = messageData;
  const emailIdentifier =
    (await getProgramEmailIdentifierByOutsideDedicatedEmail(ctx, fromAddress)) || (await getTeamMemberEmailIdentifierByOutsideDedicatedEmail(ctx, fromAddress));

  const matchFromEmailAddress = emailAddressRegex.exec(text);
  const matchFromName = emailFromNameRegex.exec(text);

  logger.trace({ ctx, fromAddress, emailIdentifier, matchFromEmailAddress, matchFromName }, 'checkForManualForwardedEmail');

  const forwardedFrom = matchFromEmailAddress && matchFromEmailAddress[0];
  const forwardedFromName = (matchFromName && matchFromName[1]) || forwardedFrom;

  return (
    emailIdentifier && {
      forwardedFrom,
      forwardedFromName,
      forwardedTo: [emailIdentifier],
    }
  );
};

// source: cristi@reva.tech
// outside dedicated email: cristi@craftingsoftware.com
// destination: cristi+dev@cristi.dev.mail.reva.tech
//
// messageData content:
// { to: [ 'cristi@craftingsoftware.com' ],
//   from: 'cristi@reva.tech',
//   text: 'email-subject\n',
//   headers:
//    { ...
//      'x-forwarded-to': 'cristi+dev@cristi.dev.mail.reva.tech',
//      ... },
//   fromName: 'Cristi Luca' }
const checkForAutomaticallyForwardedEmail = async (ctx, messageData) => {
  const X_FORWARDED_TO = 'x-forwarded-to';
  let emailIdentifier = messageData.headers && messageData.headers[X_FORWARDED_TO] && getEmailAddressWithoutDomain(messageData.headers[X_FORWARDED_TO]);

  if (!emailIdentifier) {
    emailIdentifier =
      (await getProgramEmailIdentifierByOutsideDedicatedEmails(ctx, messageData.to)) ||
      (await getTeamMemberEmailIdentifierByOutsideDedicatedEmails(ctx, messageData.to));
  }

  return (
    emailIdentifier && {
      forwardedFrom: messageData.from,
      forwardedFromName: messageData.fromName || messageData.from,
      forwardedTo: [emailIdentifier.toLowerCase()],
    }
  );
};

export const checkForOutsideDedicatedEmailFlow = async (ctx, messageData) => {
  const manualForward = await checkForManualForwardedEmail(ctx, messageData);
  return manualForward || (await checkForAutomaticallyForwardedEmail(ctx, messageData));
};

const getTargetForIndividualComm = ({ ctx, user, identifier, personId }) => {
  if (!user) {
    logger.error({ tenantId: ctx.tenantId, identifier }, `Email target not found for identifier: ${identifier}`);
    return {};
  }

  const result = {
    type: CommTargetType.INDIVIDUAL,
    id: user.id,
  };

  return personId ? { ...result, personId } : result;
};

const getTargetForTeamMember = ({ ctx, teamMember, identifier }) => {
  if (!teamMember) {
    logger.error({ ctx, identifier }, `Email target not found for identifier: ${identifier}`);
    return {};
  }

  return {
    type: CommTargetType.TEAM_MEMBER,
    id: teamMember.id,
  };
};

const getTargetForPersonToPersonComm = async (ctx, identifier) => {
  const anonymousEmailId = getAnonymousEmailIdFromEmail(identifier, false);
  const user = anonymousEmailId && (await getCommonUserByAnonymousEmailId(ctx, anonymousEmailId));
  const personId = user && (await getPersonIdByTenantIdAndUserId(ctx, ctx.tenantId, user.id));
  return getTargetForIndividualComm({ ctx, user, identifier, personId });
};

const getTargetPartyByEmailIdentifier = async (ctx, emailIdentifier) => {
  let party = await getPartyBy(ctx, { emailIdentifier });

  if (!party) return undefined;

  if (party.mergedWith) party = await getPartyBy(ctx, { id: party.mergedWith });
  const isClosedParty = !!party.endDate;
  const isArchivedParty = party.workflowState === DALTypes.WorkflowState.ARCHIVED;

  return { type: CommTargetType.PARTY, id: party.id, isClosedParty, isArchivedParty };
};

export const getTargetByEmailIdentifier = async (ctx, identifier, isPersonToPersonCommunication = false) => {
  if (isPersonToPersonCommunication) return await getTargetForPersonToPersonComm(ctx, identifier);

  const targetByPartyIdentifier = await getTargetPartyByEmailIdentifier(ctx, identifier);
  if (targetByPartyIdentifier) return targetByPartyIdentifier;
  const program =
    (await loadProgramForIncomingCommByEmail(ctx, identifier, { includeInactive: true })) ||
    (await loadProgramByMarketingSessionEmailIdentifier(ctx, identifier));
  if (program) return await getTargetForProgram({ ctx, program, identifier });

  const teamMember = await getTeamMemberByDirectEmailIdentifier(ctx, identifier);
  return getTargetForTeamMember({ ctx, teamMember, identifier });
};

const NOREPLY_REGEX = /(noreply|no-reply|mailer-daemon)@([\w\-.]*)(\.reva\.tech)/gi;

export const getRelevantEmailAddresses = (ctx, addresses) => {
  const emailsWithCorrectDomain = addresses.filter(addr => addr.endsWith('.reva.tech'));
  const emailsExceptNoReplys = emailsWithCorrectDomain.filter(addr => !addr.match(NOREPLY_REGEX));

  const skippedEmailAddresses = addresses.filter(addr => !emailsExceptNoReplys.includes(addr));
  if (skippedEmailAddresses.length) {
    logger.info({ ctx, skippedEmailAddresses }, 'Skipping target identification for the following addresses in inbound email: ');
  }

  return { emailsExceptNoReplys, skippedEmailAddresses };
};
