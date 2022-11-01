/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import { getGuestContactInfo, getGuestDefaultContactInfo } from './webInquiryService';
import { isContactBlacklisted, saveSpamCommunication as saveSpamCommunicationDb } from '../dal/blacklistRepo';
import { isValidPhoneNumber } from '../helpers/phoneUtils';
import { isEmailValid } from '../../common/helpers/validations/email';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'blacklist' });

const convertFromMessageTypeToContactInfoType = commChannelType => {
  switch (commChannelType) {
    case DALTypes.CommunicationMessageType.SMS:
    case DALTypes.CommunicationMessageType.CALL:
      return DALTypes.ContactInfoType.PHONE;
    case DALTypes.CommunicationMessageType.EMAIL:
      return DALTypes.ContactInfoType.EMAIL;
    default:
      throw new Error(`Communication channel ${commChannelType} is not yet implemented`);
  }
};

export const isSpamCommunication = async (ctx, contextData) => {
  const { channel: messageType } = contextData.communicationContext;
  const contactInfoType = convertFromMessageTypeToContactInfoType(messageType);
  const from = contextData.from || contextData.communicationContext.senderContext.from;
  const isBlacklisted = await isContactBlacklisted(ctx, contactInfoType, from);

  if (isBlacklisted) {
    logger.trace(
      { ctx, messageId: contextData.message?.messageId, messageType, contactInfoType, from, isBlacklisted },
      'communication is spam, contact info is blacklisted',
    );
  }

  return isBlacklisted;
};

export const saveSpamCommunication = async (ctx, contextData) => {
  const { channel: messageType } = contextData.communicationContext;
  const from = contextData.communicationContext.senderContext.from;

  const spamCommunication = {
    from,
    type: messageType,
    message: contextData.message,
  };

  await saveSpamCommunicationDb(ctx, spamCommunication);
};

export const checkForSpamContactInfoWebInquiry = async (ctx, data) => {
  const { phone, email } = data;

  const contactInfo = getGuestContactInfo(phone, email);

  const phoneContext = { channel: DALTypes.CommunicationMessageType.SMS, senderContext: { from: contactInfo.defaultPhone } };
  const isSpamPhoneContactInfo = isValidPhoneNumber(phone) ? await isSpamCommunication(ctx, { communicationContext: phoneContext }) : false;

  const emailContext = { channel: DALTypes.CommunicationMessageType.EMAIL, senderContext: { from: contactInfo.defaultEmail } };
  const isSpamEmailContactInfo = isEmailValid(email) ? await isSpamCommunication(ctx, { communicationContext: emailContext }) : false;

  if (isSpamEmailContactInfo) {
    await saveSpamCommunicationDb(ctx, { from: getGuestDefaultContactInfo(contactInfo), type: DALTypes.CommunicationMessageType.WEB, message: data });
    logger.trace({ ctx, contactInfo: contactInfo.defaultEmail }, 'Self service request with spam email');
    return { isSpam: true };
  }

  isSpamPhoneContactInfo &&
    !isSpamEmailContactInfo &&
    logger.warn({ ctx, contactInfo: contactInfo.defaultPhone }, 'Self service request from spam phone number, but valid email');

  return { isSpam: false };
};
