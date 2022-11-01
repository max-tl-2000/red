/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

require('../../common/catchUncaughtException');
import chalk from 'chalk';
import { createUnitOfWork } from './databaseUnitOfWork';
import { knex } from '../database/factory';
import { saveTenant, updateTenant, createTenantAdminUser, getTenantByName, truncateTablesSqlFn } from '../dal/tenantsRepo';
import { createRabbitMQConnection } from '../common/pubsubConn';
import { clean } from '../workers/consumer';
import { tenant } from './test-tenant';
import { prepareRawQuery } from '../common/schemaConstants';
import loggerModule from '../../common/helpers/logger';
import envVal from '../../common/helpers/env-val';
import { stopExecutionOfRecurringJobs, enableExecutionOfCurrentJobs } from '../api/actions/jobs/job';
import { testCtx } from './repoHelper';

const keepDB = envVal('KEEP_DB', false);
const logger = loggerModule.child({ subType: 'setupTestGlobalContext' });

const adminCtx = { tenantId: 'admin' };
let database;
let currentChan;
let currentTest;

export const disableAggregationTriggers = async tenantId => {
  await knex.raw(
    prepareRawQuery(
      `ALTER TABLE db_namespace."PartyEvents" DISABLE TRIGGER "notify_party_events_table_changes_trg";
       ALTER SEQUENCE IF EXISTS db_namespace."partyMemberExternalIdSeq" RESTART;
       ALTER SEQUENCE IF EXISTS db_namespace."partyMemberExternalProspectIdSeq" RESTART;
       ALTER SEQUENCE IF EXISTS db_namespace."partyMemberExternalRoommateIdSeq" RESTART;
      `,
      tenantId,
    ),
  );
};

export const enableAggregationTriggers = async tenantId => {
  await knex.raw(prepareRawQuery('ALTER TABLE db_namespace."PartyEvents" ENABLE TRIGGER "notify_party_events_table_changes_trg";', tenantId));
};

const addTruncateFunction = async () => {
  await knex.raw(truncateTablesSqlFn());
};

const truncateTenantData = async tenantId => {
  const start = Date.now();
  logger.trace('truncate tenant data');
  await knex.raw(`SELECT admin.truncate_tables('${tenantId}');`);
  await knex.raw("SELECT admin.truncate_tables('common');");
  const took = Date.now() - start;
  logger.trace({ took: `${took} ms` }, 'truncate tenant data - completed');
};

const resetTenant = async () => {
  const { id: tenantId, metadata, settings, partySettings } = tenant;
  await updateTenant(adminCtx, tenantId, { metadata, settings, partySettings });
};

const tenantExist = async tenantName => {
  try {
    const oldTenantId = tenant.id;
    const res = await getTenantByName(adminCtx, tenantName);
    if (res.id !== oldTenantId) return false;
    if (res) {
      tenant.id = res.id;
      tenant.tenantId = res.id;
      tenant.refreshed_at = res.refreshed_at;
      tenant.authorization_token = res.authorization_token;
    }

    return !!res;
  } catch (err) {
    logger.warn({ tenantName }, '>>> tenant does not exist');
    return false;
  }
};

// Need to avoid arrow functions to be able to access "this"
// eslint-disable-next-line
before(async function() {
  logger.debug('→ Global before');

  try {
    const { chan } = await createRabbitMQConnection();
    currentChan = chan;

    database = createUnitOfWork();

    if (keepDB) {
      if (await tenantExist(tenant.name)) {
        logger.trace('>>> testTenanId was defined and tenant exists. Skipping tenant setup');
        return;
      }
    }

    logger.debug('-> Global before - setUpAsync');
    await database.setUpAsync();

    logger.debug('-> Global before - test tenant creation');
    await saveTenant(knex, adminCtx, tenant);
    tenant.tenantId = tenant.id; // This is needed as we use this object as ctx as well
    await disableAggregationTriggers(tenant.id);
    await addTruncateFunction();
    logger.debug('-> Global before - test tenant creation completed');
  } catch (error) {
    logger.error({ error }, 'Failed global before.');
    throw error;
  }
});

export const createResolverMatcher = (waiters = []) => {
  const addWaiters = toAdd => {
    waiters = waiters.concat(toAdd);
  };

  const completeWaiterForMsg = (payload, handlerSucceeded, msg, error) => {
    logger.debug({ currentTest, waiterError: error, handlerSucceeded, msg, length: waiters.length }, 'Before checking waiters');

    const idx = waiters.findIndex(waiter => waiter(payload, handlerSucceeded, msg, error));
    if (idx !== -1) waiters.splice(idx, 1);

    logger.debug({ currentTest, waiterError: error, handlerSucceeded, msg, length: waiters.length }, 'After checking waiters');
  };

  return {
    addWaiters,
    completeWaiterForMsg,
  };
};

let startTestTimestamp;
const cleanDataFromPreviousRun = async deleteTenantQueues => {
  const ctx = { tenantId: tenant.id };
  await stopExecutionOfRecurringJobs(ctx, { waitBetweenChecks: 200 });
  await truncateTenantData(tenant.id);
  await resetTenant();
  await disableAggregationTriggers(tenant.id);
  await createTenantAdminUser(knex, tenant);
  await clean(currentChan, deleteTenantQueues);
  await enableExecutionOfCurrentJobs();
};

beforeEach(async function _beforeEach() {
  startTestTimestamp = Date.now();
  const testTitle = `${this.currentTest.fullTitle()} File:${this.currentTest.file}`;
  currentTest = testTitle;
  const logs = [];

  // To avoid affect integration testing the cache is removed from testCtx
  delete testCtx.cache;

  try {
    logger.info(chalk.green.bold(`→ starting ${testTitle}`));
    logs.push({ msg: '→ starting global before each', level: 'debug' });
    logger.warn('================BEFORE EACH - cleaning data ================');
    await cleanDataFromPreviousRun(false);
    logger.warn('================BEFORE EACH - after cleaning data ================');

    const endTestTimestamp = Date.now();
    logger.warn(`BeforeEach took: ${endTestTimestamp - startTestTimestamp} ms.`);
  } catch (error) {
    logs.push({ data: { error }, msg: `Failed global beforeEach for ${testTitle}`, level: 'error' });
    logs.forEach(entry => logger[entry.level](entry.data || {}, entry.msg));
    throw error;
  }
});

afterEach(async function _afterEach() {
  const testTitle = `${this.currentTest.fullTitle()} File:${this.currentTest.file}`;
  logger.info(chalk.green.bold(`→ finished ${testTitle}`));
  logger.warn('================AFTER EACH - test run completed ================');
  const endTestTimestamp = Date.now();
  if (endTestTimestamp - startTestTimestamp > 2000) {
    logger.warn(`Test took: ${endTestTimestamp - startTestTimestamp} ms.`);
  }
  if (this.currentTest.state === 'failed') {
    logger.error(chalk.red.bold(`✘✘✘ FAILURE: Scenario - ${this.currentTest.fullTitle()} - File - ${this.currentTest.file}`));
  }
});

after(async function _after() {
  if (!keepDB) {
    logger.trace('about to cleanDataFromPreviousRun');
    await cleanDataFromPreviousRun(true);
    logger.trace('about to tearDownAsync');
    await database.tearDownAsync();
    logger.trace('back from tearDownAsync');
  }
  // just to make sure we can access file
  // as currentTest might be undefined if no tests are executed
  this.currentTest && logger.debug(chalk.green(`<-- Done with tests in ${this.currentTest.file}`));
});

export const db = () => database;
export const chan = () => currentChan;

export { tenant };

export const getDBConnection = () => knex;
