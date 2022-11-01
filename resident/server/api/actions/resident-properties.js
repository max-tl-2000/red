/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantById, getTenantByName } from '../../dal/tenant-repo';
import { getProperty } from '../../../../server/dal/propertyRepo';
import { getTenantPropertiesByAppId, validatePropertyIdAndTenantNameQueryParams } from '../../services/property';
import { getCommonUserProperties } from '../../services/common-user';
import loggerInstance from '../../../../common/helpers/logger';
import { getUnitsInfo } from '../../services/units';
import { ResidentPropertyState } from '../../../../common/enums/residentPropertyStates';
import { ServiceError } from '../../../../server/common/errors';

const logger = loggerInstance.child({ subType: 'residentProperties' });

const formatProperty = property =>
  !property
    ? null
    : {
        propertyId: property.id,
        propertyName: property.displayName,
      };

export const getUserSettings = async req => {
  const { middlewareCtx, emailTokenCtx, query } = req;
  const { appId, propertyId: queryPropertyId, tenantName: queryTenantName } = query;
  const { consumerToken } = middlewareCtx;
  const { commonUserId } = consumerToken || {};

  logger.trace({ ctx: req, appId, commonUserId, propertyId: queryPropertyId, tenantName: queryTenantName }, 'getUserSettings');

  let propertyIds;
  let requestedPropertyId;
  let requestedProperty;
  let tenantName;
  let tenantId;

  if (!requestedPropertyId && emailTokenCtx) {
    requestedPropertyId = emailTokenCtx.propertyId;
    tenantName = emailTokenCtx.tenantId && (await getTenantById(emailTokenCtx.tenantId))?.name;
    tenantId = emailTokenCtx.tenantId;
  } else if (queryTenantName && queryPropertyId) {
    if (await validatePropertyIdAndTenantNameQueryParams(req, queryTenantName, queryPropertyId)) {
      requestedPropertyId = queryPropertyId;
      tenantName = queryTenantName;
      tenantId = (await getTenantByName(tenantName))?.id;
    }
  } else if (appId && !appId.includes('tech.reva')) {
    const commonUserTenantData = await getTenantPropertiesByAppId(req, appId, commonUserId);
    if (commonUserTenantData) {
      tenantName = commonUserTenantData.tenantName;
      tenantId = commonUserTenantData.tenantId;
      propertyIds = commonUserTenantData.propertyIds;
      if (propertyIds.length === 1) requestedPropertyId = propertyIds[0];
    }
  }

  if (requestedPropertyId) {
    requestedProperty = {
      ...formatProperty(await getProperty({ tenantId }, requestedPropertyId)),
      tenantName,
    };
  }

  const properties = await getCommonUserProperties(req, commonUserId, { propertyIds, tenantName });

  if (!properties?.length) {
    logger.trace({ middlewareCtx, ctx: req, requestedProperty, commonUserId, requestedPropertyId, tenantName }, 'commonUser has no associated properties');
  }

  if (requestedProperty && !properties.some(p => p.propertyId === requestedProperty.propertyId)) {
    logger.trace(
      { middlewareCtx, ctx: req, requestedProperty, commonUserId, properties: properties.map(p => p.propertyId) },
      'commonUser is not associated with tokenProperty',
    );
  }

  const userIsOnlyPastResident = properties.every(p => p.residentState === ResidentPropertyState.PAST);

  if (userIsOnlyPastResident) {
    throw new ServiceError({ token: 'USER_IS_PAST_RESIDENT', status: 403, properties: properties.map(p => p.propertyId) });
  }

  const propertiesWithUnits = await Promise.all(
    properties.map(async p => ({
      ...p,
      units: await getUnitsInfo({ tenantId: p.tenantId }, { propertyId: p.propertyId, personId: p.personId, commonUserId }),
    })),
  );

  return { type: 'json', content: { requestedProperty, properties: propertiesWithUnits } };
};
