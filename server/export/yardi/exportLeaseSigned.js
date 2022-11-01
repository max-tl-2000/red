/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { DALTypes } from '../../../common/enums/DALTypes';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { getExportLogs } from '../../services/export';
import { getAdditionalInfoByPartyAndType } from '../../services/party';
import { saveExternalPartyMemberInfo, archiveExternalInfo } from '../../services/externalPartyMemberInfo';
import { getActiveExternalInfoByParty, getNextRoommateCode } from '../../dal/exportRepo';
import { getPropertyByName } from '../../dal/propertyRepo';
import { getPartyLeases } from '../../dal/leaseRepo';
import { getPartyData, getCompanyName, allPartyMembersSigned } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export.js';
import { getComms, getQuoteForLease, getInventoryToExport, getLeaseTerm } from './dataGathering';
import { computeExternalInfo, getApplicationByPersonId, insertExternalPartyMemberInfoForPrimaryMember, exportFilesForCorporate } from './helpers';
import { getCharges } from './charges';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'export' });

const shouldExportRoommates = async (ctx, partyId, externalInfo) => {
  logger.trace({ ctx, partyId, externalInfo }, 'shouldExportRoommates');

  const exportLogs = await getExportLogs(ctx, partyId, DALTypes.ExportTypes.RES_ROOMMATES);
  const roomatesAlreadyExported = exportLogs.some(log => log.externalId === externalInfo.externalId);

  return !roomatesAlreadyExported;
};

const getPropertyIdFromLease = async (ctx, lease) => {
  const propertyName = lease?.baselineData?.propertyName;
  const { id: propertyId } = await getPropertyByName(ctx, propertyName);

  return propertyId;
};

export const insertExternalPartyMemberInfoForRoommatesAndChildren = async (ctx, { partyId, roommates, children, propertyId }) => {
  logger.info({ ctx, partyId, roommates, children, propertyId }, 'insertExternalPartyMemberInfoForRoommatesAndChildren');

  await mapSeries(roommates, async roommate => {
    const code = await getNextRoommateCode(ctx);
    await saveExternalPartyMemberInfo(ctx, {
      partyId,
      partyMemberId: roommate.id,
      externalRoommateId: `${code}r`,
      propertyId,
    });
  });

  await mapSeries(children, async child => {
    const code = await getNextRoommateCode(ctx);
    await saveExternalPartyMemberInfo(ctx, {
      partyId,
      childId: child.id,
      externalRoommateId: `${code}p`,
      propertyId,
    });
  });
};

export const updatePropertyIdForAllMembers = async (ctx, { party, lease, primaryTenant, oldExternalInfos }) => {
  logger.info({ ctx, partyId: party.id }, 'updatePropertyIdForAllMembers');
  const propertyId = await getPropertyIdFromLease(ctx, lease);

  await insertExternalPartyMemberInfoForPrimaryMember(ctx, { party, lease, primaryTenant, propertyId });

  const roommates = party.partyMembers.filter(pm => !pm.endDate && pm.id !== primaryTenant.id);
  const children = await getAdditionalInfoByPartyAndType(ctx, party.id, AdditionalInfoTypes.CHILD);
  await insertExternalPartyMemberInfoForRoommatesAndChildren(ctx, { partyId: party.id, roommates, children, propertyId });

  await mapSeries(oldExternalInfos, async extInfo => {
    await archiveExternalInfo(ctx, extInfo);
  });
};

export const exportOnLeaseSigned = async (ctx, partyDocument, exportEvent) => {
  const { partyId } = exportEvent;
  const { leaseId, signDate } = exportEvent.metadata;

  try {
    if (!(await isExportEnabled(ctx))) return;

    const leaseIsSignedByAllPartyMembers = allPartyMembersSigned(partyDocument.members, partyDocument.leases, leaseId);
    if (!leaseIsSignedByAllPartyMembers) {
      logger.info({ ctx, partyId: partyDocument.id }, 'Yardi Export - skipping export. Not all party members signed');
      return;
    }

    logger.info({ ctx, exportEvent }, 'Exporting party on signed lease');

    const children = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.CHILD);

    let lease = (partyDocument.leases || []).find(l => l.id === leaseId);
    if (!lease) {
      const msg = `Cannot find lease with id ${leaseId} for party ${partyId}`;
      logger.error({ ctx, partyId, leaseId }, msg);
      throw msg;
    }

    const partyData = await getPartyData(ctx, partyDocument);
    const { inventory, quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData, lease });

    const quote = getQuoteForLease(partyDocument, lease);
    const leaseTerm = getLeaseTerm(lease, quote);

    const { finCharges, leaseCharges } = await getCharges(ctx, lease);

    const { party, primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, inventory });
    const externals = await getActiveExternalInfoByParty(ctx, { partyId });

    let leaseExternalInfo;
    const isCorporatePartyWithoutExternalLeaseId = party.leaseType === DALTypes.PartyTypes.CORPORATE && !lease.external.id;

    if (isCorporatePartyWithoutExternalLeaseId) {
      logger.trace({ ctx, partyId, leaseId, exportEvent }, 'Exporting a lease for a corporate party. Setting the external codes on the lease.');

      const propertyId = await getPropertyIdFromLease(ctx, lease);
      leaseExternalInfo = await insertExternalPartyMemberInfoForPrimaryMember(ctx, { party, lease, primaryTenant, propertyId });
      lease = (await getPartyLeases(ctx, partyId)).find(l => l.id === lease.id);
    }

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
      leaseTerm,
      inventory,
      finCharges,
      charges: leaseCharges,
      application,
      invoice,
      quotePromotion,
      externalInfo: leaseExternalInfo || externalInfo,
      externals,
      leaseIsSignedByAllPartyMembers,
      signDate,
    };

    const exportTypes = [ExportType.ResTenants, ExportType.ResProspects, ExportType.ResLeaseCharges, ExportType.FinCharges];

    if (await shouldExportRoommates(ctx, partyId, externalInfo)) {
      exportTypes.push(ExportType.ResRoommates);
    }

    const exportLogs = await exportData(ctx, exportTypes, data);

    await exportFilesForCorporate(ctx, partyDocument, data, exportEvent, { externalInfo, partyData, lease });
    logger.info({ ctx, exportEvent, exportLogIds: exportLogs?.map(exportLog => exportLog.id) }, 'Export party on signed lease - success');
  } catch (error) {
    logger.info({ ctx, exportEvent, error }, 'Export party on signed lease - error');
    throw error;
  }
};
