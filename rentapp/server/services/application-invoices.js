/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as dal from '../dal/application-invoices-repo';

export const createApplicationInvoice = (ctx, invoice) => dal.createApplicationInvoice(ctx, invoice);
export const updateApplicationInvoice = (ctx, invoice) => dal.updateApplicationInvoice(ctx, invoice);
export const getApplicationInvoicesByFilter = (ctx, filter) => dal.getApplicationInvoicesByFilter(ctx, filter);
export const existsApplicationInvoice = (ctx, invoice) => dal.existsApplicationInvoice(ctx, invoice.id);
export const getApplicationInvoice = (ctx, invoice) => dal.getApplicationInvoice(ctx, invoice.id);
export const getPaidApplicationInvoices = (ctx, { partyApplicationId, personIds }) => dal.getPaidApplicationInvoices(ctx, { partyApplicationId, personIds });
