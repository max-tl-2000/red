/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { getS3Mail, deleteS3Mail } from './aws/awsUtils';
import { getCommunicationContext } from '../../services/routing/communicationContextProcessor';
import { processIncomingCommunication } from '../../services/routing/incomingCommunicationProcessor';
import { shouldIgnoreProgram } from '../../services/routing/targetProcessorHelpers';
import { getEmailAddressWithoutDomain, formatTenantEmailDomain, getNewFromEmailAddress } from '../../../common/helpers/utils';
import { getTenantFromEmailAddress } from './emailProcessingService';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { getPartyOwnersByPartyIds } from '../../dal/partyRepo';
import { getCommunicationByMessageId } from '../../dal/communicationRepo';

import { NoRetryError } from '../../common/errors';
import { DALTypes } from '../../../common/enums/DALTypes';
import config from '../../config';
import logger from '../../../common/helpers/logger';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import { outboundEmailFromForwardingCommunication } from './emailHandlers';
import { saveForwardedCommunications } from '../../dal/forwardedCommunicationsRepo';
import { isProgramForwarding } from './helpers/communicationForwardingHelper';
import { formatPhoneToDisplay } from '../../../common/helpers/phone/phone-helper';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { EMAIL_UNIQUE_CONSTRAINT_ERROR, DUPLICATE_EMAIL_TIME_INTERVAL_MIN, CONTACT_INFO_CONSTRAINT_ERROR } from '../../helpers/mails';

let getEmailDetailsFunction = getS3Mail;
let getDeleteS3MailFunction = deleteS3Mail;
export const setGetEmailDetailsFunction = f => {
  getEmailDetailsFunction = f;
};
export const setDeleteS3MailFunction = f => {
  getDeleteS3MailFunction = f;
};

export const resetEmailMocks = () => {
  getEmailDetailsFunction = getS3Mail;
  getDeleteS3MailFunction = deleteS3Mail;
};

const getToEmailForProgram = (tenantCtx, program, isFromSMS) => {
  const commsForwardingData = program.metadata?.commsForwardingData;
  if (commsForwardingData.forwardingEnabled) {
    return isFromSMS ? commsForwardingData.forwardSMSToExternalTarget : commsForwardingData.forwardEmailToExternalTarget;
  }
  return [`${program.directEmailIdentifier}@${formatTenantEmailDomain(tenantCtx.tenantName, config.mail.emailDomain)}`];
};

const constructMessageData = (msg, communicationContext, tenantCtx) => ({
  text: msg.text,
  subject: msg.subject,
  from: communicationContext.senderContext.from,
  fromName: communicationContext.senderContext.fromName,
  to: communicationContext.targetContext.program ? getToEmailForProgram(tenantCtx, communicationContext.targetContext.program) : msg.emails,
  messageId: getEmailAddressWithoutDomain(msg.messageId),
  rawMessage: msg,
});

const constructMessageDataEmailForwarding = (msg, communicationContext, tenantCtx, isFromSMS) => {
  const message = {
    text: msg.text || msg.Text,
    subject: msg.subject || t('FORWARDED_FROM_REVA_SUBJECT'),
    fromName: communicationContext.senderContext.fromName || communicationContext.senderContext.from,
    to: getToEmailForProgram(tenantCtx, communicationContext.targetContext.program, isFromSMS),
    rawMessage: { ...msg, replyTo: communicationContext.senderContext.from },
  };

  if (!isFromSMS) {
    message.replyTo = communicationContext.senderContext.from;
    message.from = getNewFromEmailAddress(tenantCtx, communicationContext.senderContext.fromName, config);
    message.messageId = getEmailAddressWithoutDomain(msg.messageId);
    message.text = t('FORWARD_EMAIL_TEMPLATE', { from: message.replyTo, name: message.fromName, text: message.text });
  } else {
    const formattedFromPhoneNumber = formatPhoneToDisplay(message.fromName);
    message.text = t('FORWARD_SMS_TEMPLATE', { from: formattedFromPhoneNumber, text: message.text });
    message.from = `${formattedFromPhoneNumber.replace(/\(|\)|\+/g, '')} <noreply@${formatTenantEmailDomain(tenantCtx.tenantName, config.mail.emailDomain)}>`;
    message.messageId = msg.MessageUUID;
  }

  return message;
};

const parseReplyTo = replyTo => {
  /* ""jean-luc picard" <jean.luc.picard@reva.tech>" */
  let replyToName = '';
  let replyToEmail = '';

  if (replyTo) {
    let matches = replyTo.match('(.*)<(.+@.+)>');
    if (matches) {
      replyToName = matches[1];
      replyToEmail = matches[2];
    } else {
      // IF no matches, it may mean that the sender just sends the email (Zillow does that for ex) wihtout the '<' and '>' symbols
      matches = replyTo.match('(.+@.+)');
      if (matches) {
        replyToEmail = matches[1];
      } else {
        logger.error(`Reply-to header could not be parsed:  ${replyTo}`);
      }
    }
  }

  return {
    replyToName: replyToName.replace(/"/gi, '').trim(),
    replyToEmail: replyToEmail.replace(/"/gi, '').trim(),
  };
};

export const constructDataForDeterminingContext = msg => {
  const { replyToName, replyToEmail } = parseReplyTo(msg.replyTo);
  return {
    messageData: {
      to: msg.emails,
      from: replyToEmail || msg.from_email,
      text: msg.text,
      headers: msg.headers,
      fromName: replyToName || msg.from_name,
      cc: msg.cc,
    },
    channel: DALTypes.CommunicationMessageType.EMAIL,
    inReplyTo: msg.inReplyTo,
  };
};

const validateSender = (msg, domainToExclude) => {
  const from = msg.messageData.from;
  if (from && from.match(domainToExclude)) {
    throw new NoRetryError(`Message received from within REVA domain: ${JSON.stringify(msg)}`);
  }
};

const determineContext = async (originalCtx, { msg, event }) => {
  if (!msg || !msg.emails) throw new NoRetryError(`invalid event. msg: ${msg}`);
  if (event !== 'inbound') {
    throw new NoRetryError(`invalid event type: ${event}`);
  }

  const revaEmailDomain = config.mail.emailDomain;
  const emailForDeterminingTenant = [...msg.emails, ...(msg.cc || [])].find(email => email.match(revaEmailDomain));
  const X_FORWARDED_TO = 'x-forwarded-to';
  let tenant = (await getTenantFromEmailAddress(emailForDeterminingTenant)) || (msg.headers && (await getTenantFromEmailAddress(msg.headers[X_FORWARDED_TO])));

  let msgForContext = { ...msg };
  if (!tenant) {
    const receivedFor = msg.receivedFor;
    tenant = receivedFor.match(revaEmailDomain) && (await getTenantFromEmailAddress(receivedFor));
    if (!tenant) {
      logger.error({ msg }, 'Error while trying to determine tenant for incoming email');
      throw new NoRetryError('inexistent tenant');
    }
    // if we got here it means that the only way to determine the recipient was from
    // receivedFor field.
    msgForContext = {
      ...msg,
      emails: [receivedFor],
    };
  }
  const ctx = { ...originalCtx, tenantId: tenant.id, tenantName: tenant.name };

  return { ctx, msgForContext };
};

export const handleEmailForwarding = async (ctx, communicationContext, msgForContext, isFromSMS) => {
  const program = communicationContext.targetContext.program;
  const commsForwardingData = program.metadata.commsForwardingData;
  logger.trace({ ctx, programId: communicationContext.targetContext.id, commsForwardingData, isFromSMS }, 'Forwarding received email');
  const message = constructMessageDataEmailForwarding(msgForContext, communicationContext, ctx, isFromSMS);

  const { processed, result } = await outboundEmailFromForwardingCommunication(ctx, message);

  if (!processed) return false;

  const forwardedCommunication = {
    type: isFromSMS ? DALTypes.CommunicationMessageType.SMS : DALTypes.CommunicationMessageType.EMAIL,
    messageId: result.MessageId,
    programId: program.id,
    programContactData: isFromSMS ? program.directPhoneIdentifier : program.directEmailIdentifier,
    message,
    forwardedTo: isFromSMS ? commsForwardingData.forwardSMSToExternalTarget : commsForwardingData.forwardEmailToExternalTarget,
    receivedFrom: isFromSMS ? message.fromName : message.replyTo,
  };
  await saveForwardedCommunications(ctx, forwardedCommunication);

  return true;
};

const handleReceivedMail = async ({ ctx, msg, msgForContext, attachments } = {}) => {
  const contextData = constructDataForDeterminingContext(msgForContext);

  const revaEmailDomain = config.mail.emailDomain;
  validateSender(contextData, revaEmailDomain);

  const communicationContext = await getCommunicationContext(ctx, contextData, msg);
  if (shouldIgnoreProgram({ communicationContext })) return true;

  if (isProgramForwarding(communicationContext)) return await handleEmailForwarding(ctx, communicationContext, msgForContext);

  const { communication: savedMessage, isSpam } = await processIncomingCommunication(ctx, {
    communicationContext,
    unread: true,
    message: constructMessageData(msgForContext, communicationContext, ctx),
    attachments,
  });

  if (isSpam) return true;

  try {
    const userIds = await getPartyOwnersByPartyIds(ctx, savedMessage.parties);
    notify({
      ctx,
      event: eventTypes.MAIL_RECEIVED,
      routing: { users: userIds },
    });
    await notifyCommunicationUpdate(ctx, savedMessage);
  } catch (ex) {
    logger.warn({ ctx, ex }, 'Handle Received Mail -> unable to notify clients');
  }
  return true;
};

const deleteMail = async (ctx, params) => {
  const { deleteEmailAfterProcessing = true } = config.mail;
  if (deleteEmailAfterProcessing) await getDeleteS3MailFunction(ctx, params);
};

export const inboundMailReceived = async params => {
  const { msgCtx } = params;
  logger.trace({ ctx: msgCtx, params }, 'Inbound mail received');

  if (params.fakeEmail) {
    const { emails } = params.fakeEmail && params.fakeEmail.msg;
    const tenant = await getTenantFromEmailAddress((emails && emails.length && emails[0]) || '');
    const cucumberRun = (config.cloudEnv || '').includes('cucumber') || tenant.name === 'cucumber';
    if (cucumberRun) {
      setGetEmailDetailsFunction(() => params.fakeEmail);
      setDeleteS3MailFunction(() => true);
    }
  }

  const parsedEmail = await getEmailDetailsFunction({ ctx: msgCtx }, params);
  if (parsedEmail.alreadyProcessed) return { processed: true };

  const emailLogData = {
    emailMessageId: parsedEmail.msg.messageId,
    emailSubject: parsedEmail.msg.subject,
    emailFrom: parsedEmail.msg.from_email,
    emailReceivedFor: parsedEmail.msg.receivedFor,
    attachments: (parsedEmail.attachments || []).map(a => ({
      filename: a.filename,
    })),
  };

  logger.debug({ ctx: msgCtx, emailLogData }, 'Inbound email details');

  const { ctx, msgForContext } = await determineContext(msgCtx, parsedEmail);

  try {
    await handleReceivedMail({ ctx, ...parsedEmail, msgForContext });
    await deleteMail(ctx, params);
    return { processed: true };
  } catch (error) {
    if (error.toString().includes(EMAIL_UNIQUE_CONSTRAINT_ERROR)) {
      const existingMessage = await getCommunicationByMessageId(ctx, parsedEmail.msg.messageId);

      if (now().diff(toMoment(existingMessage.created_at), 'minutes') < DUPLICATE_EMAIL_TIME_INTERVAL_MIN) {
        logger.trace({ ctx, params, error }, 'The email was already processed');
        // there was a timeout when it was processed the first time or we received the same message multiple times
        await deleteMail(ctx, params);
        return { processed: true };
      }
    } else if (error.toString().includes(CONTACT_INFO_CONSTRAINT_ERROR)) {
      logger.warn({ ctx, params, error }, 'Same email was probably received twice');

      await deleteMail(ctx, params);
      return { processed: true };
    }

    logger.error({ ctx, params, error }, 'inboundMailReceived - error');
    throw error;
  }
};
