/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import io from 'socket.io-client';
import amqp from 'amqplib';
import { knex } from '../database/factory';
import { getSocketServerHost } from '../socket/socketServer';
import { commonConfig } from '../../common/server-config';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'health' });

const checkDBConnection = async () => {
  let result;
  let healthy = false;

  try {
    result = await knex.raw('SELECT 1');
  } catch (error) {
    logger.error({ error }, 'Database connection down');
  }

  const rowCount = (result && result.rowCount) || 0;
  if (rowCount > 0) healthy = true;

  return healthy;
};

export const isDatabaseHealthy = async () => await checkDBConnection();

const waitForClientConnection = async (client, timeoutMs = 3000) =>
  new Promise((resolve, reject) => {
    client.on('connect', msg => {
      resolve(msg);
    });
    setTimeout(() => {
      reject(new Error('Error waiting for client to connect'));
    }, timeoutMs);
  });

export const isWebSocketHealthy = async () => {
  let socket;
  let healthy = false;

  try {
    socket = io.connect(getSocketServerHost(true), {
      transports: ['websocket'],
      reconnectionAttempts: 1,
      forceNew: true,
    });

    await waitForClientConnection(socket);

    healthy = (socket && socket.connected) || false;
  } catch (error) {
    logger.error({ error }, 'WebSocket health check error');
  } finally {
    socket && socket.close();
  }

  return healthy;
};

const checkMQConnection = async () => {
  let healthy = false;
  let conn;
  try {
    conn = await amqp.connect(commonConfig.rabbitmqHost);
    healthy = true;
  } catch (error) {
    logger.error({ error }, 'Error connecting to message queue');
  } finally {
    conn && (await conn.close());
  }

  return healthy;
};

export const isMessageQueueHealthy = async () => await checkMQConnection();
