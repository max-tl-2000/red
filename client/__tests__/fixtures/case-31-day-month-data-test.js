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
  BASE_RENT_AMOUNT_2264,
  MONTH_31,
  MONTH_30,
  ONE_TIME,
  RECURRING_CONCESSION,
  ADJUSTED_MARKET_RENT,
  BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH,
  BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
  BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
} from './quotes-concessions-commons-test';

import { getFixedAmount } from '../../helpers/quotes';

import {
  START_ON_1ST_31_DAY_MONTH_6M,
  START_ON_16TH_31_DAY_MONTH_6M,
  START_ON_31ST_31_DAY_MONTH_6M,
  START_ON_SEP_25TH_30_DAY_MONTH_6M,
  START_ON_SEP_16TH_30_DAY_MONTH_6M,
  START_ON_SEP_1ST_30_DAY_MONTH_6M,
  START_ON_SEP_5TH_30_DAY_MONTH_6M,
} from './time-frames-calendar-month-data-test';

/* Test Case: 31 days months Calendar month proration strategy
 * Move in on 1st  (rent / 31) * 31
 * Move in on 2nd  (rent / 31) * 30
 * Move in on 16th (rent / 31) * 16
 * Move in on 30th (rent / 31) * 2
 * Move in on 31st (rent / 31) * 1
 */

const BASE_RENT_AMOUNT_2000_1_DAY_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 1, 2);

export const CASE_31_DAYS_MONTH_6M = [
  {
    // From Jan 1st to Jun 30th
    leaseStartDate: '2017-01-01',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_31) * 31, // 31 billableDaysIn
    billableDaysIn: 31,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 30, // 30 billableDaysOut
    billableDaysOut: 30,
    leaseTerm: generateLeaseTerm('2017-06-30', 6),
  },
  {
    // From Jan 2nd to Jul 1st
    leaseStartDate: '2017-01-02',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_31) * 30, // 30 billableDaysIn
    billableDaysIn: 30,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2017-07-01', 6),
  },
  {
    // From Jan 16th to Jul 15th
    leaseStartDate: '2017-01-16',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_31) * 16, // 16 billableDaysIn
    billableDaysIn: 16,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 15, // 15 billableDaysOut
    billableDaysOut: 15,
    leaseTerm: generateLeaseTerm('2017-07-15', 6),
  },
  {
    // From Jan 30th to Jul 29th
    leaseStartDate: '2017-01-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_31) * 2, // 2 billableDaysIn
    billableDaysIn: 2,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2017-07-29', 6),
  },
  {
    // From Jan 31th to Jul 30th
    leaseStartDate: '2017-01-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_31) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 30, // 30 billableDaysOut
    billableDaysOut: 30,
    leaseTerm: generateLeaseTerm('2017-07-30', 6),
  },
];

export const CASE_31_DAY_MONTH_START_ON_1ST_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10)]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - 100)]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(2).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10),
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(2).fill(BASE_RENT_AMOUNT_2000 - 100), ...Array(4).fill(BASE_RENT_AMOUNT_2000)]),
  },
];

export const NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_FIRST_PERIOD = [
  {
    description: 'one-time (applied to first period) - absolute adjustment - starting on 1st - 6 months',
    leaseStartDate: '2017-09-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([BASE_RENT_AMOUNT_2264 - 1000, ...Array(5).fill(BASE_RENT_AMOUNT_2264)]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment - starting on 16th - 6 months',
    leaseStartDate: '2017-09-16',
    leaseTerm: generateLeaseTerm('2018-03-15', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([1132 - 1000, ...Array(5).fill(BASE_RENT_AMOUNT_2264), 1095.48]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment - starting on 1st - 6 months - with a concession higher than base rent',
    leaseStartDate: '2017-09-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: 3000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([0, 1528, ...Array(4).fill(BASE_RENT_AMOUNT_2264)]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment - starting on 25th - 6 months',
    leaseStartDate: '2017-09-25',
    leaseTerm: generateLeaseTerm('2018-03-24', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_25TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([0, 1716.8, ...Array(4).fill(BASE_RENT_AMOUNT_2264), 1752.77]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment - starting on 25th - 6 months - with a concession higher than base rent',
    leaseStartDate: '2017-09-25',
    leaseTerm: generateLeaseTerm('2018-03-24', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: 3000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_25TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([0, 0, 1980.8, ...Array(3).fill(BASE_RENT_AMOUNT_2264), 1752.77]),
  },
];

export const NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_FIRST_FULL_PERIOD = [
  {
    description: 'one-time (applied to first full period) - absolute adjustment - starting on 1st - 6 months',
    leaseStartDate: '2017-09-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([BASE_RENT_AMOUNT_2264 - 1000, ...Array(5).fill(BASE_RENT_AMOUNT_2264)]),
  },
  {
    description: 'one-time (applied to first full period) - absolute adjustment - starting on 16th - 6 months',
    leaseStartDate: '2017-09-16',
    leaseTerm: generateLeaseTerm('2018-03-15', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([1132, BASE_RENT_AMOUNT_2264 - 1000, ...Array(4).fill(BASE_RENT_AMOUNT_2264), 1095.48]),
  },
  {
    description: 'one-time (applied to first full period) - absolute adjustment - starting on 25th - 6 months',
    leaseStartDate: '2017-09-25',
    leaseTerm: generateLeaseTerm('2018-03-24', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_25TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([452.8, BASE_RENT_AMOUNT_2264 - 1000, ...Array(4).fill(BASE_RENT_AMOUNT_2264), 1752.77]),
  },
];

export const NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_LAST_PERIOD = [
  {
    description: 'one-time (applied to last period) - absolute adjustment - starting on 1st - 6 months',
    leaseStartDate: '2017-09-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([...Array(5).fill(BASE_RENT_AMOUNT_2264), BASE_RENT_AMOUNT_2264 - 1000]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment - starting on 16th - 6 months',
    leaseStartDate: '2017-09-16',
    leaseTerm: generateLeaseTerm('2018-03-15', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([1132, ...Array(5).fill(BASE_RENT_AMOUNT_2264), getFixedAmount(1095.48 - 1000, 2)]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment - starting on 25th - 6 months',
    leaseStartDate: '2017-09-25',
    leaseTerm: generateLeaseTerm('2018-03-24', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_25TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([452.8, ...Array(5).fill(BASE_RENT_AMOUNT_2264), getFixedAmount(1752.77 - 1000, 2)]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment - starting on 5th - 6 months',
    leaseStartDate: '2017-09-05',
    leaseTerm: generateLeaseTerm('2018-03-04', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: 1000,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_5TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([1962.13, ...Array(4).fill(BASE_RENT_AMOUNT_2264), BASE_RENT_AMOUNT_2264 - 707.87, 0]),
  },
];

export const CASE_31_DAY_MONTH_START_ON_16TH_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 16 days free
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // remaining prorated concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // charge 15 days from Sep
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH - 500,
      BASE_RENT_AMOUNT_2000,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // charge 15 days from Sep
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH, // charge 16 days from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // 15 days free remaining prorated concession from Sep
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH, // charge 16 days from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - 500, // apply absoluteAdjustment that correspond to the 15 days
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH,
      0,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // charge 15 days from Sep
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH,
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // charge 15 days from Sep
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2)),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH / 100) * 10, 2), // 15 days remaining prorated concession from Mar
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH - getFixedAmount((100 / MONTH_31) * 16, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - getFixedAmount((100 / MONTH_31) * 15, 2), // 15 days remaining prorated concession from Mar
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2), // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH / 100) * 10, 2), // remaining prorated concession from Mar
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH - getFixedAmount((100 / MONTH_31) * 16, 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / MONTH_31) * 15, 2), // remaining prorated concession from Mar
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
    ]),
  },
];

export const CASE_31_DAY_MONTH_START_ON_31ST_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 day off
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 30, 2), 2), // 30 days off remaining prorated concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // Concession amount: 64.52
      getFixedAmount(BASE_RENT_AMOUNT_2000 - 435.48, 2), // Concession amount: 435.48
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH, // charge 1 days from Mar
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH, // charge 1 days from Mar
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - 500,
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([BASE_RENT_AMOUNT_2000_1_DAY_31MONTH, 0, ...Array(4).fill(BASE_RENT_AMOUNT_2000), BASE_RENT_AMOUNT_2000]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH,
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount(BASE_RENT_AMOUNT_2000_1_DAY_31MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_1_DAY_31MONTH / 100) * 10, 2), 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2)), // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((((BASE_RENT_AMOUNT_2000 / MONTH_31) * 30) / 100) * 10, 2), // 30 days remaining prorated concession from Mar
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH - getFixedAmount((100 / MONTH_31) * 1, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100), // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / MONTH_31) * 30, 2), // 30 days remaining prorated concession from Mar
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount(BASE_RENT_AMOUNT_2000_1_DAY_31MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_1_DAY_31MONTH / 100) * 10, 2), 2),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / 100) * 10, 2), // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((((BASE_RENT_AMOUNT_2000 / MONTH_31) * 30) / 100) * 10, 2), // 30 days remaining prorated concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-03-31',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH - getFixedAmount((100 / MONTH_31) * 1, 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / MONTH_31) * 30, 2), // 30 days remaining prorated concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
];

const FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264 = (BASE_RENT_AMOUNT_2264 * 50) / 100;
const START_ON_SEP_16TH_PERIOD_AMOUNT =
  (BASE_RENT_AMOUNT_2264 / START_ON_SEP_16TH_30_DAY_MONTH_6M[0].daysInMonth) * START_ON_SEP_16TH_30_DAY_MONTH_6M[0].billableDays;
const START_ON_SEP_25TH_PERIOD_AMOUNT =
  (BASE_RENT_AMOUNT_2264 / START_ON_SEP_25TH_30_DAY_MONTH_6M[0].daysInMonth) * START_ON_SEP_25TH_30_DAY_MONTH_6M[0].billableDays;

export const ALWAYS_PRORATE_VARIABLE_RECURRING_CONCESSIONS = [
  {
    description: 'recurring applied to 2 months - starting on september 1st - variable adjustment - equals to max',
    leaseStartDate: '2017-09-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: RECURRING_CONCESSION,
        variableAdjustment: true,
        amountVariableAdjustment: FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264,
        relativeAdjustment: -50,
        recurringCount: 2,
        nonRecurringAppliedAt: null,
        absoluteAdjustment: null,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2264 - FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264, // As the lease start date is sept 1st and the amount of the concession is lower than the fee amount, the whole concession amount should be applied
      BASE_RENT_AMOUNT_2264 - FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264, // As the recurring count is 2 and the amount of the concession is lower than the fee amount, the whole concession amount should be applied
      ...Array(4).fill(BASE_RENT_AMOUNT_2264),
    ]),
  },
  {
    description: 'recurring applied to 2 months - starting on september 16th - variable adjustment - equals to max',
    leaseStartDate: '2017-09-16',
    leaseTerm: generateLeaseTerm('2018-03-15', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: RECURRING_CONCESSION,
        variableAdjustment: true,
        amountVariableAdjustment: FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264,
        relativeAdjustment: -50,
        recurringCount: 2,
        nonRecurringAppliedAt: null,
        absoluteAdjustment: null,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([
      START_ON_SEP_16TH_PERIOD_AMOUNT -
        (FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264 / START_ON_SEP_16TH_30_DAY_MONTH_6M[0].daysInMonth) * START_ON_SEP_16TH_30_DAY_MONTH_6M[0].billableDays, // $1132(Fee Amount) - ($1132(Concession Amount) / 30(Days in Sept) * 15(Days to charge)) = $566
      BASE_RENT_AMOUNT_2264 - FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264, // Applied concession in full ($1132), as oct is a full month and the concession amount is lower than the fee amount
      BASE_RENT_AMOUNT_2264 - (FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264 / START_ON_SEP_16TH_30_DAY_MONTH_6M[2].daysInMonth) * 15, // Applied remaining concession amount = $2264(Fee Amount) - ($1132(Concession Amount) / 31(Days in Oct) * 15(Days to charge)) = $1698
      ...Array(3).fill(BASE_RENT_AMOUNT_2264),
      1095.48, // Fee Amount = 15 days of march 2018
    ]),
  },
  {
    description: 'recurring applied to 2 months - starting on september 25th - variable adjustment - equals to max',
    leaseStartDate: '2017-09-25',
    leaseTerm: generateLeaseTerm('2018-03-24', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: RECURRING_CONCESSION,
        variableAdjustment: true,
        amountVariableAdjustment: FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264,
        relativeAdjustment: -50,
        recurringCount: 2,
        nonRecurringAppliedAt: null,
        absoluteAdjustment: null,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_25TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([
      START_ON_SEP_25TH_PERIOD_AMOUNT -
        (FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264 / START_ON_SEP_25TH_30_DAY_MONTH_6M[0].daysInMonth) * START_ON_SEP_25TH_30_DAY_MONTH_6M[0].billableDays, // $458.8(Fee Amount) - ($1132(Concession Amount) / 30(Days in Sept) * 6(Days to charge)) = $226.4
      BASE_RENT_AMOUNT_2264 - FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264, // Applied concession in full ($1132), as oct is a full month and the concession amount is lower than the fee amount
      BASE_RENT_AMOUNT_2264 - (FIFTY_PERCENT_OF_BASE_RENT_AMOUNT_2264 / START_ON_SEP_16TH_30_DAY_MONTH_6M[2].daysInMonth) * 24, // Applied remaining concession amount = $2264(Fee Amount) - ($1132(Concession Amount) / 31(Days in Oct) * 24(Days to charge)) = $1358.40
      ...Array(3).fill(BASE_RENT_AMOUNT_2264),
      1752.77, // Fee Amount = 24 days of march 2018
    ]),
  },
  {
    description: 'recurring applied to 2 months - starting on september 16th - variable adjustment - lower than max',
    leaseStartDate: '2017-09-16',
    leaseTerm: generateLeaseTerm('2018-03-15', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: RECURRING_CONCESSION,
        variableAdjustment: true,
        amountVariableAdjustment: 1000,
        relativeAdjustment: -50,
        recurringCount: 2,
        nonRecurringAppliedAt: null,
        absoluteAdjustment: null,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([
      START_ON_SEP_16TH_PERIOD_AMOUNT - (1000 / START_ON_SEP_16TH_30_DAY_MONTH_6M[0].daysInMonth) * START_ON_SEP_16TH_30_DAY_MONTH_6M[0].billableDays, // $1132(Fee Amount) - ($1000(Concession Amount) / 30(Days in Sept) * 15(Days to charge)) = $632
      BASE_RENT_AMOUNT_2264 - 1000, // Applied concession in full ($1000), as oct is a full month and the concession amount is lower than the fee amount
      BASE_RENT_AMOUNT_2264 - (1000 / START_ON_SEP_16TH_30_DAY_MONTH_6M[2].daysInMonth) * 15, // Applied remaining concession amount = $2264(Fee Amount) - ($1000(Concession Amount) / 31(Days in Oct) * 15(Days to charge)) = $1764
      ...Array(3).fill(BASE_RENT_AMOUNT_2264),
      1095.48, // Fee Amount = 15 days of march 2018
    ]),
  },
  {
    description: 'recurring applied to all months - starting on september 1st - variable adjustment - lower to max',
    leaseStartDate: '2017-09-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: RECURRING_CONCESSION,
        variableAdjustment: true,
        amountVariableAdjustment: 264,
        relativeAdjustment: -15,
        recurringCount: 0,
        nonRecurringAppliedAt: null,
        absoluteAdjustment: null,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([
      ...Array(6).fill(2000), // $264 (Concession amount) applied to all months in full
    ]),
  },
  {
    description: 'recurring applied to all months - starting on september 16th - variable adjustment - lower to max',
    leaseStartDate: '2017-09-16',
    leaseTerm: generateLeaseTerm('2018-03-15', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: RECURRING_CONCESSION,
        variableAdjustment: true,
        amountVariableAdjustment: 264,
        relativeAdjustment: -15,
        recurringCount: 0,
        nonRecurringAppliedAt: null,
        absoluteAdjustment: null,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([
      START_ON_SEP_16TH_PERIOD_AMOUNT - (264 / START_ON_SEP_16TH_30_DAY_MONTH_6M[0].daysInMonth) * START_ON_SEP_16TH_30_DAY_MONTH_6M[0].billableDays, // $1132(Fee Amount) - ($264(Concession Amount) / 30(Days in Sept) * 15(Days to charge)) = $1000
      ...Array(5).fill(2000), // $264(Concession amount) applied to 5 months in full
      963.48, // Fee Amount = 15 days of march 2018 - $264(Concession amount)
    ]),
  },
  {
    description: 'recurring applied to all months - starting on september 25th - variable adjustment - lower to max',
    leaseStartDate: '2017-09-25',
    leaseTerm: generateLeaseTerm('2018-03-24', 6, BASE_RENT_AMOUNT_2264, [
      {
        name: RECURRING_CONCESSION,
        variableAdjustment: true,
        amountVariableAdjustment: 264,
        relativeAdjustment: -15,
        recurringCount: 0,
        nonRecurringAppliedAt: null,
        absoluteAdjustment: null,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_SEP_25TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2264),
    paymentsResult: generatePaymentsResult([
      START_ON_SEP_25TH_PERIOD_AMOUNT - (264 / START_ON_SEP_25TH_30_DAY_MONTH_6M[0].daysInMonth) * START_ON_SEP_25TH_30_DAY_MONTH_6M[0].billableDays, // $458.8(Fee Amount) - ($264(Concession Amount) / 30(Days in Sept) * 6(Days to charge)) = $400
      ...Array(5).fill(2000), // $264(Concession amount) applied to 5 months in full
      1541.57, // Fee Amount = 24 days of march 2018 - $264(Concession amount)
    ]),
  },
];
