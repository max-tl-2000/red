/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import cfg from '../config';
import { deferred } from '../../common/helpers/deferred';
import { exists } from '../../common/helpers/xfs';
import {
  createTenant,
  deleteTenant,
  refreshTenant,
  patchTenant,
  createGuestApplication,
  getAllTenants,
  clearRabbitMqQueues,
  getAvailableCucumberPhoneNumber,
  loginAdminUser,
  setAuthToken,
  createTruncanteFn,
  truncateTablesOnTenants,
  disableAutomaticLogout,
} from '../lib/utils/apiHelper';

import eventTypes from '../../common/enums/eventTypes';
import { connect as connectSocketClient, disconnect as disconnectSocketClient, subscribe as subscribeSocketClient } from '../../common/helpers/socketClient';

import logger from '../../common/helpers/logger';
import execp from '../../resources/execp';
import { TEST_TENANT_ID } from '../../common/test-helpers/tenantInfo';
import { doAndRetry } from '../../common/helpers/attempt';

// the tenantId to use when the cucumber tests are executed skipping the db creation
export const CUCUMBER_DEFAULT_TEST_ID = 'reva_4_ever';

const { cloudEnv, cucumber } = cfg;

const CUCUMBER_BK_FILE = './cucumber/bk.sqlc';
const { coredbContainerName, coredbAdminPassword: dbPassword, coredbAdminUser: dbUser } = cucumber;

const restoreDBFromBackup = process.env.RESTORE_DB_FROM_BACKUP === 'true';
const socketOpts = { once: true };

export const getTenant = () => ({
  name: cucumber.tenantName,
  id: TEST_TENANT_ID,
  metadata: {
    phoneNumbers: [
      { phoneNumber: '12255550180' },
      { phoneNumber: '12255550181' },
      { phoneNumber: '12255550182' },
      { phoneNumber: '12255550183' },
      { phoneNumber: '12255550184' },
      { phoneNumber: '12255550185' },
      { phoneNumber: '12255550186' },
      { phoneNumber: '12255550187' },
      { phoneNumber: '12255550188' },
      { phoneNumber: '12255550189' },
      { phoneNumber: '12255550190' },
      { phoneNumber: '12255550191' },
      { phoneNumber: '12255550192' },
      { phoneNumber: '12255550193' },
    ],
    enablePhoneSupport: cucumber.enablePhoneSupport,
    revaPricingAsRms: true,
  },
});

export { loginAdminUser, setAuthToken, connectSocketClient, disconnectSocketClient };

export const tenant = getTenant();

const provisioningTimeout = cucumber.provisioningTimeout;

export const createCucumberTenant = async () => {
  const notificationPromise = deferred({ timeout: provisioningTimeout, id: 'commProviderSetupDone' });
  subscribeSocketClient(eventTypes.COMM_PROVIDER_SETUP_DONE, notificationPromise.resolve, socketOpts);
  logger.info('About to trigger create tenant');
  await createTenant(tenant);
  logger.info(`Waiting up to ${provisioningTimeout / 1000} seconds for COMM_PROVIDER_SETUP_DONE`);
  await notificationPromise;
  logger.trace('Create Cucumber tenant - done.');
};

export const deleteCucumberTenant = async cucumberTenant => {
  logger.info('Deleting cucumber tenant');
  const notificationPlivoCleanupPromise = deferred({ timeout: provisioningTimeout, id: 'plivoCleanedUp' });
  subscribeSocketClient(eventTypes.REMOVE_TENANT_PLIVO_CLEANUP_DONE, notificationPlivoCleanupPromise.resolve, socketOpts);

  logger.info('About to trigger delete tenant');
  await deleteTenant(cucumberTenant);

  logger.info(`Waiting up to ${provisioningTimeout / 1000} seconds for Plivo Cleanup`);
  await notificationPlivoCleanupPromise;

  logger.trace('Delete Cucumber tenant - done.');
};

// make sure we don't have tenant from previous unsuccessfully run
export const clearEnvironment = async () => {
  logger.info('Clearing environment');
  await clearRabbitMqQueues();

  logger.trace('Attempting to get the tenants');
  const tenants = await getAllTenants(tenant);

  logger.debug({ tenants }, 'Tenants found');
  const cucumberTenant = tenants.tenants.find(t => t.name === tenant.name);

  if (cucumberTenant) {
    logger.trace(`Cucumber tenant already exists (${cucumberTenant.id}). It will be deleted.`);
    await deleteCucumberTenant(cucumberTenant);
  }

  logger.info('Clearing environment - done.');
};

export const updateCucumberTenant = async () => {
  logger.info({ tenant }, 'updating cucumber tenant to ');

  const notificationPromise = deferred({ timeout: provisioningTimeout, id: 'phoneAssignationSuccess' });
  subscribeSocketClient(eventTypes.PHONENO_ASSIGNATION_SUCCESS, notificationPromise.resolve, socketOpts);

  logger.info('About to trigger update tenant');
  await patchTenant(tenant);

  logger.info(`Waiting up to ${provisioningTimeout / 1000} seconds for PHONENO_ASSIGNATION_SUCCESS`);
  await notificationPromise;

  logger.trace('Update Cucumber tenant - done.');
};

const refreshCucumberTenant = async ({ testId, rejectOnFailure = false } = {}) => {
  const notificationPromise = deferred({ timeout: provisioningTimeout * 2, id: 'refreshTenatSchemaDone' });
  subscribeSocketClient(
    eventTypes.REFRESH_TENANT_SCHEMA_DONE,
    data => {
      if (data && !data.successfully) {
        logger.error({ data }, 'Refresh tenant failed');

        if (rejectOnFailure) {
          notificationPromise.reject('REFRESH TENANT SCHEMA FAILED');
          return;
        }
      }

      // The refresh fails, but cucumber tests are able to be executed
      // the failures are mostly due to deadlocks
      notificationPromise.resolve();
    },
    socketOpts,
  );

  logger.info('About to trigger refresh tenant with testId', testId);
  await refreshTenant(tenant, testId);

  logger.info(`Waiting up to ${provisioningTimeout / 1000} seconds for REFRESH_TENANT_SCHEMA_DONE`);
  await notificationPromise;

  logger.trace('Refresh Cucumber tenant - done.');
};

export const createPlivoGuestApplication = async () => {
  const notificationPromise = deferred({ timeout: provisioningTimeout, id: 'createPlivoGuestApplicationDone' });
  subscribeSocketClient(eventTypes.CREATE_PLIVO_GUEST_APPLICATION_DONE, notificationPromise.resolve, socketOpts);

  logger.info('About to trigger create guest application');
  await createGuestApplication(tenant);

  logger.info(`Waiting up to ${provisioningTimeout / 1000} seconds for CREATE_PLIVO_GUEST_APPLICATION_DONE`);
  await notificationPromise;

  logger.trace('Create guest application - done.');
};

export const getCucumberPhoneNumber = async () => {
  const plivoEnvData = cucumber.plivo;
  const envData = plivoEnvData.find(item => item.cloudEnv === cloudEnv);
  const ret = envData ? envData.phoneNumber : await getAvailableCucumberPhoneNumber(tenant.metadata.enablePhoneSupport);
  logger.info({ ret }, 'returning cucumber phone number ');
  return ret;
};

export const shouldSkip = tags => tags.indexOf('@SkipTenantRefresh') > -1;

const restoreDB = async () => {
  try {
    await execp(
      `docker exec -e PGPASSWORD=${dbPassword} -i ${coredbContainerName} pg_restore -U revauser --dbname=reva_core --clean --no-acl --no-owner < ${CUCUMBER_BK_FILE}`,
      {
        maxBuffer: Infinity,
      },
    );
  } catch (err) {
    logger.warn({ err }, '>>> restoreDB had errors');
  }
};

const _refreshTenantBetweenScenarios = async (isDemoFlow, tags, testId) => {
  if (restoreDBFromBackup) {
    if (shouldSkip(tags)) {
      return;
    }

    logger.trace({ testId }, 'restoringTheDB');
    await restoreDB();

    logger.trace('login in as admin to be able to access tenant api');
    const user = await loginAdminUser();
    setAuthToken(user.token);
  } else {
    if (isDemoFlow) {
      await deleteCucumberTenant(tenant);
      await createCucumberTenant();
      const phone = await getCucumberPhoneNumber();
      logger.trace(`Cucumber tenant phone number: ${phone}`);
      tenant.metadata.phoneNumbers[0] = { phoneNumber: phone };

      await updateCucumberTenant();
      await createPlivoGuestApplication();
    }

    if (shouldSkip(tags)) {
      return;
    }

    await refreshCucumberTenant({ testId, rejectOnFailure: true });
  }
};

export const refreshTenantBetweenScenarios = async (isDemoFlow, tags, testId) =>
  await doAndRetry(() => _refreshTenantBetweenScenarios(isDemoFlow, tags, testId), {
    maxAttempts: 3,
    waitBetweenAttempts: 1000,
    onBeforeAttempt: ({ attemptNumber }) => {
      logger.trace(`retrying the schema refresh: attempt ${attemptNumber}`);
    },
    onAttemptFail: ({ error, attemptNumber }) => {
      logger.warn({ error }, `attempt #${attemptNumber}, failed`);
    },
    onFail: ({ error }) => {
      logger.error({ error }, 'initiatePayment: no more attempts left');
      throw error;
    },
  });

const saveDBState = async () => {
  await execp(`docker exec -i ${coredbContainerName} pg_dump -U revauser -x --format custom reva_core > ${CUCUMBER_BK_FILE}`, { maxBuffer: Infinity });
};

export const initSocketConn = async () => {
  logger.trace('about to create socket client');
  await connectSocketClient('admin', `wss://ws.${cucumber.domain}`);

  logger.trace('login in as admin to be able to access tenant api');
  const user = await loginAdminUser();
  setAuthToken(user.token);
};

export const initDB = async (testId = CUCUMBER_DEFAULT_TEST_ID) => {
  logger.trace('about to clear environment');
  await clearEnvironment();

  if (restoreDBFromBackup && (await exists(CUCUMBER_BK_FILE))) {
    await restoreDB();
    return;
  }

  logger.trace('about to create a cucumber tenant');
  await createCucumberTenant();

  const phone = await getCucumberPhoneNumber();
  logger.trace(`Cucumber tenant phone number: ${phone}`);
  tenant.metadata.phoneNumbers[0] = { phoneNumber: phone };

  await updateCucumberTenant();
  await createPlivoGuestApplication();
  await refreshCucumberTenant({ testId, rejectOnFailure: true });

  if (restoreDBFromBackup) {
    await saveDBState();
  }
};

/**
 * Export the data of a given schema to the provided file as sql instructions. We cannot use the binary format because restoring it
 * triggers a lot of warnings about triggers being executed. It is strange though that the plain text version does not produce the same erros
 *
 * @param {object} options
 * @param {string} options.schema the schema from where the data will be backed up
 * @param {string} options.bkFile path of the file that will contain the output of the backup
 */
const exportDBState = async ({ schema, bkFile } = {}) => {
  const cmd = `docker exec -e PGPASSWORD=${dbPassword} -i ${coredbContainerName} pg_dump -U ${dbUser} --disable-triggers --schema ${schema} -a -x reva_core > ${bkFile}`;
  await execp(cmd, {
    maxBuffer: Infinity,
  });
};

/**
 * Restore the data from the provided backup file
 * @param {string} file path of the backup file containing the data to restore
 */
export const restoreSchemaState = async file => {
  await execp(`docker exec -e PGPASSWORD=${dbPassword} -i ${coredbContainerName} psql -U ${dbUser} -d reva_core < ${file}`, { maxBuffer: Infinity });
  logger.info(`restore schema ${file} done`);
};

/**
 * restore the db to a known state using previously saved backupd files
 * @param {Array} bkFiles the backup files to restore
 */
export const restoreFromBackup = async (bkFiles = []) => {
  logger.time('restoreFromBackup');
  await clearRabbitMqQueues();
  await truncateTablesOnTenants({ tenant: { id: tenant.id, name: tenant.name }, schemas: ['common', TEST_TENANT_ID] });

  for (let i = 0; i < bkFiles.length; i++) {
    const file = bkFiles[i];
    await restoreSchemaState(file);
  }

  logger.timeEnd('restoreFromBackup');
};

/**
 * creates the tenant to be used for the e2e tests. The tenant name is cucumber
 * because it can also be used to execute the cucumber tests
 */
export const createE2Etenant = async () => {
  logger.trace('clearing previous tenant info');
  await clearEnvironment();

  logger.trace('creating e2e tenant');
  await createCucumberTenant();

  const phone = await getCucumberPhoneNumber();

  logger.trace(`e2e tenant phone number: ${phone}`);
  tenant.metadata.phoneNumbers[0] = { phoneNumber: phone };

  await updateCucumberTenant();
  await createPlivoGuestApplication();
  await refreshCucumberTenant({ testId: CUCUMBER_DEFAULT_TEST_ID, rejectOnFailure: true });

  await disableAutomaticLogout(tenant);

  logger.trace('add the "truncate_tables" function');
  await createTruncanteFn();

  logger.trace('export state of common schema');
  await exportDBState({ schema: 'common', bkFile: './testcafe/bks/commonbk.sql' });

  logger.trace('export state of e2e tenant');
  await exportDBState({ schema: TEST_TENANT_ID, bkFile: './testcafe/bks/e2e-tenant.sql' });

  logger.info('e2e tenant created and backup created');
};

export const teardownDB = async () => {
  if (!restoreDBFromBackup) {
    await deleteCucumberTenant(tenant);
  }
  await disconnectSocketClient();
};
