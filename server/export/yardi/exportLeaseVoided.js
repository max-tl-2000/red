/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { getExportLogs } from '../../services/export';
import { getAdditionalInfoByPartyAndType } from '../../services/party';
import { getPartyData, getCompanyName } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export.js';
import { getComms, getInventoryToExport } from './dataGathering';
import { formatExportEntry, computeExternalInfo, getApplicationByPersonId, exportFilesForCorporate } from './helpers';
import { archiveExternalInfo } from '../../services/externalPartyMemberInfo';
import { getPropertyById } from '../../dal/propertyRepo';
import { getMainExternalInfoByPartyAndProperty } from '../../dal/exportRepo';

import loggerModule from '../../../common/helpers/logger';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
const logger = loggerModule.child({ subType: 'export' });

const getChargesFromExportLog = async (ctx, partyId, leaseId, csvType) => {
  const exportLogs = await getExportLogs(ctx, partyId, csvType);
  const exportLog = exportLogs.find(log => log.leaseId === leaseId);
  return exportLog && exportLog.data.entries;
};

const getCharges = async (ctx, partyId, lease, timezone) => {
  let finCharges = await getChargesFromExportLog(ctx, partyId, lease.id, DALTypes.ExportTypes.FIN_CHARGES);
  if (finCharges) {
    finCharges = await execConcurrent(
      finCharges.filter(charge => charge.OFFSET !== 'appfee'),
      async charge => ({
        amount: -1 * charge.AMOUNT,
        date: parseAsInTimezone(charge.DATE, { format: 'M/D/YYYY', timezone }).toISOString(),
        isLeaseCharge: true,
        ...formatExportEntry(charge),
      }),
    );
  }

  let leaseCharges = await getChargesFromExportLog(ctx, partyId, lease.id, DALTypes.ExportTypes.RES_LEASE_CHARGES);
  if (leaseCharges) {
    const { leaseStartDate } = lease.baselineData.publishedLease;

    leaseCharges = leaseCharges.map(charge => ({
      externalChargeCode: charge.Charge_Code,
      amount: 0,
      fromDate: leaseStartDate,
      toDate: leaseStartDate,
    }));
  }

  return { finCharges, leaseCharges };
};

export const exportOnLeaseVoided = async (ctx, partyDocument, exportEvent) => {
  const { partyId } = exportEvent;
  const { leaseId, allPartyMembersSigned } = exportEvent.metadata;

  try {
    if (!(await isExportEnabled(ctx))) return;

    if (!allPartyMembersSigned) {
      logger.info({ ctx, exportEvent }, 'Yardi Export - The lease was not signed by all party members before voiding. The export will not be performed.');
      return;
    }

    logger.info({ ctx, exportEvent }, 'Exporting party on voided lease');

    const children = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.CHILD);

    const lease = (partyDocument.leases || []).find(l => l.id === leaseId);
    if (!lease) {
      const msg = `Cannot find lease with id ${leaseId} for party ${partyId}`;
      logger.error({ ctx, partyId, leaseId }, msg);
      throw msg;
    }

    const partyData = await getPartyData(ctx, partyDocument);
    const { inventory, quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData });
    const { party, primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, leaseId: lease.id, isForVoidLeaseExport: true });

    const propertyToExport = externalInfo?.propertyId && (await getPropertyById(ctx, externalInfo.propertyId));
    const inventoryToExport = inventory && inventory.property?.id === propertyToExport.id ? inventory : null;

    const { finCharges, leaseCharges } = await getCharges(ctx, partyId, lease, partyData.property.timezone);
    const { primaryTenantComms, firstShowDate } = await getComms(ctx, partyDocument, primaryTenant);
    const companyName = getCompanyName(partyDocument, primaryTenant.id);
    const application = getApplicationByPersonId(partyDocument, primaryTenant.personId);
    const invoice = application && partyDocument.invoices?.find(inv => inv.personApplicationId === application?.id);

    const data = {
      tenantId: ctx.tenantId,
      party,
      ...partyData,
      partyMember: primaryTenant,
      companyName,
      children,
      firstShowDate,
      primaryTenantComms,
      lease,
      inventory: inventoryToExport,
      finCharges,
      charges: leaseCharges,
      application,
      invoice,
      quotePromotion,
      externalInfo,
      propertyToExport,
    };

    const exportTypes = [
      ExportType.ResTenants,
      ExportType.ResProspects,
      finCharges && ExportType.FinCharges,
      leaseCharges && ExportType.ResLeaseCharges,
    ].filter(x => x);

    const exportLogs = await exportData(ctx, exportTypes, { ...data, inventory: null });

    const mainExternalInfo = await getMainExternalInfoByPartyAndProperty(ctx, partyId, propertyToExport.id);
    await exportFilesForCorporate(ctx, partyDocument, data, exportEvent, { externalInfo: mainExternalInfo, partyData, lease });

    if (party.leaseType === DALTypes.PartyTypes.CORPORATE && externalInfo.id) {
      await archiveExternalInfo(ctx, externalInfo);
    }

    logger.info({ ctx, exportEvent, exportLogs }, 'Export party on voided lease - success');
  } catch (error) {
    logger.info({ ctx, exportEvent, error }, 'Export party on voided lease - error');
    throw error;
  }
};
