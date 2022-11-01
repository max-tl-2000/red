/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantById, getTenantByName, getTenantSettingsByTenantId } from '../../dal/tenant-repo';
import { getPropertySettingsByPropertyId } from '../../services/property';

export const getLoginFlowSettings = async req => {
  const { query, emailTokenCtx } = req;
  const { propertyId: queryPropertyId, tenantName: queryTenantName, tenantId: queryTenantId } = query;

  let propertyId;
  let tenantName;
  let tenantId;
  let email;

  if (queryPropertyId && queryTenantName) {
    propertyId = queryPropertyId;
    tenantName = queryTenantName;
    tenantId = (await getTenantByName(tenantName))?.id;
  }

  if (!propertyId && queryPropertyId && queryTenantId) {
    propertyId = queryPropertyId;
    tenantId = queryTenantId;
    tenantName = (await getTenantById(tenantId))?.name;
  }

  if (!propertyId && emailTokenCtx) {
    // TODO: cache the name of the tenants so these queries don't go to the db
    if (emailTokenCtx.isCommonToken) {
      const { commonUserId, applicationName } = emailTokenCtx;
      return {
        type: 'json',
        content: {
          email: emailTokenCtx.email,
          commonUserId,
          applicationName,
        },
      };
    }

    propertyId = emailTokenCtx.propertyId;
    email = emailTokenCtx.email;
    tenantName = (await getTenantById(emailTokenCtx.tenantId))?.name;
    tenantId = emailTokenCtx.tenantId;
  }

  if (!propertyId || !tenantId) {
    return { type: 'json', content: {} };
  }

  const { rxp } = await getPropertySettingsByPropertyId({ ...req, tenantId }, propertyId);

  const { legal } = await getTenantSettingsByTenantId(tenantId);

  const loginFlow = rxp?.loginFlow || { line1: '', line2: '', line3: '', hideLogo: false };

  return {
    type: 'json',
    content: {
      loginFlow,
      applicationName: rxp?.app?.name,
      email,
      propertyId,
      tenantName,
      legal,
    },
  };
};
