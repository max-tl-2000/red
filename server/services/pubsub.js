/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { createRabbitMQConnection } from '../common/pubsubConn';
import loggerModule from '../../common/helpers/logger';
import { OBSCURE_VALUE, obscureObject } from '../../common/helpers/logger-utils';
import { shortenedToString } from '../../common/helpers/strings';
import timedOut from '../../common/helpers/sleep';
import {
  HEADER_MESSAGE_ID,
  HEADER_ORIGINALLY_SENT,
  HEADER_TENANT_ID,
  HEADER_REQUEST_ID,
  HEADER_ORIGINAL_REQUEST_IDS,
  HEADER_DOCUMENT_VERSION,
  HEADER_DELAY,
} from '../helpers/message-constants';
import config from '../workers/config';
import { now } from '../../common/helpers/moment-utils';
import tryParse from '../../common/helpers/try-parse';

const logger = loggerModule.child({ subType: 'AMQP/Publisher' });

const offlinePubQueue = [];
let pubChannel;
let connection;
let reconnect = true;

const getProtectedMessageToLog = (msg, noLog) => {
  if (noLog) return OBSCURE_VALUE;
  return msg ? JSON.stringify(obscureObject(tryParse(msg, {}))) : msg;
};

const publish = async ({ chan, exchange, key, msg, noLog, ctx }) => {
  try {
    if (!chan) throw new Error('PUBLISH_ATTEMPTED_WITHOUT_CHAN');
    const msgId = newId();
    const protectedMessage = getProtectedMessageToLog(msg, noLog);
    logger.trace({ payload: shortenedToString(protectedMessage, 2000), exchange, routingKey: key, msgId, ctx }, 'publishing message');
    const res = await chan.publish(exchange, key, Buffer.from(msg), {
      persistent: true,
      headers: {
        retryCount: 0,
        [HEADER_MESSAGE_ID]: msgId,
        [HEADER_ORIGINALLY_SENT]: now().format(),
        [HEADER_TENANT_ID]: ctx.tenantId,
        [HEADER_REQUEST_ID]: ctx.reqId,
        [HEADER_ORIGINAL_REQUEST_IDS]: ctx.originalRequestIds || [],
        [HEADER_DOCUMENT_VERSION]: ctx.documentVersion,
        [HEADER_DELAY]: ctx.delay,
      },
    });
    if (config.isDevelopment) {
      logger.trace({ publishResult: res }, `Sent message to exchange: ${exchange} with key: ${key}, result: ${res}`);
    }
    return res;
  } catch (err) {
    logger.error({ error: err }, 'publish error');
    if (err.name === 'TypeError') {
      logger.error('pubsub message had unexpected format -- will NOT retry it!');
    } else {
      logger.error('Clearing pubChannel to force a reconnect...');
      pubChannel = undefined;
      offlinePubQueue.push({
        exchange,
        key,
        msg,
        noLog,
        ctx,
      });
    }
    return false;
  }
};

const startConnection = async () => {
  try {
    if (!pubChannel) {
      const { conn, chan } = await createRabbitMQConnection();
      conn.on('error', err => {
        if (err.message !== 'Connection closing') {
          logger.error({ error: err }, 'producer connection error');
          pubChannel = undefined;
          setTimeout(startConnection, 2000);
          return;
        }
      });

      conn.on('close', () => {
        pubChannel = undefined;
        if (reconnect) {
          logger.error('producer reconnecting');
          setTimeout(startConnection, 2000);
        }
        return;
      });
      connection = conn;
      pubChannel = chan;
    }

    while (offlinePubQueue.length > 0) {
      const offlineMessage = offlinePubQueue.shift();

      if (!offlineMessage || (offlineMessage && !offlineMessage.exchange)) break;
      logger.trace({ offlineMessage }, 'publishing from offline queue msg');
      await publish({ chan: pubChannel, ...offlineMessage });
    }
  } catch (err) {
    logger.error({ error: err }, 'failed to connect to rabbitmq');
    pubChannel = undefined;
    setTimeout(startConnection, 2000);
  }
};

export const stopQueueConnection = async () => {
  reconnect = false;
  if (!connection) {
    logger.trace('closed AMQP connection');
    return;
  }

  logger.trace('closing connection');
  const result = pubChannel && (await pubChannel.close());
  if (!result) {
    await connection.close();
    logger.trace('closed AMQP connection');
  }
};

export const sendMessage = async ({ exchange, key: routingKey, message, ctx = {} }) => {
  if (!message) throw new Error('SEND_MESSAGE_ATTEMPTED_WITH_EMPTY_MSG');

  logger.trace({ ctx, exchange, routingKey }, 'sendMessage');
  const msg = JSON.stringify(message);

  const send = async ({ postCommit }) => {
    if (postCommit) {
      logger.trace({ exchange, routingKey }, 'sending delayed message');
    }

    await publish({ chan: pubChannel, exchange, key: routingKey, msg, noLog: message._noLog, ctx });
    if (config.isIntegration) {
      // let the message consumers run as they are not running in a separate process when integration suite is run
      await timedOut(200);
    }
  };

  await startConnection();
  if (!ctx.trx || (ctx.trx.isCompleted && ctx.trx.isCompleted())) {
    return await send({ postCommit: false });
  }

  ctx.trx.postCommitOperations = [...(ctx.trx.postCommitOperations || []), send];
  logger.trace({ exchange, routingKey }, 'delayed message sending');

  return Promise.resolve();
};
