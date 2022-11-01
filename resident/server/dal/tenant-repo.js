/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ADMIN } from '../../../server/common/schemaConstants';
export const getTenantByName = async name => {
  // on purpose use require to avoid the db connection to start before we used any of these methods
  const { rawStatement } = require('../../../server/database/factory');
  const query = `SELECT id, name
                 FROM admin."Tenant"
                 WHERE name = '${name}'
                 OR metadata->'previousTenantNames' @> '[{"name": "${name}"}]'`;

  const {
    rows: [tenant],
  } = await rawStatement({ tenantId: ADMIN }, query);

  return tenant;
};

export const getTenantById = async id => {
  // on purpose use require to avoid the db connection to start before we used any of these methods
  const { rawStatement } = require('../../../server/database/factory');
  const query = `SELECT id, name
                 FROM admin."Tenant"
                 WHERE id = :id`;
  const {
    rows: [tenant],
  } = await rawStatement({ tenantId: ADMIN }, query, [{ id }]);

  return tenant;
};

export const getTenantSettingsByTenantId = async id => {
  // on purpose use require to avoid the db connection to start before we used any of these methods
  const { rawStatement } = require('../../../server/database/factory');
  const query = `SELECT id, settings
                 FROM admin."Tenant"
                 WHERE id = :id`;
  const {
    rows: [tenant],
  } = await rawStatement({ tenantId: ADMIN }, query, [{ id }]);

  return tenant?.settings;
};
