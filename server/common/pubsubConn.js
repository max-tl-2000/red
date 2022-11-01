/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import amqp from 'amqplib';
import { commonConfig } from '../../common/server-config';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'pubsubConn' });
let chanIndex = 0;

export async function createRabbitMQConnection() {
  let conn;
  let chan;

  const { rabbitmqHost, rabbitmqHeartbeat = 120 } = commonConfig;

  logger.info({ rabbitmqHost, rabbitmqHeartbeat }, 'rabbitMQConnectionConfig');
  try {
    conn = await amqp.connect(`${rabbitmqHost}?heartbeat=${rabbitmqHeartbeat}`);
    chan = await conn.createChannel();
    chan.chanIndex = chanIndex++;
    logger.debug(`created chan ${chan.chanIndex}`);
  } catch (err) {
    logger.error(err, 'Failed to create rabbitmq connection');
    chan && chan.close();
    conn && conn.close();
    conn = null;
    chan = null;
    throw err;
  }

  return { conn, chan };
}
