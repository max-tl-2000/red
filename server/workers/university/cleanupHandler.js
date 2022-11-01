/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import config from '../config';
import { rawStatement } from '../../database/factory';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { admin } from '../../common/schemaConstants';
import { deleteTenant } from '../../services/tenantService';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'university/cleanupHandler' });

const getTenantsActivity = async ctx => {
  logger.info({ ctx }, 'cleanupTestingTenants');
  const adminCtx = { tenantId: admin.id };

  const buildTenantsQuery = 'SELECT tenant_name, tenant_id, is_training_tenant, last_login FROM admin.tenant_last_access();';
  const { rows } = await rawStatement(adminCtx, buildTenantsQuery, []);
  logger.trace({ ctx, rows }, 'cleanupTestingTenants - lastTenantAccess');
  return rows;
};

const filterInactiveTenants = (ctx, tenants) => {
  const { defaultCleanTenantsAfterInactivity } = config;
  const localTime = now();

  const inactiveTenants = tenants
    .filter(t => t.is_training_tenant)
    .map(t => {
      const lastLogin = (t.last_login ? toMoment(t.last_login) : toMoment(new Date(0))).add(defaultCleanTenantsAfterInactivity, 'days');
      const isInactive = lastLogin.isBefore(localTime);
      const updatedTenant = { ...t, lastLogin, isInactive };
      return updatedTenant;
    })
    .filter(t => t.isInactive);

  logger.trace({ ctx, localTime, inactiveTenants, defaultCleanTenantsAfterInactivity }, 'cleanupTestingTenants - tenants to remove');

  return inactiveTenants;
};

export const cleanupTrainingTenants = async payload => {
  const { msgCtx: ctx } = payload;
  logger.time({ ctx, payload }, 'Recurring Jobs - cleanupTestingTenants duration');

  const adminCtx = { tenantId: admin.id };
  try {
    const testingTenants = await getTenantsActivity(ctx);
    const inactiveTenants = filterInactiveTenants(ctx, testingTenants);
    await mapSeries(inactiveTenants, async tenant => await deleteTenant(adminCtx, tenant.tenant_id));
  } catch (error) {
    logger.error({ ctx, error, msgPayload: payload }, 'cleanupTestingTenants failed');
    return { processed: false, retry: false };
  }

  logger.timeEnd({ ctx, payload }, 'Recurring Jobs - cleanupTestingTenants duration');

  return { processed: true };
};
