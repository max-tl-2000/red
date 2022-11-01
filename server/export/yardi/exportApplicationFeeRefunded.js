/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getActiveExternalInfoByParty } from '../../dal/exportRepo';
import { getPartyData } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export';
import { getExecutedLease, getInventoryToExport } from './dataGathering';
import { getFinCharges, getFinReceipts, enhanceTransactionData, computeExternalInfo } from './helpers';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'export' });

export const exportOnApplicationFeeRefunded = async (ctx, partyDocument, exportEvent) => {
  const partyId = partyDocument.id;
  let dataToLog = {};

  try {
    if (!(await isExportEnabled(ctx))) return;

    const { transactionId, isRefund } = exportEvent.metadata;
    if (!isRefund) {
      logger.trace({ ctx }, 'The transaction is not a refund, will not be exported');
      return;
    }

    logger.info({ ctx, partyId, exportEvent }, 'Exporting party on application fee refunded');

    const transaction = partyDocument.transactions.find(t => t.id === transactionId);
    if (!transaction) {
      const msg = `Cannot find transction with transactionId ${transactionId}`;
      logger.error({ ctx, transactionId }, msg);
      throw new Error(msg);
    }

    const partyData = await getPartyData(ctx, partyDocument);
    const { inventory } = await getInventoryToExport(ctx, partyDocument, { partyData });
    const { party, primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, includeArchivedParties: true, inventory });

    const invoice = (partyDocument.invoices || []).find(i => i.id === transaction.invoiceId);
    const { personApplicationId } = invoice;
    const { personId } = partyDocument.personApplications.find(pa => pa.id === personApplicationId);

    const externals = await getActiveExternalInfoByParty(ctx, { partyId, includeArchivedParties: true });

    const lease = getExecutedLease(partyDocument);

    dataToLog = {
      ...dataToLog,
      partyId,
      partyMemberId: (primaryTenant || {}).id,
      inventoryId: (inventory || {}).id,
      leaseId: (lease || {}).id,
      personId,
      personApplicationId,
    };

    const transactionData = await enhanceTransactionData(transaction);

    const data = {
      tenantId: ctx.tenantId,
      party,
      property: partyData.property,
      inventory,
      lease,
      partyMember: primaryTenant,
      finCharges: await getFinCharges(ctx, invoice, transactionData),
      finReceipts: await getFinReceipts(ctx, invoice, transactionData),
      externalInfo,
      externals,
    };
    const exportTypes = [ExportType.FinCharges, ExportType.FinReceipts];
    const exportLogs = await exportData(ctx, exportTypes, data);

    logger.info({ ctx, partyId, exportLogs, exportEvent, ...dataToLog }, 'Exporting party on application fee refunded - success');
  } catch (error) {
    logger.error({ ctx, error, partyId, exportEvent, ...dataToLog }, 'Exporting party on application fee refunded - error');
    throw error;
  }

  return;
};
