/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import { DALTypes } from '../../../common/enums/DALTypes';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import logger from '../../../common/helpers/logger';

import { isValidPhoneNumber } from '../../helpers/phoneUtils';
import { looksLikeAPhoneNumber } from '../../../common/helpers/phone-utils';
import { enhanceContactWithThirdPartyInfo } from '../contactEnhancerService';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { REMOVE_LEADING_AND_TRAILING_SINGLE_QUOTES } from '../../../common/regex';

export const constructCommEntry = (commContext, message, persons, parties, teamIds) => {
  // incoming calls will be marked as unread comms only if they are not answered
  const unread = commContext.channel !== DALTypes.CommunicationMessageType.CALL;
  const { messageId, transferredFromCommId, ...restOfMessage } = message;
  let commEntry = {
    message: {
      ...restOfMessage,
      otherToIdentifiers: commContext.otherToIdentifiers || [],
    },
    persons,
    unread,
    type: commContext.channel,
    direction: DALTypes.CommunicationDirection.IN,
    teams: teamIds,
    parties,
    threadId: commContext.threadId,
    category: commContext.category,
    transferredFromCommId,
    calledTeam: commContext.calledTeam,
    partyOwner: commContext.partyOwner,
    partyOwnerTeam: commContext.partyOwnerTeam,
  };

  if (commContext.channel === DALTypes.CommunicationMessageType.SMS) {
    commEntry = { ...commEntry, status: { status: [{ address: message.from, status: 'received', messageId }] } };
  } else {
    commEntry = { ...commEntry, messageId, status: { status: [{ address: message.from, status: 'received' }] } };
  }

  const program = commContext.targetContext.program;
  commEntry = program ? { ...commEntry, teamPropertyProgramId: program.teamPropertyProgramId } : commEntry;

  const originalProgram = commContext.targetContext.originalProgram;
  commEntry = originalProgram
    ? { ...commEntry, teamPropertyProgramId: originalProgram.teamPropertyProgramId, fallbackTeamPropertyProgramId: program.teamPropertyProgramId }
    : commEntry;

  return commContext.channel === DALTypes.CommunicationMessageType.EMAIL && commContext.category === DALTypes.CommunicationCategory.ILS
    ? { ...commEntry, type: DALTypes.CommunicationMessageType.WEB }
    : commEntry;
};

const getPhoneInfoIfPossible = (leadInformation = {}) => {
  const { phone } = leadInformation.contactInfo || {};
  return phone && isValidPhoneNumber(phone) ? phone : '';
};

const getQualificationQuestions = (leadInformation = {}) => {
  const { qualificationQuestions } = leadInformation.additionalFields || {};
  return qualificationQuestions;
};

const constructPersonDataFromEmailMessage = (senderContext, message, leadInformation = {}) => {
  const fullName = senderContext.forwardedFromName || senderContext.fromName || message.from_name;
  const namesGroups = REMOVE_LEADING_AND_TRAILING_SINGLE_QUOTES.exec(fullName);
  let formattedName = namesGroups?.length ? namesGroups[1] : fullName;
  if (formattedName === DALTypes.CommunicationIgnoreFields.FULLNAME) formattedName = null;
  const email = senderContext.from === DALTypes.CommunicationIgnoreFields.EMAIL ? '' : senderContext.from;
  const phone = getPhoneInfoIfPossible(leadInformation);
  const contactInfo = enhance([...((email && [{ type: 'email', value: email }]) || []), ...((phone && [{ type: 'phone', value: phone }]) || [])], {
    shouldCleanUpPhoneNumbers: true,
  });

  return {
    fullName: formattedName,
    preferredName: '',
    contactInfo,
    qualificationQuestions: message.questions || getQualificationQuestions(leadInformation),
  };
};

const parseContextFrom = contextFrom => {
  const fullNameIsPhone = looksLikeAPhoneNumber(contextFrom);
  const fullName = fullNameIsPhone ? '' : contextFrom;
  const contactInfo = fullNameIsPhone ? enhance([{ type: 'phone', value: contextFrom }]) : null;

  return { fullName, contactInfo };
};

const constructPersonDataFromPhoneCallOrSMS = (senderContext, message) => {
  const { fullName, contactInfo } = parseContextFrom(senderContext.from);

  return {
    fullName,
    preferredName: '',
    contactInfo,
    qualificationQuestions: message.questions,
  };
};

export const constructPersonDataFromMessage = (channel, senderContext, message, leadInformation = {}) => {
  switch (channel) {
    case DALTypes.CommunicationMessageType.EMAIL:
      return constructPersonDataFromEmailMessage(senderContext, message, leadInformation);
    case DALTypes.CommunicationMessageType.SMS:
      return constructPersonDataFromPhoneCallOrSMS(senderContext, message);
    case DALTypes.CommunicationMessageType.CALL:
      return constructPersonDataFromPhoneCallOrSMS(senderContext, message);
    default:
      throw new Error(`Unable to construct person data. Channel ${channel} not implemented`);
  }
};

export const enhancePersonData = async (ctx, lead, from) => {
  const pm = lead.partyMembers[0];
  const person = {
    id: pm.personId,
    fullName: pm.fullName,
    contactInfo: pm.contactInfo,
  };

  const personInfoToLog = pick(person, ['id', 'fullName']);

  logger.debug({ ctx, person: personInfoToLog }, 'enhancePersonData');
  const enhancedParams = { callerName: true, carrier: true };
  const updatedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, enhancedParams, from);
  logger.trace({ ctx, person: personInfoToLog }, 'enhancePersonData updated person to');

  if (lead.userId) {
    notify({
      ctx,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId: lead.id },
      routing: { teams: lead.teams },
    });
  }

  return updatedPerson;
};
