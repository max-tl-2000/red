/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import knex from 'knex';
import { setupDefaultSchema, migrateSchema } from '../services/schemaSetup';
import loggerM from '../../common/helpers/logger';

const logger = loggerM.child({ subType: 'DatabaseConnection' });

export default class DatabaseConnection {
  constructor(config) {
    this.config = config;
  }

  async openAsync() {
    logger.debug({ config: this.config }, 'db configuration');
    this.connection = knex(this.config);
  }

  getUnderlying() {
    return this.connection;
  }

  executeQueryAsync(query) {
    return this.connection.raw(query);
  }

  async executeScalarAsync(query) {
    const result = await this.executeQueryAsync(query);

    if (result.rowCount !== 1) {
      throw new Error('Invalid row count for scalar query');
    }

    const onlyRow = result.rows[0];
    const onlyRowKeys = Object.keys(onlyRow);

    if (onlyRowKeys.length !== 1) {
      throw new Error('Invalid column count for scalar query');
    }

    return onlyRow[onlyRowKeys[0]];
  }

  async executeMigrationsAsync() {
    await setupDefaultSchema(this.connection);
    await migrateSchema(this.connection);
  }

  async dropDatabaseAsync(database) {
    // the following queries are used for debugging purposes
    // to show the current connection and other connections
    // that might be opened
    const {
      rows: [currentConnection],
    } = await this.executeQueryAsync(`
      select
        datname, pid,
        usename, client_addr,
        backend_start, state, query
      from
        pg_stat_activity
      where
        pid = pg_backend_pid();
    `);

    const { rows } = await this.executeQueryAsync(`
      select
        datname, pid,
        usename, client_addr,
        backend_start, state, query
      from
        pg_stat_activity
      where
        pid <> pg_backend_pid();
    `);

    logger.debug({ currentConnection, otherConnections: rows }, 'pg_stat_activity');

    await this.executeQueryAsync(`
      SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE pid <> pg_backend_pid()
         AND datname='${database}';
      `);

    return this.executeQueryAsync(`DROP DATABASE IF EXISTS ${database}`);
  }

  createDatabaseAsync(database) {
    return this.executeQueryAsync(`CREATE DATABASE ${database}`);
  }

  disposeAsync() {
    return this.connection.destroy();
  }
}
