/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import v4 from 'uuid/v4';
import fs from 'fs';
import omit from 'lodash/omit';
import Promise, { mapSeries } from 'bluebird';
import chunk from 'lodash/chunk';
import { knex, runInTransaction, updateJSONBField, initQuery, rawStatement } from '../database/factory';
import config from '../config';
import { hash } from '../helpers/crypto';
import { admin, prepareRawQuery, common } from '../common/schemaConstants';
import { tenantAdminEmail } from '../../common/helpers/database';
import { addRentappTablesToTenant } from '../../rentapp/server/database/schema-setup';
import { deleteCommonInformation } from '../../auth/server/dal/common-user-repo';
import { deleteMigrationFiles } from './knexRepo';
import { migrationsToDelete } from './migrationsToDelete/tenant';
import { migrationsToDelete as migrationsToDeleteCommon } from './migrationsToDelete/common';
import { migrationsToDelete as migrationsToDeleteAdmin } from './migrationsToDelete/admin';
import { getTenantData as getTenantDataHelper, prepareTenantData, TENANT_SETTINGS, DATA_DIRECTION } from './helpers/tenantsRepo';

import loggerModule from '../../common/helpers/logger';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { getCtxCache, setCtxCache } from '../../common/server/ctx-cache';

const logger = loggerModule.child({ subType: 'tenantsRepo' });

const TENANT = 'Tenant';

const doExecuteQueries = async (conn, queries, comment) => {
  if ((queries || []).length === 0) return [];

  const startTime = new Date().getTime();
  let result;
  if (typeof queries === 'string') {
    result = await conn.raw(`${queries}`);
  } else {
    const maxConcurrentQueries = 10;
    const queryGroups = chunk(queries, queries.length / maxConcurrentQueries);
    logger.trace(`executing ${queries.length} queries in ${queryGroups.length} connections for: ${comment}`);

    result = await mapSeries(queryGroups, async queryGroup => {
      const groupedQuery = queryGroup.join('\n');
      return await conn.raw(`${groupedQuery}`);
    });
  }
  const endTime = new Date().getTime();
  logger.trace(`Cloning ${comment} finished after: ${endTime - startTime} ms`);
  return result;
};

const executeQueries = (...args) => {
  const p = doExecuteQueries(...args);

  p.catch(err => logger.error({ err }, 'executeQueries error'));

  return p;
};

export const cloneSchema = async (conn, source, destination, newSchemaName) => {
  logger.trace(`Cloning DB schema ${source} to ${destination}`);

  const queries = await executeQueries(
    conn,
    `SELECT admin.clone_schema_first_step('${source}', '${destination}', TRUE);`,
    `DB schema first step ${source} to ${destination}`,
  );

  // Create the tables
  await executeQueries(conn, queries.rows[0].clone_schema_first_step, `${source} tables to ${destination}`);

  // Foreign keys have to be executed sequentially to prevent deadlocks
  await executeQueries(conn, queries.rows[1].clone_schema_first_step, 'fk constraints');

  // Materialized views
  await executeQueries(conn, queries.rows[2].clone_schema_first_step, 'materialize views');

  // Run the last step
  await executeQueries(conn, `SELECT admin.clone_schema_last_step('${source}', '${destination}');`, `DB schema last step ${source} to ${destination}`);

  // Fix CHECK constraint definitions
  await executeQueries(conn, `SELECT admin.fix_check_constraints('${source}', '${destination}');`);

  newSchemaName && (await conn.raw(`COMMENT ON SCHEMA "${destination}" IS '${newSchemaName}'`));
};

export const renameSchema = async (conn, source, destination) => {
  logger.trace(`Renaming DB schema ${source} to ${destination}`);

  const startTime = new Date().getTime();
  await conn.raw(`ALTER SCHEMA "${source}" RENAME TO "${destination}";`);
  const endTime = new Date().getTime();
  logger.trace(`Renaming DB schema ${source} to ${destination} finished after: ${endTime - startTime} ms`);
};

export const createTenantBaseSchema = async (conn, tenant, schema = 'tenant', useLeasingCommon = true) => {
  const tenantId = tenant.id;

  logger.time(`Creating tenant schema for tenantId: ${tenantId}`);

  await conn.raw(`CREATE SCHEMA IF NOT EXISTS "${tenantId}"`);

  const readFile = Promise.promisify(fs.readFile);
  if (useLeasingCommon) {
    let commonStatement = await readFile(path.join(__dirname, '../database/schema/leasing-common.sql'), 'utf8');
    commonStatement = prepareRawQuery(commonStatement, tenantId);
    await conn.raw(commonStatement);
    logger.trace(`Created tenant common schema: ${tenant.id}`);
  }

  let structure = await readFile(path.join(__dirname, `../database/schema/${schema}.sql`), 'utf8');
  structure = prepareRawQuery(structure, tenantId);
  await conn.raw(structure);

  if (!['common', 'public', 'admin'].includes(tenantId)) {
    let data = await readFile(path.join(__dirname, `../database/schema/${schema}_data.sql`), 'utf8');
    data = prepareRawQuery(data, tenantId);
    await conn.raw(data);
  }

  logger.timeEnd(`Creating tenant schema for tenantId: ${tenantId}`);
};

export const migrateTenantSchema = async (conn, tenant) => {
  const tenantId = tenant.id;
  logger.time(`migrateTenantSchema for tenantId: ${tenantId}`);

  const directory = tenant.migrations_path ? path.join(config.knexConfig.migrations.directory, tenant.migrations_path) : config.knexConfig.migrations.directory;

  logger.trace(`Migrating DB tables for tenant ${tenantId} from path ${directory}`);

  try {
    if (tenantId === 'common' && migrationsToDeleteCommon.length > 0) {
      await deleteMigrationFiles(tenant.id, migrationsToDeleteCommon);
    } else if (tenantId === 'admin' && migrationsToDeleteAdmin.length > 0) {
      await deleteMigrationFiles(tenant.id, migrationsToDeleteAdmin);
    } else if (!['common', 'public', 'admin'].includes(tenantId) && migrationsToDelete.length > 0) {
      await deleteMigrationFiles(tenant.id, migrationsToDelete);
    }

    const { migrate } = knex.withUserParams({ tenantId });
    await migrate.latest({
      directory,
      tableName: 'knex_migrations',
      schemaName: tenantId,
    });

    if (!['common', 'public'].includes(tenantId)) {
      const readFile = Promise.promisify(fs.readFile);
      let triggerSql = await readFile(path.join(__dirname, '../database/schema/updated_at_triggers.sql'), 'utf8');
      triggerSql = prepareRawQuery(triggerSql, tenantId);
      await conn.raw(triggerSql);
    }

    logger.trace(`Migrated DB tables for tenant ${tenantId} from path ${directory}`);
  } catch (e) {
    logger.error({ error: e }, `Migration failed for tenant ${tenantId}!`);
    throw e;
  }

  logger.timeEnd(`migrateTenantSchema for tenantId: ${tenantId}`);
};

export const rollbackTenantMigration = async (conn, tenant) => {
  const tenantId = tenant.id;

  const directory = tenant.migrations_path ? path.join(config.knexConfig.migrations.directory, tenant.migrations_path) : config.knexConfig.migrations.directory;

  logger.trace(`Rollback migration for tenant ${tenantId} from path ${directory}`);

  try {
    const { migrate } = knex.withUserParams({ tenantId });
    await migrate.rollback({
      directory,
      tableName: 'knex_migrations',
      schemaName: tenantId,
    });
    logger.trace(`Rollback migration completed for tenant ${tenantId} from path ${directory}`);
  } catch (e) {
    logger.error({ error: e }, `Rollback migration failed for tenant ${tenantId}!`);
  }
};

export const createTenantAdminUser = async (conn, tenant) => {
  const user = {
    id: v4(),
    externalUniqueId: v4(),
    fullName: `admin ${tenant.name}`,
    preferredName: 'admin',
    email: tenantAdminEmail,
    password: await hash('admin'),
    metadata: { wasInvited: true, isAdmin: true },
    created_at: new Date(),
    updated_at: new Date(),
  };

  await conn.withSchema(tenant.id).into('Users').insert(user);

  logger.trace(`Created admin user for tenant ${tenant.id}`);
};

export const createTenantSchema = async (conn, tenant) => {
  logger.time(`createTenantSchema for tenantId: ${tenant.id}`);

  await createTenantBaseSchema(conn, tenant);

  // TODO: move this into a listener hook in rentapp
  await addRentappTablesToTenant(conn, tenant);

  await migrateTenantSchema(conn, tenant);

  await createTenantAdminUser(conn, tenant);

  logger.timeEnd(`createTenantSchema for tenantId: ${tenant.id}`);
};

export const saveTenant = async (conn, ctx, tenant) => {
  tenant.authorization_token = v4();

  tenant.refreshed_at = new Date();
  const [res] = await conn.withSchema(ctx.tenantId).insert(prepareTenantData(tenant, DATA_DIRECTION.IN)).into(TENANT).returning('*');
  tenant.refreshed_at = res.refreshed_at;
  await cloneSchema(conn, 'template_schema', tenant.id, tenant.name);

  return res;
};

export const getTenants = async (conn, ctx) => getTenantDataHelper(await initQuery(ctx).from(TENANT));

export const getTenantSettingsByIdQuery = tenantId => knex.select('settings').from(`admin.${TENANT}`).where({ id: tenantId }).first();

const getTenantSetting = async (ctx, tenantId, setting) => {
  const query = `SELECT id, name, settings->'${setting}' AS "${setting}", settings->'sensitiveData'->'${setting}' AS "sensitiveData"
    FROM db_namespace."${TENANT}"
    WHERE id = :tenantId`;

  const { rows = [] } = await rawStatement(ctx, query, [{ tenantId }]);
  const result = rows[0] || {};

  const prepareResults = { settings: { [setting]: result[setting], sensitiveData: result.sensitiveData }, ...omit(result, [setting, 'sensitiveData']) };
  const tenantSetting = prepareTenantData(prepareResults);

  const requestedSetting = { ...tenantSetting.settings[setting], ...tenantSetting.settings.sensitiveData };
  const { settings, ...restOfResults } = tenantSetting;

  return { ...restOfResults, [setting]: requestedSetting };
};

export const getTenantScreeningSettings = async (ctx, tenantId) => await getTenantSetting(ctx, tenantId, TENANT_SETTINGS.SCREENING);
export const getTenantRemoteFtpSettings = async (ctx, tenantId) => await getTenantSetting(ctx, tenantId, TENANT_SETTINGS.REMOTE_FTP);

const setTenantDataCtxCache = (ctx, tenantName, tenantId, tenantData) => {
  const getTenantDataCachedPath = `dal.tenants.getTenantData.${tenantId}`;
  const getTenantByNameCachedPath = `dal.tenants.getTenantByName.${tenantName}`;

  setCtxCache(ctx, getTenantDataCachedPath, tenantData, { tenantId });
  setCtxCache(ctx, getTenantByNameCachedPath, tenantData, { tenantId });
  setCtxCache(ctx, getTenantDataCachedPath, tenantData, { tenantId: admin.id });
  setCtxCache(ctx, getTenantByNameCachedPath, tenantData, { tenantId: admin.id });
};

export const getTenantByName = async (ctx, name) => {
  if (!name) throw new Error('name parameter is required');

  const tenantId = ctx.tenantId;
  if (!tenantId) ctx.tenantId = admin.id;

  const cachePath = `dal.tenants.getTenantByName.${name}`;
  const tenantCache = getCtxCache(ctx, cachePath);
  if (tenantCache) {
    return tenantCache;
  }

  const query = `SELECT *
                 FROM admin."${TENANT}"
                 WHERE name = '${name}'
	               OR metadata->'previousTenantNames' @> '[{"name": "${name}"}]'`;

  const {
    rows: [tenant],
  } = await rawStatement(ctx, query);

  ctx.tenantId = tenantId;

  const tenantData = getTenantDataHelper([tenant])[0];

  setTenantDataCtxCache(ctx, name, tenantData?.id, tenantData);

  return tenantData;
};

export const getTenantIdByName = async (ctx, tenantName) => {
  const { id: tenantId } = (await getTenantByName(ctx, tenantName)) || {};
  return tenantId;
};

export const getTenantData = async (ctx, id, refreshCache = false) => {
  const tenantId = id ?? ctx.tenantId;

  if (!tenantId) throw new Error('tenantId parameter is required');

  const tenantIdInCtx = ctx.tenantId;
  if (!tenantIdInCtx) ctx.tenantId = admin.id;

  const cachePath = `dal.tenants.getTenantData.${tenantId}`;
  const tenantCache = getCtxCache(ctx, cachePath);
  if (tenantCache && !refreshCache) {
    return tenantCache;
  }

  const query = `SELECT *
                 FROM admin."${TENANT}"
                 WHERE id = '${tenantId}'
                 OR metadata->'previousTenantNames' @> '[{"id": "${tenantId}"}]'`;

  const {
    rows: [tenant],
  } = await rawStatement(ctx, query);

  ctx.tenantId = tenantIdInCtx;

  const tenantData = getTenantDataHelper([tenant])[0];

  setTenantDataCtxCache(ctx, tenantData?.name, tenantId, tenantData);

  return tenantData;
};

export const getTenantByAuthToken = async (conn, ctx, token) => {
  const query = `SELECT *
                 FROM admin."${TENANT}"
                 WHERE authorization_token = '${token}'
                 OR metadata->'previousTenantNames' @> '[{"auth_token": "${token}"}]'`;

  const {
    rows: [tenant],
  } = await rawStatement(ctx, query, [{ token }]);
  return getTenantDataHelper([tenant])[0];
};

export const updateTenant = async (ctx, tenantId, delta) => {
  !delta.updated_at && Object.assign(delta, { updated_at: new Date() });

  const [tenant] = await initQuery(ctx).from(TENANT).where({ id: tenantId }).update(prepareTenantData(delta, DATA_DIRECTION.IN)).returning('*');

  return tenant;
};

// the following function is expected to be called as is
// so no need to add async await here
// eslint-disable-next-line
const dropTenantSchema = tenantId => knex.raw(`DROP SCHEMA "${tenantId}" CASCADE`);

export const deleteTenant = async (ctx, tenantId) =>
  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const deleteSandboxJobQuery = 'DELETE FROM db_namespace."CreateSandboxJob" WHERE "tenantId" = :tenantId;';

    await rawStatement(innerCtx, deleteSandboxJobQuery, [{ tenantId }]);
    const query = `DELETE FROM db_namespace."${TENANT}" WHERE id = :tenantId RETURNING id`;
    const {
      rows: [id],
    } = await rawStatement(innerCtx, query, [{ tenantId }]);

    if (id) {
      await dropTenantSchema(tenantId).transacting(innerCtx.trx);
      await deleteCommonInformation(innerCtx, tenantId);
    }
  }, ctx);

const unmarkPhoneNumberAsUsed = tenantMetadata => {
  const tenantPhoneNumbers = tenantMetadata.phoneNumbers.map(pn => ({
    phoneNumber: pn.phoneNumber,
  }));
  return {
    ...tenantMetadata,
    phoneNumbers: tenantPhoneNumbers,
  };
};

export const recreateTenantSchema = async (conn, ctx, tenantId) => {
  logger.time(`Recreate database schema for tenant ${tenantId}`);
  const tenant = await getTenantData(ctx, tenantId);

  await dropTenantSchema(tenantId);
  await deleteCommonInformation(ctx, tenantId);
  await cloneSchema(conn, 'template_schema', tenantId, tenant.name);

  const tenantMetadata = unmarkPhoneNumberAsUsed(tenant.metadata);
  await updateTenant(ctx, tenantId, {
    refreshed_at: new Date(),
    metadata: tenantMetadata,
  });

  logger.timeEnd(`Recreate database schema for tenant ${tenantId}`);
};

export const getTenantReservedPhoneNumbers = async outerCtx => {
  // TODO: We need to check this again when the cache behavior change
  // We are removing the cache from ctx for this behavior because is affecting some cases related to importPrograms loadDbData
  const { cache, ...ctx } = outerCtx;
  const tenant = await getTenantData(ctx);
  return tenant.metadata.phoneNumbers;
};

export const saveTenantMetadata = async (ctx, tenantId, metadata, trx) => {
  await execConcurrent(
    Object.keys(metadata),
    async key =>
      await updateJSONBField({
        schema: admin.id,
        table: 'Tenant',
        tableId: tenantId,
        field: 'metadata',
        key,
        value: metadata[key],
        outerTrx: trx,
      }),
  );

  // Chris: Note to Christophe. This should no longer be here once we detect correctly when we stop doing gets from DB
  ctx.cache = undefined;
};

export const updateTenantPhoneNumbers = async (ctx, tenant, phoneNumbers) => {
  logger.trace({ ctx, updatedTenantId: tenant.id }, 'updateTenantPhoneNumbers');
  return await updateTenant({ tenantId: admin.id }, tenant.id, {
    metadata: { ...tenant.metadata, phoneNumbers },
  });
};

export const markPhoneNumberAsUsed = async (ctx, tenantId, tenantReservedPhoneNumbers, phoneOwnerType, phoneOwnerId, phoneNumber, trx) => {
  const phoneNumbers = tenantReservedPhoneNumbers.map(phone => {
    if (phone.phoneNumber === phoneNumber) {
      return {
        ...phone,
        isUsed: true,
        ownerType: phoneOwnerType,
        ownerId: phoneOwnerId,
      };
    }

    return phone;
  });

  await saveTenantMetadata(ctx, tenantId, { phoneNumbers }, trx);
};

export const getSchemaInformation = async (conn, tenantId) =>
  await conn.raw(`
    SELECT DISTINCT table_name, column_name
      FROM information_schema.columns
    WHERE table_schema = '${tenantId}'
    AND table_name NOT IN ('knex_migrations', 'knex_migrations_lock', 'ResetTokens', 'UsersInvites', 'CallQueue', 'LeaseSubmissionTracking',
                           'RecurringJobs', 'Jobs', 'PartySearch', 'PersonMessage', 'PersonRelationship', 'PersonSearch',
                           'PersonStrongMatches', 'PersonToPersonCommunication', 'Tokens', 'RingCentralEvents', 'NavigationHistory',
                           'CommunicationDrafts', 'MRIExportTracking', 'ImportFilesChecksums', 'AppSettings')
    ORDER BY 1,2;
  `);

// eslint-disable-next-line
export const getTenantByIdQuery = tenantId => knex.raw(prepareRawQuery('SELECT name FROM db_namespace."Tenant" WHERE id = :tenantId', admin.id), { tenantId });

export const truncateTablesSqlFn = ({
  excludeKnexMigrations = true,
  excludeCommonProgramSources = true,
  excludeRecurringJobs = true,
  excludeAppSettings = true,
  excludeSubscriptions = true,
} = {}) => {
  // in testcafe we are fine removing the data from knex_migration
  // table since we will anyway restore it from the backup
  const excludeKnexMigrationStatement = excludeKnexMigrations ? "AND table_name <> 'knex_migrations'" : '';

  const excludeCommonProgramSourcesStatement = excludeCommonProgramSources ? `AND (schema_name <> '${common.id}' OR table_name <> 'ProgramSources')` : '';

  const excludeRecurringJobsStatement = excludeRecurringJobs ? "AND table_name <> 'RecurringJobs'" : '';

  const excludeAppSettingsStatement = excludeAppSettings ? "AND table_name <> 'AppSettings'" : '';

  const excludeSubscriptionsStatement = excludeSubscriptions ? "AND table_name <> 'Subscriptions'" : '';

  return `
  CREATE OR REPLACE FUNCTION admin.truncate_tables(schema_name text) RETURNS void AS $$
  DECLARE
      statements CURSOR FOR
          SELECT * FROM admin.rowcount_all(schema_name)
          WHERE cnt > 0
          ${excludeKnexMigrationStatement}
          ${excludeCommonProgramSourcesStatement}
          ${excludeRecurringJobsStatement}
          ${excludeAppSettingsStatement}
          ${excludeSubscriptionsStatement}
          ORDER BY cnt DESC;
  DECLARE begin_time BIGINT;
  DECLARE end_time BIGINT;
  BEGIN
      FOR stmt IN statements LOOP
          begin_time := extract(epoch from clock_timestamp()) * 1000;
          EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE', schema_name, stmt.table_name);
          end_time := extract(epoch from clock_timestamp()) * 1000;
          RAISE WARNING 'Truncating data TABLE=% COUNT=% took:% ', stmt.table_name, stmt.cnt, (end_time - begin_time);
      END LOOP;
  END;
  $$ LANGUAGE plpgsql;`;
};
