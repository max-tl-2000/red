/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import knexBuilder from 'knex';
import connectionTester from 'connection-tester';
import { knexConfig, knexConfigReadOnly } from './knexfile.js';
import logger from '../../common/helpers/logger';

const {
  connection: { host: connectionHost, database: connectionDatabase, port: connectionPort },
  pool: poolConfig,
} = knexConfig;
const mockKnex = process.env.REVA_MOCK_KNEX;
const nodeEnv = process.env.NODE_ENV;

if (mockKnex) {
  logger.info('Using a mock of the knex module instead of real knex entity');
} else {
  logger.info({ connectionHost, connectionPort }, 'Confirming db connection');
  const { error: conError } = connectionTester.test(
    connectionHost, // host
    connectionPort, // port
    1000,
  ); // connection timeout
  logger.info({ connectionHost, connectionPort, conError }, 'Confirmed db connection');
  if (conError) {
    logger.error({ error: conError, connectionHost, connectionPort }, 'Cannot connect to database!');
    throw new Error(conError);
  }
  logger.info({ poolConfig, connectionHost, connectionDatabase, nodeEnv }, 'Instantiating knex singleton');
}

export const knex = process.env.REVA_MOCK_KNEX ? {} : knexBuilder(knexConfig);
export const knexReadOnly = process.env.REVA_MOCK_KNEX ? {} : knexBuilder(knexConfigReadOnly);
logger.info('Back from Instantiating knex singleton');
