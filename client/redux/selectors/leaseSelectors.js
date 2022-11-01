/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';
import { DALTypes } from 'enums/DALTypes';
import { getLeases, getPromotedQuotes } from './partySelectors';
import { isInventoryLeasedOnPartyType } from '../../../common/helpers/inventory';
import { canVoidLease } from '../../../common/helpers/lease';
// Please note this is a custom selector to calculate the
// current leaseFormData for a selectedLeasedId
// not intended to be used in mapStateToProps
export const getLeaseFormData = createSelector(
  getLeases,
  (state, props) => props.selectedLeaseId,
  (leases, selectedLeaseId) => {
    if (!selectedLeaseId || !leases) return undefined;
    return leases.find(lease => lease.id === selectedLeaseId);
  },
);

export const isDraftLease = createSelector(getLeaseFormData, leaseFormData => {
  if (!leaseFormData) return undefined;
  return leaseFormData.status === DALTypes.LeaseStatus.DRAFT;
});

export const isReadOnlyLease = createSelector(getLeaseFormData, leaseFormData => {
  if (!leaseFormData) return undefined;
  return leaseFormData.status === DALTypes.LeaseStatus.EXECUTED;
});

export const doesLeaseHaveWetSignedEnvelope = createSelector(getLeaseFormData, leaseFormData => {
  if (!leaseFormData) return undefined;
  return !!leaseFormData.signatures?.some(s => s.status === DALTypes.LeaseSignatureStatus.WET_SIGNED);
});

export const doesLeaseHaveDigitallySignedDocument = createSelector(getLeaseFormData, leaseFormData => {
  if (!leaseFormData) return undefined;
  return !!leaseFormData.signatures?.some(s => s.status === DALTypes.LeaseSignatureStatus.SIGNED);
});

export const getQuoteForSelectedLease = createSelector(getLeaseFormData, getPromotedQuotes, (leaseFormData, promotedQuotes) => {
  if (!leaseFormData || !promotedQuotes) return undefined;
  return leaseFormData && promotedQuotes.find(pq => pq.id === leaseFormData.quoteId);
});

export const getUnitNameForSelectedLease = createSelector(getQuoteForSelectedLease, quoteForSelectedLease => {
  if (!quoteForSelectedLease) return '';
  const { inventory = {} } = quoteForSelectedLease;

  return inventory.fullQualifiedName;
});

const otherPartyLeaseSelector = (state, props) => {
  const { quoteId, status } = props.lease;
  if (status === DALTypes.LeaseStatus.EXECUTED) return null;

  const leasedQuote = state.quotes.quotes.find(({ id }) => id === quoteId);

  return leasedQuote;
};

export const getUnitReservedWarning = createSelector(
  otherPartyLeaseSelector,
  state => state.globalStore.get('users'),
  (_state, props) => props.party,
  (leasedQuote, users, party) => {
    if (!leasedQuote) return null;

    const { inventoryHolds, name: unitName } = leasedQuote.inventory;
    const inventoryHold = inventoryHolds.find(({ partyId }) => partyId !== party.id);
    const inventoryAlreadyLeased = isInventoryLeasedOnPartyType(leasedQuote.inventory.state, party);

    if (!inventoryHold && !inventoryAlreadyLeased) return null;

    const user = inventoryHold && users.size && users.find(u => u.id === inventoryHold.heldBy);
    const message = inventoryHold ? 'UNIT_RESERVED_WARNING' : 'LEASED_UNIT_WARNING';
    const partyId =
      (inventoryHold && inventoryHold.partyId) || (leasedQuote.inventory.leasePartyMembers[0] && leasedQuote.inventory.leasePartyMembers[0].partyId);

    return {
      message,
      agent: (user && user.fullName) || '',
      unitName,
      partyId,
      reservedOnThirdParty: !partyId,
    };
  },
);

export const displayVoidLeaseOption = createSelector(
  (_state, props) => props.lease,
  state => state.auth.user,
  (lease, user) => canVoidLease(lease, user),
);

// remove white spaces at the beginning, at the end and between words
export const removeExtraWhiteSpaces = string => string.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');

export const findDuplicates = items => {
  const duplicates = {};
  return items.map(item => {
    if (!item.name) {
      return item;
    }
    const itemName = removeExtraWhiteSpaces(item.name).toLowerCase();
    duplicates[itemName] === undefined ? (duplicates[itemName] = 1) : (duplicates[itemName] += 1);
    return {
      ...item,
      isDuplicated: duplicates[itemName] > 1,
    };
  });
};

export const getModelWithDuplicateFlag = createSelector(
  props => props.lease.baselineData,
  model => {
    const { children, pets } = model;
    return {
      ...model,
      children: findDuplicates(children),
      pets: findDuplicates(pets),
    };
  },
);
