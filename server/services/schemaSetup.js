/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Promise from 'bluebird';
import { getTenants, createTenantSchema, createTenantBaseSchema, migrateTenantSchema, rollbackTenantMigration } from '../dal/tenantsRepo';
import { createTenant, notifyTenantCreated } from './tenantService';
import { admin, common, COMMON, RED, templateSchema, ADMIN } from '../common/schemaConstants';
import { getLastMigrationFile, getMigrations } from '../dal/knexRepo';
import envVal from '../../common/helpers/env-val';
import loggerInstance from '../../common/helpers/logger';

const ctx = { tenantId: admin.id };

const logger = loggerInstance.child({ subType: 'schemaSetup' });

export async function setupDefaultSchema(conn) {
  await createTenantBaseSchema(conn, admin, ADMIN);
  await migrateTenantSchema(conn, admin);

  await createTenantBaseSchema(conn, common, COMMON, false);
  await migrateTenantSchema(conn, common);

  await createTenantSchema(conn, templateSchema);

  if (envVal('TESTCAFE_ENV', false)) {
    logger.info('Skipping the creation of red tenant in testcafe env');
    return;
  }

  const redTenant = {
    id: 'c3e94369-109d-422d-89a0-81d9a5d536cb',
    name: RED,
  };

  const createdTenant = await createTenant(conn, ctx, redTenant);
  await notifyTenantCreated(ctx, createdTenant);
}

export async function migrateSchema(conn) {
  await migrateTenantSchema(conn, admin);
  await migrateTenantSchema(conn, common);
  await migrateTenantSchema(conn, templateSchema);

  const tenants = await getTenants(conn, ctx);
  await Promise.each(tenants, async tenant => {
    await migrateTenantSchema(conn, tenant);
  });
}

export async function rollbackMigration(conn) {
  await rollbackTenantMigration(conn, admin);
  await rollbackTenantMigration(conn, common);
  await rollbackTenantMigration(conn, templateSchema);

  const tenants = await getTenants(conn, ctx);
  await Promise.each(tenants, async tenant => {
    await rollbackTenantMigration(conn, tenant);
  });
}

export const getTenantLatestMigration = async tenant => await getLastMigrationFile(tenant.id);

export const getTenantMigrations = async tenant => await getMigrations(tenant.id);
