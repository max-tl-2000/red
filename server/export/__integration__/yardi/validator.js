/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';

import { now } from '../../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../../common/date-constants';

const getDateToCompare = ({ daysOffset, timezone = LA_TIMEZONE } = {}) => `"${now({ timezone }).add(daysOffset, 'days').format('M/D/YYYY')}"`;

const getMonthFromNow = ({ numOfMonths, timezone = LA_TIMEZONE } = {}) => {
  const startOfDayInTimezone = now({ timezone }).startOf('day');
  const forwarded = startOfDayInTimezone.add(numOfMonths, 'months');
  return `"${forwarded.format('M/D/YYYY')}"`;
};

const getConcessionToDate = ({ timezone = LA_TIMEZONE } = {}) =>
  `"${now({ timezone }).startOf('day').add(1, 'months').subtract(1, 'days').format('M/D/YYYY')}"`;

const NO_ERROR = '';
const MISMATCH_ERROR = 'mismatch';

const testDateFromSystem = ({ actual, timezone = LA_TIMEZONE } = {}) => {
  // some dates are generated by the system automatically
  // and not due to data we provide to the system
  // So we need to use the current date for those
  // not the mocked date in the future that we use in certain tests
  const expectedVal = getDateToCompare({ daysOffset: 0, timezone });
  if (actual !== expectedVal) {
    return { expectedVal, error: MISMATCH_ERROR };
  }

  return { error: NO_ERROR };
};

const testCurrentDate = ({ actual, daysFromNow, timezone = LA_TIMEZONE } = {}) => {
  const expectedVal = getDateToCompare({ daysOffset: daysFromNow, timezone });
  if (actual !== expectedVal) {
    return { expectedVal, error: MISMATCH_ERROR };
  }

  return { error: NO_ERROR };
};

const testOneYearFromNow = ({ actual, timezone = LA_TIMEZONE } = {}) => {
  const expectedVal = `"${now({ timezone }).startOf('day').add(1, 'years').format('M/D/YYYY')}"`;

  if (actual !== expectedVal) {
    return { expectedVal, error: MISMATCH_ERROR };
  }

  return { error: NO_ERROR };
};

const testFirstOfMonth = ({ actual, timezone = LA_TIMEZONE, daysFromNow }) => {
  const expectedVal = `"${now({ timezone }).add(daysFromNow, 'days').startOf('month').format('M/D/YYYY')}"`;

  if (actual !== expectedVal) {
    return { expectedVal, error: MISMATCH_ERROR };
  }

  return { error: NO_ERROR };
};

const testChargeToDate = ({ actual, isVoidedLease, daysFromNow, actualFileName, timezone = LA_TIMEZONE, key }) => {
  if (isVoidedLease) {
    const expectedVal = getDateToCompare({ daysOffset: daysFromNow, timezone });
    if (actual !== expectedVal) {
      return { expectedVal, error: MISMATCH_ERROR };
    }

    return { error: NO_ERROR };
  }

  const oneMonthFromNow = getMonthFromNow({ numOfMonths: 1, timezone });
  const twoMonthsFromNow = getMonthFromNow({ numOfMonths: 2, timezone });
  const concessionDate = getConcessionToDate({ timezone });

  if (actual !== oneMonthFromNow && actual !== twoMonthsFromNow && actual !== concessionDate) {
    throw new Error(`File ${actualFileName} column ${key} should be populated and either 1 or 2 months from now. Actual: ${actual}`);
  }

  return { error: NO_ERROR };
};

export const validate = ({ baselineFilePath, actualFileName, key, expected, actual, isVoidedLease, timezone, daysFromNow = 0 }) => {
  const getErrorMessage = (expectedVal, actualVal) =>
    `Expected: ${expectedVal}, received: ${actualVal}. File ${actualFileName} column ${key} mismatch with baseline "${path.basename(baselineFilePath)}".`;

  const testValue = ({ error, expectedVal }) => {
    if (error !== NO_ERROR) return getErrorMessage(expectedVal, actual);

    return NO_ERROR;
  };

  if (!expected && !actual) return NO_ERROR;

  const dateFieldUseDateTimeFromTheSystem = ['Date_Applied'].includes(key);
  if (dateFieldUseDateTimeFromTheSystem) return testValue(testDateFromSystem({ actual, timezone }));

  const isCurrentDateField = [
    'LeaseFrom',
    'Preferred_MoveIn',
    'Move_In_Date',
    'From_Date',
    'Lease_From_Date',
    'First_Contacted_On',
    'Date_Approved',
    'Date_Canceled',
    'Date_Denied',
    'Lease_Sign_Date',
    'DATE',
  ].includes(key);
  if (isCurrentDateField) return testValue(testCurrentDate({ actual, daysFromNow, timezone }));

  const isOneYearFromNowDateField = ['LeaseTo', 'Lease_To_Date'].includes(key);
  if (isOneYearFromNowDateField) return testValue(testOneYearFromNow({ actual, timezone }));

  const isFirstOfMonthDateField = ['POSTMONTH'].includes(key);
  if (isFirstOfMonthDateField) return testValue(testFirstOfMonth({ actual, daysFromNow, timezone }));

  const isChargeToDate = ['To_Date'].includes(key);
  if (isChargeToDate) return testValue(testChargeToDate({ actual, timezone, isVoidedLease, daysFromNow, actualFileName, key }));

  const isRandom = ['Ext_Ref_Roommate_Id'].includes(key);
  if (isRandom && actual) return NO_ERROR;

  if (actual !== expected) {
    return getErrorMessage(expected, actual);
  }

  return NO_ERROR;
};