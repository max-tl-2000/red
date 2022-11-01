/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import knexBuilder from 'knex';
import { knexConfig } from '../database/knexfile';

import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'BaseSchemaBuilderAnalytics' });

const clonedOperationalConfig = () => JSON.parse(JSON.stringify(knexConfig));

export const createConnection = (toExistingDB, knexInstance) => {
  const newKnexConfig = knexInstance ? JSON.parse(JSON.stringify(knexInstance)) : clonedOperationalConfig();

  if (!toExistingDB) {
    newKnexConfig.connection.database = 'postgres';
  }
  logger.trace(`createConnection to ${newKnexConfig.connection.database}`);
  return knexBuilder(newKnexConfig);
};

const getAdminConfig = (knexConfiguration, isToPostgresDB = true) => {
  if (isToPostgresDB) knexConfiguration.connection.database = 'postgres';
  knexConfiguration.connection.user = knexConfiguration.connection.adminUser;
  knexConfiguration.connection.password = knexConfiguration.connection.adminPassword;

  logger.trace(`createConnection to ${knexConfiguration.connection.database} as admin user`);

  return knexBuilder(knexConfiguration);
};

export const getOperationalAdminConnection = isToPostgresDB => getAdminConfig(clonedOperationalConfig(), isToPostgresDB);
