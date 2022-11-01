/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { getCommonUserById as getCommonUserByIdDb, getRelatedTenantsByCommonUserId } from '../dal/common-user-repo';
import { getResidentState } from '../../../server/services/person';
import { ServiceError } from '../../../server/common/errors';
import loggerInstance from '../../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'commonUser' });

export const getCommonUserProperties = async (ctx, commonUserId, { propertyIds, tenantName }) => {
  if (!commonUserId) {
    throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 412 });
  }

  let commonUserTenants = await getRelatedTenantsByCommonUserId(ctx, commonUserId);

  const tenantSelected = tenantName && commonUserTenants.find(t => t.name === tenantName);

  commonUserTenants = tenantSelected ? [tenantSelected] : commonUserTenants;
  if (!commonUserTenants?.length) throw new ServiceError({ token: 'COMMON_USER_TENANTS_NOT_DEFINED' });

  const propertiesByTenant = await mapSeries(commonUserTenants, commonUserTenant =>
    getResidentState({ ...ctx, tenantId: commonUserTenant.tenantId }, commonUserTenant.personId, propertyIds),
  );

  const formattedProperties = propertiesByTenant.flatMap((properties, index) =>
    properties.map(({ propertyId, propertyName, propertyState, propertyCity, residentState, features, personId, propertyTimezone }) => ({
      propertyName,
      propertyId,
      tenantName: commonUserTenants[index].tenantName,
      tenantId: commonUserTenants[index].tenantId,
      tenantLegal: commonUserTenants[index].tenantLegal,
      residentState,
      propertyState,
      propertyCity,
      features,
      personId,
      propertyTimezone,
    })),
  );

  const sortedProperties = formattedProperties?.sort((p1, p2) => {
    if (p1.propertyName < p2.propertyName) {
      return -1;
    }
    if (p1.propertyName > p2.propertyName) {
      return 1;
    }
    return 0;
  });

  logger.trace({ ctx, commonUserId, propertyIds, sortedProperties }, 'getCommonUserProperties');

  return sortedProperties;
};

export const getCommonUserById = async (ctx, commonUserId) => await getCommonUserByIdDb(ctx, commonUserId);
