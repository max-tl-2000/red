/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import uuid from 'uuid/v4';
import { t } from 'i18next';
import { getTenantData } from '../../dal/tenantsRepo';
import { updateMessages } from '../../dal/communicationRepo';
import { getPartyOwnersByPartyIds } from '../../dal/partyRepo';
import { handleMessageStatusChange } from './helpers/statusChangeHelper';
import eventTypes from '../../../common/enums/eventTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { notify } from '../../../common/server/notificationClient';
import { OperationResultType } from '../../../common/enums/enumHelper';
import { getTelephonyOps } from '../../services/telephony/providerApiOperations';
import { getCommunicationContext } from '../../services/routing/communicationContextProcessor';
import { shouldIgnoreProgram } from '../../services/routing/targetProcessorHelpers';
import loggerModule from '../../../common/helpers/logger';
import { processIncomingCommunication } from '../../services/routing/incomingCommunicationProcessor';
import { loadPartyById } from '../../services/party';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import * as eventService from '../../services/partyEvent';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { isProgramForwarding } from './helpers/communicationForwardingHelper';
import { isUnformattedPhoneLikeValue } from '../../helpers/phoneUtils';
import { saveForwardedCommunications } from '../../dal/forwardedCommunicationsRepo';
import { handleEmailForwarding } from './inboundEmailHandler';
import { formatPhoneToDisplay } from '../../../common/helpers/phone/phone-helper';

const logger = loggerModule.child({ subType: 'comms' });

const forwardedSmsRegex = RegExp(/FWD\+(\d+):(.*)/);
const isForwardedSms = ({ Text: fwdMessage }) => forwardedSmsRegex.test(fwdMessage);
const parseForwardedSms = ({ Text: fwdMessage }) => {
  const [_fullText, from, text] = forwardedSmsRegex.exec(fwdMessage);
  return { from, text: text.trim() };
};
const isSMS = ({ Type: messageType }) => !messageType || messageType === DALTypes.CommunicationMessageType.SMS.toLocaleLowerCase();

const getFromAndMessageForReceivedSms = msg => (isForwardedSms(msg) ? parseForwardedSms(msg) : { from: msg.From, text: isSMS(msg) ? msg.Text : msg.Body });

const constructDataForDeterminingContext = msg => {
  const { from } = getFromAndMessageForReceivedSms(msg);

  return {
    messageData: {
      to: [msg.To],
      cc: [],
      from,
    },
    channel: DALTypes.CommunicationMessageType.SMS,
  };
};

const isMessageTooLong = response => response && response.includes('text parameter length exceeds');

const trySend = async (ctx, msg, sms) => {
  try {
    logger.debug({ ctx, msg }, 'plivoSendSms - calling plivoAPI');

    // Plivo responds only with a list of uuids (messageUuid is a list),
    // but based on https://support.plivo.com/support/tickets/409976 we don't know which uuid correspond to which number
    // the messageId will be set when we receive the status notification from Plivo (function: outboundSmsStatusUpdate)
    // {
    //   id: [
    //    'b0ab735a-9672-11e9-a079-0242ac110006',
    //    'b0ad137c-9672-11e9-a079-0242ac110006',
    //   ],
    //   apiId: 'b0aab08c-9672-11e9-a079-0242ac110006',
    //   message: 'message(s) queued',
    //   messageUuid: [
    //    'b0ab735a-9672-11e9-a079-0242ac110006',
    //    'b0ad137c-9672-11e9-a079-0242ac110006',
    //   ],
    // }
    const { messageUuid } = await getTelephonyOps().sendMessage(sms);
    logger.trace({ ctx, msg, messageUuid }, 'plivoSendSms - messageUuid');

    return { message: { sendingResult: OperationResultType.SUCCESS }, messageUuid };
  } catch (error) {
    logger.error({ ctx, error }, `Error while sending sms to ${sms.dst}`);

    const errorMessage = error.toString();
    const isTooLong = isMessageTooLong(errorMessage);

    // if it's not a length error rethrow it so that sending is retried
    if (!isTooLong) throw error;

    return {
      message: {
        sendingResult: OperationResultType.FAILED,
        errorMessage,
        isTooLong,
      },
    };
  }
};
const getMMSAttachaments = message =>
  Object.keys(message)
    .filter(key => key.startsWith('Media') && key !== 'MediaCount')
    .map(key => message[key]);

const constructMessageData = (msg, communicationContext) => {
  const { from, text } = getFromAndMessageForReceivedSms(msg);

  return {
    text,
    from,
    to: communicationContext.targetContext.program ? [communicationContext.targetContext.program.directPhoneIdentifier] : [msg.To],
    messageId: msg.MessageUUID,
    rawMessage: msg,
    attachaments: isSMS(msg) ? [] : getMMSAttachaments(msg),
  };
};

const constructForwardingMessageData = (msg, communicationContext, forwardSmsTarget) => {
  const { from, text } = getFromAndMessageForReceivedSms(msg);
  const formattedFromPhoneNumber = formatPhoneToDisplay(from);
  const finalText = t('FORWARD_SMS_TEMPLATE', { from: formattedFromPhoneNumber, text });

  return {
    text: finalText,
    from: communicationContext.targetContext.program.directPhoneIdentifier,
    to: forwardSmsTarget,
    messageId: msg.MessageUUID,
    rawMessage: msg,
  };
};

export const getNotificationStatusUrl = async (ctx, commId, isForwardedSmsStatus) => {
  const { statusUrl } = await getTelephonyConfigs(ctx);
  return isForwardedSmsStatus ? statusUrl : `${statusUrl}&commId=${commId}`;
};

const isTenantPhoneSupportEnabled = async (ctx, tenantId) => {
  const tenant = await getTenantData(ctx, tenantId);
  return tenant.metadata.enablePhoneSupport;
};

const handleSmsForwarding = async (ctx, communicationContext, msg, isPhoneIntegrationEnabled) => {
  logger.debug({ ctx, communicationContext, msg }, 'handleSmsForwarding');
  const program = communicationContext.targetContext.program;
  const commsForwardingData = program.metadata.commsForwardingData;
  logger.trace({ ctx, programId: communicationContext.targetContext.id, commsForwardingData }, 'Forwarding received sms');
  let info = {};

  if (isUnformattedPhoneLikeValue(commsForwardingData.forwardSMSToExternalTarget)) {
    const message = constructForwardingMessageData(msg, communicationContext, commsForwardingData.forwardSMSToExternalTarget);
    if (isPhoneIntegrationEnabled) {
      const statusUrl = await getNotificationStatusUrl(ctx, '', true);
      const sms = { src: message.from, dst: message.to, text: message.text, params: { url: statusUrl } };
      info = await trySend(ctx, msg, sms);
    } else {
      info.messageUuid = [uuid()];
    }

    const forwardedCommunication = {
      type: DALTypes.CommunicationMessageType.SMS,
      messageId: info.messageUuid[0] || msg.MessageUUID,
      programId: program.id,
      programContactData: program.directPhoneIdentifier,
      message,
      forwardedTo: program.metadata.commsForwardingData.forwardSMSToExternalTarget,
      receivedFrom: message.from,
    };
    await saveForwardedCommunications(ctx, forwardedCommunication);
  } else {
    await handleEmailForwarding(ctx, communicationContext, msg, true);
  }
  return { processed: true };
};

export async function inboundSmsReceived(msg) {
  /* { To: '16504375757', */
  /* From: '16502736663', */
  /* TotalRate: '0', */
  /* Units: '1', */
  /* Text: 'Test incoming SMS message!', */
  /* TotalAmount: '0', */
  /* Type: 'sms', */
  /* MessageUUID: 'a6c7b52a-ef44-11e5-8088-22000afd0a5c' } */

  const { msgCtx, ...smsMsg } = msg;
  logger.trace({ ctx: msgCtx, smsMsg }, 'inboundSmsReceived');

  const contextData = constructDataForDeterminingContext(smsMsg);
  const communicationContext = await getCommunicationContext(msgCtx, contextData);
  const tenantPhoneSupportEnabled = await isTenantPhoneSupportEnabled(msgCtx, msgCtx.tenantId);

  if (shouldIgnoreProgram({ communicationContext })) return { processed: true };

  if (isProgramForwarding(communicationContext)) {
    return await handleSmsForwarding(msgCtx, communicationContext, smsMsg, tenantPhoneSupportEnabled);
  }

  const { communication: savedMessage, isSpam, isPersonToPersonMessage } = await processIncomingCommunication(msgCtx, {
    communicationContext,
    unread: true,
    message: constructMessageData(smsMsg, communicationContext),
  });

  if (isSpam || isPersonToPersonMessage) return { processed: true };

  try {
    const userIds = await getPartyOwnersByPartyIds(msgCtx, savedMessage.parties);
    notify({
      ctx: msgCtx,
      event: eventTypes.SMS_RECEIVED,
      routing: { users: userIds },
    });
    await notifyCommunicationUpdate(msgCtx, savedMessage);
  } catch (ex) {
    logger.warn({ ctx: msgCtx, ex }, 'Handle Revceived SMS -> unable to notify clients');
  }

  return { processed: true };
}

// Plivo notification shape:
// {
//   From: '16504375757',
//   ParentMessageUUID: '2f193fd4-2368-4928-80db-021e7957f7b2',
//   To: '16502736663',
//   Units: '1',
//   TotalAmount: '0.0035',
//   Status: 'sent',
//   TotalRate: '0.0035',
//   MCC: '0',
//   PartInfo: '1 of 1',
//   MNC: '0',
//   MessageUUID: '2f193fd4-2368-4928-80db-021e7957f7b2',
// }
export async function outboundSmsStatusUpdate(msg) {
  const { msgCtx, ...rest } = msg;
  logger.trace({ ctx: msgCtx, ...rest }, 'outboundSmsStatusUpdate - params');

  try {
    // plivo always returns the status of each individual message, which has only one recipient, but because
    // we use the same function to update the status of all the comms, we need to pass the recipient as an array
    const recipients = [msg.To];

    // for a sms that is sent successfully we will receive 3 notifications from Plivo
    // 1st notification: status = queued
    // 2nd notification: status = sent
    // 3rd notification: status = delivered
    const data = { messageId: msg.MessageUUID, newStatus: msg.Status, recipients, commId: msg.commId, errorCode: msg.ErrorCode };
    await handleMessageStatusChange(msgCtx, data);

    // if (!updatedCommunication.isForwardedComm) {
    //   await notifyCommunicationUpdate(msgCtx, updatedCommunication);
    // }

    return { processed: true };
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'Error while updating SMS status in DB');
    return { processed: false };
  }
}

const plivoSendSms = async (ctx, msg) => {
  const { message, entityId, partyId, userId, customerPhoneOverride, notificationMessage, sourcePhoneNo, skipSMSNotify } = msg;
  logger.debug({ ctx, msg }, 'plivoSendSms');

  const to = uniq(message.to);
  const dst = customerPhoneOverride || to.join('<');
  const statusUrl = await getNotificationStatusUrl(ctx, entityId);
  const sms = { src: sourcePhoneNo, dst, text: message.text, params: { url: statusUrl } };

  const info = await trySend(ctx, msg, sms);

  const updateDelta = { message: info.message };
  const [{ persons }] = await updateMessages(ctx, { id: entityId }, updateDelta);

  const party = await loadPartyById(ctx, partyId);

  !skipSMSNotify &&
    notify({
      ctx,
      event: eventTypes.SMS_SENT,
      data: {
        type: info.message.sendingResult,
        ids: [entityId],
        notificationMessage,
        partyId,
        persons,
        userId,
      },
      routing: { teams: party.teams },
    });

  if (info.message.sendingResult === OperationResultType.SUCCESS) {
    await eventService.saveCommunicationSentEvent(ctx, { partyId, userId, metadata: { communicationId: entityId } });
    await eventService.saveCommunicationCompletedEvent(ctx, { partyId, userId, metadata: { communicationId: entityId } });
  }
};

const fakeSendSms = async (ctx, msg) => {
  const { message, entityId, partyId, userId, notificationMessage, skipSMSNotify } = msg;
  logger.debug({ ctx, msg }, 'fakeSendSms');

  try {
    logger.debug({ ctx }, 'fakeSendSms simulating message update');

    // TODO: simulate random delays?  Also could simulate post to webhooks/sms/status
    const updateDelta = { message: { sendingResult: OperationResultType.SUCCESS } };

    logger.debug({ ctx, updateDelta }, 'fakeSendSms messageDelta');
    const [{ persons }] = await updateMessages(ctx, { id: entityId }, updateDelta);

    const party = await loadPartyById(ctx, partyId);

    !skipSMSNotify &&
      notify({
        ctx,
        event: eventTypes.SMS_SENT,
        data: {
          type: OperationResultType.SUCCESS,
          ids: [entityId],
          userId,
          notificationMessage,
          partyId,
          persons,
        },
        routing: { teams: party.teams },
      });

    await eventService.saveCommunicationSentEvent(ctx, { partyId, userId, metadata: { communicationId: entityId } });
    await eventService.saveCommunicationCompletedEvent(ctx, { partyId, userId, metadata: { communicationId: entityId } });
  } catch (error) {
    logger.error({ ctx, error }, `Error while sending fake sms to ${message.to}`);
    throw error;
  }
};

const send = async (msgCtx, msg) => {
  const tenantPhoneSupportEnabled = await isTenantPhoneSupportEnabled(msgCtx, msgCtx.tenantId);
  msg.message.text = msg.message.text.replace(/https?:\/\//g, '');
  tenantPhoneSupportEnabled ? await plivoSendSms(msgCtx, msg) : await fakeSendSms(msgCtx, msg);
};

export const outboundSmsSent = async msg => {
  const { msgCtx } = msg;
  logger.debug({ ctx: msgCtx, msg }, 'handling outboundSmsSent');

  await send(msgCtx, msg);

  return { processed: true };
};

export const outboundApplicationInvitationSmsSent = async msg => {
  const { msgCtx } = msg;
  logger.debug({ ctx: msgCtx, msg }, 'handling outboundApplicationInvitationSmsSent');

  await send(msg);

  return { processed: true };
};
