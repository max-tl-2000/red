/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, rawStatement } from '../database/factory';

import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'knexRepo' });

const buildINClause = ids => ids.map(_id => '?').join(',');

export const deleteMigrationFiles = async (tenantId, migrationsToDelete) => {
  const query = `DELETE FROM db_namespace.knex_migrations WHERE "name" IN (${buildINClause(migrationsToDelete)});`;
  const command = rawStatement({ tenantId }, query, [migrationsToDelete]);
  const res = await command;

  if (res.rowCount > 0) {
    logger.trace({ tenantId, migrationsToDelete }, 'Deleted migration files');
  }
};

export const getMigrations = async tenantId => await initQuery({ tenantId }).from('knex_migrations').select('name').orderBy('name', 'asc');

export const getLastMigrationFile = async tenantId => {
  const query = `SELECT name FROM db_namespace.knex_migrations
                 ORDER BY id DESC
                 LIMIT 1;`;
  const command = rawStatement({ tenantId }, query, []);
  const { rows } = await command;
  console.log('last migrations', rows);
  return rows[0];
};
