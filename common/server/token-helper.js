/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { generateTokenForDomain } from '../../server/services/tenantService';
import { getTenantIdByName } from '../../server/dal/tenantsRepo';
import { ServiceError } from '../../server/common/errors';
import { admin } from '../../server/common/schemaConstants';

export const createSelfServeTokenByTenantId = async (tenantId, host) => {
  if (!tenantId) throw new ServiceError({ token: 'NO_TENANT_ID' });

  const token = await generateTokenForDomain({
    tenantId,
    domain: host,
    expiresIn: '1y',
    allowedEndpoints: ['guestCard/availableSlots', 'guestCard', 'contactUs', 'marketingContact', 'marketing/'],
  });

  return token;
};

export const createSelfServeToken = async (tenantName, host) => {
  if (!tenantName) throw new ServiceError({ token: 'NO_TENANT_NAME' });
  const tenantId = await getTenantIdByName({ tenantId: admin.id }, tenantName);

  return createSelfServeTokenByTenantId(tenantId, host);
};
