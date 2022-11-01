/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import { t } from 'i18next';
import { reservedInventoryItemsStates } from '../enums/inventoryStates';
import { sortAndSplitList } from './list-utils';
import { DALTypes } from '../enums/DALTypes';
import { now, toMoment } from './moment-utils';

const isInventoryLeased = state => reservedInventoryItemsStates.includes(state);

export const isInventoryLeasedOnPartyType = (state, { workflowName = DALTypes.WorkflowName.NEW_LEASE } = {}) => {
  const isLeased = isInventoryLeased(state);

  if (workflowName !== DALTypes.WorkflowName.RENEWAL) return isLeased;

  return isLeased && state !== DALTypes.InventoryState.OCCUPIED;
};

export const createInventoryUnavailableDialogModel = ({ partyId, onInventoryHoldingWarningDialogClosed, onViewParty, title, text }) => ({
  title,
  lblAction: t('MSG_BOX_BTN_OK'),
  lblCancel: partyId ? t('VIEW_PARTY') : '',
  handleOnActionClick: onInventoryHoldingWarningDialogClosed,
  handleOnCancelClick: () => onViewParty(partyId),
  text,
});

const filterAmenitiesByHighValue = (amenities, isHighValue) => amenities.filter(amenity => amenity.highValue === isHighValue && amenity.hidden === false);

export const getHighValueAmenityNames = (inventory, isHighValue) => {
  const inventoryAmenities = filterAmenitiesByHighValue(inventory.amenities, isHighValue);
  const highValueAmenityNames = inventoryAmenities.map(amenity => amenity.displayName);
  return sortAndSplitList(new Set(highValueAmenityNames));
};

export const formatNumBedrooms = (numBedrooms, translationKey = 'QUOTE_DRAFT_NUM_BEDS') =>
  numBedrooms === 0 ? t('STUDIO') : t(translationKey, { count: numBedrooms });

export const formatLayout = layout => {
  const { numBathrooms, type, numBedrooms, surfaceArea = '' } = layout;
  const formattedNumBedrooms = formatNumBedrooms(parseFloat(numBedrooms, 10));
  const formattedSurfaceArea = surfaceArea ? `, ${t('QUOTE_DRAFT_AREA', { count: parseFloat(surfaceArea, 10) })}, ` : surfaceArea;
  return type === DALTypes.InventoryType.UNIT
    ? `${formattedNumBedrooms},
    ${t('QUOTE_DRAFT_NUM_BATHS', {
      count: parseFloat(numBathrooms, 10),
    })}
    ${formattedSurfaceArea}`
    : '';
};

/* Returns a summary of the layout, e.g.
  1 bed, 2 bath, 1000 sf Ballantine
*/
export const getQuoteLayoutSummary = inventory => {
  const { numBathrooms, numBedrooms, surfaceArea, displayName } = inventory.layout;
  const formattedLayoutInfo = formatLayout({
    numBathrooms,
    numBedrooms,
    type: inventory.type,
    surfaceArea,
  });
  return `${formattedLayoutInfo} ${t('FLOOR_PLAN_NAME', {
    name: displayName,
  })}`;
};

export const getPolicyStatement = inventory => get(inventory, 'property.settings.quote.policyStatement', t('DEFAULT_QUOTE_POLICY_STATEMENT'));

export const getAvailabilityDate = (inventory, timezone) => {
  const inventoryAvailabilityDate = toMoment(inventory.availabilityDate, { timezone }).startOf('day');
  const priceAvailabilityDate = toMoment(inventory.priceAvailabilityDate, { timezone }).startOf('day');
  const nowAtProperty = now({ timezone }).startOf('day');

  const latestAvailabilityDate = inventoryAvailabilityDate.isSameOrAfter(priceAvailabilityDate, 'day') ? inventoryAvailabilityDate : priceAvailabilityDate;
  return latestAvailabilityDate.isSameOrAfter(nowAtProperty, 'day') ? latestAvailabilityDate : nowAtProperty;
};

export const isAvailableNow = (inventory, timezone) => {
  const nowAtProperty = now({ timezone });
  // availabilityDate is synced
  if (inventory.availabilityDate) {
    const inventoryOrPriceDate = getAvailabilityDate(inventory, timezone);
    return inventoryOrPriceDate.isSameOrBefore(nowAtProperty, 'day');
  }
  // availabilityDate is estimated = determined by pricing and state
  if (inventory.state === DALTypes.InventoryState.VACANT_READY) {
    return toMoment(inventory.priceAvailabilityDate, { timezone }).isSameOrBefore(nowAtProperty, 'day');
  }

  return false;
};
