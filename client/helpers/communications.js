/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import Immutable from 'immutable';
import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';
import max from 'lodash/max';
import v4 from 'uuid/v4';
import capitalize from 'lodash/capitalize';
import { replaceTemplatedValues, isCommAnOutgoingDirectMessage } from '../../common/helpers/utils';
import { MONTH_DATE_YEAR_LONG_FORMAT } from '../../common/date-constants';
import { DALTypes } from '../../common/enums/DALTypes';
import { getDisplayName } from '../../common/helpers/person-helper';
import { formatPhone } from '../../common/helpers/phone-utils';
import { toMoment, formatMoment } from '../../common/helpers/moment-utils';
import { formatTimestamp } from '../../common/helpers/date-utils';
import { formatPhoneNumber } from './strings';
import { MULTIPLE_REPLY_PREFIXES } from '../../common/regex';

export const getAgentsInvolvedInCall = ({ mostRecentCall, calls, parties, users }) => {
  if (!mostRecentCall) return [];

  const transferredToDisplayName = mostRecentCall.message.transferredToDisplayName;
  if (transferredToDisplayName) return [transferredToDisplayName];

  const getAgents = call => {
    const user = call.userId && users.get(call.userId);
    if (user) return [user.fullName];

    return call.parties
      .map(id => parties.get(id))
      .filter(p => !!p)
      .map(p => users.get(p.userId))
      .filter(u => !!u)
      .map(u => u.fullName);
  };

  const getTransferrers = (call, agentsSoFar) => {
    const transferredFromCall = call.transferredFromCommId && calls.find(c => c.id === call.transferredFromCommId);

    if (transferredFromCall) {
      const newAgentsSoFar = [...agentsSoFar, ...getAgents(transferredFromCall)];
      return getTransferrers(transferredFromCall, newAgentsSoFar);
    }
    return agentsSoFar;
  };

  const agents = getAgents(mostRecentCall);
  return uniq(getTransferrers(mostRecentCall, agents));
};

export const getCallOwner = ({ call, partyId, parties, users }) => {
  if (call.message.transferredToDisplayName) {
    return call.message.transferredToDisplayName;
  }
  const callUser = call.userId && users.get(call.userId);
  if (callUser) return callUser.fullName;

  const party = partyId && parties.get(partyId);
  const partyUser = party && users.get(party.userId);
  if (partyUser) return partyUser.fullName;

  const partiesUsers = call.parties
    .map(id => parties.get(id))
    .filter(p => !!p)
    .map(p => users.get(p.userId))
    .filter(u => !!u)
    .map(u => u.fullName);

  return uniq(partiesUsers).join(', ');
};

export const getMostRecentCommunication = comms =>
  comms && comms.length ? comms.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)))[0] : undefined;

export const isLastCommUnreadByUser = comms => {
  if (!comms || comms.length === 0) return true;

  const allCommsExceptOutgoingDirectMessages = comms.filter(comm => !isCommAnOutgoingDirectMessage(comm));
  const mostRecentComm = getMostRecentCommunication(allCommsExceptOutgoingDirectMessages);

  return mostRecentComm ? mostRecentComm.unread : false;
};

export const getCommunicationParticipants = (direction, participants) => {
  if (!participants || !participants.length) return '';
  const concatenated = participants.map(p => getDisplayName(p)).join(', ');
  return direction === DALTypes.CommunicationDirection.OUT ? `${concatenated}, ${t('ME')}` : concatenated;
};

const getBounceMessage = (bouncedAddresses, participants, label, isSMS) => {
  const participantsArray = participants.constructor === Array ? participants : participants.toArray();
  const boucedInfoWithNames = bouncedAddresses.map(address => {
    const participant = participantsArray.find(p => (isSMS ? p.contactInfo.defaultPhone === address : p.contactInfo.defaultEmail === address));
    const formattedAddress = isSMS ? formatPhoneNumber(address) : `<${address}>`;
    return participant ? `${getDisplayName(participant)} ${formattedAddress}` : `${formattedAddress}`;
  });
  return `${t(label)} ${boucedInfoWithNames.join(', ')}`;
};

export const getEmailBounceMessage = (communication, participants) => {
  if (!communication.status) return '';

  const bouncedEmailAddresses = communication.status.status.filter(s => s.status === DALTypes.CommunicationStatus.BOUNCED).map(s => s.address);
  if (bouncedEmailAddresses.length === 0) return '';
  return getBounceMessage(bouncedEmailAddresses, participants, 'BOUNCE_EMAIL_WARNING');
};

export const getSMSFailMessage = (communication, participants) => {
  if (!communication.status) return '';

  const bouncedNumbers = communication.status.status
    .filter(s => s.status === DALTypes.CommunicationStatus.UNDELIVERED || s.status === DALTypes.CommunicationStatus.FAILED)
    .map(s => s.address);
  if (bouncedNumbers.length === 0) return '';

  return getBounceMessage(bouncedNumbers, participants, 'BOUNCE_SMS_WARNING', true);
};

export const isGroupMessageDelivered = communication => {
  if (communication.category !== DALTypes.PostCategory.ANNOUNCEMENT && communication.category !== DALTypes.PostCategory.EMERGENCY) return true;

  const deliveredComms = communication.status.status.filter(s => s.status === DALTypes.CommunicationStatus.DELIVERED);

  return deliveredComms.length > 0;
};

export const getPersonDisplayName = (personId, participants) => {
  const participant = participants.find(p => p.id === personId);
  return getDisplayName(participant);
};

export const groupByThreadAndSort = communications => {
  const grouped = communications.reduce((acc, comm) => {
    const { ...temp } = acc;
    temp[comm.threadId] = {
      threadId: comm.threadId,
      comms: temp[comm.threadId] ? [...temp[comm.threadId].comms, comm] : [comm],
      type: comm.type,
    };
    return temp;
  }, {});

  const groupedMap = new Immutable.Map(grouped);
  const maxCreatedAt = thread => max(thread.comms.map(c => c.created_at));

  return groupedMap.sort((a, b) => {
    const maxB = toMoment(maxCreatedAt(b));
    const maxA = toMoment(maxCreatedAt(a));
    return maxB.diff(maxA);
  });
};

export const getRecipientsForEmailDropDown = (partyMembers, persons) => {
  const members = partyMembers.filter(pm => persons.find(pers => pm.personId === pers.id));
  const recipientsMap = members.reduce((acc, item) => {
    const person = persons.find(p => p.id === item.personId);
    const emails = person.contactInfo.emails || [];
    const newItems = emails.length
      ? emails.map(email => ({
          id: email.id,
          memberType: item.memberType,
          name: getDisplayName(person),
          value: email.value,
          isPrimary: email.isPrimary,
        }))
      : [
          {
            id: v4(), // just to make react happy so it renders all the elements
            memberType: item.memberType,
            name: getDisplayName(person),
            value: t('EMAIL_MISSING'),
            disabled: true,
          },
        ];
    acc.set(item.memberType, {
      id: item.memberType,
      name: item.memberType,
      items: [...((acc.get(item.memberType) || {}).items || []), ...newItems],
    });
    return acc;
  }, new Map());
  return [...recipientsMap.values()];
};

const getFlattenedCommPersons = comms => uniq(flatten(comms.map(comm => comm.persons)));

export { getFlattenedCommPersons };

export const isWebInquiry = comm => {
  const webInquiryCategories = [
    DALTypes.CommunicationCategory.WEB_CONTACT,
    DALTypes.CommunicationCategory.WEB_APPLICATION,
    DALTypes.CommunicationCategory.WEB_APPOINTMENT,
    DALTypes.CommunicationCategory.WEB_QUOTE,
    DALTypes.CommunicationCategory.WEB_CANCEL_APPOINTMENT,
    DALTypes.CommunicationCategory.WEB_DECLINE_APPOINTMENT,
  ];
  return comm?.category && webInquiryCategories.includes(comm.category);
};

export const webInquiryText = {
  [DALTypes.CommunicationCategory.WEB_CONTACT]: {
    title: 'WEBSITE_INQUIRY',
    description: 'MOVE_IN_DATE_RANGE',
  },
  [DALTypes.CommunicationCategory.WEB_APPLICATION]: {
    title: 'APPLICATION_SENT',
    description: 'APPLICATION_LINK_SENT',
  },
  [DALTypes.CommunicationCategory.WEB_APPOINTMENT]: {
    title: 'SELF_BOOK_APPOINTMENT_TITLE',
    description: ['SELF_BOOK_APPOINTMENT_FOR', 'SELF_BOOK_APPOINTMENT_ON_DATE'],
  },
  [DALTypes.CommunicationCategory.WEB_QUOTE]: {
    title: 'QUOTE_SENT',
    description: 'SELF_QUOTE_FOR_APARTMENT',
  },
  [DALTypes.CommunicationCategory.WEB_CANCEL_APPOINTMENT]: {
    title: 'CANCEL_APPOINTMENT_TITLE',
    description: 'CANCEL_APPOINTMENT_DESCRIPTION',
  },
  [DALTypes.CommunicationCategory.WEB_DECLINE_APPOINTMENT]: {
    title: 'DECLINE_APPOINTMENT_TITLE',
    description: 'DECLINE_APPOINTMENT_DESCRIPTION',
  },
};

export const getWebInquiryHeaderFromComm = comm => {
  const source = comm && comm.source;
  if (source && isWebInquiry(comm)) {
    return `[${source}] ${t(webInquiryText[comm.category].title)}`;
  }

  if (
    isWebInquiry(comm) &&
    (comm?.category === DALTypes.CommunicationCategory.WEB_CANCEL_APPOINTMENT || comm?.category === DALTypes.CommunicationCategory.WEB_DECLINE_APPOINTMENT)
  ) {
    return `${t(webInquiryText[comm.category].title)}`;
  }
  return t('WEBSITE_INQUIRY');
};

const getDescriptionForAppointmentCancelOrDecline = (appointment, timezone, category) => {
  const appointmentCancelRejectDate = appointment?.updated_at;
  const dateTime = formatTimestamp(appointmentCancelRejectDate, { timezone });
  return t(webInquiryText[category].description, { dateTime });
};

export const getWebInquiryDescription = (comm, timezone) => {
  const commMessageData = comm?.message?.rawMessageData;
  switch (comm.category) {
    case DALTypes.CommunicationCategory.WEB_CONTACT: {
      const moveInRange = commMessageData?.qualificationQuestions?.moveInTime;
      return moveInRange ? t(webInquiryText[comm.category].description, { moveInRange: t(moveInRange) }) : '';
    }
    case DALTypes.CommunicationCategory.WEB_APPOINTMENT: {
      const appointmentStartDate = commMessageData?.requestAppointment?.startDate;
      const dateTime = formatTimestamp(appointmentStartDate, { timezone });
      const inventoryFullQualifiedName = commMessageData?.requestAppointment?.inventoryFullQualifiedName;

      if (appointmentStartDate && inventoryFullQualifiedName) {
        return t(webInquiryText[comm.category].description[0], { inventoryFullQualifiedName, dateTime });
      }
      if (appointmentStartDate) {
        return t(webInquiryText[comm.category].description[1], { dateTime });
      }
      return '';
    }
    case DALTypes.CommunicationCategory.WEB_QUOTE: {
      const unitId = commMessageData?.requestQuote?.unitQualifiedName || commMessageData?.unitId;
      return unitId ? t(webInquiryText[comm.category].description, { unitId }) : '';
    }
    case DALTypes.CommunicationCategory.WEB_APPLICATION: {
      return t(webInquiryText[comm.category].description);
    }
    case DALTypes.CommunicationCategory.WEB_CANCEL_APPOINTMENT: {
      return getDescriptionForAppointmentCancelOrDecline(commMessageData?.appointment, timezone, comm.category);
    }
    case DALTypes.CommunicationCategory.WEB_DECLINE_APPOINTMENT: {
      return getDescriptionForAppointmentCancelOrDecline(commMessageData?.appointment, timezone, comm.category);
    }
    default:
      return '';
  }
};

export const getCommHeaderPrefix = message => {
  const isSelfServiceMessage = !!message.requestQuote;
  return isSelfServiceMessage ? `${t('SELF_SERVE_PREFIX')} ` : '';
};

const getPropertyNameForEmailSignature = (loggedInUser, associatedPropertyOfParty, outgoingCampaign) => {
  if (outgoingCampaign) return outgoingCampaign.propertyDisplayName;
  if (associatedPropertyOfParty) return associatedPropertyOfParty;

  // In case we are not in the context of a party, only display property if the user is associated with a single one, to avoid confusion.
  return loggedInUser.associatedProperties && loggedInUser.associatedProperties.length === 1 ? loggedInUser.associatedProperties[0].displayName : '';
};

// output shape:
//
// Margaret Krivoruchko
// Sales Associate
//
// Parkmerced Apartments
// (202) 555-0120
// rentnow@parkmerced.com
//
export const getEmailSignature = (loggedInUser, propertyName, outgoingProgram) => {
  const signatureTemplate = `\n\n${loggedInUser.communicationDefaultEmailSignature}`;
  const propertyDisplayName = getPropertyNameForEmailSignature(loggedInUser, propertyName);
  return signatureTemplate
    .replace('%fullName%', loggedInUser.fullName)
    .replace('%businessTitle%', loggedInUser.metadata.businessTitle)
    .replace('%primaryPropertyName%', propertyDisplayName || '')
    .replace('%primaryPropertyTeam_phone%', formatPhone(outgoingProgram.displayPhoneNumber) || '')
    .replace('%primaryPropertyTeam_email%', outgoingProgram.displayEmail || '');
};

export const buildDataSendSMSQuote = (quote, inventory, partyMembers, partyId, model, quoteSmsTemplate) => {
  const type = DALTypes.CommunicationMessageType.SMS;
  const contactInfos = partyMembers.map(member => member.person.contactInfo.defaultPhoneId);
  const recipients = {
    contactInfos,
  };
  const templateData = {
    template: quoteSmsTemplate || '',
    commonData: {
      inventoryName: inventory.name,
      propertyName: inventory.property.displayName,
      expirationDate: formatMoment(model.expirationDate, { format: MONTH_DATE_YEAR_LONG_FORMAT, timezone: model.propertyTimezone }),
      inventoryType: capitalize(inventory.type),
      quoteId: model.id,
    },
    recipients: partyMembers,
  };
  const text = replaceTemplatedValues(quoteSmsTemplate, templateData.commonData);
  const message = {
    content: text,
    unread: false,
  };
  return { recipients, message, type, partyId, quote, templateData };
};

export const getCommunicationPlaceholderMessage = ({ areCommsDisabled, isActiveLeaseParty, isEmail = false, daysToRouteToALPostMoveout }) => {
  if (areCommsDisabled) {
    return isActiveLeaseParty ? t('DISABLED_REPLIES_MESSAGE_AL', { days: daysToRouteToALPostMoveout }) : t('DISABLED_REPLIES_MESSAGE');
  }

  return !isEmail ? t('SMS_CARD_WRITE_MESSAGE') : t('TYPE_A_REPLY_MESSAGE');
};

export const removeMultipleReplyPrefixes = subject => subject.replace(MULTIPLE_REPLY_PREFIXES, `${t('REPLY_ACRONYM')} `);

export const getCommEmailsToReply = (lastComm, persons) => {
  if (!lastComm) {
    return persons.reduce((acc, person) => {
      const defaultEmailId = person.contactInfo.defaultEmailId;
      acc.push(defaultEmailId);
      return acc;
    }, []);
  }

  const inReplyPersons = lastComm.persons.map(p => persons.get(p));
  const allContactInfo = inReplyPersons.reduce((acc, person) => {
    const contactInfo = person.contactInfo.emails;
    contactInfo.map(ci => acc.push(ci));
    return acc;
  }, []);

  const replyInfo =
    lastComm.direction === DALTypes.CommunicationDirection.IN
      ? [lastComm.message.from.toLowerCase()]
      : lastComm.message.to.map(address => address.toLowerCase());

  return (allContactInfo.filter(ci => replyInfo.includes(ci.value.toLowerCase())) || []).map(ci => ci.id);
};
