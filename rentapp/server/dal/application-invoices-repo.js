/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertInto, updateOne, exists, getOne } from '../../../server/database/factory';
const APP_INVOICES_TABLE_NAME = 'rentapp_ApplicationInvoices';

export const createApplicationInvoice = async (ctx, invoice) => await insertInto(ctx, APP_INVOICES_TABLE_NAME, invoice);

export const updateApplicationInvoice = async (ctx, invoice) => await updateOne(ctx.tenantId, APP_INVOICES_TABLE_NAME, invoice.id, invoice, ctx.trx);

export const getApplicationInvoicesByFilter = async (ctx, filter) => await initQuery(ctx).from(APP_INVOICES_TABLE_NAME).where(filter).select();

export const getPaidApplicationInvoices = async (ctx, { partyApplicationId, personIds }) => {
  const query = initQuery(ctx)
    .from('rentapp_ApplicationInvoices')
    .innerJoin('rentapp_PersonApplication', `${APP_INVOICES_TABLE_NAME}.personApplicationId`, 'rentapp_PersonApplication.id')
    .whereRaw(`"${APP_INVOICES_TABLE_NAME}"."paymentCompleted" IS TRUE`)
    .select(`${APP_INVOICES_TABLE_NAME}.*`, 'rentapp_PersonApplication.personId', 'rentapp_PersonApplication.feeWaiverReason');

  personIds && query.whereIn('rentapp_PersonApplication.personId', personIds);
  partyApplicationId && query.where(`${APP_INVOICES_TABLE_NAME}.partyApplicationId`, partyApplicationId);

  return await query;
};

export const existsApplicationInvoice = async (ctx, invoiceId) => await exists(ctx, APP_INVOICES_TABLE_NAME, invoiceId);

export const getApplicationInvoice = async (ctx, id) => await getOne(ctx, APP_INVOICES_TABLE_NAME, id);
