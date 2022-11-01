/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import keys from 'lodash/keys';
import { isDateAfterDate } from '../../../common/helpers/date-utils';
import { parseAsInTimezone, now } from '../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
export const STANDARD_LENGTH = '12';

const logger = loggerModule.child({ subType: 'RMS Parser helpers' });

const rmsProvider = 'LRO';

const statusMapping = {
  'On Notice': DALTypes.InventoryState.OCCUPIED_NOTICE,
  'Vacant Ready': DALTypes.InventoryState.VACANT_READY,
  'Vacant Unavailable': DALTypes.InventoryState.VACANT_MAKE_READY,
};

export const getLROUnitInfo = (ctx, node) => {
  const { fileName } = node;
  const { ID: externalId, AVAILDATE: availDate, STATUS: status, AMENITYVALUE: amenityValue } = node.attributes;

  const inventoryState = statusMapping[status];
  if (!inventoryState) {
    logger.warn({ ctx, fileName, externalId, status }, 'An unknown RMS status has been received');
  }

  return {
    externalId,
    availDate,
    status: inventoryState || status,
    amenityValue,
    rmsProvider,
    fileName,
    type: DALTypes.InventoryType.UNIT, // All the records in the xml files are considered units. This change is needed due to this implementation CPM-13982
  };
};

const renewalStatusMapping = {
  N: DALTypes.InventoryState.OCCUPIED,
  Y: DALTypes.InventoryState.OCCUPIED_NOTICE,
};

export const getLRORenewalInfo = node => {
  const { fileName } = node;
  const { UNITID: externalId, RENEWALDATE: renewalDate, AMENITYVALUE: amenityValue, HASGIVENNOTICE: hasGivenNotice } = node.attributes;
  return {
    externalId,
    availDate: renewalDate,
    renewalDate,
    status: renewalStatusMapping[hasGivenNotice],
    amenityValue,
    rmsProvider,
    fileName,
    type: DALTypes.InventoryType.UNIT, // All the records in the xml files are considered units. This change is needed due to this implementation CPM-13982
  };
};

export const getDateByAttribute = (attribute, timezone) =>
  attribute ? parseAsInTimezone(attribute, { format: YEAR_MONTH_DAY_FORMAT, timezone }).format(YEAR_MONTH_DAY_FORMAT) : '';

export const getRenewalLeaseTerm = ({ nodeAttributes, currentRenewal, timezone }) => ({
  ...nodeAttributes,
  STARTDATE: now({ timezone }).format(YEAR_MONTH_DAY_FORMAT),
  ENDDATE: parseAsInTimezone(currentRenewal.renewalDate, { format: YEAR_MONTH_DAY_FORMAT, timezone }).add(1, 'years').format(YEAR_MONTH_DAY_FORMAT),
  AVAILDATE: '',
});

const hasMostRecentDateRange = (term, minLeaseTerm) => term.startDate === minLeaseTerm.startDate && term.endDate === minLeaseTerm.endDate;

const findStandardRent = (leaseTerms, minLeaseTerm) => {
  const startDate = leaseTerms[STANDARD_LENGTH] && keys(leaseTerms[STANDARD_LENGTH])[0];

  if (!leaseTerms[STANDARD_LENGTH] || !hasMostRecentDateRange({ ...leaseTerms[STANDARD_LENGTH][startDate], startDate }, minLeaseTerm)) {
    return { standardLeaseLength: minLeaseTerm.leaseLength, standardRent: minLeaseTerm.rent };
  }
  return { standardLeaseLength: STANDARD_LENGTH, standardRent: leaseTerms[STANDARD_LENGTH][startDate].rent };
};

export const addLeaseTerms = (leaseTerms, currentLeaseTerm) => {
  if (!leaseTerms[currentLeaseTerm.LT]) {
    leaseTerms[currentLeaseTerm.LT] = {};
  }
  leaseTerms[currentLeaseTerm.LT][currentLeaseTerm.STARTDATE] = { endDate: currentLeaseTerm.ENDDATE, rent: currentLeaseTerm.EFFECTIVERENT };

  return leaseTerms;
};

export const addAmenity = (amenities, currentAmenity) => {
  amenities.push(currentAmenity);
  return amenities;
};

const isThereMissingRentInRange = (previousLeaseStartDates, sortedStartDates) => previousLeaseStartDates.length !== sortedStartDates.length;

const isThereAMismatchInDateRanges = (previousDateRange, dateRange) => !previousDateRange || previousDateRange.endDate !== dateRange.endDate;

const getLowestRent = (dateRange, startDate, leaseLength, currentMinRentLease) => {
  const newMinRent = { minRentLeaseLength: leaseLength, minRentStartDate: startDate, minRentEndDate: dateRange.endDate, minRent: dateRange.rent };
  if (!currentMinRentLease.minRent) return newMinRent;

  return parseFloat(dateRange.rent) < parseFloat(currentMinRentLease.minRent) ? newMinRent : currentMinRentLease;
};

const validateMissingRentInDatesRange = (leaseTermsInfo, error) => {
  const { previousLeaseTerm, sortedStartDates, previousLeaseLength, leaseLength } = leaseTermsInfo;
  const previousLeaseStartDates = keys(previousLeaseTerm).sort();

  if (isThereMissingRentInRange(previousLeaseStartDates, sortedStartDates)) {
    error = `Rent missing for a date range between lease terms ${previousLeaseLength} - ${leaseLength}`;
  }
  return error;
};

const validateConsecutiveStartDates = (leaseTermsInfo, error, timezone) => {
  const { sortedStartDates, index, leaseTerm, startDate, leaseLength } = leaseTermsInfo;
  const previousStartDate = sortedStartDates[index];
  const dateRangeBefore = leaseTerm[previousStartDate];
  if (
    !isDateAfterDate(
      parseAsInTimezone(startDate, { format: YEAR_MONTH_DAY_FORMAT, timezone }),
      parseAsInTimezone(dateRangeBefore.endDate, { format: YEAR_MONTH_DAY_FORMAT, timezone }),
    )
  ) {
    error = `Start date is not after previous end date for lease term ${leaseLength}`;
  }
  return error;
};

const validateMismatchInDateRanges = (leaseTermsInfo, error) => {
  const { previousLeaseTerm, dateRange, previousLeaseLength, leaseLength, startDate } = leaseTermsInfo;
  const previousDateRange = previousLeaseTerm && previousLeaseTerm[startDate];
  if (isThereAMismatchInDateRanges(previousDateRange, dateRange)) {
    error = `Mismatch in date ranges for lease terms ${previousLeaseLength} - ${leaseLength}`;
  }

  return error;
};

const orderColumns = (leaseTermInfo, error, rowIndex, timezone) => {
  const { sortedStartDates, leaseTerm, leaseLength, previousLeaseTerm, previousLeaseLength, sortedLeaseTermsDates } = leaseTermInfo;
  let { currentMinRentLease } = leaseTermInfo;
  for (let j = 0; j < sortedStartDates.length; j++) {
    const startDate = sortedStartDates[j];
    const dateRange = leaseTerm[startDate];

    if (j !== 0) {
      error = validateConsecutiveStartDates({ sortedStartDates, index: j - 1, leaseTerm, startDate, leaseLength }, error, timezone);
      if (error) break;
    }

    if (rowIndex !== 0) {
      error = validateMismatchInDateRanges({ previousLeaseTerm, dateRange, previousLeaseLength, leaseLength, startDate }, error);
      if (error) break;
    }
    currentMinRentLease = getLowestRent(dateRange, startDate, leaseLength, currentMinRentLease);
    sortedLeaseTermsDates[startDate] = leaseTerm[startDate];
  }

  return { currentMinRentLease, sortedLeaseTermsDates, error };
};

const sortUnitLeaseTerms = (leaseTerms, sortedLeaseLengths, timezone) => {
  const sortedLeaseTerms = {};
  let sortedLeaseTermsDates = {};
  let error = null;
  let previousLeaseLength = null;
  let previousLeaseTerm = null;
  let currentMinRentLease = {};

  for (let i = 0; i < sortedLeaseLengths.length; i++) {
    const leaseLength = sortedLeaseLengths[i];
    const leaseTerm = leaseTerms[leaseLength];
    const sortedStartDates = keys(leaseTerm).sort();

    if (i !== 0) {
      previousLeaseLength = sortedLeaseLengths[i - 1];
      previousLeaseTerm = leaseTerms[previousLeaseLength];
      error = validateMissingRentInDatesRange({ previousLeaseTerm, sortedStartDates, previousLeaseLength, leaseLength }, error);
      if (error) break;
    }

    const orderedColumns = orderColumns(
      { sortedStartDates, leaseTerm, leaseLength, previousLeaseTerm, previousLeaseLength, sortedLeaseTermsDates, currentMinRentLease },
      error,
      i,
      timezone,
    );
    currentMinRentLease = orderedColumns.currentMinRentLease;
    sortedLeaseTermsDates = orderedColumns.sortedLeaseTermsDates;
    error = orderedColumns.error;

    previousLeaseTerm = null;
    previousLeaseLength = null;
    if (error) break;

    sortedLeaseTerms[leaseLength] = sortedLeaseTermsDates;
    sortedLeaseTermsDates = {};
  }
  return { sortedLeaseTerms, currentMinRentLease, error };
};

export const buildUnitStructure = (leaseTerms, amenityList, unitInfo, timezone) => {
  const sortedLeaseLengths = keys(leaseTerms).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const { sortedLeaseTerms, currentMinRentLease, error } = sortUnitLeaseTerms(leaseTerms, sortedLeaseLengths, timezone);
  let unitStructure = {};
  const amenities = amenityList ? amenityList.join(' | ') : null;

  if (!keys(sortedLeaseTerms).length) {
    return { unitStructure, error };
  }

  const minLeaseLength = sortedLeaseLengths[0];
  const minLeaseTerm = sortedLeaseTerms[minLeaseLength];
  const minLeaseStartDate = keys(minLeaseTerm)[0];

  const { minRentLeaseLength, minRentStartDate, minRentEndDate, minRent } = currentMinRentLease;
  const { standardLeaseLength, standardRent } = findStandardRent(sortedLeaseTerms, {
    ...minLeaseTerm[minLeaseStartDate],
    leaseLength: minLeaseLength,
    startDate: minLeaseStartDate,
  });

  unitStructure = {
    ...unitInfo,
    rentMatrix: { ...sortedLeaseTerms },
    standardLeaseLength,
    standardRent,
    minRentLeaseLength,
    minRentStartDate,
    minRentEndDate,
    minRent,
    amenities,
  };
  return { unitStructure, error };
};

export const isThereAnErrorForTheInventory = (errors, externalId) => errors.some(e => e.externalId === externalId);

export const addErrors = (errors, error) => {
  const { externalId, message, rmsErrorType } = error;

  if (!externalId) {
    errors.push({ rmsErrorType, messages: [message] });
    return errors;
  }

  if (!isThereAnErrorForTheInventory(errors, externalId)) {
    errors.push({ externalId, rmsErrorType, messages: [message] });
    return errors;
  }

  return errors.map(e => {
    e.externalId === externalId && e.messages.push(message);
    return e;
  });
};
