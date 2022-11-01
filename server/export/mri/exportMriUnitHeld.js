/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import { ExportType } from './export';
import { getAllExternalInfoByPartyForMRI } from '../../dal/exportRepo';
import { getPartyData, getCompanyName, isPartyInApplicantState, getAppointmentInventory } from '../common-export-utils';
import { getExternalInfo, generateGuestCardsExportSteps, addIndex, processExportMessage } from './mri-export-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getInventoryExpanded } from '../../services/inventories';
import { getInventoryProps, updateInventoryOnHoldByPartyIdAndInvId, updateLastInventoryOnHoldByPartyId } from '../../dal/inventoryRepo';
import { getExternalIdsForUser } from '../../services/users';
import { shouldExportExternalUniqueId } from '../helpers';
import { getAvailabilityDate } from '../../../common/helpers/inventory';
import loggerModule from '../../../common/helpers/logger';
import { toMoment } from '../../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'export/mri' });

export const getPrimaryExternalIdToClearUnit = (partyDocument, { primaryTenant, externals, updatedInventory, isUnitReleased }) => {
  let primaryTenantToIdClear;
  let assignedPropertyId;
  const primaryExternals = externals.filter(ext => ext.isPrimary && ext.externalId);
  const invHolds =
    updatedInventory?.id && !partyDocument?.invOnHolds?.find(inv => inv.id === updatedInventory.id)
      ? (partyDocument?.invOnHolds || []).concat([updatedInventory] || [])
      : partyDocument?.invOnHolds || [];
  const sortedInvHolds = invHolds?.sort((a, b) => -toMoment(a.created_at).diff(toMoment(b.created_at)));

  // at unit held, for multiple primary residents and hold inventories, we clear the data for the previous one
  // for old records of inventory hold that do not have anything in metadata, we clear the data for the current primary member
  if (!isUnitReleased && sortedInvHolds?.length > 1) {
    primaryTenantToIdClear = sortedInvHolds[1]?.metadata?.primaryPartyMemberId || primaryTenant?.id;
    assignedPropertyId = sortedInvHolds[1]?.metadata?.propertyId || partyDocument.assignedPropertyId;
  } else if (!isUnitReleased) {
    // at first unit held we clear the data for the last inv hold
    primaryTenantToIdClear = updatedInventory?.metadata?.primaryPartyMemberId || primaryTenant?.id;
    assignedPropertyId = updatedInventory?.metadata?.propertyId || partyDocument.assignedPropertyId;
  } else {
    // at releaseUnit, we clear the data for the party member from the last invHold
    primaryTenantToIdClear = sortedInvHolds[0]?.metadata?.primaryPartyMemberId || primaryTenant?.id;
    assignedPropertyId = sortedInvHolds[0]?.metadata?.propertyId || partyDocument.assignedPropertyId;
  }

  const primaryExternalToClear = primaryExternals.find(e => e.partyMemberId === primaryTenantToIdClear && e?.propertyId === assignedPropertyId);
  return primaryExternalToClear?.externalId;
};

export const getData = async (
  ctx,
  { partyDocument, inventoryId, leaseId, leaseTermLength, leaseStartDate, isUnitReleased = false, includeArchivedPartiesAndMembers = false },
) => {
  const partyData = await getPartyData(ctx, partyDocument);
  const { primaryTenant, externalInfo, party } = await getExternalInfo(ctx, partyDocument, leaseId, includeArchivedPartiesAndMembers);

  const externals = await getAllExternalInfoByPartyForMRI(ctx, partyDocument.id);
  const externalIds = await getExternalIdsForUser(ctx, partyDocument.ownerTeam, partyDocument.userId);
  const companyName = getCompanyName(partyDocument, primaryTenant.id);

  let updatedInventory = {};
  !isUnitReleased &&
    (updatedInventory = await updateInventoryOnHoldByPartyIdAndInvId(ctx, {
      inventoryId,
      partyId: party.id,
      partyMemberId: primaryTenant.id,
      assignedPropertyId: partyDocument.assignedPropertyId,
    }));

  const inventory = inventoryId && (await getInventoryExpanded(ctx, inventoryId));
  const firstAppointmentInventory = partyDocument?.metadata?.appointmentInventory;
  const inventoryProps = inventory && (await getInventoryProps(ctx, { inventoryId }));
  const inventoryAvailabilityDate = inventoryProps && getAvailabilityDate(inventoryProps, partyData.property.timezone);
  const lease = (partyDocument.leases || []).find(l => l.id === leaseId);
  const shouldExportExternalUniqueIdForAgent = await shouldExportExternalUniqueId(ctx, partyDocument.ownerTeam, partyDocument.userId);
  const partyShouldBeExportedAsApplicant = isPartyInApplicantState(partyDocument.invoices);

  const primaryExternalIdForClearUnit = getPrimaryExternalIdToClearUnit(partyDocument, {
    primaryTenant,
    externals,
    updatedInventory,
    isUnitReleased,
    inventoryId,
  });

  return {
    tenantId: ctx.tenantId,
    primaryTenant,
    primaryExternalIdForClearUnit,
    ...partyData,
    companyName,
    party,
    inventory: inventory && {
      ...pick(inventory, ['itemType', 'itemId', 'name', 'externalId']),
      building: pick(inventory.building, ['externalId']),
      property: pick(inventory.property, ['externalId']),
    },
    inventoryAvailabilityDate,
    lease: lease && {
      id: lease.id,
      baselineData: {
        publishedLease: pick(lease.baselineData.publishedLease, ['moveInDate', 'leaseStartDate']),
        quote: pick(lease.baselineData.quote, ['timezone', 'moveInDate']),
      },
    },
    appointmentInventory: await getAppointmentInventory(ctx, firstAppointmentInventory, partyData),
    externalInfo,
    externals,
    userExternalUniqueId: externalIds.externalUniqueId,
    teamMemberExternalId: externalIds.externalId,
    shouldExportExternalUniqueIdForAgent,
    leaseTermLength,
    quote: {
      leaseStartDate,
    },
    partyShouldBeExportedAsApplicant,
  };
};

export const exportMriUnitHeld = async (ctx, partyDocument, exportEvent, extraPayload) => {
  try {
    const partyId = partyDocument && partyDocument.id;
    const { inventoryId, leaseId, skipExportToMRI, termLength } = exportEvent.metadata;
    const quote = partyDocument.quotes.find(q => q.inventoryId === inventoryId && q.publishedQuoteData);

    const leaseTermLength = termLength || quote?.publishedQuoteData?.leaseTerms[0]?.termLength;
    const leaseStartDate = quote && (quote.leaseStartDate || quote?.publishedQuoteData?.leaseStartDate);

    logger.info({ ctx, partyId, inventoryId, exportEvent }, 'Export to MRI - starting export on hold inventory');

    if (skipExportToMRI) {
      logger.info(
        { ctx, partyId, inventoryId, exportEvent },
        'Export to MRI - Export for the hold will be done from the application payment export or edit lease export. Skipping export',
      );
      return;
    }

    const data = await getData(ctx, { partyDocument, inventoryId, leaseId, leaseTermLength, leaseStartDate });
    const guestCardSteps = await generateGuestCardsExportSteps(ctx, partyDocument, data);
    const exportSteps = addIndex([...guestCardSteps, ExportType.ClearSelectedUnit, ExportType.SelectUnit]);

    await processExportMessage(ctx, {
      partyId,
      data,
      exportSteps,
      extraPayload,
      mriExportAction: DALTypes.MriExportAction.HOLD_INVENTORY,
    });
  } catch (error) {
    logger.error({ ctx, error, partyId: partyDocument.id }, 'Export MRI - hold inventory - error');
    throw error;
  }
};

export const exportMriUnitReleased = async (ctx, partyDocument, exportEvent, extraPayload) => {
  try {
    const partyId = partyDocument && partyDocument.id;
    const { inventoryId, releasedOnExecutedLease, remainingInventoryOnHold, leaseTermLength, releaseAtCloseParty, leaseStartDate } = exportEvent.metadata;

    if (releasedOnExecutedLease) {
      logger.info(
        { ctx, partyId, releasedInventoryId: inventoryId, exportEvent },
        'Export to MRI - ignore the release of a unit that was released after countersinging the lease',
      );
      return;
    }

    if (releaseAtCloseParty && !partyDocument?.endDate) {
      logger.info(
        { ctx, partyId, releasedInventoryId: inventoryId, exportEvent },
        'Export to MRI - ignore the release of a unit that was manually held and the party is not closed',
      );
      return;
    }

    logger.info({ ctx, partyId, releasedInventoryId: inventoryId, exportEvent }, 'Export to MRI - starting export on release inventory');

    const data = await getData(ctx, {
      partyDocument,
      inventoryId: remainingInventoryOnHold,
      leaseTermLength,
      leaseStartDate,
      isUnitReleased: true,
      includeArchivedPartiesAndMembers: releaseAtCloseParty,
    });
    const exportSteps = [ExportType.ClearSelectedUnit];
    if (remainingInventoryOnHold) {
      logger.trace(
        { ctx, releasedInventoryId: inventoryId, remainingInventoryOnHold },
        'Export MRI - We still have a hold on the unit in Reva, so we will push back the hold to MRI',
      );
      if (!data?.externalInfo?.externalId) {
        await updateLastInventoryOnHoldByPartyId(ctx, {
          partyId,
          partyMemberId: data.primaryTenant.id,
          assignedPropertyId: partyDocument.assignedPropertyId,
        });
        const guestCardSteps = await generateGuestCardsExportSteps(ctx, partyDocument, data);
        exportSteps.push(...guestCardSteps);
      }
      exportSteps.push(ExportType.SelectUnit);
    }

    await processExportMessage(ctx, {
      partyId,
      data,
      exportSteps: addIndex(exportSteps),
      extraPayload,
      mriExportAction: DALTypes.MriExportAction.RELEASE_INVENTORY,
    });
  } catch (error) {
    logger.error({ ctx, error, partyId: partyDocument.id }, 'Export MRI - release inventory - error');
    throw error;
  }
};
