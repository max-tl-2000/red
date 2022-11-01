/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as comms from './communication/commProviderIntegration';
import * as sync from './sync';
import * as recurringJobs from './tasks/recurringJobs';
import { ServiceError } from '../common/errors';
import eventTypes from '../../common/enums/eventTypes';
import { notify } from '../../common/server/notificationClient';

import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subtype: 'workers/tenantHandler' });

const HEADER_RECURRING_JOB = 'x-reva-recurringJobProcessed';
const HEADER_SYNC = 'x-reva-syncProcessed';
const failed = { processed: false };

let recurringJobHandlerOnCreate = recurringJobs.enableTenantRecurringJob;
export const setRecurringJobHandlerOnCreate = func => (recurringJobHandlerOnCreate = func);

let commsHandlerOnCreate = comms.onTenantCreated;
export const setCommsHandlerOnCreate = func => (commsHandlerOnCreate = func);

let syncHandlerOnRemove = sync.tenantRemoved;
export const setSyncHandlerOnRemove = func => (syncHandlerOnRemove = func);

let recurringJobHandlerOnRemove = recurringJobs.disableTenantRecurringJob;
export const setRecurringJobHandlerOnRemove = func => (recurringJobHandlerOnRemove = func);

let commsHandlerOnRemove = comms.onTenantRemoved;
export const setCommsHandlerOnRemove = func => (commsHandlerOnRemove = func);

export const resetHandlers = () => {
  setRecurringJobHandlerOnCreate(recurringJobs.enableTenantRecurringJob);
  setCommsHandlerOnCreate(comms.onTenantCreated);
  setSyncHandlerOnRemove(sync.tenantRemoved);
  setRecurringJobHandlerOnRemove(recurringJobs.disableTenantRecurringJob);
  setCommsHandlerOnRemove(comms.onTenantRemoved);
};

export const tenantCreatedHandler = async (tenant, msg) => {
  logger.info({ tenant }, 'tenantCreatedHandler');

  // if recurringJob already processed, skip it
  if (!msg.properties.headers[HEADER_RECURRING_JOB]) {
    const { processed: recurringJobProcessed } = await recurringJobHandlerOnCreate(tenant);
    logger.trace({ recurringJobProcessed }, 'tenantCreatedHandler recurring job status');
    if (!recurringJobProcessed) return failed;

    msg.properties.headers[HEADER_RECURRING_JOB] = true;
  }

  const commsStatus = await commsHandlerOnCreate(tenant);
  logger.trace({ commsStatus }, 'tenantCreatedHandler commProvider status');

  return commsStatus;
};

export const tenantRemovedHandler = async (data, msg) => {
  logger.info({ data, headers: msg.properties.headers }, 'tenantRemovedHandler');

  // if recurringJob already processed, skip it
  if (!msg.properties.headers[HEADER_RECURRING_JOB]) {
    const { processed: recurringJobProcessed } = await recurringJobHandlerOnRemove(data);
    logger.trace({ recurringJobProcessed }, 'tenantRemovedHandler recurring job status');
    if (!recurringJobProcessed) return failed;

    msg.properties.headers[HEADER_RECURRING_JOB] = true;
  }

  // if sync handler already processed, skip it
  if (!msg.properties.headers[HEADER_SYNC]) {
    const { processed: syncProcessed } = await syncHandlerOnRemove(data);
    logger.trace({ syncProcessed }, 'tenantRemovedHandler sync job status');
    if (!syncProcessed) return failed;

    msg.properties.headers[HEADER_SYNC] = true;
  }

  const commsStatus = await commsHandlerOnRemove(data);
  logger.trace({ commsStatus }, 'tenantRemovedHandler comms job status');
  return commsStatus;
};

export const getAvailablePhoneNumbers = async ({ ctx }) => {
  logger.trace({ ctx }, 'getAvailablePhoneNumbersHandler');
  let tenantNumbers = [];
  let successfully;
  try {
    tenantNumbers = await comms.getAvailableNumbers();
    successfully = true;
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve available phone numbers from Plivo');
    throw new ServiceError({
      token: 'FAILED_TO_RETRIEVE_AVAILABLE_PLIVO_NUMBERS',
      status: 404,
    });
  } finally {
    notify({
      ctx,
      tenantId: ctx.tenantId,
      event: eventTypes.TENANT_AVAILABLE_NUMBERS_COMPLETED,
      data: { tenantNumbers, successfully },
    });
  }
  return { processed: true };
};
