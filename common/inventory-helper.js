/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import omitBy from 'lodash/omitBy';
import { statesTranslationKeys } from './enums/inventoryStates';
import { DALTypes } from './enums/DALTypes';
import { formatStringWithPlaceholders } from './helpers/strings';
import { toMoment, now, formatMoment } from './helpers/moment-utils';
import { SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT } from './date-constants';
import { isDateInTheCurrentYear } from './helpers/date-utils';

export const availableUnitStates = [
  DALTypes.InventoryState.DOWN, // down will be considered as available but will show a warning
  DALTypes.InventoryState.OCCUPIED_NOTICE,
  DALTypes.InventoryState.VACANT_MAKE_READY,
  DALTypes.InventoryState.VACANT_READY,
];

const removeUndefinedDataFromObj = obj => omitBy(obj, value => !value);

export const formatName = inventory => {
  const { name, type, building } = inventory;
  const { addressLine1, addressLine2 } = building.address || {};
  const replaceData = {
    '%inventoryName%': name,
    '%inventoryType%': type,
  };

  const inventoryType = type ? `${type[0].toUpperCase()}${type.substring(1)}` : '';
  const addresses = Object.values(
    removeUndefinedDataFromObj({
      prefix: `${inventoryType} ${name}`,
      addressLine1,
      addressLine2,
    }),
  );
  const buildingAddress = addresses.join(', ');

  return formatStringWithPlaceholders(buildingAddress, replaceData);
};

const getStateDateTranslation = (formattedDate, translationKey, shouldShowNotification) =>
  shouldShowNotification ? t(translationKey, { date: formattedDate }) : '';

const inventoryStateDateTranslation = (stateDate, translationKey, shouldShowNotification, timezone) => {
  const dateFormat = isDateInTheCurrentYear(stateDate, timezone) ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT;
  const formattedDate = toMoment(stateDate, { timezone }).format(dateFormat);
  return getStateDateTranslation(formattedDate, translationKey, shouldShowNotification);
};

const getLeaseDateFromInventory = leases => {
  if (!leases || !leases.size) return null;

  // what's this used for?
  // how come are we sure that we're using the right lease?
  const leaseData = leases.get(leases.keys().next().value);

  if (leaseData.status !== DALTypes.LeaseStatus.EXECUTED) return null;

  if (leaseData.baselineData && leaseData.baselineData.publishedLease) {
    return leaseData.baselineData.publishedLease.leaseStartDate;
  }
  return null;
};

const getReadyByLabelWhenStateIsReserved = ({ inventoryLeases, translationKey, timezone }) => {
  const leaseStartDate = getLeaseDateFromInventory(inventoryLeases);
  if (!leaseStartDate) return '';
  return inventoryStateDateTranslation(leaseStartDate, translationKey, true, timezone);
};

const formatInventoryStateTransitionDate = (inventory, inventoryLeases) => {
  let readyBy = '';
  const { property: { timezone } = {} } = inventory;
  switch (inventory.state) {
    // if date is today or earlier, display nothing;  else display annotation
    case DALTypes.InventoryState.VACANT_MAKE_READY:
    case DALTypes.InventoryState.OCCUPIED_NOTICE: {
      const { nextStateExpectedDate } = inventory;
      if (!nextStateExpectedDate) return '';
      // if date is today or earlier, display annotation; else display nothing
      const isDateInFuture = !toMoment(nextStateExpectedDate, { timezone }).isSameOrBefore(now({ timezone }));
      readyBy = inventoryStateDateTranslation(nextStateExpectedDate, 'EXPECTED_BY', isDateInFuture, timezone);
      break;
    }
    case DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED:
    case DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED:
    case DALTypes.InventoryState.VACANT_READY_RESERVED: {
      readyBy = getReadyByLabelWhenStateIsReserved({
        inventoryLeases,
        translationKey: 'NOTICE_STARTS',
        timezone,
      });
      break;
    }
    default:
  }
  return readyBy;
};

const unavailableInventoryStates = [
  DALTypes.InventoryState.VACANT_MAKE_READY,
  DALTypes.InventoryState.OCCUPIED_NOTICE,
  DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
  DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
  DALTypes.InventoryState.VACANT_READY_RESERVED,
];

export const getInventoryAvailabilityDateAndDataSource = (inventory, userDateInput) => {
  const { property: { timezone } = {} } = inventory;
  const isInventoryStateUnavailable = unavailableInventoryStates.includes(inventory.state);

  if (!isInventoryStateUnavailable || !inventory.availabilityDate) return {};

  const readyByDate = inventory.availabilityDate;
  const { availabilityDateSource } = inventory;
  const isDateBeforeInventoryAvailability = toMoment(userDateInput, { timezone }).isBefore(readyByDate);
  const dateFormat = isDateInTheCurrentYear(readyByDate, timezone) ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT;
  const formattedDate = formatMoment(readyByDate, { timezone, format: dateFormat });
  return { inventoryAvailability: isDateBeforeInventoryAvailability, availabilityDateSource, readyByDate: formattedDate };
};

export const inventoryStateRepresentation = (inventory, leases = {}) => {
  const inventoryStateKey = statesTranslationKeys[inventory.state];

  if (!inventoryStateKey) return t('NO_STATE');

  // this is a GMT property date
  // TODO: global search does not return nextStateExpectedDate but should so that we can use when dispalying the global search result card
  return t(inventoryStateKey, {
    ready: formatInventoryStateTransitionDate(inventory, leases),
  });
};

const partyTypeIsRenewal = ({ leaseState, isRenewalParty }) => leaseState === DALTypes.LeaseState.RENEWAL || isRenewalParty;

// Only in the inventoryAction the leaseState does not matter.
export const shouldEnableQuoteAction = (unit, { leaseState, isRenewalParty }) => {
  if ([DALTypes.InventoryState.EXCLUDED, DALTypes.InventoryState.ADMIN].includes(unit.state)) return false;

  // CPM-19695: check on reserved state is temporaray, this is because rms pricing is generating pricing for teh reserved units, and we want to hide the quote action
  if (
    [
      DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
      DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
      DALTypes.InventoryState.VACANT_READY_RESERVED,
    ].includes(unit.state)
  ) {
    return false;
  }

  if (unit.isRenewal && !partyTypeIsRenewal({ leaseState, isRenewalParty }) && !unit.marketRent) return false;
  if (!unit.isRenewal && partyTypeIsRenewal({ leaseState, isRenewalParty })) return false;

  return !!unit.adjustedMarketRent;
};

export const getQuoteActionLabel = (unit, { leaseState, isRenewalParty }) => {
  if (!unit.isRenewal || !unit.adjustedMarketRent || !partyTypeIsRenewal({ leaseState, isRenewalParty })) {
    return t('QUOTE');
  }
  return t('QUOTE', { renewal: 'RENEWAL' });
};

export const isModelState = inventory => inventory.state === DALTypes.InventoryState.MODEL;

export const shouldDisplayInventoryState = (inventory, isModel) => !inventory?.hideStateFlag && !isModel;

export const formatInventoryName = ({ type, name, building }, includeBuildingName) => {
  if (!type || !name) return '';
  if (includeBuildingName) {
    const { displayName = '' } = building || {};
    return `${type.charAt(0).toUpperCase() + type.slice(1)} ${displayName}-${name}`;
  }
  return `${type.charAt(0).toUpperCase() + type.slice(1)} ${name}`;
};
