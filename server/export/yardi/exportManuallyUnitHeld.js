/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartyData, getCompanyName } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export.js';
import { getComms, getInventoryToExport } from './dataGathering';
import { computeExternalInfo, getApplicationByPersonId, traditionalPartyIsNotInAnExportableState } from './helpers';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

const shouldExportManualHold = (partyDocument, inventoryId, inventoryOnHoldId) => {
  const { invOnHolds, state, leaseType } = partyDocument;

  if (traditionalPartyIsNotInAnExportableState(state, leaseType)) return false;

  const inventoryOnHold = invOnHolds.find(i => i.id === inventoryOnHoldId);

  return inventoryOnHold?.reason === DALTypes.InventoryOnHoldReason.MANUAL;
};

export const exportOnManuallyUnitHeld = async (ctx, partyDocument, exportEvent) => {
  try {
    if (!(await isExportEnabled(ctx))) return;

    const { inventoryId, inventoryOnHoldId = '' } = exportEvent.metadata;
    const partyId = partyDocument.id;

    if (!shouldExportManualHold(partyDocument, inventoryId, inventoryOnHoldId)) {
      logger.info(
        { ctx, partyId, state: partyDocument.state, leaseType: partyDocument.leaseType, inventoryOnHoldId },
        'Export manual inventory hold - skipped',
      );
      return;
    }

    logger.info({ ctx, partyId, exportEvent, inventoryId, inventoryOnHoldId }, 'Export manual inventory hold - start');

    const partyData = await getPartyData(ctx, partyDocument);
    const { inventory, quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData }, true);
    const { party, primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, inventory });

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
      inventory,
      partyMember: primaryTenant,
      companyName,
      externalInfo,
    };

    const exportTypes = [ExportType.ResTenants, ExportType.ResProspects];
    const exportLogs = await exportData(ctx, exportTypes, data);

    logger.info({ ctx, partyId, exportLogs }, 'Export manual inventory hold - success');
  } catch (error) {
    logger.error({ ctx, partyId: partyDocument && partyDocument.id, error }, 'Export manual inventory hold - error');
    throw error;
  }
};
