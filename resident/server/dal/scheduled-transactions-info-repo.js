/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { COMMON } from '../../../server/common/schemaConstants';
import { insertInto, rawStatement } from '../../../server/database/factory';

export const insertScheduledTransactionsInfo = async (ctx, data) =>
  await insertInto({ ...ctx, tenantId: COMMON }, 'ScheduledTransactionsInfo', data, { updateOnConflict: true });

export const getSeenTransactions = async (ctx, transactionIds) => {
  const query = `SELECT "transactionId"
    FROM db_namespace."ScheduledTransactionsInfo" 
    WHERE ARRAY["transactionId"] <@ :transactionIds
    AND "wasSeen" = true
  `;

  const { rows } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [{ transactionIds }]);
  return rows;
};
