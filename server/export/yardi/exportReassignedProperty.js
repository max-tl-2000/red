/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { getAdditionalInfoByPartyAndType } from '../../services/party';
import { archiveExternalInfo } from '../../services/externalPartyMemberInfo';
import { getActiveExternalInfoByParty } from '../../dal/exportRepo';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { getPartyData, getCompanyName } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export.js';
import { getComms, getInventoryToExport } from './dataGathering';
import { computeExternalInfo, getApplicationByPersonId } from './helpers';
import { getPropertyById } from '../../dal/propertyRepo';

import loggerModule from '../../../common/helpers/logger';
import { now } from '../../../common/helpers/moment-utils';
const logger = loggerModule.child({ subType: 'export' });

export const exportOnReassignedProperty = async (ctx, partyDocument, exportEvent) => {
  try {
    if (!(await isExportEnabled(ctx))) return;

    const partyId = partyDocument.id;
    if (!partyDocument.assignedPropertyId) {
      logger.error({ ctx, partyId }, 'Exporting party on reassigned property error: missing assignedProperty');
      return;
    }
    logger.info({ ctx, partyId, exportEvent }, 'Exporting party on reassigned property');

    const prevExternalInfo = await getActiveExternalInfoByParty(ctx, { partyId });
    if (!prevExternalInfo?.length) {
      logger.info(
        { ctx, partyId },
        'Party was reassigned to a different property before ever being exported, nothing needs to be closed in Yardi. Skipping export.',
      );
      return;
    }

    await mapSeries(prevExternalInfo, async externalInfo => await archiveExternalInfo(ctx, externalInfo));

    const partyData = await getPartyData(ctx, partyDocument);
    const { quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData });
    const { party, primaryTenant } = await computeExternalInfo(ctx, { partyDocument, isForReassignedPropertyExport: true });

    const application = getApplicationByPersonId(partyDocument, primaryTenant.personId);
    const invoice = application && partyDocument.invoices?.find(inv => inv.personApplicationId === application?.id);
    const { primaryTenantComms, firstShowDate } = await getComms(ctx, partyDocument, primaryTenant);
    const companyName = getCompanyName(partyDocument, primaryTenant.id);
    const children = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.CHILD);
    const externalInfo = prevExternalInfo.find(extInfo => extInfo.isPrimary);
    const propertyToExport = externalInfo?.propertyId && (await getPropertyById(ctx, externalInfo.propertyId));

    const partyCloseDate = now().toDate();
    party.endDate = partyCloseDate;

    const data = {
      tenantId: ctx.tenantId,
      party,
      ...partyData,
      children,
      primaryTenantComms,
      firstShowDate,
      quotePromotion,
      partyCloseDate,
      application,
      invoice,
      partyMember: primaryTenant,
      companyName,
      externalInfo,
      propertyToExport,
    };

    const exportTypes = [ExportType.ResTenants, ExportType.ResProspects];
    const exportedFiles = await exportData(ctx, exportTypes, data);

    logger.info({ ctx, partyId, exportedFiles }, 'Export party reassigned to property - success');
  } catch (error) {
    logger.error({ ctx, partyId: partyDocument && partyDocument.id, error }, 'Export party reassigned to property - error');
    throw error;
  }
};
