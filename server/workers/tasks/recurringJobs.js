/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { getTenants, getTenantData } from '../../dal/tenantsRepo';
import { admin } from '../../common/schemaConstants';
import { knex } from '../../database/factory';
import { APP_EXCHANGE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import config from '../../config';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'AMQP' });

let jobHandlers = [];
let globalJobHandlers = [];

export const removeAllGlobalJobHandlers = () => {
  globalJobHandlers = [];
};

export const addGlobalJobHandlers = funcs => (globalJobHandlers = [...globalJobHandlers, ...funcs]);

export const removeGlobalJobHandler = func => (globalJobHandlers = globalJobHandlers.filter(f => f !== func));

export const removeAllJobHandlers = () => {
  jobHandlers = [];
};

export const addJobHandlers = funcs => (jobHandlers = [...jobHandlers, ...funcs]);

export const removeJobHandler = func => (jobHandlers = jobHandlers.filter(f => f !== func));

const tenantWasRemoved = async id => {
  const ctx = { tenantId: admin.id };
  return !(await getTenantData(ctx, id));
};

export const getTopic = id => `recurring_message_for_tenant_${id}`;
export const TENANT_QUEUE_SUFFIX = 'recurring_job_queue';
export const getQueueName = id => `tenant_${id}_${TENANT_QUEUE_SUFFIX}`;
export const getConfigName = name => `${name}_recurring_worker`;

const handleGlobalRecurringJob = async ({ tenantId }) => {
  await mapSeries(globalJobHandlers, func => func(tenantId));

  const delay = config.recurringJobs.interval * 1000;

  setTimeout(
    async () =>
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: getTopic(tenantId),
        message: { tenantId },
        ctx: { tenantId },
      }),
    delay,
  );

  return { processed: true };
};

const handleRecurringJob = async ({ tenantId }) => {
  if (await tenantWasRemoved(tenantId)) {
    logger.info(`tenant ${tenantId} was removed, terminating recurring job for it`);
    return { processed: true };
  }

  await mapSeries(jobHandlers, func => func(tenantId));

  const delay = config.recurringJobs.interval * 1000;

  setTimeout(
    async () =>
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: getTopic(tenantId),
        message: { tenantId },
        ctx: { tenantId },
      }),
    delay,
  );

  return { processed: true };
};

let onWorkerConfigAdded = () => ({});
export const setOnWorkerConfigAdded = func => (onWorkerConfigAdded = func);

let onWorkerConfigRemoved = () => ({});
export const setOnWorkerConfigRemoved = func => (onWorkerConfigRemoved = func);

const createConfigForTenantId = id => ({
  exchange: APP_EXCHANGE,
  queue: getQueueName(id),
  topics: {
    [getTopic(id)]: id === admin.id ? handleGlobalRecurringJob : handleRecurringJob,
  },
  noOfConsumers: 1,
  initialPublish: async () =>
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: getTopic(id),
      message: { tenantId: id },
      ctx: { tenantId: id },
    }),
});

export const enableTenantRecurringJob = async ({ id, name, isTrainingTenant }) => {
  if (isTrainingTenant) return { processed: true };
  await onWorkerConfigAdded({
    name: getConfigName(name),
    conf: createConfigForTenantId(id),
  });
  return { processed: true };
};

export const disableTenantRecurringJob = async ({ tenant }) => {
  await onWorkerConfigRemoved(getQueueName(tenant.id));
  return { processed: true };
};

export const createRecurringWorkerConfig = async () => {
  try {
    const tenants = await getTenants(knex, { tenantId: admin.id });

    return tenants
      .filter(t => !t.isTrainingTenant)
      .reduce(
        (acc, tenant) => ({
          [getConfigName(tenant.name)]: createConfigForTenantId(tenant.id),
          ...acc,
        }),
        { [getConfigName(admin.name)]: createConfigForTenantId(admin.id) },
      );
  } catch (error) {
    logger.error({ error }, 'Error while retrieving config for recurring jobs');
    return [];
  }
};
