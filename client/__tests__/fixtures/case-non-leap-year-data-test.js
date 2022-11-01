/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  generateLeaseTerm,
  generateBasePayments,
  generatePaymentsResult,
  BASE_RENT_AMOUNT_2000,
  MONTH_31,
  MONTH_30,
  NON_LEAP_YEAR_FEB_DAYS,
  ONE_TIME,
  RECURRING_CONCESSION,
  ADJUSTED_MARKET_RENT,
  BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
} from './quotes-concessions-commons-test';

import { getFixedAmount } from '../../helpers/quotes';

/* Test Case: February non-leap-year Calendar month proration strategy
 * Move in on 1st  (rent / 28) * 28
 * Move in on 2nd  (rent / 28) * 27
 * Move in on 16th (rent / 28) * 13
 * Move in on 27th (rent / 28) * 2
 * Move in on 28th (rent / 28) * 1
 */

const BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 27, 2);
const BASE_RENT_AMOUNT_2000_1_DAY_NONLY = getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 1, 2);

export const CASE_NON_LEAP_YEAR_FEB_6M = [
  {
    // From Feb 1st to Jul 31st
    leaseStartDate: '2017-02-01',
    amountIn: (ADJUSTED_MARKET_RENT / NON_LEAP_YEAR_FEB_DAYS) * 28, // 28 billableDaysIn
    billableDaysIn: 28,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 31, // 31 billableDaysOut
    billableDaysOut: 31,
    leaseTerm: generateLeaseTerm('2017-07-31', 6),
  },
  {
    // From Feb 2nd to Aug 1st
    leaseStartDate: '2017-02-02',
    amountIn: (ADJUSTED_MARKET_RENT / NON_LEAP_YEAR_FEB_DAYS) * 27, // 27 billableDaysIn
    billableDaysIn: 27,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2017-08-01', 6),
  },
  {
    // From Feb 16th to Aug 15th
    leaseStartDate: '2017-02-16',
    amountIn: (ADJUSTED_MARKET_RENT / NON_LEAP_YEAR_FEB_DAYS) * 13, // 13 billableDaysIn
    billableDaysIn: 13,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 15, // 15 billableDaysOut
    billableDaysOut: 15,
    leaseTerm: generateLeaseTerm('2017-08-15', 6),
  },
  {
    // From Feb 27th to Aug 26th
    leaseStartDate: '2017-02-27',
    amountIn: (ADJUSTED_MARKET_RENT / NON_LEAP_YEAR_FEB_DAYS) * 2, // 2 billableDaysIn
    billableDaysIn: 2,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 26, // 26 billableDaysOut
    billableDaysOut: 26,
    leaseTerm: generateLeaseTerm('2017-08-26', 6),
  },
  {
    // From Feb 28th to Aug 27th
    leaseStartDate: '2017-02-28',
    amountIn: (ADJUSTED_MARKET_RENT / NON_LEAP_YEAR_FEB_DAYS) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 27, // 27 billableDaysOut
    billableDaysOut: 27,
    leaseTerm: generateLeaseTerm('2017-08-27', 6),
  },
];

const FULL_MONTH_FROM_MAR_TO_JUL = [
  { timeframe: 'Mar 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Apr 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'May 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Jun 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'Jul 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
];

const START_ON_1ST_FEB_NON_LEAP_YEAR_6M = [
  {
    timeframe: 'Feb 2017',
    billableDays: 28,
    daysInMonth: NON_LEAP_YEAR_FEB_DAYS,
  },
  ...FULL_MONTH_FROM_MAR_TO_JUL,
];

const START_ON_16TH_FEB_NON_LEAP_YEAR_6M = [
  {
    timeframe: 'Feb 2017',
    billableDays: 13,
    daysInMonth: NON_LEAP_YEAR_FEB_DAYS,
  },
  ...FULL_MONTH_FROM_MAR_TO_JUL,
  { timeframe: 'Aug 2017', billableDays: 15, daysInMonth: MONTH_31 },
];

const START_ON_28TH_FEB_NON_LEAP_YEAR_6M = [
  {
    timeframe: 'Feb 2017',
    billableDays: 1,
    daysInMonth: NON_LEAP_YEAR_FEB_DAYS,
  },
  ...FULL_MONTH_FROM_MAR_TO_JUL,
  { timeframe: 'Aug 2017', billableDays: 27, daysInMonth: MONTH_31 },
];

export const CASE_NON_LEAP_YEAR_FEB_START_ON_1ST_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10)]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - 100)]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(2).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10),
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-02-01',
    leaseTerm: generateLeaseTerm('2017-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(2).fill(BASE_RENT_AMOUNT_2000 - 100), ...Array(4).fill(BASE_RENT_AMOUNT_2000)]),
  },
];

export const CASE_NON_LEAP_YEAR_FEB_START_ON_16TH_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 13 days free
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 15, 2), 2), // 15 days remaining prorated concession from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount(getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2) - 500, 2), // apply absoluteAdjustment that correspond to the 13 days
      BASE_RENT_AMOUNT_2000,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2),
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 16, 2), 2), // 16 days free remaining prorated concession from Aug
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2), // charge 13 days from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount(500, 2), // apply absoluteAdjustment that correspond to the 15 days
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2), // charge 13 days from Feb
      0,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2), // charge 13 days from Feb
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2) -
        getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13) / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2)),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 15) / 100) * 10, 2), // apply missing 15 days remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount(getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2) - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2), 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 15, 2), // apply missing 15 days remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2) -
        getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13) / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2), // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 15) / 100) * 10, 2), // apply missing 15 days remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-02-16',
    leaseTerm: generateLeaseTerm('2017-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount(getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2) - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 13, 2), 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 15, 2), // apply missing 15 days remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
];

export const CASE_NON_LEAP_YEAR_FEB_START_ON_28TH_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 day off
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 27, 2), 2), // 27 days off remaining prorated concession from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // Apply absoluteAdjustment that correspond to the 1 day = 71.43
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount(428.57, 2), 2), // apply absoluteAdjustment that correspond to the 27 days remaining concession from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_NONLY, // charge 1 day from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 4, 2), 2), // apply 4 days remaining prorated concession from Aug
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_NONLY, // charge 1 days from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH - getFixedAmount(500, 2), // In full
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_NONLY,
      0,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_NONLY,
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_NONLY - getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 1) / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH - getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 27) / 100) * 10, 2), // 27 days remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount(BASE_RENT_AMOUNT_2000_1_DAY_NONLY - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 1, 2), 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 27, 2), // 27 days remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_NONLY - getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 1) / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2), // complete concession
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((((BASE_RENT_AMOUNT_2000 / NON_LEAP_YEAR_FEB_DAYS) * 27) / 100) * 10, 2), 2), // 27 days remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2018-02-28',
    leaseTerm: generateLeaseTerm('2018-08-27', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_28TH_FEB_NON_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount(BASE_RENT_AMOUNT_2000_1_DAY_NONLY - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 1, 2), 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / NON_LEAP_YEAR_FEB_DAYS) * 27, 2), // 27 days remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_27_DAYS_31MONTH,
    ]),
  },
];
