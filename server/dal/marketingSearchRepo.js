/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement, insertInto, runInTransaction } from '../database/factory';

export const saveMarketingSearchData = async (ctx, marketingSearchData) =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };

    await rawStatement(innerCtx, 'TRUNCATE TABLE db_namespace."MarketingSearch"');
    await insertInto(innerCtx, 'MarketingSearch', marketingSearchData);
  });

export const getMarketingSearches = async ctx => {
  const query = `
      SELECT ms.order, ms."entryMatch", ms.scope, ms."stateScope", ms."cityScope", ms.url, ms."queryStringFlag", ms."inactiveFlag"
      FROM db_namespace."MarketingSearch" ms
    `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
