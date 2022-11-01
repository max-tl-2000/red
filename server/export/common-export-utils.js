/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import minBy from 'lodash/minBy';
import pick from 'lodash/pick';

import { now, toMoment } from '../../common/helpers/moment-utils';
import { isCorporateParty } from '../../common/helpers/party-utils';
import { loadUserById } from '../services/users';
import { loadPartyById } from '../services/party';
import { getInventoryExpanded } from '../services/inventories';
import { getPropertyAssignedToParty } from '../helpers/party';
import { getPrimaryExternalInfoByParty } from '../dal/exportRepo';
import { loadProgramByTeamPropertyProgramId as getPartyProgramData } from '../dal/programsRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { getInventoryGroupById } from '../dal/inventoryGroupRepo';
import { getInventoryById, getAllHoldsForParty } from '../dal/inventoryRepo';
import { getFirstCompletedPartyTour } from '../dal/appointmentRepo';

import loggerModule from '../../common/helpers/logger';
import { sortByCreationDate } from '../../common/helpers/sortBy';
const logger = loggerModule.child({ subType: 'export' });

export const getMoveInDate = (lease, party, propertyTimezone) => {
  if (lease) {
    const { moveInDate } = lease.baselineData.quote;
    const timezone = propertyTimezone || lease.baselineData.timezone;

    return moveInDate || now({ timezone });
  }

  const { moveInDate } = party.storedUnitsFilters || {};
  const timezone = propertyTimezone || party.timezone;

  if (moveInDate && moveInDate.min) {
    return toMoment(moveInDate.min, { timezone });
  }

  return now({ timezone });
};

export const getOccupyDate = ({ lease, quote, inventoryAvailabilityDate, party, propertyTimezone }) => {
  if (lease?.baselineData?.publishedLease) {
    const timezone = propertyTimezone || lease.baselineData.timezone;
    const { leaseStartDate } = lease.baselineData.publishedLease;

    return leaseStartDate ? toMoment(leaseStartDate, { timezone }) : now({ timezone });
  }

  const timezone = propertyTimezone || party?.timezone;

  if (quote?.leaseStartDate) {
    const publishedQuoteDate = toMoment(quote.leaseStartDate, { timezone });
    if (publishedQuoteDate.isSameOrAfter(inventoryAvailabilityDate, 'day')) return publishedQuoteDate;

    return inventoryAvailabilityDate;
  }

  return now({ timezone });
};

export const getGuestCardMoveInDate = (lease, party, propertyTimezone) => {
  if (lease?.baselineData?.publishedLease) {
    const timezone = propertyTimezone || lease.baselineData.timezone;
    const { leaseStartDate } = lease.baselineData.publishedLease;

    return leaseStartDate ? toMoment(leaseStartDate, { timezone }) : now({ timezone });
  }

  return getMoveInDate(lease, party, propertyTimezone);
};

export const parseFullName = fullName => {
  if (!fullName) return {};

  // the last name before the space character is the LastName, everything else before is a part of the FirstName

  const names = fullName.split(' ').filter(name => name);
  const lastName = names.pop();

  return {
    firstName: names.join(' ') || lastName,
    lastName,
  };
};

export const getFirstAndLastName = partyMember => {
  if (partyMember.fullName) return parseFullName(partyMember.fullName);
  if (partyMember.info) return parseFullName(partyMember.info.fullName);

  const { defaultPhone, defaultEmail } = partyMember.contactInfo || {};
  const name = defaultPhone || defaultEmail;

  return {
    firstName: name,
    lastName: name,
  };
};

export const getInventoryOnHold = async (ctx, partyDocument, onlyManualHolds = false) => {
  const inventoriesOnHold = onlyManualHolds
    ? await getAllHoldsForParty(ctx, partyDocument.id, [DALTypes.InventoryOnHoldReason.MANUAL])
    : await getAllHoldsForParty(ctx, partyDocument.id);
  const sortedInventoryOnHolds =
    inventoriesOnHold.length && inventoriesOnHold.sort((a, b) => sortByCreationDate(a, b, { field: 'created_at', sortOrder: 'DESC' }));

  return sortedInventoryOnHolds?.length && (await getInventoryExpanded(ctx, sortedInventoryOnHolds[0].inventoryId));
};

export const getPartyData = async (ctx, partyDocument) => {
  logger.trace({ ctx, partyId: partyDocument.id }, 'getPartyData');

  const user = await loadUserById(ctx, partyDocument.userId);
  const property = await getPropertyAssignedToParty(ctx, partyDocument);

  const party = await loadPartyById(ctx, partyDocument.id);
  const programData = party.teamPropertyProgramId ? await getPartyProgramData(ctx, partyDocument.teamPropertyProgramId) : {};

  const inventoryOnHold = await getInventoryOnHold(ctx, partyDocument);

  return {
    partyId: party.id,
    leaseType: party.leaseType,
    user: pick(user, ['fullName']),
    property: pick(property, ['id', 'externalId', 'timezone', 'postMonth']),
    children: (partyDocument.children || []).filter(child => !child.endDate),
    vehicles: (partyDocument.vehicles || []).filter(vehicle => !vehicle.endDate),
    sourceName: programData.sourceName || '',
    inventoryOnHold,
  };
};

export const getPropertyExternalId = ({ inventory, property = {}, propertyToExport = null }) => {
  const propertyToUse = get(inventory, 'property') || propertyToExport || property;
  return propertyToUse.externalId;
};

export const getCompanyName = (partyDocument, partyMemberId) => {
  if (!isCorporateParty(partyDocument)) return '';

  const member = partyDocument.members.find(p => p.partyMember.id === partyMemberId);

  return member?.company?.displayName || 'UNKNOWN';
};

export const isTypeResident = memberType => memberType === DALTypes.MemberType.RESIDENT;

export const electPrimaryTenant = (ctx, activeMembers) => {
  logger.trace({ ctx, activeMembers }, 'electPrimaryTenant');

  const residents = activeMembers.filter(pm => isTypeResident(pm.memberType));
  const electedResident = minBy(residents, 'created_at');

  const electedPrimaryTenant = electedResident || minBy(activeMembers, 'created_at');
  logger.trace({ ctx, electedPrimaryTenant }, 'electPrimaryTenant - result');

  return electedPrimaryTenant;
};

export const isPartyInApplicantState = invoices =>
  invoices && invoices.some(invoice => invoice.paymentCompleted && (!invoice.applicationFeeWaiverAmount || invoice.applicationFeeWaiverAmount === 0));

export const getAppointmentInventory = async (ctx, firstAppointmentInventory, partyData) => {
  logger.trace({ ctx, firstAppointmentInventory, partyData }, 'getAppointmentInventory');
  let inventory;

  if (firstAppointmentInventory && firstAppointmentInventory.inventoryId) {
    inventory = await getInventoryById(ctx, { id: firstAppointmentInventory.inventoryId, expand: true });
  } else {
    const firstCompletedPartyTour = await getFirstCompletedPartyTour(ctx, partyData.partyId);

    const inventoryId = firstCompletedPartyTour?.metadata?.inventories[0];
    inventory = inventoryId && (await getInventoryById(ctx, { id: inventoryId, expand: true }));
  }

  const inventoryGroup = inventory && (await getInventoryGroupById(ctx, inventory.inventoryGroupId));

  return inventory && inventory.propertyId === partyData.property.id
    ? {
        externalId: firstAppointmentInventory.externalId || inventory.externalId,
        propertyId: firstAppointmentInventory.propertyId || inventory.property.id,
        property: { externalId: inventory.property.externalId },
        inventorygroup: { inactive: inventoryGroup.inactive, externalId: inventory.inventorygroup.externalId },
      }
    : {};
};

const getLeaseToExport = (leases, leaseId) => (leases || []).find(lease => lease.status !== DALTypes.LeaseStatus.VOIDED && lease.id === leaseId);

export const allPartyMembersSigned = (partyMembers, leases, leaseId) => {
  const lease = getLeaseToExport(leases, leaseId);
  if (!lease) return false;

  return (
    (lease.signatures || [])
      .filter(signature => signature.partyMemberId)
      .filter(
        signature =>
          ![DALTypes.LeaseSignatureStatus.SIGNED, DALTypes.LeaseSignatureStatus.WET_SIGNED, DALTypes.LeaseSignatureStatus.VOIDED].includes(signature.status),
      ).length === 0
  );
};

export const didPropertyChange = async (ctx, partyId, propertyId) => {
  const externalInfo = await getPrimaryExternalInfoByParty(ctx, partyId);
  if (!externalInfo) return false;

  return externalInfo.propertyId !== propertyId;
};
