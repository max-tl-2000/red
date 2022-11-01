/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, insertInto, getOne, getOneWhere, initQuery } from '../../../server/database/factory';
const APP_TRANSACTIONS_TABLE_NAME = 'rentapp_ApplicationTransactions';
const APP_INVOICES_TABLE_NAME = 'rentapp_ApplicationInvoices';

export const createApplicationTransaction = (ctx, transaction) => insertInto(ctx, APP_TRANSACTIONS_TABLE_NAME, transaction);

export const getTransactionById = async (ctx, transactionId) => {
  const fksToExpand = {
    invoiceId: {
      rel: APP_INVOICES_TABLE_NAME,
      repr: 'invoice',
    },
  };
  return await getOne(ctx, APP_TRANSACTIONS_TABLE_NAME, transactionId, fksToExpand);
};

export const existsApplicationTransaction = async (ctx, { invoiceId, transactionType, externalId }) => {
  const transaction = await getOneWhere(ctx, APP_TRANSACTIONS_TABLE_NAME, {
    invoiceId,
    transactionType,
    externalId,
  });
  return !!transaction;
};

export const getApplicationTransactionsByPersonApplicationIds = async (ctx, { personApplicationIds, types }) => {
  const query = initQuery(ctx)
    .from(APP_TRANSACTIONS_TABLE_NAME)
    .innerJoin(APP_INVOICES_TABLE_NAME, `${APP_TRANSACTIONS_TABLE_NAME}.invoiceId`, `${APP_INVOICES_TABLE_NAME}.id`)
    .whereIn(`${APP_INVOICES_TABLE_NAME}.personApplicationId`, personApplicationIds);

  if (types && types.length) {
    query.whereIn(`${APP_TRANSACTIONS_TABLE_NAME}.transactionType`, types);
  }

  return await query.select(`${APP_TRANSACTIONS_TABLE_NAME}.*`);
};

export const getLatestTransactionDatesGroupedByTargetId = async ctx =>
  await initQuery(ctx)
    .from(APP_TRANSACTIONS_TABLE_NAME)
    .select(
      'targetId',
      knex.raw(`
        max("transactionData"->>'createdOn') as "createdOn"
      `),
    )
    .groupBy('targetId');
