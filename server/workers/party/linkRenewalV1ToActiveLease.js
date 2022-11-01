/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantByName } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { admin } from '../../common/schemaConstants';
import { linkRenewalV1ToActiveLease } from '../../services/renewalV1Migration';

const logger = loggerModule.child({ subType: 'linkRenewalV1ToActiveLease' });

const getTenantContext = async () => {
  const tenantName = process.argv[2];
  const ctx = { tenantId: admin.id };
  const tenant = await getTenantByName(ctx, tenantName);

  if (!tenant) {
    logger.error('Tenant not found');
    return {};
  }
  return { tenantId: tenant.id };
};

async function main() {
  const tenantCtx = await getTenantContext();
  const propertyIds = process.argv[3];
  await linkRenewalV1ToActiveLease(tenantCtx, { propertyIdsFilter: propertyIds });
}

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while linking renewal V1s to active leases', e);
  process.exit(1); // eslint-disable-line
  });
