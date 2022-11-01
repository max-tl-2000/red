/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Expo, ExpoPushTicket } from 'expo-server-sdk';
import partition from 'lodash/partition';
import flatten from 'lodash/flatten';
import values from 'lodash/values';

import loggerInstance from '../helpers/logger';
import { getDevicesByUserIds } from '../../resident/server/dal/device';
import { COMMON_SCHEMA_CTX } from '../../auth/server/dal/common';

const logger = loggerInstance.child({ subType: 'push-notifications' });
const expo = new Expo();

type Message = {
  title: string;
  body: string;
  data: { [key: string]: string };
};

const collectPushTicketReceiptsAsync = async (tickets: ExpoPushTicket[]) => {
  /*
    Later, after the Expo push notification service has delivered the
    notifications to Apple or Google (usually quickly, but allow the the service
    up to 30 minutes when under load), a "receipt" for each notification is
    created. The receipts will be available for at least a day; stale receipts
    are deleted.

    The ID of each receipt is sent back in the response "ticket" for each
    notification. In summary, sending a notification produces a ticket, which
    contains a receipt ID you later use to get the receipt.

    The receipts may contain error codes to which you must respond. In
    particular, Apple or Google may block apps that continue to send
    notifications to devices that have blocked notifications or have uninstalled
    your app. Expo does not control this policy and sends back the feedback from
    Apple and Google so you can handle it appropriately.
  */

  /*
    Not all tickets have IDs; for example, tickets for notifications
    that could not be enqueued will have error information and no receipt ID.
  */

  const [successTickets, errorTickets] = partition(tickets, t => !!t.id);

  if (errorTickets.length) logger.error({ errorTickets }, 'failed to send some push notifications');

  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(successTickets.map(t => t.id));

  await Promise.all(
    receiptIdChunks.map(async chunk => {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        values(receipts).forEach(receipt =>
          receipt.status === 'ok'
            ? logger.trace({ receipt }, 'successfully sent push notification')
            : logger.error({ receipt }, 'failed to send push notification'),
        );
      } catch (error) {
        logger.error({ chunk }, 'failed to get push notification receipt');
      }
    }),
  );
};

export const sendPushNotification = async (ctx: { [key: string]: any }, message: Message, userIds: string[]) => {
  try {
    logger.info({ ctx, notification: message, userIds }, 'sending push notifications to users');

    const devices = await getDevicesByUserIds({ ...ctx, ...COMMON_SCHEMA_CTX }, userIds);

    const [devicesWithPushTokens, devicesWithoutPushTokens] = partition(devices, d => Expo.isExpoPushToken(d.pushToken));

    logger.trace({ ctx, devicesWithoutPushTokens, devicesWithPushTokens }, 'determined information about devices with valid push tokens');

    const pushMessages = devicesWithPushTokens.map(d => ({
      to: d.pushToken,
      ...message,
      sound: 'default',
      channelId: 'default',
    }));

    const pushMessageChunks = expo.chunkPushNotifications(pushMessages);

    const ticketChunks = await Promise.all(
      pushMessageChunks.map(async chunk => {
        try {
          return await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          logger.error({ ctx, error, chunk }, 'failed to send push notification chunk');
          return [];
        }
      }),
    );

    const tickets = flatten(ticketChunks);
    collectPushTicketReceiptsAsync(tickets);
  } catch (error) {
    logger.error({ ctx, message, userIds }, 'failed to send push notifications to users');
  }
};
