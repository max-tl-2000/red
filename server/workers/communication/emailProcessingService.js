/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantByName } from '../../dal/tenantsRepo';
import { admin } from '../../common/schemaConstants';
import { updateMessages } from '../../dal/communicationRepo';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import { OperationResultType } from '../../../common/enums/enumHelper';
import loggerModule from '../../../common/helpers/logger';
import config from '../../config';

import { parseTenantName } from './helpers/email';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import * as eventService from '../../services/partyEvent';
import { handleMessageStatusChange } from './helpers/statusChangeHelper';

const logger = loggerModule.child({ subType: 'comms' });

export const getTenantFromEmailAddress = async email => {
  if (!email) return null;
  const tenantName = parseTenantName(email);
  const adminCtx = { tenantId: admin.id };
  const tenant = await getTenantByName(adminCtx, tenantName);
  return tenant;
};

const notifyFailedSentEmail = (ctx, data) => {
  if (data.noNotifySentMail) return;

  notify({
    ctx,
    event: eventTypes.MAIL_SENT,
    data: { type: OperationResultType.FAILED },
    routing: { users: [data.userId] },
  });
};

const notifySentEmail = (ctx, data, teams) => {
  if (data.noNotifySentMail) return;

  notify({
    ctx,
    event: eventTypes.MAIL_SENT,
    data: { type: OperationResultType.SUCCESS, notificationMessage: data.notificationMessage, teams },
    routing: { users: [data.userId] },
  });
};

export async function handleSendMail(ctx, event, data) {
  logger.info({ ctx }, `Sent Email with id:  ${data.id}`);
  const tenantName = parseTenantName(data.from);

  const adminCtx = { tenantId: admin.id };
  const tenant = await getTenantByName(adminCtx, tenantName);

  if (!tenant) throw new Error('TENANT NOT FOUND');
  if (!ctx.tenantId) {
    ctx.tenantId = tenant.id; // for the case where the tenantId is not set on the context
  }

  if (!event.MessageId) {
    await notifyFailedSentEmail(ctx, data);
    return;
  }

  if (data.sentEmailOnly) return;

  const messageDelta = { messageId: event.MessageId };
  const [updatedComm] = await updateMessages(ctx, { id: data.id }, messageDelta);

  await eventService.saveCommunicationSentEvent(ctx, {
    partyId: data.partyId,
    userId: data.userId,
    metadata: { communicationId: data.id },
  });

  await eventService.saveCommunicationCompletedEvent(ctx, {
    partyId: data.partyId,
    userId: data.userId,
    metadata: { communicationId: data.id },
  });

  await notifySentEmail(ctx, data, updatedComm.teams);
}

export const handleEmailStatusChange = async data => {
  const { msgCtx, ...rest } = data;
  logger.trace({ ctx: msgCtx, emailData: rest }, 'handleEmailStatusChange - params');

  try {
    const tenant = await getTenantFromEmailAddress(data.email);
    if (!msgCtx.tenantId) {
      msgCtx.tenantId = tenant.id; // for the case where the tenantId is not set on the context
    }

    const msg = {
      messageId: data.messageId,
      newStatus: data.type,
      email: data.email,
      recipients: data.recipients,
    };
    const updatedCommunication = await handleMessageStatusChange(msgCtx, msg);
    if (updatedCommunication.parties && config.defaultCommsCategories.includes(updatedCommunication.category)) {
      await notifyCommunicationUpdate(msgCtx, updatedCommunication);
    }
  } catch (error) {
    logger.warn({ ctx: msgCtx, error }, 'Error while updating email status in DB');
  }

  return true;
};
