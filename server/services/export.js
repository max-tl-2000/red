/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { sortByCreationDate } from '../../common/helpers/sortBy';
import { AdditionalInfoTypes } from '../../common/enums/partyTypes';
import { now } from '../../common/helpers/moment-utils';
import { loadProgramByTeamPropertyProgramId as getPartyProgramData } from '../dal/programsRepo';
import * as exportRepo from '../dal/exportRepo';
import { getFirstCompletedTourDate } from '../dal/appointmentRepo';
import { getPropertyAssignedToParty } from '../helpers/party';
import { runInTransaction } from '../database/factory';
import { getPersonApplicationByPersonAndParty, getInvoiceForPersonApplication } from './applications';
import { getQuotePromotionsByQuoteId } from './quotePromotions';
import { getInventoryExpanded, getInventoryForQuote } from './inventories';
import { saveExternalPartyMemberInfo, replacePrimaryTenant, archiveExternalInfo } from './externalPartyMemberInfo';
import { loadUserById } from './users';
import { getAdditionalInfoByPartyAndType } from './party';
import { loadCommunicationsByPerson } from './communication';
import { electPrimaryTenant } from '../export/common-export-utils';
import { isResident } from '../../common/helpers/party-utils';

import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'exportService' });

export const getExportLogs = async (ctx, partyId, type) => await exportRepo.getExportLogs(ctx, partyId, type);

export const getExportLog = async (ctx, exportLogId) => await exportRepo.getExportLog(ctx, exportLogId);

export const saveExportLog = async (ctx, exportLog) => await exportRepo.saveExportLog(ctx, exportLog);

export const updateExportLog = async (ctx, exportLog) => await exportRepo.updateExportLog(ctx, exportLog);

export const updateExportLogMetadata = async (ctx, exportLogIds, data) => await exportRepo.updateExportLogMetadata(ctx, exportLogIds, data);

export const getPrimaryTenantId = (ctx, partyMembers) => {
  const primaryTenant = partyMembers.find(pm => pm.externalId);

  if (!primaryTenant) {
    const resident = electPrimaryTenant(ctx, partyMembers);
    return resident && resident.id;
  }

  return primaryTenant.id;
};

const setProspectCode = async (ctx, partyId, externalInfoId) => {
  logger.trace({ ctx, partyId, externalInfoId }, 'setProspectCode');

  const externalProspectId = await exportRepo.getNextProspectCode(ctx);

  return await exportRepo.updateExternalInfo(ctx, {
    id: externalInfoId,
    externalProspectId,
  });
};

const setRoommateCodes = async (ctx, partyId, roommates, propertyId) => {
  logger.trace({ ctx, partyId, roommates }, 'setRoommateCodes');

  const externals = await exportRepo.getActiveExternalInfoByParty(ctx, { partyId });

  // roommates
  const memberHasRoommateId = roommate => externals.find(e => e.partyMemberId === roommate.id && !!e.externalRoommateId);
  const roommatesToExport = roommates.filter(r => !memberHasRoommateId(r));

  await mapSeries(roommatesToExport, async roommate => {
    const code = await exportRepo.getNextRoommateCode(ctx);
    await saveExternalPartyMemberInfo(ctx, {
      partyId,
      partyMemberId: roommate.id,
      externalRoommateId: `${code}r`,
      propertyId,
    });
  });

  // children
  const childHasRoommateId = child => externals.find(e => e.childId === child.id && !!e.externalRoommateId);
  const children = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.CHILD);
  const childrenToExport = children.filter(c => !childHasRoommateId(c));

  await mapSeries(childrenToExport, async child => {
    const code = await exportRepo.getNextRoommateCode(ctx);
    await saveExternalPartyMemberInfo(ctx, {
      partyId,
      childId: child.id,
      externalRoommateId: `${code}p`,
      propertyId,
    });
  });
};

const shouldSetNewPrimaryTenant = (ctx, externalInfo, partyMembers) => {
  logger.trace({ ctx, externalInfo, partyMembers }, 'shouldSetNewPrimaryTenant');

  if (!externalInfo) return true;

  const primaryPartyMember = partyMembers.find(pm => pm.id === externalInfo.partyMemberId);

  const wasPrimaryRemoved = !!primaryPartyMember.endDate;
  const isPrimaryNotAResident = !isResident(primaryPartyMember);
  const partyHasResidents = partyMembers.some(pm => isResident(pm));

  logger.trace({ ctx, isPrimaryNotAResident, partyHasResidents }, 'shouldSetNewPrimaryTenant - results');

  return wasPrimaryRemoved || (isPrimaryNotAResident && partyHasResidents);
};

export const setPrimaryTenant = async (ctx, { partyId, partyMembers, partyMemberId, includeArchivedParties = false, propertyId }) => {
  logger.trace({ ctx, partyId, partyMemberId, includeArchivedParties, propertyId }, 'setPrimaryTenant');
  if (!partyMembers.length) return;

  let externalInfo = await exportRepo.getPrimaryExternalInfoByParty(ctx, partyId, includeArchivedParties);

  const newPrimaryTenantNeeded = shouldSetNewPrimaryTenant(ctx, externalInfo, partyMembers);
  if (externalInfo && newPrimaryTenantNeeded) {
    const prevPrimary = partyMembers.find(pm => pm.id === externalInfo.partyMemberId);
    await replacePrimaryTenant(ctx, { partyId, partyMembers, removedMember: prevPrimary, propertyId });
  }

  if (!externalInfo) {
    const primaryTenantId =
      partyMemberId ||
      getPrimaryTenantId(
        ctx,
        partyMembers.filter(pm => !pm.endDate),
      );

    await runInTransaction(async trx => {
      const innerCtx = { ...ctx, trx };

      const existingExternalInfo = await exportRepo.getActiveExternalInfo(innerCtx, primaryTenantId);
      await archiveExternalInfo(innerCtx, existingExternalInfo);

      const externalId = await exportRepo.getNextPrimaryTenantCode(innerCtx);
      const data = {
        partyId,
        partyMemberId: primaryTenantId,
        externalId,
        externalProspectId: existingExternalInfo?.externalProspectId,
        isPrimary: true,
        propertyId,
      };

      await saveExternalPartyMemberInfo(innerCtx, data);
    });
  }

  // prospect code
  externalInfo = await exportRepo.getPrimaryExternalInfoByParty(ctx, partyId, includeArchivedParties);
  if (!externalInfo?.externalProspectId) {
    await setProspectCode(ctx, partyId, externalInfo.id);
  }

  const roommates = partyMembers.filter(pm => !pm.endDate && pm.id !== externalInfo.partyMemberId);
  await setRoommateCodes(ctx, partyId, roommates, externalInfo.propertyId);
};

export const getApplicationFeeData = async (ctx, partyId, personId) => {
  const application = await getPersonApplicationByPersonAndParty(ctx, personId, partyId);
  if (!application) return {};
  const invoice = await getInvoiceForPersonApplication(ctx, application.id);

  return {
    application,
    invoice,
  };
};

export const getQuoteDataFromInvoice = async (ctx, invoice) => {
  if (!invoice) return {};
  const { quoteId } = invoice;
  if (!quoteId) return {};

  const { id: inventoryId } = await getInventoryForQuote(ctx, quoteId, ['id']);
  const inventory = await getInventoryExpanded(ctx, inventoryId);

  const quotePromotions = await getQuotePromotionsByQuoteId(ctx, quoteId);
  const [quotePromotion] = quotePromotions.sort(sortByCreationDate);

  return {
    inventory,
    quotePromotion,
  };
};

export const getExportMergedPartyData = async (ctx, mergedParty) => {
  const party = mergedParty;

  const user = await loadUserById(ctx, party.userId);
  const property = await getPropertyAssignedToParty(ctx, party);
  const programData = party.teamPropertyProgramId ? await getPartyProgramData(ctx, party.teamPropertyProgramId) : {};

  const primaryTenantId = getPrimaryTenantId(ctx, party.partyMembers);
  const primaryTenant = party.partyMembers.find(pm => pm.id === primaryTenantId);

  const { application, invoice } = await getApplicationFeeData(ctx, party.id, primaryTenant.personId);
  const { inventory, promotedQuote } = await getQuoteDataFromInvoice(ctx, invoice);

  const children = await getAdditionalInfoByPartyAndType(ctx, party.id, AdditionalInfoTypes.CHILD);
  const vehicles = await getAdditionalInfoByPartyAndType(ctx, party.id, AdditionalInfoTypes.VEHICLE);

  const primaryTenantComms = await loadCommunicationsByPerson(ctx, primaryTenant.personId);
  const firstShowDate = ((await getFirstCompletedTourDate(ctx, primaryTenant.id)) || {}).dueDate;

  return {
    tenantId: ctx.tenantId,
    party,
    sourceName: programData.sourceName || '',
    user,
    property,
    children,
    vehicles,
    primaryTenantComms,
    firstShowDate,
    promotedQuote,
    partyCloseDate: now().toDate(),
    application,
    invoice,
    inventory,
  };
};
