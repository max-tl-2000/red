/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createJWTToken } from '../../../common/server/jwt-helpers';

const getToken = tenant =>
  createJWTToken({
    name: 'test',
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantRefreshedAt: new Date().toUTCString(),
  });

export default function getAuthHeader(tenant) {
  const token = getToken(tenant);

  return {
    Authorization: `Bearer ${token}`,
  };
}
