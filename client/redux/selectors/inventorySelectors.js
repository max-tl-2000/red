/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';
import isEmpty from 'lodash/isEmpty';
import { getInventoryAvailabilityDateAndDataSource } from '../../../common/inventory-helper';

const getInventoryAvailabilityDetails = (inventory, leaseStartDate) => {
  const inventoryAvailability = getInventoryAvailabilityDateAndDataSource(inventory, leaseStartDate);
  return {
    isInventoryUnavailable: inventoryAvailability.inventoryAvailability,
    inventoryAvailableDate: inventoryAvailability.readyByDate,
    inventory,
  };
};

export const getInventoryAvailability = createSelector(
  (_state, props) => props.quote,
  (_state, props) => props.lease.baselineData.publishedLease,
  (quote, publishedLease) => {
    if (!quote || !quote.inventory) return {};

    return !publishedLease
      ? getInventoryAvailabilityDetails(quote.inventory, quote.leaseStartDate)
      : getInventoryAvailabilityDetails(quote.inventory, publishedLease.leaseStartDate);
  },
);

export const getInventoryAvailabilityForReviewScreening = createSelector(
  state => state.inventoryStore.inventory,
  (_state, props) => props.quote,
  (inventory, quote) => {
    if (isEmpty(inventory) || !quote) return {};
    return getInventoryAvailabilityDetails(inventory, quote.leaseStartDate);
  },
);

export const getInventoryAvailabilityByLease = createSelector(
  state => state.inventoryStore.inventory,
  state => state.form,
  (inventory, form) => {
    if (isEmpty(inventory) || isEmpty(form)) return {};
    const leaseStartDate = form.leaseForm.values.LEASE_START_DATE;
    return getInventoryAvailabilityDetails(inventory, leaseStartDate);
  },
);

export const getAllowRentableItemSelection = createSelector(
  state => state.inventoryStore.loadingInventoryDetails,
  state => state.inventoryStore.inventory,
  (loadingInventoryDetails, inventory) => {
    if (loadingInventoryDetails) return false;

    return inventory?.property?.settings?.lease?.allowRentableItemSelection;
  },
);
