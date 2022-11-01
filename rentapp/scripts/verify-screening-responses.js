/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { success, error, subtle } from 'clix-logger/logger';
import { closePool } from '../../server/database/factory';
import { getTenantIdByName } from '../../server/dal/tenantsRepo';
import { handleScreeningResponseValidation } from '../server/workers/screening/screening-handler';
import { admin } from '../../server/common/schemaConstants';

const main = async () => {
  console.log(process.argv);
  const tenantName = process.argv[2];
  subtle(`looking up tenant name ${tenantName}`);
  const tenantId = await getTenantIdByName({ tenantId: admin.id }, tenantName);
  await handleScreeningResponseValidation({ tenantId });
  success('Done!');
};

if (require.main === module) {
  main()
    .catch(e => {
      error(e);
      closePool();
    })
    .then(() => closePool());
}
