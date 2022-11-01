/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knexConfig } from '../database/knexfile';
import DatabaseConnection from './databaseConnection';
import { seed, stopKnexAndQueue } from '../database/seeds/BaseSchemaBuilder';

class DatabaseUnitOfWork {
  constructor(config) {
    this.config = config;

    // we're currently using 2 connections to execute the job
    // instead of having only one connection that was swapped

    // the revaUser connection is used to create the db and run seed
    this.revaUserConnection = null;

    // the revaAdmin is used to drop the db
    this.revaAdminConnection = null;
  }

  getConnectionConfig() {
    const connection = JSON.parse(JSON.stringify(this.config.connection));
    connection.database = 'postgres';
    connection.user = connection.adminUser;
    connection.password = connection.adminPassword;

    return {
      ...this.config,
      connection,
    };
  }

  setUpMetaConnectionAsync() {
    if (!this.revaAdminConnection) {
      this.revaAdminConnection = new DatabaseConnection(this.getConnectionConfig());
    }

    return this.revaAdminConnection.openAsync();
  }

  async setUpAsync() {
    await this.setUpMetaConnectionAsync();
    await this.revaAdminConnection.dropDatabaseAsync(this.config.connection.database);

    await seed();
  }

  getConnection() {
    return this.revaUserConnection.getUnderlying();
  }

  async tearDownConnectionAsync() {
    if (this.revaUserConnection) {
      await this.revaUserConnection.disposeAsync();
    }

    if (this.revaAdminConnection) {
      await this.revaAdminConnection.disposeAsync();
    }

    this.revaUserConnection = null;
    this.revaAdminConnection = null;
  }

  async tearDownAsync() {
    // why we need to call destroy on knex???
    await stopKnexAndQueue();
    // this should return the previous connection if already one exists
    await this.setUpMetaConnectionAsync();
    // use the revaAdmin conenction to drop the database
    await this.revaAdminConnection.dropDatabaseAsync(this.config.connection.database);
    await this.tearDownConnectionAsync();
  }
}

export function createUnitOfWork() {
  return new DatabaseUnitOfWork(knexConfig);
}
