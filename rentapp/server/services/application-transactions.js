/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as dal from '../dal/application-transactions-repo';
import logger from '../../../common/helpers/logger';

export const createApplicationTransaction = (ctx, transaction) => {
  const { invoiceId, transactionType } = transaction;
  logger.info({ ctx, transactionType, invoiceId }, 'creating application transaction');

  return dal.createApplicationTransaction(ctx, transaction);
};

export const getTransactionById = async (ctx, transactionId) => await dal.getTransactionById(ctx, transactionId);

export const existsApplicationTransaction = (ctx, { invoiceId, transactionType, externalId }) =>
  dal.existsApplicationTransaction(ctx, {
    invoiceId,
    transactionType,
    externalId,
  });

export const getApplicationTransactionsByPersonApplicationIds = (ctx, { personApplicationIds, types }) =>
  dal.getApplicationTransactionsByPersonApplicationIds(ctx, {
    personApplicationIds,
    types,
  });

export const getLatestTransactionDatesGroupedByTargetId = async ctx => {
  const latestTransactionDatesGroupedByTargetId = await dal.getLatestTransactionDatesGroupedByTargetId(ctx);
  return latestTransactionDatesGroupedByTargetId.reduce((acc, item) => {
    acc.set(+item.targetId, item);
    return acc;
  }, new Map());
};
