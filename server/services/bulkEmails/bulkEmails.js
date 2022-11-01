/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import chunk from 'lodash/chunk';
import newId from 'uuid/v4';
import { mapSeries } from 'bluebird';

import { DALTypes } from '../../../common/enums/DALTypes';
import {
  getPostRecipientsByPostId,
  updateRecipientsWithSessionId,
  bulkInsertNotifications,
  saveNotificationTemplate,
  getPostRecipientsBySessionId,
  getPostById,
} from '../../dal/cohortCommsRepo';
import config from '../../config';

import loggerModule from '../../../common/helpers/logger';

import { sendMessage } from '../pubsub';
import { APP_EXCHANGE, BULK_EMAILS_TYPE } from '../../helpers/message-constants';

const logger = loggerModule.child({ subType: 'bulkEmails' });

const createNotificationEntries = async (ctx, sessionId, notificationTemplateId) => {
  logger.trace({ ctx, sessionId }, 'createNotificationEntries');

  const postRecipients = await getPostRecipientsBySessionId(ctx, sessionId);

  const recipientsWithoutCommonUser = [];

  const returnValue = postRecipients.map(recipient => {
    const hasCommonUserId = !!recipient.commonUserId;

    if (!hasCommonUserId) {
      recipientsWithoutCommonUser.push(recipient);
    }

    return {
      id: newId(),
      postRecipientId: recipient.id,
      type: DALTypes.CommunicationMessageType.EMAIL,
      status: DALTypes.CommunicationStatus.PENDING,
      messageParams: {
        emailAddress: recipient.userEmail,
        commonUserId: recipient.commonUserId,
      },
      notificationTemplateId,
    };
  });

  if (recipientsWithoutCommonUser.length > 0) {
    logger.warn({ recipientsWithoutCommonUser }, `Found "${recipientsWithoutCommonUser.length}" recipients without commonUserId`);
  }

  return returnValue;
};

export const saveNotifications = async (ctx, sessionId) => {
  logger.trace({ ctx, sessionId }, 'saveNotifications - start');
  const notificationTemplateId = await saveNotificationTemplate(ctx, sessionId);
  const notifications = await createNotificationEntries(ctx, sessionId, notificationTemplateId);
  await bulkInsertNotifications(ctx, notifications);
  logger.trace({ ctx, sessionId }, 'saveNotifications - done');
};

const prepareDataAndPublishMessage = async (ctx, recipients, propertyId, postCategory) => {
  const sessionId = newId();
  logger.trace({ ctx, propertyId, recipients: recipients.map(recipient => recipient.id), postCategory }, 'prepareDataAndPublishMessage - start');

  await updateRecipientsWithSessionId(
    ctx,
    sessionId,
    recipients.map(recipient => recipient.id),
  );

  await saveNotifications(ctx, sessionId);

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: BULK_EMAILS_TYPE.SEND_BULK_EMAILS,
    message: {
      tenantId: ctx.tenantId,
      sessionId,
      propertyId,
      postCategory,
    },
    ctx,
  });

  logger.trace({ ctx, propertyId, postCategory }, 'prepareDataAndPublishMessage - done');
};

export const createBulkEmailsMessages = async (ctx, postId) => {
  logger.trace({ ctx, postId }, 'createBulkEmailsMessages - start');

  const postRecipients = await getPostRecipientsByPostId(ctx, postId);
  const propertiesOfPostRecipients = uniq(postRecipients.map(postRecipient => postRecipient.propertyId));
  const post = await getPostById(ctx, postId);

  await mapSeries(propertiesOfPostRecipients, async propertyId => {
    logger.trace({ ctx, postId, propertyId }, 'Processing post recipients for property');
    const postRecipientsForProperty = postRecipients.filter(postRecipient => postRecipient.propertyId === propertyId);

    // maximum number of persons on a sendGrid mail API request is 999
    const maximumNoOfSendRecipients = config.sendGrid.maxEmailRecipients;
    if (postRecipientsForProperty.length > maximumNoOfSendRecipients) {
      const recipientChunks = chunk(postRecipientsForProperty, maximumNoOfSendRecipients);
      logger.trace({ ctx, postId, propertyId, noOfChunks: recipientChunks.length }, 'createBulkEmailsMessages - no of chunks');
      await mapSeries(recipientChunks, async batch => await prepareDataAndPublishMessage(ctx, batch, propertyId, post.category));
    } else {
      await prepareDataAndPublishMessage(ctx, postRecipientsForProperty, propertyId, post.category);
    }
  });

  logger.trace({ ctx, postId }, 'createBulkEmailsMessages - done');
};
