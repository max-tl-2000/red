/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import { knexConfig } from '../knexfile';
import { hash } from '../../helpers/crypto';
import { createReplicationUser } from '../../replication/replicationSetup';
import { getOperationalAdminConnection, createConnection } from '../../database_connections/db_connections';

import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
const logger = loggerModule.child({ subType: 'BaseSchemaBuilder' });

const createSuperAdmin = async () => {
  const { superAdmin } = require('../../config').default;
  const { insertInto } = require('../factory');

  const newUser = {
    fullName: 'System',
    preferredName: superAdmin.preferredName,
    email: superAdmin.userName,
    password: await hash(superAdmin.password),
    externalUniqueId: v4(),
    metadata: { isAdmin: true },
  };

  await insertInto('admin', 'Users', newUser);
  logger.info(`User ${newUser.email} created.`);
};

const createUser = async () => {
  const knex = getOperationalAdminConnection();
  logger.trace(`checking if user "${knexConfig.connection.user}" exists`);
  const { rowCount } = await knex.raw(`SELECT 1 FROM pg_user WHERE usename='${knexConfig.connection.user}'`);

  if (rowCount === 0) {
    logger.trace(`user "${knexConfig.connection.user}" does not exist. Let's create it`);
    await knex.raw(`CREATE ROLE "${knexConfig.connection.role}"`);
    await knex.raw(
      `CREATE USER "${knexConfig.connection.user}" WITH password '${knexConfig.connection.password}' IN GROUP "${knexConfig.connection.role}" CREATEDB`,
    );
  } else {
    logger.trace(`user "${knexConfig.connection.user}" exists`);
  }

  // destroy the connection
  // a new one will be created to create the tables
  await knex.destroy();
};

const createExtensions = async () => {
  // extensions must be created in the reva DB...
  const knex = getOperationalAdminConnection(false);

  logger.trace('ensuring that extensions are created');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA public;');
  logger.trace('done creating extensions');

  // destroy the connection
  // a new one will be created to create the tables
  await knex.destroy();
};

const createDatabase = async () => {
  const knex = createConnection(false);
  logger.trace(`checking if database "${knexConfig.connection.database}" exists`);

  const { rowCount } = await knex.raw(`SELECT 1 FROM pg_database WHERE datname = '${knexConfig.connection.database}'`);

  if (rowCount === 0) {
    logger.trace(`database "${knexConfig.connection.database}" does not exist. Let's create it`);
    await knex.raw(`CREATE DATABASE ${knexConfig.connection.database}`);
  } else {
    logger.trace(`database "${knexConfig.connection.database}" exists`);
  }
  // destroy the connection
  // a new one will be created to create the tables
  await knex.destroy();
};

const doStartConsumers = async () => {
  const { startConsumers } = require('../../workers/consumer');
  const bindConsumers = false;
  const skipRecurringJobs = true;
  return await startConsumers(bindConsumers, skipRecurringJobs);
};

const createTables = async () => {
  const { setupDefaultSchema } = require('../../services/schemaSetup');
  logger.time({ tenantId: 'admin' }, 'setup default schema');
  const knex = createConnection(true);
  await setupDefaultSchema(knex);
  await doStartConsumers();
  await knex.destroy();
  logger.timeEnd({ tenantId: 'admin' }, 'setup default schema');
};

const initializeDatabase = async () => {
  logger.info('initializeDatabase database start');
  await createUser();
  await createReplicationUser(knexConfig, DALTypes.DatabaseType.OPERATIONAL);
  await createDatabase();
  await createExtensions();
  await createTables();
  await createSuperAdmin();
  logger.info('initializeDatabase database done');
};

export const stopKnexAndQueue = async () => {
  const { stopQueueConnection } = require('../../services/pubsub');
  const { knex: globalKnex } = require('../knex');

  await stopQueueConnection();
  await globalKnex.destroy();

  logger.trace('stopKnexAndQueue done!');
};

export const seed = () => {
  logger.time({ tenantId: 'admin' }, 'initializing database');
  return initializeDatabase()
    .then(() => {
      logger.timeEnd({ tenantId: 'admin' }, 'initializing database');
      logger.info('database initialization done');
    })
    .catch(error => {
      logger.timeEnd({ tenantId: 'admin' }, 'initializing database');
      logger.error({ error }, 'seed error');
      throw error;
    });
};

if (require.main === module) {
  seed()
    .then(async () => {
      await stopKnexAndQueue();

      // we have currently a very nasty issue
      // by just importing some of the database (or maybe QUEUE) modules
      // a connection to the server is being open
      // this will just ensure the process exit correctly
    process.exit(0); // eslint-disable-line
    })
    .catch(async () => {
      await stopKnexAndQueue();

      // eslint-disable-next-line
    process.exit(1); // ensures it exits with a proper exit code
    });
}
