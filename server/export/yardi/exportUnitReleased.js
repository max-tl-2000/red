/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPartyData, getCompanyName } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export.js';
import { getComms, getInventoryToExport, getQuoteForLease, getLeaseTerm } from './dataGathering';
import { computeExternalInfo, getApplicationByPersonId, traditionalPartyIsNotInAnExportableState, exportFilesForCorporate } from './helpers';
import { getPropertyById } from '../../dal/propertyRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getMainExternalInfoByPartyAndProperty, getExternalInfoByLeaseId } from '../../dal/exportRepo';
import { getInventoryExpanded } from '../../services/inventories';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

const shouldExportReleaseHold = (partyDocument, releaseAtCloseParty) => {
  const { state, leaseType } = partyDocument;

  if (traditionalPartyIsNotInAnExportableState(state, leaseType)) return false;
  if (releaseAtCloseParty) return false;

  return true;
};

const propertyChanged = (inventory, releasedInventory) => {
  if (inventory?.property?.id !== releasedInventory?.property?.id) return true;

  return false;
};

const shouldExportRevaApp = (inventory, releasedInventory, releasedOnExecutedLease, leaseId) => {
  const propChanged = propertyChanged(inventory, releasedInventory);
  return !!(propChanged && !releasedOnExecutedLease && !leaseId);
};

const performExport = async (ctx, data) => {
  const exportTypes = [ExportType.ResTenants, ExportType.ResProspects];
  return await exportData(ctx, exportTypes, data);
};

export const exportOnUnitReleased = async (ctx, partyDocument, exportEvent) => {
  try {
    if (!(await isExportEnabled(ctx))) return;

    const { inventoryId, releasedOnExecutedLease, leaseId, releaseAtCloseParty, manualRelease } = exportEvent.metadata;
    const partyId = partyDocument.id;
    if (!shouldExportReleaseHold(partyDocument, releaseAtCloseParty)) {
      logger.info({ ctx, partyId, state: partyDocument.state, leaseType: partyDocument.leaseType, releaseAtCloseParty }, 'Export inventory released - skipped');
      return;
    }

    logger.info(
      { ctx, partyId, exportEvent, inventoryId, releasedOnExecutedLease, releaseAtCloseParty, leaseId, manualRelease },
      'Export inventory released - start',
    );

    const partyData = await getPartyData(ctx, partyDocument);
    const { inventory, quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData }, true);

    let inventoryToExport;
    let exportRevaApp;
    const releasedInventory = await getInventoryExpanded(ctx, inventoryId);

    if (partyData.leaseType === DALTypes.PartyTypes.CORPORATE) {
      if (manualRelease && !propertyChanged(inventory, releasedInventory)) {
        inventoryToExport = inventory;
        exportRevaApp = shouldExportRevaApp(inventory, releasedInventory, releasedOnExecutedLease, leaseId);
      } else if (!releaseAtCloseParty) {
        inventoryToExport = releasedInventory;
        exportRevaApp = shouldExportRevaApp(inventory, releasedInventory, releasedOnExecutedLease, leaseId);
      } else {
        inventoryToExport = inventory;
      }
    } else {
      inventoryToExport = inventory;
    }

    const { party, primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, inventory: inventoryToExport });

    let leaseExternalInfo;

    let lease;
    let leaseTerm;

    if (party.leaseType === DALTypes.PartyTypes.CORPORATE) {
      leaseExternalInfo = leaseId && (await getExternalInfoByLeaseId(ctx, leaseId));
      lease = (partyDocument.leases || []).find(l => l.id === leaseId);
      const quote = getQuoteForLease(partyDocument, lease);
      leaseTerm = getLeaseTerm(lease, quote);
    }

    const propertyToExport = !inventoryToExport && externalInfo?.propertyId && (await getPropertyById(ctx, externalInfo.propertyId));

    const application = getApplicationByPersonId(partyDocument, primaryTenant.personId);
    const invoice = application && partyDocument.invoices?.find(inv => inv.personApplicationId === application?.id);

    const { primaryTenantComms, firstShowDate } = await getComms(ctx, partyDocument, primaryTenant);
    const companyName = getCompanyName(partyDocument, primaryTenant.id);

    const data = {
      tenantId: ctx.tenantId,
      party,
      ...partyData,
      primaryTenantComms,
      firstShowDate,
      quotePromotion,
      application,
      invoice,
      lease,
      leaseTerm,
      inventory: exportRevaApp ? null : inventoryToExport,
      partyMember: primaryTenant,
      companyName,
      externalInfo: leaseExternalInfo || externalInfo,
      propertyToExport: exportRevaApp ? inventoryToExport?.property : propertyToExport,
    };

    let exportLogs;
    if (party.leaseType !== DALTypes.PartyTypes.CORPORATE || !releasedOnExecutedLease) {
      exportLogs = await performExport(ctx, data);
    }

    const mainExternalInfo = await getMainExternalInfoByPartyAndProperty(ctx, partyId, propertyToExport?.id || inventoryToExport.propertyId);
    leaseId && (await exportFilesForCorporate(ctx, partyDocument, data, exportEvent, { externalInfo: mainExternalInfo, releasedOnExecutedLease, partyData }));

    logger.info({ ctx, partyId, exportLogs }, 'Export inventory released - success');
  } catch (error) {
    logger.error({ ctx, partyId: partyDocument && partyDocument.id, error }, 'Export inventory released - error');
    throw error;
  }
};
