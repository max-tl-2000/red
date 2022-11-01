/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import {
  getPropertySettingsByPropertyId as getPropertySettingsByPropertyIdDb,
  getPropertyIdsByPersonIdAndAppId,
  validatePropertyBelongsToTenant,
  insertOrUpdateLastAccessedProperty as insertOrUpdateLastAccessedPropertyDb,
} from '../dal/property-repo';
import { badRequestErrorIfNotAvailable } from '../../../common/helpers/validators';
import { ServiceError } from '../../../server/common/errors';

import { getRelatedTenantsByCommonUserId } from '../dal/common-user-repo';
import loggerInstance from '../../../common/helpers/logger';
import { getTenantByName } from '../dal/tenant-repo';

const logger = loggerInstance.child({ subType: 'residentPropertyService' });

export const getTenantPropertiesByAppId = async (ctx, appId, commonUserId) => {
  logger.trace({ ctx, appId, commonUserId }, 'getTenantPropertiesByAppId');
  if (!appId || !commonUserId) {
    throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 412 });
  }
  const tenants = await getRelatedTenantsByCommonUserId(ctx, commonUserId);
  if (!tenants.length) throw new ServiceError({ token: 'COMMON_USER_TENANTS_NOT_DEFINED' });

  const tenantsProperties = await mapSeries(tenants, async ({ tenantId, tenantName, personId }) => {
    const propertyIds = await getPropertyIdsByPersonIdAndAppId({ ...ctx, tenantId }, personId, appId);
    return { propertyIds, tenantId, tenantName };
  });
  return tenantsProperties.flat().find(({ propertyIds }) => propertyIds.length);
};

export const getPropertySettingsByPropertyId = async (ctx, propertyId) => {
  const { settings } = await getPropertySettingsByPropertyIdDb(ctx, propertyId);
  return settings || {};
};

export const validatePropertyIdAndTenantNameQueryParams = async (ctx, tenantName, propertyId) => {
  if (!tenantName || !propertyId) {
    throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 412 });
  }

  const tenant = await getTenantByName(tenantName);
  if (!tenant) {
    logger.trace({ ctx, tenantName }, "validatePropertyIdAndTenantNameQueryParams tenant doesn't exists");
    return false;
  }

  const isValid = await validatePropertyBelongsToTenant({ ...ctx, tenantId: tenant.id }, propertyId);
  logger.trace({ ctx, tenantName, propertyId, isValid }, 'validatePropertyIdAndTenantNameQueryParams result');
  return isValid;
};

export const markPropertyAsAccessed = async (ctx, { commonUserId, propertyId }) => {
  badRequestErrorIfNotAvailable([
    { property: ctx.tenantId, message: 'MISSING_TENANT_ID' },
    { property: propertyId, message: 'MISSING_PROPERTY_ID' },
    { property: commonUserId, message: 'MISSING_COMMON_USER_ID' },
  ]);
  return insertOrUpdateLastAccessedPropertyDb(ctx, { commonUserId, propertyId });
};
