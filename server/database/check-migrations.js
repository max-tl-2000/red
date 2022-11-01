/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fs from 'fs';
import textTable from 'text-table';
import chalk from 'chalk';
import config from '../config';
import { getTenantLatestMigration, getTenantMigrations } from '../services/schemaSetup';
import { getTenants } from '../services/tenantService';
import { admin, TEMPLATE_SCHEMA, RESERVED_TENANTS } from '../common/schemaConstants';
import { error } from '../../resources/logger';

const MIGRATIONS_DIR = config.knexConfig.migrations.directory;
const SUCCESS = 'SUCCESS';
const FAILURE = 'FAILED';

const isHiddenPath = filePath => /(^|\/)\.[^/.]/g.test(filePath);

const isValidPath = filePath => fs.existsSync(filePath);

const getFilesInDirectory = (dir, ignoreHiddenPaths = true, fileType = '.js') =>
  fs
    .readdirSync(dir)
    .filter(file => !(ignoreHiddenPaths && isHiddenPath(file)))
    .filter(file => file.endsWith(fileType))
    .filter(file => fs.statSync(path.join(dir, file)).isFile())
    .sort();

const getDirectoryNamesInPath = dir => fs.readdirSync(dir).filter(file => fs.statSync(path.join(dir, file)).isDirectory());

const getTenantSchemasWithSrcMigrations = async () => {
  const migrations = getFilesInDirectory(MIGRATIONS_DIR);
  const results = await getTenants();

  return results.tenants.filter(tenant => tenant.id !== admin.id).map(tenant => ({ tenant, migrations }));
};

const getReservedTenantSchemasWithSrcMigrations = () => {
  const reservedTenantsDirectories = getDirectoryNamesInPath(MIGRATIONS_DIR);
  reservedTenantsDirectories.push(TEMPLATE_SCHEMA); // template_schema uses MIGRATIONS_DIR

  return reservedTenantsDirectories.map(reservedTenantName => {
    let reservedTenantMigrationDir = path.join(MIGRATIONS_DIR, reservedTenantName);

    if (!isValidPath(reservedTenantMigrationDir)) {
      reservedTenantMigrationDir = MIGRATIONS_DIR;
    }

    const migrations = getFilesInDirectory(reservedTenantMigrationDir);
    const tenant = RESERVED_TENANTS.get(reservedTenantName);
    return { tenant, migrations };
  });
};

const getResultsTableHeader = () => [
  chalk.yellow('Tenant Name'),
  chalk.yellow('Tenant Id'),
  chalk.yellow('Latest Migration in SRC'),
  chalk.yellow('Tenant Latest Migration'),
  chalk.yellow('Migrations Applied (DB/SRC)'),
  chalk.yellow('STATUS'),
];

const getMissingMigrationsTableHeader = () => [chalk.yellow('Tenant Name'), chalk.yellow('Missing Migrations')];

const getRowColor = result => (result === SUCCESS ? 'green' : 'red');

const getResultsRow = tenantMigration => [
  chalk[getRowColor(tenantMigration.result)](tenantMigration.tenant.name),
  chalk[getRowColor(tenantMigration.result)](tenantMigration.tenant.id),
  chalk[getRowColor(tenantMigration.result)](tenantMigration.latestMigration),
  chalk[getRowColor(tenantMigration.result)](tenantMigration.tenantLatestDBMigration),
  chalk[getRowColor(tenantMigration.result)](`${tenantMigration.migrationsInDb}/${tenantMigration.migrationsInSrc}`),
  chalk[getRowColor(tenantMigration.result)](tenantMigration.result),
];

const getAlignment = headers => {
  const alignment = headers.map(() => 'l');
  return { align: alignment };
};

const getMissingMigrationsRow = (tenant, migrations) => [chalk[getRowColor(FAILURE)](tenant), chalk[getRowColor(FAILURE)](migrations)];

const logResults = (results, header = getResultsTableHeader) => {
  if (results && results.length) {
    results.unshift(header());
    console.log(textTable(results, getAlignment(header())), '\n');
  }
};

const migrationListsAreEqual = (migrationsInSrc, tenantMigrations) => migrationsInSrc.every((x, index) => tenantMigrations[index] === x);

const migrationFailed = (migrationsInSrc, tenantMigrations) =>
  migrationsInSrc.length !== tenantMigrations.length || !migrationListsAreEqual(migrationsInSrc, tenantMigrations);

const getMissingMigrations = (migrationsInSrc, tenantMigrations) => migrationsInSrc.filter(migration => !tenantMigrations.includes(migration));

const isDatabaseMigrated = async () => {
  let isDbMigrated = true;
  const migrationResults = [];
  const missingMigrationsResults = [];

  const tenantSchemasMigrations = await getTenantSchemasWithSrcMigrations();
  const reservedTenantSchemasMigrations = getReservedTenantSchemasWithSrcMigrations();
  const schemasMigrations = [...reservedTenantSchemasMigrations, ...tenantSchemasMigrations];

  for (const tenantMigration of schemasMigrations) {
    const { tenant, migrations: migrationsInSrc } = tenantMigration;

    const tenantLatestDBMigration = await getTenantLatestMigration(tenant);
    let tenantMigrations = await getTenantMigrations(tenant);
    tenantMigrations = tenantMigrations.map(migration => migration.name);

    tenantMigration.latestMigration = migrationsInSrc.slice(-1).pop();
    tenantMigration.tenantLatestDBMigration = tenantLatestDBMigration;
    tenantMigration.migrationsInSrc = migrationsInSrc.length;
    tenantMigration.migrationsInDb = tenantMigrations.length;
    tenantMigration.result = SUCCESS;

    if (migrationFailed(migrationsInSrc, tenantMigrations)) {
      isDbMigrated = false;
      tenantMigration.result = FAILURE;
      missingMigrationsResults.push(getMissingMigrationsRow(tenantMigration.tenant.name, getMissingMigrations(migrationsInSrc, tenantMigrations).join(', ')));
    }

    migrationResults.push(getResultsRow(tenantMigration));
  }

  logResults(migrationResults);
  logResults(missingMigrationsResults, getMissingMigrationsTableHeader);

  return isDbMigrated;
};

const main = async () => {
  if (!(await isDatabaseMigrated())) {
    process.exit(1); // eslint-disable-line
  }
};

main()
  .then(process.exit)
  .catch(err => {
    error({ err }, 'An error ocurred while checking migrations');
    process.exit(1); // eslint-disable-line
  });
