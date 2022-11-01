/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex } from '../database/factory';
import { refreshUnitSearchView, enableSearchTriggers, disableSearchTriggers, refreshSearchData } from '../dal/searchRepo';
import { createDataForDemo } from '../import/demo_sample_data/import';
import { recreateTenantSchema, saveTenantMetadata } from '../dal/tenantsRepo';
import { getAllVoiceRecordingIds } from '../dal/communicationRepo';
import { refreshSubscriptions } from '../dal/subscriptionsRepo';
import { getAdminUser, updateUser, getAllSipEndpoints } from '../dal/usersRepo';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import logger from '../../common/helpers/logger';
import { sendMessage } from '../services/pubsub';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../helpers/message-constants';
import { admin } from '../common/schemaConstants';
import { getTenant } from '../services/tenantService';
import { getAssetsBucket, getPrivateBucket } from './upload/uploadUtil';
import { getS3Provider } from './upload/s3Provider';
import { enableTenantRecurringJob, disableTenantRecurringJob } from './tasks/recurringJobs';
import sleep from '../../common/helpers/sleep';
import { bulkRemoveEventsAllUsers } from '../services/externalCalendars/cronofyService';

export const tenantRemoved = async ({ tenant }) => {
  const ctx = { tenantId: tenant.id };
  logger.info({ adminId: admin.id, tenantName: tenant.name }, 'Tenant removed : ');
  logger.info('Deleting S3 contents from Assets and Private buckets', {
    adminId: admin.id,
    tenantName: tenant.name,
  });

  await getS3Provider().deleteAll(ctx, getAssetsBucket());
  await getS3Provider().deleteAll(ctx, getPrivateBucket());

  return { processed: true };
};

/**
 * @param {object} tenant - an object of the form { tenantId: '...' }
 * @param {number} timedelta - in minutes
 */
export const tenantDataChanged = async tenant => {
  logger.info(`tenantDataChanged: ${tenant.tenantId}`);
  await refreshUnitSearchView({ tenantId: tenant.tenantId });

  logger.info('tenantDataChanged done indexing things');
  return { processed: true };
};

const removeAndRecreateTenantSchema = async tenant => {
  const ctx = { tenantId: tenant.id, name: tenant.name };
  const adminUserBackup = await getAdminUser(ctx);
  await disableTenantRecurringJob({ tenant });
  await tenantRemoved({ tenant });
  await recreateTenantSchema(knex, { tenantId: admin.id }, tenant.id);
  const adminUserAfterClear = await getAdminUser(ctx);
  await updateUser(ctx, adminUserAfterClear.id, adminUserBackup);
  await refreshSubscriptions(ctx);
};

const enableSearchTriggersAndRefreshData = async tenantId => {
  await sleep(1000); // this seems to fix the issue but we still to find why the partyTransitions are creating deadlocks
  await enableSearchTriggers(tenantId);
  await sleep(1000); // this seems to fix the issue but we still to find why the partyTransitions are creating deadlocks
  await refreshSearchData(tenantId);
};

const cleanupCalendarAccounts = async (ctx, tenantId) => {
  await bulkRemoveEventsAllUsers({ tenantId });
  await saveTenantMetadata(ctx, tenantId, { externalCalendars: { integrationEnabled: false } });
};

export const clearTenantSchema = async ({ ctx, tenantIdToClear }) => {
  try {
    logger.info(`Clear schema for tenant ${tenantIdToClear}`);
    const tenant = await getTenant({ tenantId: tenantIdToClear }, tenantIdToClear);
    await cleanupCalendarAccounts(ctx, tenantIdToClear);
    await removeAndRecreateTenantSchema(tenant);
    await enableTenantRecurringJob(tenant);
    await enableSearchTriggersAndRefreshData(tenantIdToClear);
    logger.info(`Clear schema for tenant ${tenantIdToClear} ... done`);

    notify({
      ctx,
      event: eventTypes.CLEAR_TENANT_SCHEMA_DONE,
      data: { tenantId: tenantIdToClear, successfully: true },
    });
    return { processed: true };
  } catch (e) {
    await enableSearchTriggersAndRefreshData(tenantIdToClear);
    logger.error(e);
    notify({
      ctx,
      event: eventTypes.CLEAR_TENANT_SCHEMA_DONE,
      data: { tenantId: tenantIdToClear, successfully: false },
    });
    return { processed: false };
  }
};

export const tenantRefreshSchema = async ({ ctx, tenantIdToRefresh, importInventory, testId, bigDataCount, noOfTeams }) => {
  try {
    logger.info(`Refresh schema for tenant ${tenantIdToRefresh} testId ${testId}`);

    await notify({
      ctx: { ...ctx, tenantId: tenantIdToRefresh },
      event: eventTypes.FORCE_LOGOUT_PLUS_ADMIN,
    });

    const tenant = await getTenant({ tenantId: tenantIdToRefresh }, tenantIdToRefresh);
    const recordingIds = await getAllVoiceRecordingIds({
      tenantId: tenantIdToRefresh,
    });
    const endpoints = await getAllSipEndpoints({ tenantId: tenantIdToRefresh });

    await sendMessage({
      exchange: APP_EXCHANGE,
      key: COMM_MESSAGE_TYPE.TENANT_COMM_PROVIDER_CLEANUP,
      message: {
        phoneSupportEnabled: tenant.metadata && tenant.metadata.enablePhoneSupport,
        endpoints,
        recordingIds,
      },
      ctx,
    });
    await cleanupCalendarAccounts(ctx, tenantIdToRefresh);
    await removeAndRecreateTenantSchema(tenant);
    await disableSearchTriggers(tenantIdToRefresh);
    await createDataForDemo(ctx, tenantIdToRefresh, importInventory, testId, bigDataCount, noOfTeams);
    await enableTenantRecurringJob(tenant);

    if (!testId) {
      // disable search triggers for cucumber test, too many deadlocks...
      await sleep(2000);
      await enableSearchTriggersAndRefreshData(tenantIdToRefresh);
    }
    logger.info(`Refresh schema for tenant ${tenantIdToRefresh} ... done`);
    notify({
      ctx,
      event: eventTypes.REFRESH_TENANT_SCHEMA_DONE,
      data: { tenantId: tenantIdToRefresh, successfully: true },
    });
    return { processed: true };
  } catch (e) {
    logger.error({ error: e }, 'Refresh schema failure');

    notify({
      ctx,
      event: eventTypes.REFRESH_TENANT_SCHEMA_DONE,
      data: { tenantId: tenantIdToRefresh, successfully: false },
    });
    return { processed: true }; // Don't retry this
  }
};
