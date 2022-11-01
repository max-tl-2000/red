/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { getAdditionalInfoByPartyAndType } from '../../services/party';
import { getActiveExternalInfoByParty, getPrimaryExternalInfoByParty } from '../../dal/exportRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { getPartyData, getCompanyName } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export.js';
import { getInventoryToExport, getComms } from './dataGathering';
import { computeExternalInfo, getApplicationByPersonId, findAndEnhancePrimaryTenant } from './helpers';
import { setPrimaryTenant } from '../../services/export';

import loggerModule from '../../../common/helpers/logger';
import { now } from '../../../common/helpers/moment-utils';
const logger = loggerModule.child({ subType: 'export' });

const wasPartyPreviouslyExported = async (ctx, partyId) => {
  // check if the party was already exported
  const externalInfo = await getPrimaryExternalInfoByParty(ctx, partyId);
  if (!externalInfo || !externalInfo.externalId.endsWith('t')) return false;

  logger.trace({ ctx, partyId }, 'party was previously exported');

  return true;
};

const shouldPartyBeExported = async (ctx, partyDocument, closeReasonId) => {
  logger.trace({ ctx, partyId: partyDocument.id, closeReasonId }, 'shouldPartyBeExported');

  const reasons = DALTypes.ClosePartyReasons;
  const reason = reasons[closeReasonId];

  if (reason === reasons.CLOSED_DURING_IMPORT || reason === reasons.PROPERTY_SOLD) {
    logger.trace({ ctx, partyId: partyDocument.id, closeReasonId }, 'Close party export will be skipped');

    return false;
  }

  const isPartyImported = partyDocument.metadata?.creationType === DALTypes.PartyCreationTypes.IMPORT;
  const partyPreviouslyExported = await wasPartyPreviouslyExported(ctx, partyDocument.id);

  if (isPartyImported || partyPreviouslyExported) {
    logger.trace({ ctx, partyId: partyDocument.id, closeReasonId }, 'Close party event will be exported');

    return true;
  }

  logger.trace({ ctx, partyId: partyDocument.id, closeReasonId }, 'Party does not meet any criterias, skipping export');

  return false;
};

export const exportOnPartyClosed = async (ctx, partyDocument, exportEvent) => {
  try {
    if (!(await isExportEnabled(ctx))) return;

    const { closeReason } = exportEvent.metadata;
    const partyId = partyDocument.id;
    if (!(await shouldPartyBeExported(ctx, partyDocument, closeReason))) return;

    logger.info({ ctx, partyId, exportEvent }, 'Exporting closed party');

    const activePartyMembers = partyDocument.members.filter(m => !m.partyMember.endDate);

    if (!activePartyMembers.length) {
      logger.info({ ctx, partyId, exportEvent }, 'Exporting closed party when no partyMembers were found');

      await setPrimaryTenant(ctx, {
        partyId,
        partyMembers: partyDocument.members.map(m => m.partyMember),
        partyMemberId: null,
        propertyId: partyDocument.assignedPropertyId,
      });

      return;
    }

    const partyData = await getPartyData(ctx, partyDocument);
    const { quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData });
    const { party } = await computeExternalInfo(ctx, { partyDocument });

    const externals = await getActiveExternalInfoByParty(ctx, { partyId });
    const exportLogs = [];

    const primaryExternals = externals.filter(ext => ext.isPrimary);

    await mapSeries(primaryExternals, async external => {
      const primaryTenant = await findAndEnhancePrimaryTenant(partyDocument, external);

      const application = getApplicationByPersonId(partyDocument, primaryTenant.personId);
      const invoice = application && partyDocument.invoices?.find(inv => inv.personApplicationId === application?.id);
      const { primaryTenantComms, firstShowDate } = await getComms(ctx, partyDocument, primaryTenant);
      const companyName = getCompanyName(partyDocument, primaryTenant.id);
      const children = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.CHILD);

      const partyCloseDate = now().toDate();

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
        inventory: null,
        partyMember: primaryTenant,
        companyName,
        externalInfo: external,
        externals,
      };

      const exportTypes = [ExportType.ResTenants, ExportType.ResProspects];
      const logs = await exportData(ctx, exportTypes, data);

      exportLogs.push(...logs);
    });

    logger.info({ ctx, partyId, exportLogs }, 'Export closed party - success');
  } catch (error) {
    logger.error({ ctx, partyId: partyDocument && partyDocument.id, error }, 'Export closed party - error');
    throw error;
  }
};
