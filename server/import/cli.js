/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { importInventory } from './excelInventory.js';
import { highlight, writeToFile } from '../helpers/workbook.js';
import { closePool } from '../database/factory';
import { APP_EXCHANGE, SYNC_MESSAGE_TYPE } from '../helpers/message-constants';
import { sendMessage, stopQueueConnection } from '../services/pubsub';
import { getTenantByName } from '../dal/tenantsRepo';

async function main() {
  const tenantName = process.argv[2];
  const inputFile = process.argv[3];
  const outputFile = process.argv[4];

  if (!tenantName || !inputFile || !outputFile) {
    console.log('Usage: inventory.js tenantName inputFile outputFile');
    return;
  }

  const tenant = await getTenantByName({ tenantId: 'admin' }, tenantName);

  if (!tenant) {
    console.error(`The tenant name '${tenantName}' does not exist`);
    return;
  }

  const ctx = { tenantId: tenant.id };
  const { invalidCells: ignoredRows } = await importInventory(ctx, inputFile);
  const newWorkbook = await highlight(inputFile, ignoredRows);
  await writeToFile(newWorkbook, outputFile);

  console.log(`Highlighted file written to ${outputFile}`);
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SYNC_MESSAGE_TYPE.TENANT_DATA_CHANGED,
    message: { tenantId: tenant.id },
    ctx,
  });
}

// Run with `node_modules/.bin/babel-node server/import/cli.js server/import/__tests__/resources/Inventory.xlsx output.xlsx <tenantId>`
if (require.main === module) {
  main()
    .then(closePool)
    .then(stopQueueConnection)
    .catch(e => {
      console.log(e.message);
      console.log(e.stack);
      closePool();
      stopQueueConnection();
    });
}
