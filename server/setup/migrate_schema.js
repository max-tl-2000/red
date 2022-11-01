/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { closePool, knex } from '../database/factory';
import { knexConfig } from '../database/knexfile';
import { migrateSchema } from '../services/schemaSetup';
import loggerModule from '../../common/helpers/logger';
import { createReplicationUser } from '../replication/replicationSetup';
import { DALTypes } from '../../common/enums/DALTypes';

const nodeProcess = process;

const logger = loggerModule.child({ subType: 'migrateSchema' });

async function main() {
  logger.time({ tenantId: 'admin' }, 'Creating replication user');
  await createReplicationUser(knexConfig, DALTypes.DatabaseType.OPERATIONAL);
  logger.timeEnd({ tenantId: 'admin' }, 'Creating replication user');

  logger.time({ tenantId: 'admin' }, 'Migrating DB schema');
  await migrateSchema(knex);
  logger.timeEnd({ tenantId: 'admin' }, 'Migrating DB schema');
}

async function closeConns(exitCode = 0) {
  logger.trace('Closing reva core DB connection');
  await closePool();
  nodeProcess.exit(exitCode);
}

// Run with `node_modules/.bin/babel-node server/setup/cli.js
if (require.main === module) {
  main()
    .then(closeConns)
    .catch(async error => {
      logger.error({ error }, 'Error executing migrate_database cli.');
      await closeConns(1);
    });
}
