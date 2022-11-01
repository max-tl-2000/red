/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import newUUID from 'uuid/v4';
import { getTeamBy, getTeamsForUser, getTeamMemberById } from '../../dal/teamsRepo';
import { isValidPhoneNumber } from '../../helpers/phoneUtils';
import { getOnlyDigitsFromPhoneNumber, looksLikeAPhoneNumber } from '../../../common/helpers/phone-utils';
import { getPersonsBySenderData } from '../../dal/personRepo';
import {
  loadPartiesByPersonIds,
  getPartiesByPersonIdsAndTeamIds,
  getPartyBy,
  getActivePartyIdsByPersonIdsAndPropertyId,
  getPersonIdsByFullNameAndPartyId,
} from '../../dal/partyRepo';
import { getCommunicationByMessageId, loadMessageById } from '../../dal/communicationRepo';
import { saveContactInfo } from '../../dal/contactInfoRepo';
import { loadProgramForIncomingCommByTeamPropertyProgram } from '../../dal/programsRepo';
import loggerModule from '../../../common/helpers/logger';
import { getEmailAddressWithoutDomain, computeThreadId } from '../../../common/helpers/utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { checkForOutsideDedicatedEmailFlow, getTargetByEmailIdentifier, getRelevantEmailAddresses } from './targetProcessorEmailHelper';
import { getTargetByPhone } from './targetProcessorPhoneHelper';
import { getTargetByTeamId, getTargetByUserId } from './targetProcessorIdHelper';
import { cleanAndFormatName } from '../importActiveLeases/process-data/helpers';
const logger = loggerModule.child({ subType: 'comms' });
import { CommTargetType } from './targetUtils';
import {
  getPersonToPersonCommunicationByMessageId,
  getPersonToPersonCommunicationByForwardMessageId,
} from '../../../roommates/server/services/person-to-person-communication';
import { getAnonymousEmailIdFromEmail, isAnonymousEmail } from '../../helpers/mails';
import { getCommonUserByAnonymousEmailId, getPersonIdByTenantIdAndUserId, getCommonUserByEmailAddress } from '../../../auth/server/services/common-user';
import { CommunicationTargetNotFoundError, NoRetryError } from '../../common/errors';
import { shouldExcludePartyWhenProcessingIncomingComm as shouldExcludeParty } from '../../helpers/party';
import { isAnonymousEmail as isAnonymousIlsEmail } from '../../../common/helpers/anonymous-email';
import { getEmailParserProvider, isInboundEmailOnIlsDomains } from './email-parser/email-parser-provider';
import { partyWfStatesSubset } from '../../../common/enums/partyTypes';

const preProcessIdentifiersFromMessage = async (ctx, messageData, channel) => {
  const defaultIdentifiers = {
    toIdentifiers: messageData.to,
    ccIdentifiers: messageData.cc,
    from: messageData.from,
    userId: messageData.toUserId,
    teamId: messageData.toTeamId,
  };
  switch (channel) {
    case DALTypes.CommunicationMessageType.SMS:
    case DALTypes.CommunicationMessageType.CALL:
      return defaultIdentifiers;
    case DALTypes.CommunicationMessageType.WEB:
      return {
        ...defaultIdentifiers,
        webInquiryContactInfos: messageData.webInquiryContactInfos,
      };
    case DALTypes.CommunicationMessageType.EMAIL: {
      const forwardInfo = await checkForOutsideDedicatedEmailFlow(ctx, messageData);

      const { emailsExceptNoReplys: relevantToIdentifiers, skippedEmailAddresses: otherToIdentifiers } = getRelevantEmailAddresses(ctx, messageData.to);
      const { emailsExceptNoReplys: relevantCCIdentifiers } = getRelevantEmailAddresses(ctx, messageData.cc || []);

      const emailCtx = {
        toIdentifiers: (forwardInfo && forwardInfo.forwardedTo) || relevantToIdentifiers.map(p => getEmailAddressWithoutDomain(p)),
        ccIdentifiers: relevantCCIdentifiers.map(p => getEmailAddressWithoutDomain(p)),
        from: (forwardInfo && forwardInfo.forwardedFrom) || messageData.from,
        fromName: messageData.fromName,
        forwardedFromName: (forwardInfo && forwardInfo.forwardedFromName) || '',
        otherToIdentifiers,
      };
      logger.trace({ ctx, emailCtx, forwardInfo }, 'preProcessIdentifiersFromMessage');
      return emailCtx;
    }
    default:
      return {
        toIdentifiers: [],
        ccIdentifiers: [],
        from: '',
      };
  }
};

const getTargetByIdentifier = (ctx, identifier, isPersonToPersonCommunication) =>
  isValidPhoneNumber(identifier) ? getTargetByPhone(ctx, identifier) : getTargetByEmailIdentifier(ctx, identifier, isPersonToPersonCommunication);

const isParty = t => t.type === CommTargetType.PARTY;
const isTeamMember = t => t.type === CommTargetType.TEAM_MEMBER;
const isProgram = t => t.type === CommTargetType.PROGRAM;
const isIndividual = t => t.type === CommTargetType.INDIVIDUAL;

const hasPartyTarget = (to, cc) => to.some(t => isParty(t)) || cc.some(c => isParty(c));
const hasTeamMemberTarget = (to, cc) => to.some(t => isTeamMember(t)) || cc.some(c => isTeamMember(c));
const hasProgramTarget = (to, cc) => to.some(t => isProgram(t)) || cc.some(c => isProgram(c));

const getPartyTarget = (to, cc) => to.find(t => isParty(t)) || cc.find(c => isParty(c));
const getTeamMemberTarget = (to, cc) => to.find(t => isTeamMember(t)) || cc.find(c => isTeamMember(c));
const getProgramTarget = (to, cc) => to.find(t => isProgram(t)) || cc.find(c => isProgram(c));
const getFirstIndividualTarget = (to, cc) => to.find(t => isIndividual(t)) || cc.find(c => isIndividual(c));

// TODO we may need the ability to configure this in the future or retrieve them from a rule engine
const getPrimaryTargetRules = () => [
  {
    name: 'PartyTarget',
    condition: (to, cc) => hasPartyTarget(to, cc),
    primaryTarget: (to, cc) => getPartyTarget(to, cc),
  },
  {
    name: 'SingleTarget',
    condition: (to, cc) => to.length === 1 && cc.length === 1,
    primaryTarget: to => to[0],
  },
  {
    name: 'ProgramTarget',
    condition: (to, cc) => hasProgramTarget(to, cc),
    primaryTarget: (to, cc) => getProgramTarget(to, cc),
  },
  {
    name: 'TeamMemberTarget',
    condition: (to, cc) => hasTeamMemberTarget(to, cc),
    primaryTarget: (to, cc) => getTeamMemberTarget(to, cc),
  },
  {
    name: 'FirstIndividual',
    condition: () => true,
    primaryTarget: (to, cc) => getFirstIndividualTarget(to, cc),
  },
];

// TODO: pass in ctx
const getPersonToPersonSenderInformation = async (tenantId, targetContext, previousCommunication) => {
  const ctx = { tenantId };
  if (!(targetContext && targetContext.personId)) return undefined;

  const { from: previousSenderId, message } = previousCommunication;
  let user = await getCommonUserByEmailAddress(ctx, message.to[0]);
  if (previousSenderId !== targetContext.personId) {
    const anonymousEmailId = getAnonymousEmailIdFromEmail(message.from);
    user = anonymousEmailId && (await getCommonUserByAnonymousEmailId(ctx, anonymousEmailId));
  }

  if (!user) return undefined;

  const personId = await getPersonIdByTenantIdAndUserId(ctx, tenantId, user.id);
  return { personId, email: user.email };
};

const getProgramForTransferredCall = async (ctx, transferredFromCommId) => {
  const { teamPropertyProgramId } = await loadMessageById(ctx, transferredFromCommId);
  return teamPropertyProgramId && (await loadProgramForIncomingCommByTeamPropertyProgram(ctx, teamPropertyProgramId));
};

const getTargetContext = async (ctx, { identifiers, from, isPersonToPersonCommunication, transferredFromCommId }) => {
  const { teamId, userId, toIdentifiers, ccIdentifiers } = identifiers;
  logger.trace(
    {
      ctx,
      teamId,
      from,
      userId,
      toIdentifiers,
      ccIdentifiers,
    },
    'Get target context',
  );

  if (!isPersonToPersonCommunication) {
    const incomingProgram = transferredFromCommId && (await getProgramForTransferredCall(ctx, transferredFromCommId));
    if (teamId) return await getTargetByTeamId(ctx, teamId, incomingProgram);
    if (userId) return await getTargetByUserId(ctx, userId, incomingProgram);
  }

  const targetNotFoundError = new CommunicationTargetNotFoundError(`Communication target NOT found! to: ${toIdentifiers}, cc: ${ccIdentifiers}`);
  const getEntitiesPromise = identifier => getTargetByIdentifier(ctx, identifier, isPersonToPersonCommunication);

  const toResult = await mapSeries(toIdentifiers || [], async identifier => await getEntitiesPromise(identifier));
  const ccResult = await mapSeries(ccIdentifiers || [], async identifier => await getEntitiesPromise(identifier));

  const to = toResult.filter(r => !!r.id);
  const cc = ccResult.filter(r => !!r.id);

  if (!to.length && !cc.length) {
    logger.info({ ctx, toIdentifiers, ccIdentifiers }, 'No communication target found');
    throw targetNotFoundError;
  }

  const firstRuleMatch = getPrimaryTargetRules().find(p => p.condition(to, cc));
  if (firstRuleMatch) return firstRuleMatch.primaryTarget(to, cc);

  logger.info({ ctx }, 'No rules matched the communication target configuration');
  throw targetNotFoundError;
};

const getPartiesByTargetContext = async (ctx, { targetContext, personIds, channel }) => {
  if (targetContext.type === CommTargetType.PARTY) {
    if (!targetContext.isClosedParty && !targetContext.isArchivedParty) return [targetContext.id];
    const oldClosedParty = await getPartyBy(ctx, { id: targetContext.id });
    const activePartyIdsForUser = await getActivePartyIdsByPersonIdsAndPropertyId(ctx, personIds, oldClosedParty.assignedPropertyId);
    return activePartyIdsForUser.length > 0 ? activePartyIdsForUser : [targetContext.id];
  }

  if (targetContext.type === CommTargetType.TEAM_MEMBER) {
    const { teamId } = await getTeamMemberById(ctx, targetContext.id);
    const parties = await getPartiesByPersonIdsAndTeamIds(ctx, personIds, [teamId], true);
    return parties.filter(p => !shouldExcludeParty(p)).map(p => p.id);
  }

  if (channel === DALTypes.CommunicationMessageType.WEB) {
    const parties = await loadPartiesByPersonIds(ctx, personIds, partyWfStatesSubset.unarchived);
    return parties.filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE).map(p => p.id);
  }

  const parties = await loadPartiesByPersonIds(ctx, personIds, partyWfStatesSubset.unarchived);
  return parties.map(p => p.id);
};

const saveMissingContactInfosForPerson = async (ctx, { email, phone, shouldSaveEmail, shouldSavePhone, personId }) => {
  logger.trace({ ctx, email, phone, shouldSaveEmail, shouldSavePhone, personId }, 'saveMissingContactInfosForPerson');

  if (shouldSaveEmail) await saveContactInfo(ctx, [{ type: DALTypes.ContactInfoType.EMAIL, value: email }], personId);

  if (shouldSavePhone) await saveContactInfo(ctx, [{ type: DALTypes.ContactInfoType.PHONE, value: phone }], personId);
};

export const getPersonIdFromWebInquiryContactInfos = async (ctx, webInquiryContactInfos) => {
  logger.trace({ ctx, webInquiryContactInfos }, 'getPersonIdFromWebInquiryContactInfos');

  const { defaultEmail, defaultPhone } = webInquiryContactInfos;

  const [personByEmail] = defaultEmail ? await getPersonsBySenderData(ctx, defaultEmail) : [];
  const [personByPhone] = !!defaultPhone && looksLikeAPhoneNumber(defaultPhone) ? await getPersonsBySenderData(ctx, defaultPhone) : [];

  const { id: personId } = personByEmail || personByPhone || {};

  if (!personId) return [];

  const shouldSaveEmail = defaultEmail && !personByEmail;
  const shouldSavePhone = defaultPhone && !personByPhone;

  await saveMissingContactInfosForPerson(ctx, { personId, email: defaultEmail, phone: defaultPhone, shouldSaveEmail, shouldSavePhone });

  return [personId];
};

export const getSenderContextPersonIds = async (ctx, { from, channel, transferredFromCommId, fromName, targetContext }) => {
  if (transferredFromCommId) {
    const { persons: personIds } = await loadMessageById(ctx, transferredFromCommId);
    return personIds;
  }
  const isWebOrEmail = from && (channel === DALTypes.CommunicationMessageType.EMAIL || channel === DALTypes.CommunicationMessageType.WEB);
  const persons = isWebOrEmail || looksLikeAPhoneNumber(from) ? await getPersonsBySenderData(ctx, from) : [];

  const partyId = targetContext?.type === CommTargetType.PARTY ? targetContext.id : '';
  if (isWebOrEmail && !persons?.length && !!partyId) {
    const [personId] = await getPersonIdsByFullNameAndPartyId(ctx, partyId, cleanAndFormatName(fromName));
    personId && (await saveContactInfo(ctx, [{ type: DALTypes.ContactInfoType.EMAIL, value: from }], personId));
    return personId ? [personId] : [];
  }
  return persons.map(p => p.id);
};

const getSenderContext = async ({
  ctx,
  from,
  fromName,
  forwardedFromName,
  previousCommunication,
  targetContext,
  channel,
  transferredFromCommId,
  redialForCommId,
  webInquiryContactInfos,
}) => {
  logger.trace(
    {
      ctx,
      from,
      fromName,
      forwardedFromName,
      previousCommunication,
      targetContext,
      channel,
      redialForCommId,
      webInquiryContactInfos,
    },
    'Get sender context',
  );

  const personIds =
    channel === DALTypes.CommunicationMessageType.WEB
      ? await getPersonIdFromWebInquiryContactInfos(ctx, webInquiryContactInfos)
      : await getSenderContextPersonIds(ctx, {
          from,
          channel,
          transferredFromCommId: transferredFromCommId || redialForCommId,
          fromName,
          targetContext,
        });

  if (previousCommunication && previousCommunication.threadId) {
    const senderInformation = await getPersonToPersonSenderInformation(ctx.tenantId, targetContext, previousCommunication);
    if (senderInformation) {
      return {
        persons: [senderInformation.personId],
        from: senderInformation.email,
        fromName,
      };
    }
    return {
      persons: personIds,
      from,
      fromName,
    };
  }

  if (personIds.length) {
    return {
      persons: personIds,
      parties: [...new Set(await getPartiesByTargetContext(ctx, { targetContext, personIds, channel }))],
      from,
      fromName,
    };
  }

  return {
    persons: [],
    parties: targetContext.type === CommTargetType.PARTY ? [targetContext.id] : [],
    forwardedFromName,
    from,
    fromName,
  };
};

const getModuleContext = async (ctx, targetContext) => {
  if (targetContext.type === CommTargetType.PARTY) {
    const party = await getPartyBy(ctx, { id: targetContext.id });
    const team = await getTeamBy(ctx, { id: party.ownerTeam });
    return team.module;
  }

  if (targetContext.type === CommTargetType.INDIVIDUAL) {
    // TODO now we return the first team module
    const [firstTeam] = await getTeamsForUser(ctx, targetContext.id, true);
    return firstTeam.module;
  }

  if (targetContext.type === CommTargetType.TEAM_MEMBER) {
    const { teamId } = await getTeamMemberById(ctx, targetContext.id);
    const team = await getTeamBy(ctx, { id: teamId });
    return team.module;
  }

  if (targetContext.type === CommTargetType.TEAM) {
    // CommTargetType.TEAM is when a call is transferred to a team
    const team = await getTeamBy(ctx, { id: targetContext.id });
    return team.module;
  }

  const team = await getTeamBy(ctx, { id: targetContext.program.teamId });
  if (!team) throw new Error(`Cannot find the module context for ${targetContext}`);

  return team.module;
};

const getThreadForCommunication = async (ctx, inReplyToMessageId, channel, senderContext, redialForCommId) => {
  if (redialForCommId) {
    const baseCommForRedial = await loadMessageById(ctx, redialForCommId);
    return baseCommForRedial.threadId;
  }
  // all channels other than emails have a deterministic thread id
  if (channel !== DALTypes.CommunicationMessageType.EMAIL && senderContext.persons && senderContext.persons.length) {
    return computeThreadId(channel, senderContext.persons);
  }
  // for emails we always have a new thread except in the reply to situations
  if (!inReplyToMessageId) return newUUID();
  const previousCommunication = await getCommunicationByMessageId(ctx, inReplyToMessageId);
  return previousCommunication ? previousCommunication.threadId : newUUID();
};

const getPersonToPersonCommunication = async (ctx, messageId) => {
  const communication = await getPersonToPersonCommunicationByMessageId(ctx, messageId);
  return communication || (await getPersonToPersonCommunicationByForwardMessageId(ctx, messageId));
};

const getIlsParsedData = message => {
  const emailParserProvider = getEmailParserProvider(message);
  const { from, fromName, contactInfo, additionalFields } = emailParserProvider ? emailParserProvider.parseEmailInformation(message) : {};
  return (
    emailParserProvider && {
      from,
      fromName,
      forwardedFromName: fromName,
      leadInformation: { contactInfo, additionalFields },
      category: DALTypes.CommunicationCategory.ILS,
      isSuccessfullyParsed: !!(from || (contactInfo || {}).phone || fromName),
      providerName: emailParserProvider.providerName,
    }
  );
};

const isILSCommunication = (ctx, commData, rawMessage) => {
  const { channel, messageData } = commData;
  if (![DALTypes.CommunicationMessageType.WEB, DALTypes.CommunicationMessageType.EMAIL].includes(channel)) return false;

  return rawMessage && isInboundEmailOnIlsDomains({ ...messageData, rawMessage });
};

/*
 * getCommunicationContext
 * @param {Object} commData - object containing the required properties for fake getPostToFADV
 * @param {Object} commData.messageData - message data context
 * @param {Object} commData.messageData.to - array of identifiers for the target communication
 * @param {string} commData.messageData.from - identifier (phone/email) of the sender
 * @param {string} commData.messageData.text - text version of the email body
 * @param {Object} commData.messageData.headers - rawMessage's headers
 * @param {string} commData.messageData.fromName - Property name
 * @param {Object} commData.messageData.cc - array of identifiers
 * @param {string} commData.channel - channel of communication (email/sms/call)
 * @param {string} commData.inReplyTo - message id of previous email in the thread
 * @param {Object} rawMessage - raw message obtained from email bucket. more details see the msg property in the awsUtils/parseEmailFromMimeMessage
 * @return {Object} a communication context based on an inbound email
 */
export const getCommunicationContext = async (ctx, commData, rawMessage) => {
  const { messageData, channel, inReplyTo, transferredFromCommId, redialForCommId } = commData;
  let { from, fromName, forwardedFromName, webInquiryContactInfos, ...targetIdentifiers } = await preProcessIdentifiersFromMessage(ctx, messageData, channel);

  const personToPersonCommunication = inReplyTo && (await getPersonToPersonCommunication(ctx, inReplyTo));
  const personToPersonThreadId = personToPersonCommunication && personToPersonCommunication.threadId;
  let isPersonToPersonCommunication = !!personToPersonThreadId;
  if (!personToPersonThreadId && targetIdentifiers.toIdentifiers && targetIdentifiers.toIdentifiers.length) {
    const [email] = targetIdentifiers.toIdentifiers;
    isPersonToPersonCommunication = email && isAnonymousEmail(email, false);
  }

  let leadInformation;
  let category = DALTypes.CommunicationCategory.USER_COMMUNICATION;
  if (!inReplyTo && isILSCommunication(ctx, commData, rawMessage)) {
    const ilsEmailData = getIlsParsedData({ ...messageData, rawMessage });

    // IF successfully  parsed, then override values
    if (ilsEmailData && ilsEmailData.isSuccessfullyParsed) {
      logger.trace({ ctx, providerName: ilsEmailData.providerName }, 'ilsEmailData parsed');
      from = ilsEmailData.from;
      fromName = ilsEmailData.fromName;
      forwardedFromName = ilsEmailData.fromName;
      leadInformation = ilsEmailData.leadInformation;
      category = ilsEmailData.category;
    } else if (!isAnonymousIlsEmail(from)) {
      // else If not anonymous, then reject to dead letter
      logger.error({ ctx, msg: rawMessage, ilsEmailData }, 'Failed to set the communication context for inbound ILS email');
      throw new NoRetryError(`Message received from an ils provider and was not possible extract any information: ${JSON.stringify(ilsEmailData)}`);
    }
  }

  if (channel === DALTypes.CommunicationMessageType.SMS || channel === DALTypes.CommunicationMessageType.CALL) {
    from = getOnlyDigitsFromPhoneNumber(from);
  }

  const targetContext = await getTargetContext(ctx, { identifiers: targetIdentifiers, from, isPersonToPersonCommunication, transferredFromCommId });
  const senderContext = await getSenderContext({
    ctx,
    from,
    fromName,
    forwardedFromName,
    previousCommunication: personToPersonCommunication,
    targetContext,
    channel,
    transferredFromCommId,
    redialForCommId,
    webInquiryContactInfos,
  });

  if (isPersonToPersonCommunication) {
    return {
      targetContext,
      senderContext,
      channel,
      personToPersonThreadId,
      isPersonToPersonCommunication,
    };
  }

  const moduleContext = await getModuleContext(ctx, targetContext);

  const threadId = await getThreadForCommunication(ctx, inReplyTo, channel, senderContext, redialForCommId);
  const result = {
    targetContext,
    threadId,
    channel,
    senderContext,
    moduleContext,
    leadInformation,
    category,
    inReplyTo,
    transferredFromCommId,
    otherToIdentifiers: targetIdentifiers.otherToIdentifiers,
  };
  logger.trace({ ctx, ...result }, 'CommunicationContextProcessor result');
  return result;
};
