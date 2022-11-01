/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from './errors';

export const RED = 'red';
export const ADMIN = 'admin';
export const COMMON = 'common';
export const TEMPLATE_SCHEMA = 'template_schema';
export const ANALYTICS = 'analytics';

export const admin = {
  id: ADMIN,
  name: ADMIN,
  migrations_path: ADMIN,
};

export const common = {
  id: COMMON,
  name: COMMON,
  migrations_path: COMMON,
};

export const templateSchema = {
  id: TEMPLATE_SCHEMA,
  name: TEMPLATE_SCHEMA,
  metadata: {
    enablePhoneSupport: false,
    phoneNumbers: [],
  },
};

export const analytics = {
  id: ANALYTICS,
  name: ANALYTICS,
  migrations_path: ANALYTICS,
};

export const RESERVED_TENANTS = new Map([
  [ADMIN, admin],
  [COMMON, common],
  [TEMPLATE_SCHEMA, templateSchema],
  [ANALYTICS, analytics],
]);

export const RESERVED_TENANT_NAMES = new Set([
  ADMIN,
  ANALYTICS,
  TEMPLATE_SCHEMA,
  'test',
  'mail',
  'corp',
  'ws',
  COMMON,
  'application',
  'resident',
  'consul',
  'coredb',
  'auth',
  'contract',
  'roommates',
  'selfserve',
  'static',
  'health',
]);

export const prepareRawQuery = (rawStatement, tenantId) => {
  let quotedTenantId = tenantId;
  let unquotedTenantId = tenantId;
  let unquotedTenantIdPrefix = tenantId;

  if (!tenantId) throw new ServiceError({ token: 'prepareRawQuery: tenantId not provided' });
  if (!RESERVED_TENANT_NAMES.has(tenantId)) {
    quotedTenantId = `"${tenantId}"`;
    unquotedTenantId = `${tenantId}`;
    unquotedTenantIdPrefix = tenantId.substr(0, 8); // this is needed because PSQL names can be 64 chars max and using the full UUID will use 32
  }
  const prepared = rawStatement
    .replace(/db_namespace_unquotedprefix/g, unquotedTenantIdPrefix)
    .replace(/db_namespace_unquoted/g, unquotedTenantId)
    .replace(/db_namespace/g, quotedTenantId);
  return prepared;
};
