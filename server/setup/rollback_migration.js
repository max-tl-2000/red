/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { closePool, knex } from '../database/factory';
import { rollbackMigration } from '../services/schemaSetup';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'migrateSchema' });

async function main() {
  logger.time('Rollback migration');
  await rollbackMigration(knex);
  logger.timeEnd('Rollback migration');
}

// Run with `node_modules/.bin/babel-node server/setup/cli.js
if (require.main === module) {
  main().then(closePool).catch(closePool);
}
