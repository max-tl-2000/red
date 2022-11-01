/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { now } from '../../../common/helpers/moment-utils';
import { getMergePartyExportData, getActiveExternalInfoByParty } from '../../dal/exportRepo';
import { isExportEnabled, exportData, ExportType } from './export';
import { computeExternalInfo } from './helpers';
import { getCompanyName } from '../common-export-utils';
import { archiveAllExternalInfoByParty } from '../../services/externalPartyMemberInfo';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'export' });

export const exportOnPartyMerged = async (ctx, partyDocument, exportEvent) => {
  const { matchId } = exportEvent.metadata;

  try {
    if (!(await isExportEnabled(ctx))) return;

    logger.info({ ctx, exportEvent }, 'Exporting merged party');

    const mergedPartyData = await getMergePartyExportData(ctx, matchId);

    const {
      party,
      sourceName,
      user,
      property,
      children,
      vehicles,
      primaryTenantComms,
      firstShowDate,
      quotePromotion,
      application,
      invoice,
      inventory,
    } = mergedPartyData.exportData;

    const { primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, includeArchivedParties: true });
    const externals = await getActiveExternalInfoByParty(ctx, { partyId: party.id, includeArchivedParties: true });
    const partyCloseDate = now().toDate(); // TODO: ask Cluj, why is the toDate() call needed. It should not be needed
    const companyName = getCompanyName(partyDocument, primaryTenant.id);
    await archiveAllExternalInfoByParty(ctx, party.id);

    const data = {
      tenantId: ctx.tenantId,
      party,
      sourceName,
      user,
      property,
      children,
      vehicles,
      primaryTenantComms,
      firstShowDate,
      quotePromotion,
      partyCloseDate,
      application,
      invoice,
      inventory,
      partyMember: primaryTenant,
      companyName,
      externalInfo,
      externals,
    };

    party.endDate = new Date();

    const exportTypes = [ExportType.ResTenants, ExportType.ResProspects];
    const exportLogs = await exportData(ctx, exportTypes, data);

    logger.info({ ctx, partyId: partyDocument.id, matchId, exportLogs, exportEvent }, 'Export merged party - success');
  } catch (error) {
    logger.error({ ctx, partyId: partyDocument.id, matchId, error, exportEvent }, 'Export merged party - error');
    throw error;
  }
};
