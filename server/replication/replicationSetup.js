/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createConnection, getOperationalAdminConnection } from '../database_connections/db_connections';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'ReplicationSetup' });

export const isRDSEnv = async knex => {
  const { rowCount } = await knex.raw("SELECT 1 FROM pg_catalog.pg_user WHERE usename = 'rdsadmin';");

  if (rowCount === 0) return false;
  return true;
};

export const createReplicationUser = async knexConfig => {
  const knex = createConnection(false, knexConfig);
  logger.trace(`checking if user "${knexConfig.connection.replicationUser}" exists`);
  const { rowCount } = await knex.raw(`SELECT 1 FROM pg_user WHERE usename='${knexConfig.connection.replicationUser}'`);

  if (rowCount === 0) {
    logger.trace(`user "${knexConfig.connection.replicationUser}" does not exist. Let's create it`);
    const conn = getOperationalAdminConnection();

    (await isRDSEnv(knex))
      ? await conn.raw(
          `CREATE USER "${knexConfig.connection.replicationUser}" WITH LOGIN PASSWORD '${knexConfig.connection.replicationPassword}'
           IN GROUP rds_replication, rds_superuser CREATEDB;`,
        )
      : await conn.raw(
          `CREATE USER "${knexConfig.connection.replicationUser}" WITH LOGIN PASSWORD '${knexConfig.connection.replicationPassword}'
           CREATEDB;`,
        );

    await conn.destroy();
  } else {
    logger.trace(`user "${knexConfig.connection.replicationUser}" exists`);
  }

  await knex.destroy();
};
