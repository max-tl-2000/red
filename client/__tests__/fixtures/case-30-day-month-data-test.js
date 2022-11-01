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
  ONE_TIME,
  RECURRING_CONCESSION,
  ADJUSTED_MARKET_RENT,
  BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
  BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH,
  BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
} from './quotes-concessions-commons-test';

import { START_ON_1ST_30_DAY_MONTH_6M, START_ON_16TH_30_DAY_MONTH_6M, START_ON_30TH_30_DAY_MONTH_6M } from './time-frames-calendar-month-data-test';

import { getFixedAmount } from '../../helpers/quotes';

/* Test Case: 30 days months Calendar month proration strategy
 * Move in on 1st  (rent / 30) * 30
 * Move in on 2nd  (rent / 30) * 29
 * Move in on 16th (rent / 30) * 15
 * Move in on 30th (rent / 30) * 1
 */

const BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 29, 2);
const BASE_RENT_AMOUNT_2000_1_DAY_30MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_30) * 1, 2);

export const CASE_30_DAYS_MONTH_6M = [
  {
    // From Apr 1st to Sep 30th
    leaseStartDate: '2017-04-01',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 30, // 30 billableDaysIn
    billableDaysIn: 30,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 30, // 30 billableDaysOut
    billableDaysOut: 30,
    leaseTerm: generateLeaseTerm('2017-09-30', 6),
  },
  {
    // From Apr 2nd to Oct 1st
    leaseStartDate: '2017-04-02',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysIn
    billableDaysIn: 29,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2017-10-01', 6),
  },
  {
    // From Apr 16th to Oct 15th
    leaseStartDate: '2017-04-16',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 15, // 15 billableDaysIn
    billableDaysIn: 15,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 15, // 15 billableDaysOut
    billableDaysOut: 15,
    leaseTerm: generateLeaseTerm('2017-10-15', 6),
  },
  {
    // From Apr 30th to Oct 29th
    leaseStartDate: '2017-04-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_31) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2017-10-29', 6),
  },
];

export const CASE_30_DAY_MONTH_START_ON_1ST_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      0, // 1 period free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 period free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - 500, // 500 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-04-01',
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
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10)]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - 100)]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-04-01',
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
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(2).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10),
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-04-01',
    leaseTerm: generateLeaseTerm('2017-09-30', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_1ST_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(2).fill(BASE_RENT_AMOUNT_2000 - 100), ...Array(4).fill(BASE_RENT_AMOUNT_2000)]),
  },
];

export const CASE_30_DAY_MONTH_START_ON_16TH_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 15 days free
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // 15 days free
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // Charge 15 days from Oct
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - getFixedAmount(500, 2), // apply absoluteAdjustment that correspond to the 15 days
      BASE_RENT_AMOUNT_2000,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH, // Charge 15 days from Oct
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // Charge 15 days from Apr
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH, // 16 days free remaining
      0, // 1 period free - 15 days free
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // Charge 15 days from Apr
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount(500, 2), // apply absoluteAdjustment in full
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      0, // free period
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      BASE_RENT_AMOUNT_2000 - 500, // apply absoluteAdjustment that correspond to the 15 days missing
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH / 100) * 10, 2),
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - getFixedAmount((100 / MONTH_30) * 15, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH - getFixedAmount((100 / MONTH_30) * 15, 2),
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH / 100) * 10, 2), // remaining prorated concession from April
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-04-16',
    leaseTerm: generateLeaseTerm('2017-10-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_16TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - getFixedAmount((100 / MONTH_30) * 15, 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / MONTH_30) * 15, 2), // remaining prorated concession from April
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH,
    ]),
  },
];

export const CASE_30_DAY_MONTH_START_ON_30TH_6M = [
  {
    description: 'one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 day off
      getFixedAmount(BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_30) * 29, 2), 2), // 29 days off remaining prorated concession from April
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // apply absoluteAdjustment that correspond to the 1 day = 66.67
      BASE_RENT_AMOUNT_2000 - getFixedAmount(433.33, 2), // apply absoluteAdjustment that correspond to the 29 days remaining concession from April
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_30MONTH, // charge 1 day from Apr
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 2, 2), // 2 days off remaining prorated concession from October
      0, // 29 days off
    ]),
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_30MONTH, // charge 1 days from Apr
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH - getFixedAmount(500, 2),
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_30MONTH,
      0,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH,
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_30MONTH,
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_30MONTH - getFixedAmount((BASE_RENT_AMOUNT_2000_1_DAY_30MONTH / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH - getFixedAmount((((BASE_RENT_AMOUNT_2000 / 30) * 29) / 100) * 10, 2), // remaining prorated concession from April
    ]),
  },
  {
    description: 'recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_30MONTH - getFixedAmount((100 / MONTH_30) * 1, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH - getFixedAmount((100 / MONTH_30) * 29, 2), // remaining prorated concession from April
    ]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_30) * 1, 2) - getFixedAmount((((BASE_RENT_AMOUNT_2000 / MONTH_30) * 1) / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 10, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((((BASE_RENT_AMOUNT_2000 / MONTH_30) * 29) / 100) * 10, 2), // remaining prorated concession from April
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-04-30',
    leaseTerm: generateLeaseTerm('2017-10-29', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(START_ON_30TH_30_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_30) * 1, 2) - getFixedAmount((100 / MONTH_30) * 1, 2),
      BASE_RENT_AMOUNT_2000 - 100, // complete concession
      BASE_RENT_AMOUNT_2000 - getFixedAmount((100 / MONTH_30) * 29, 2), // remaining prorated concession from April
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_29_DAYS_31MONTH,
    ]),
  },
];
