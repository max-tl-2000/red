/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import apiClient from '../apiClient';
import { getDataToCleanup } from './cleanupUtils';
import { closePool } from '../../../../database/factory';
import { createBluemoonAuth } from '../bluemoonUtils';

const TEST_REVA_PROPERTY_ID = 'revaId';
const TEST_USERNAME = 'developer@intest';
const TEST_PASSWORD = 'import';
const TEST_PROPERTY_ID = 6715;

export const cleanupBluemoon = async (emailMatcher, name) => {
  const ctx = { tenantId: 'testTenantId' };
  await createBluemoonAuth(ctx, TEST_PROPERTY_ID, TEST_REVA_PROPERTY_ID, TEST_USERNAME, TEST_PASSWORD);

  const { signaturesToDelete, leasesToDelete } = await getDataToCleanup(ctx, TEST_REVA_PROPERTY_ID, emailMatcher, name);

  console.log('==========================================================');
  console.log(`Found ${signaturesToDelete.length} signatures to cleanup`);
  console.log(`Found ${leasesToDelete.length} leases to cleanup`);
  console.log('==========================================================');
  console.log('The following data will be deleted');
  console.log('ESignatures: ', signaturesToDelete);
  console.log('Leases: ', leasesToDelete);
  console.log('==========================================================');

  try {
    await mapSeries(signaturesToDelete, async signature => {
      await apiClient.deleteLeaseESignatureRequest(ctx, TEST_REVA_PROPERTY_ID, null, null, signature);
    });

    await mapSeries(leasesToDelete, async lease => {
      await apiClient.deleteLease(ctx, TEST_REVA_PROPERTY_ID, null, null, lease);
    });

    console.log('=====SUCCESSFULLY CLEANED UP DATA=====');
  } catch (error) {
    console.log('Error encountered: ', error);
  }
};

// Usage:
// node_modules/.bin/babel-node --extensions '.js,.ts' server/services/leases/bluemoon/cleanup/cleanBluemoon.js {emailAddressMatcher} {residentNameToSearchFor}
// Please note that the {name} is optional. If used, the process will go through all the leases and try to match the given name against the residents names for each lease.
// If matched those leases will be deleted.
// The process will take approximately 5 minutes if name is used.
async function main() {
  const emailMatcher = process.argv[2];
  const name = process.argv[3];

  if (!emailMatcher) {
    console.error('Usage:');
    console.error("node_modules/.bin/babel-node --extensions '.js,.ts' server/services/leases/bluemoon/cleanup/cleanBluemoon.js {emailAddressMatcher} {name}");
  }

  await cleanupBluemoon(emailMatcher, name);
}

if (require.main === module) {
  main()
    .then(closePool)
    .then(process.exit)
    .catch(e => {
      console.log(e.stack);
    });
}
