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
  LEAP_YEAR_FEB_DAYS,
  ONE_TIME,
  RECURRING_CONCESSION,
  ADJUSTED_MARKET_RENT,
  BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
} from './quotes-concessions-commons-test';

import { getFixedAmount } from '../../helpers/quotes';

/* Test Case: February leap-year Calendar month proration strategy
 * Move in on 1st  (rent / 29) * 29
 * Move in on 2nd  (rent / 29) * 28
 * Move in on 16th (rent / 29) * 14
 * Move in on 27th (rent / 29) * 3
 * Move in on 28th (rent / 29) * 2
 * Move in on 29th (rent / 29) * 1
 */

const BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 28, 2);
const BASE_RENT_AMOUNT_2000_1_DAY_LY = getFixedAmount((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 1, 2);
const BASE_RENT_AMOUNT_2000_14_DAYS_LY = getFixedAmount((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 14, 2);

export const CASE_LEAP_YEAR_FEB_6M = [
  {
    // From Feb 1st to Jul 31st
    leaseStartDate: '2020-02-01',
    amountIn: (ADJUSTED_MARKET_RENT / LEAP_YEAR_FEB_DAYS) * 29, // 29 billableDaysIn
    billableDaysIn: 29,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 31, // 31 billableDaysOut
    billableDaysOut: 31,
    leaseTerm: generateLeaseTerm('2020-07-31', 6),
  },
  {
    // From Feb 2nd to Aug 1st
    leaseStartDate: '2020-02-02',
    amountIn: (ADJUSTED_MARKET_RENT / LEAP_YEAR_FEB_DAYS) * 28, // 28 billableDaysIn
    billableDaysIn: 28,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2020-08-01', 6),
  },
  {
    // From Feb 16th to Aug 15th
    leaseStartDate: '2020-02-16',
    amountIn: (ADJUSTED_MARKET_RENT / LEAP_YEAR_FEB_DAYS) * 14, // 14 billableDaysIn
    billableDaysIn: 14,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 15, // 15 billableDaysOut
    billableDaysOut: 15,
    leaseTerm: generateLeaseTerm('2020-08-15', 6),
  },
  {
    // From Feb 27th to Aug 26th
    leaseStartDate: '2020-02-27',
    amountIn: (ADJUSTED_MARKET_RENT / LEAP_YEAR_FEB_DAYS) * 3, // 3 billableDaysIn
    billableDaysIn: 3,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 26, // 26 billableDaysOut
    billableDaysOut: 26,
    leaseTerm: generateLeaseTerm('2020-08-26', 6),
  },
  {
    // From Feb 28th to Aug 27th
    leaseStartDate: '2020-02-28',
    amountIn: (ADJUSTED_MARKET_RENT / LEAP_YEAR_FEB_DAYS) * 2, // 2 billableDaysIn
    billableDaysIn: 2,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 27, // 27 billableDaysOut
    billableDaysOut: 27,
    leaseTerm: generateLeaseTerm('2020-08-27', 6),
  },
  {
    // From Feb 29th to Aug 28th
    leaseStartDate: '2020-02-29',
    amountIn: (ADJUSTED_MARKET_RENT / LEAP_YEAR_FEB_DAYS) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 28, // 28 billableDaysOut
    billableDaysOut: 28,
    leaseTerm: generateLeaseTerm('2020-08-28', 6),
  },
];

const FULL_MONTHS_FROM_MAR_TO_JUL = [
  { timeframe: 'Mar 2020', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Apr 2020', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'May 2020', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Jun 2020', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'Jul 2020', billableDays: MONTH_31, daysInMonth: MONTH_31 },
];

const START_ON_1ST_FEB_LEAP_YEAR_6M = [{ timeframe: 'Feb 2020', billableDays: 29, daysInMonth: LEAP_YEAR_FEB_DAYS }, ...FULL_MONTHS_FROM_MAR_TO_JUL];

const START_ON_16TH_FEB_LEAP_YEAR_6M = [
  { timeframe: 'Feb 2020', billableDays: 14, daysInMonth: LEAP_YEAR_FEB_DAYS },
  ...FULL_MONTHS_FROM_MAR_TO_JUL,
  { timeframe: 'Aug 2020', billableDays: 15, daysInMonth: MONTH_31 },
];

const START_ON_29TH_FEB_LEAP_YEAR_6M = [
  { timeframe: 'Feb 2020', billableDays: 1, daysInMonth: LEAP_YEAR_FEB_DAYS },
  ...FULL_MONTHS_FROM_MAR_TO_JUL,
  { timeframe: 'Aug 2020', billableDays: 28, daysInMonth: MONTH_31 },
];

export const CASE_LEAP_YEAR_FEB_START_ON_1ST_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10)]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - 100)]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(2).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10),
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2020-02-01',
    leaseTerm: generateLeaseTerm('2020-07-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(2).fill(BASE_RENT_AMOUNT_2000 - 100), ...Array(4).fill(BASE_RENT_AMOUNT_2000)]),
  },
];

export const CASE_LEAP_YEAR_FEB_START_ON_16TH_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 14 days free
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 15, 2), // 15 days free remaining prorated concession from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY - 500,
      BASE_RENT_AMOUNT_2000,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY, // charge 16 days from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 16, 2), // 16 days free remaining prorated concession from Aug
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY, // charge 14 days from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - 500, // apply absoluteAdjustment concession in full
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY,
      0,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY,
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // charge 15 days from Aug
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY - getFixedAmount((BASE_RENT_AMOUNT_2000_14_DAYS_LY / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2)),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount((((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 15) / 100) * 10, 2), // 15 days concession remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 14, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 15, 2), // 15 days concession remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY - getFixedAmount((BASE_RENT_AMOUNT_2000_14_DAYS_LY / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2), // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 15) / 100) * 10, 2), // 15 days concession remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2020-02-16',
    leaseTerm: generateLeaseTerm('2020-08-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_14_DAYS_LY - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 14, 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 15, 2), // 15 days concession remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
];

export const CASE_LEAP_YEAR_FEB_START_ON_29TH_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 day off
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 28, 2), 2), // 28 days remaining prorated concession from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // apply absoluteAdjustment that correspond to the 1 day= 68.97
      getFixedAmount(BASE_RENT_AMOUNT_2000 - 431.03, 2), // apply absoluteAdjustment that correspond to the 28 days remaining prorated concession from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_LY, // charge 1 day from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 3, 2), 2), // apply missing 3 days remaining prorated concession from Aug
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_LY, // charge 1 days from Feb
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      getFixedAmount(BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH - 500, 2), // Applied in full
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([BASE_RENT_AMOUNT_2000_1_DAY_LY, 0, ...Array(4).fill(BASE_RENT_AMOUNT_2000), BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_LY,
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_LY - getFixedAmount((BASE_RENT_AMOUNT_2000_1_DAY_LY / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2)),
      getFixedAmount(BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH - getFixedAmount((((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 28) / 100) * 10, 2), 2), // 28 days remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_LY - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 1, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 28, 2), // 28 days remaining prorated concession from Feb
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_LY - getFixedAmount((BASE_RENT_AMOUNT_2000_1_DAY_LY / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2), // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((((BASE_RENT_AMOUNT_2000 / LEAP_YEAR_FEB_DAYS) * 28) / 100) * 10, 2), // 28 days remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2020-02-29',
    leaseTerm: generateLeaseTerm('2020-08-28', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_29TH_FEB_LEAP_YEAR_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_LY - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 1, 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / LEAP_YEAR_FEB_DAYS) * 28, 2), // 28 days remaining prorated concession from Feb
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_28_DAYS_31MONTH,
    ]),
  },
];
