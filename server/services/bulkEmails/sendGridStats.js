/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import partition from 'lodash/partition';
import { mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { bulkUpdateNotifications, updateDirectMessageNotificationStatus } from '../../dal/cohortCommsRepo';

const logger = loggerModule.child({ subType: 'services/sendGridStats' });

const updateDirectMessageNotifications = async (ctx, directMessageNotifications) => {
  logger.trace({ ctx, directMessageNotifications }, 'updateDirectMessageNotifications');

  try {
    directMessageNotifications.length &&
      (await mapSeries(
        directMessageNotifications,
        async directMessageNotification =>
          await updateDirectMessageNotificationStatus(
            ctx,
            directMessageNotification.notificationToSendId,
            directMessageNotification.event,
            directMessageNotification.reason,
          ),
      ));
  } catch (error) {
    logger.error({ ctx, directMessageNotifications, error }, 'error updating directMessageNotifications');
  }
};

const updatePostNotifications = async (ctx, postNotifications) => {
  logger.trace({ ctx, postNotifications }, 'updatePostNotifications');

  try {
    postNotifications.length && (await bulkUpdateNotifications(ctx, postNotifications));
  } catch (error) {
    logger.error({ ctx, postNotifications, error }, 'error updating postNotifications');
  }
};

export const processSendGridStats = async (ctx, event) => {
  logger.trace({ ctx, event }, 'processSendGridStats');

  const [directMessageNotifications, postNotifications] = partition(event, ev => ev.messageType === DALTypes.CommunicationMessageType.DIRECT_MESSAGE);

  await updateDirectMessageNotifications(ctx, directMessageNotifications);
  await updatePostNotifications(ctx, postNotifications);
};
