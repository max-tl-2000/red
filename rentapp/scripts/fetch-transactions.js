/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { success, error, subtle } from 'clix-logger/logger';
import { closePool } from '../../server/database/factory';
import { getTenantIdByName } from '../../server/dal/tenantsRepo';
import { storeGivenTransactions } from '../server/services/payment';
import { YEAR_MONTH_DAY_FORMAT } from '../../common/date-constants';
import { getTransactionsByFromDay } from '../server/payment/payment-provider-integration';

import { now } from '../../common/helpers/moment-utils';
import { TARGET_ACCOUNT_TYPE, TARGET_ACCOUNT_NAME } from '../common/enums/target-account-types';
import { admin } from '../../server/common/schemaConstants';

// node_modules/.bin/babel-node --require ./enable-ts.js ./rentapp/scripts/fetch-transactions.js maximus 2017-11-01
const main = async () => {
  console.log(process.argv);
  const tenantName = process.argv[2];
  const fromDayArg = process.argv[3];

  subtle(`looking up tenant name ${tenantName}`);
  const tenantId = await getTenantIdByName({ tenantId: admin.id }, tenantName);

  const fromDay = fromDayArg || now().format(YEAR_MONTH_DAY_FORMAT);

  subtle(`starting fetch transactions fromDay: ${fromDay}`);

  const transactions = await getTransactionsByFromDay({ tenantId }, fromDay, {
    targetTypeFilters: [TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.HOLD_ACCOUNT], TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.APPLICATION_ACCOUNT]],
  });

  subtle(`fetched transactions, length: ${transactions.length}`);

  await storeGivenTransactions(tenantId, transactions);

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
