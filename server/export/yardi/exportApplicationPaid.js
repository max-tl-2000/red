/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPartyData, getCompanyName } from '../common-export-utils';
import { getActiveExternalInfoByParty } from '../../dal/exportRepo';
import { isExportEnabled, exportData, ExportType } from './export.js';
import { getComms, getInventoryToExport } from './dataGathering';
import { getFinCharges, getFinReceipts, computeExternalInfo, getInvoiceByApplicationId } from './helpers';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

export const exportOnApplicationPaid = async (ctx, partyDocument, exportEvent) => {
  const partyId = partyDocument.id;

  try {
    if (!(await isExportEnabled(ctx))) return;

    const { personId, applicationId } = exportEvent.metadata;
    logger.info({ ctx, partyId, personId, exportEvent }, 'Exporting party on paid application');

    const partyData = await getPartyData(ctx, partyDocument);
    const { inventory, quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData });
    const { party, primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, inventory });

    const externals = await getActiveExternalInfoByParty(ctx, { partyId });
    const application = partyDocument.personApplications?.find(a => a.id === applicationId);
    const invoice = getInvoiceByApplicationId(partyDocument, applicationId);

    const { primaryTenantComms, firstShowDate } = await getComms(ctx, partyDocument, primaryTenant);
    const companyName = getCompanyName(partyDocument, primaryTenant.id);

    const data = {
      tenantId: ctx.tenantId,
      party,
      ...partyData,
      invoice,
      inventory,
      firstShowDate,
      primaryTenantComms,
      application,
      quotePromotion,
      partyMember: primaryTenant,
      companyName,
      finCharges: await getFinCharges(ctx, invoice),
      finReceipts: await getFinReceipts(ctx, invoice),
      externalInfo,
      externals,
    };

    const exportTypes = [ExportType.ResTenants, ExportType.ResProspects, ExportType.FinCharges];
    if (!invoice.applicationFeeWaiverAmount || invoice.holdDepositFeeIdAmount) {
      exportTypes.push(ExportType.FinReceipts);
    }

    const exportLogs = await exportData(ctx, exportTypes, data);

    logger.info({ ctx, partyId, exportLogs }, 'Export party on paid application - success');
  } catch (error) {
    logger.error({ ctx, partyId, error }, 'Export party on paid application - error');
    throw error;
  }
};
