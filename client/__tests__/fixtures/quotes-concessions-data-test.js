/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  generateLeaseTerm,
  generatePaymentsResult,
  generateBasePayments,
  BASE_RENT_AMOUNT_2000,
  MONTH_30,
  ONE_TIME,
  VARIABLE_ONE_TIME,
  RECURRING_CONCESSION,
  BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
} from './quotes-concessions-commons-test';

import {
  PARKING_INDOOR_PRICE,
  UTILITIES_SUM,
  UTILITIES_SUM_15_DAYS_30MONTH,
  PARKING_INDOOR_15_DAYS_30MONTH,
  generateUtilitiesAndParkingFeeWithConcessions,
} from './quotes-fees-commons-test';

const VARIABLE_ADJUSTMENT_AMOUNT_6 = 6;
const TWO_PARKING = 2;

const FULL_MONTHS_FROM_APR_TO_AUG = [
  { timeframe: 'Apr 2017', billableDays: MONTH_30 },
  { timeframe: 'May 2017', billableDays: MONTH_30 },
  { timeframe: 'Jun 2017', billableDays: MONTH_30 },
  { timeframe: 'Jul 2017', billableDays: MONTH_30 },
  { timeframe: 'Aug 2017', billableDays: MONTH_30 },
];

const TIMEFRAME_6M = [{ timeframe: 'Mar 2017', billableDays: MONTH_30 }, ...FULL_MONTHS_FROM_APR_TO_AUG];

const TIMEFRAME_12M = [
  ...TIMEFRAME_6M,
  { timeframe: 'Sep 2017', billableDays: MONTH_30 },
  { timeframe: 'Oct 2017', billableDays: MONTH_30 },
  { timeframe: 'Nov 2017', billableDays: MONTH_30 },
  { timeframe: 'Dec 2017', billableDays: MONTH_30 },
  { timeframe: 'Jan 2018', billableDays: MONTH_30 },
  { timeframe: 'Feb 2018', billableDays: MONTH_30 },
];

const PAYMENTS_START_ON_MARCH_16TH_6M = [
  { timeframe: 'Mar 2017', billableDays: 15 },
  ...FULL_MONTHS_FROM_APR_TO_AUG,
  { timeframe: 'Sep 2017', billableDays: 15 },
];

const PAYMENTS_START_ON_MARCH_16TH_2M = [
  { timeframe: 'Mar 2017', billableDays: 15 },
  { timeframe: 'Apr 2017', billableDays: MONTH_30 },
  { timeframe: 'May 2017', billableDays: 15 },
];

const PAYMENTS_START_ON_MARCH_16TH_1M = [
  { timeframe: 'Mar 2017', billableDays: 15 },
  { timeframe: 'Apr 2017', billableDays: 15 },
];

export const MOVE_IN_ON_FIRST_WITH_CONCESSION = [
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
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // first month 0
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
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([BASE_RENT_AMOUNT_2000 - 500, ...Array(5).fill(BASE_RENT_AMOUNT_2000)]),
  },
  {
    description: 'one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 12, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(11).fill(BASE_RENT_AMOUNT_2000), 0]), // last month 0
  },
  {
    description: 'one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 12, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -500,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(11).fill(BASE_RENT_AMOUNT_2000), BASE_RENT_AMOUNT_2000 - 500]),
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
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([0, BASE_RENT_AMOUNT_2000, ...Array(4).fill(BASE_RENT_AMOUNT_2000)]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment of 150',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -150,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([0, BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, ...Array(4).fill(BASE_RENT_AMOUNT_2000)]),
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
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([BASE_RENT_AMOUNT_2000 - 500, ...Array(5).fill(BASE_RENT_AMOUNT_2000)]),
  },
  {
    description: 'recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -12,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 * 12) / 100, // first month with concession
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 * 12) / 100,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'recurring applied to 2 months (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 12, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -12,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(10).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 * 12) / 100, // last two months with concessions
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 * 12) / 100,
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
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
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
        absoluteAdjustment: -25,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 - 25)]), // -$25
  },
];

export const MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION = [
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
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // first month with concession
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // proration applied to concession
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
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
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - 500,
      BASE_RENT_AMOUNT_2000,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
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
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // proration appliedto to concession
      0,
    ]), // last month with concession
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
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - 500,
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
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      0,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment of 150',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -150,
        absoluteAdjustment: null,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      0,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
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
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      BASE_RENT_AMOUNT_2000 - 500,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
    ]),
  },
  {
    description: 'recurring applied to all periods - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -12,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - (BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH / 100) * 12,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 / 100) * 12),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - (BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH / 100) * 12, // 15 days remaining concession from Mar
    ]),
  },
  {
    description: 'recurring applied to all periods - absolute adjustment',
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
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - (100 / MONTH_30) * 15,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - (100 / MONTH_30) * 15, // 15 days remaining concession from Mar
    ]),
  },
  {
    description: 'recurring applied to 2 months (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -12,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - (BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH * 12) / 100,
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 * 12) / 100, // complete concession
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH * 12) / 100, // remaining prorated concession from Mar
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
    ]),
  },
  {
    description: 'recurring applied to 2 months (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -12,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      ...Array(3).fill(BASE_RENT_AMOUNT_2000),
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH * 12) / 100,
      BASE_RENT_AMOUNT_2000 - (BASE_RENT_AMOUNT_2000 * 12) / 100,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - (BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH * 12) / 100,
    ]),
  },
  {
    description: 'concession $3000 monthly discount / applied at first 2 months - 6 months',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -3000,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([0, 0, 0, 1000, 2000, 2000, 1000]),
  },
  {
    description: 'concession $3000 monthly discount / applied at 2 months (applied to first full month period) - 6 months',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -3000,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      0,
      BASE_RENT_AMOUNT_2000 - 1000,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000 / 2,
    ]),
  },
  {
    description: 'concession 200% monthly discount / applied at 2 months (applied to first full month period) - 6 months',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-09-15', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -200,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
      0,
      0,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000 / 2,
    ]),
  },
];

export const MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION_2M = [
  {
    description: 'concession $3000 monthly discount / applied at first 2 months - 2 months lease',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -3000,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([0, 0, 0]),
  },
  {
    description: 'concession $3000 monthly discount / applied at last 2 months - 2 months lease',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -3000,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([0, 0, 0]),
  },
  {
    description: 'concession $3000 monthly discount / applied at first full 2 months - 2 months lease',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -3000,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, 0, 0]),
  },
  {
    description: 'concession employee rent credit monthly discount / applied to all months - 2 months lease',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, 1000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -2000,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, 1000),
    paymentsResult: generatePaymentsResult([0, 0, 0]),
  },
];

export const MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION_1M = [
  {
    description: 'concession $3000 monthly discount / applied at first full month - 1 months lease',
    leaseStartDate: '2017-03-16',
    leaseTerm: generateLeaseTerm('2017-04-15', 1, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -3000,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_1M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([1000, 1000]),
  },
];

export const MOVE_IN_ON_FIRST_WITH_MULTIPLE_CONCESSIONS = [
  {
    description: 'one-time (applied to first period) and recurring applied to 2 months (applied at first) - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -12,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (12 / 100) - BASE_RENT_AMOUNT_2000 * (12 / 100), // Applied the negative amount - (BASE_RENT_AMOUNT_2000 * (12 / 100)) to second month
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to last period) and recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (10 / 100)),
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (10 / 100) - BASE_RENT_AMOUNT_2000 * (10 / 100), // Applied the negative amount - (BASE_RENT_AMOUNT_2000 * (10 / 100)) to previous month
      0,
    ]),
  },
  {
    description: 'one-time (applied to first full month period) and recurring applied to 2 months (applied at first full month) - relative adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -12,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (12 / 100) - BASE_RENT_AMOUNT_2000 * (12 / 100), // Applied the negative amount - (BASE_RENT_AMOUNT_2000 * (12 / 100)) to second month
      ...Array(4).fill(BASE_RENT_AMOUNT_2000),
    ]),
  },
  {
    description: 'one-time (applied to first period) and recurring applied to all terms - relative adjustment / applied from last',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (10 / 100) - BASE_RENT_AMOUNT_2000 * (10 / 100), // Applied the negative amount - (BASE_RENT_AMOUNT_2000 * (10 / 100)) to previous month
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (10 / 100)),
    ]),
  },
  {
    description: 'one-time (applied to first full month period) and recurring applied to all terms - relative adjustment / applied from last',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (10 / 100) - BASE_RENT_AMOUNT_2000 * (10 / 100), // Applied the negative amount - (BASE_RENT_AMOUNT_2000 * (10 / 100)) to previous month
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - BASE_RENT_AMOUNT_2000 * (10 / 100)),
    ]),
  },
  {
    description: 'one-time (applied to first period) and recurring applied to all terms - relative adjustment/ applied at last',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 1, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments([{ timeframe: 'Mar 2017', billableDays: MONTH_30 }], BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([0]),
  },
  {
    description: 'one-time (applied to first full month period) and recurring applied to all terms - relative adjustment / applied at first',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 1, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments([{ timeframe: 'Mar 2017', billableDays: MONTH_30 }], BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([0]),
  },
  {
    description: 'one-time (applied to first period) - relative adjustment and recurring applied to all terms absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -25,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - 25 - 25, // Applied the negative amount -$25 to second month
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - 25),
    ]),
  },
  {
    description: 'one-time (applied to first full month period) - relative adjustment and recurring applied to all terms absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -25,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - 25 - 25, // Applied the negative amount -$25 to second month
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - 25),
    ]),
  },
  {
    description: '1 month free (applied at first) - recurring $25 per month - recurring $100 per month - 12 months',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 12, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -25,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - 25 - 100 - 25 - 100, // Applied the pending amounts of $25 + $100
      ...Array(10).fill(BASE_RENT_AMOUNT_2000 - 25 - 100),
    ]),
  },
  {
    description: '1 month free (applied at first full month) - recurring $25 per month - recurring $100 per month - 12 months',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 12, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -25,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - 25 - 100 - 25 - 100, // Applied the pending amounts of $25 + $100
      ...Array(10).fill(BASE_RENT_AMOUNT_2000 - 25 - 100),
    ]),
  },
  {
    description: '2 recurring concessions - recurring $25 per month - recurring $100 per month - 12 months',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2018-02-28', 12, BASE_RENT_AMOUNT_2000, [
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -25,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([...Array(12).fill(BASE_RENT_AMOUNT_2000 - 25 - 100)]),
  },
  {
    // case: Negative amount roll over to previous period
    description: 'one-time (applied to last period) - recurring applied to all terms absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - 100),
      BASE_RENT_AMOUNT_2000 - 100 - 100, // roll over $100 from Aug
      0, // 1 month free
    ]),
  },
  {
    // case: Negative amount roll over to next period
    description: 'one-time (applied to first period) - recurring applied to all terms absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 month free
      BASE_RENT_AMOUNT_2000 - 100 - 100, // roll over $100 from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - 100),
    ]),
  },
  {
    // case: Negative amount roll over to next period
    description: 'one-time (applied to first full month period) - recurring applied to all terms absolute adjustment',
    leaseStartDate: '2017-03-01',
    leaseTerm: generateLeaseTerm('2017-08-31', 6, BASE_RENT_AMOUNT_2000, [
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: 100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0, // 1 month free
      BASE_RENT_AMOUNT_2000 - 100 - 100, // roll over $100 from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 - 100),
    ]),
  },
];

export const MOVE_IN_ON_FIRST_PARKING_INDOOR_FEE_WITH_CONCESSIONS = [
  {
    description: '1 Parking indoor fee with - one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + (UTILITIES_SUM + PARKING_INDOOR_PRICE)),
    ]),
  },
  {
    description: '1 Parking Indoor fee with - one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100, // $100 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100, // $100 free
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + (UTILITIES_SUM + PARKING_INDOOR_PRICE)),
    ]),
  },
  {
    description: '1 Parking Indoor fee with - one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100, // $100 free
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
    ]),
  },
  {
    description: '2 Parking indoor fee with - one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions(
      [
        {
          name: ONE_TIME,
          nonRecurringAppliedAt: 'first',
          relativeAdjustment: -100,
          absoluteAdjustment: null,
        },
      ],
      TWO_PARKING,
    ),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + TWO_PARKING * PARKING_INDOOR_PRICE),
    ]),
  },
  {
    description: '2 Parking indoor fee with - one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions(
      [
        {
          name: ONE_TIME,
          nonRecurringAppliedAt: 'firstFull',
          relativeAdjustment: -100,
          absoluteAdjustment: null,
        },
      ],
      TWO_PARKING,
    ),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + TWO_PARKING * PARKING_INDOOR_PRICE),
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - relative adjustment',
    leaseStartDate: '2016-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -50,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + (PARKING_INDOOR_PRICE / 100) * 50)]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2016-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -20,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([...Array(6).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 20)]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 6 months - relative adjustment',
    leaseStartDate: '2017-03-01',
    termLength: 12,
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -50,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      ...Array(6).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + (PARKING_INDOOR_PRICE * 50) / 100),
      ...Array(6).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 6 months - absolute adjustment',
    leaseStartDate: '2017-03-01',
    termLength: 12,
    paymentsForPeriods: generateBasePayments(TIMEFRAME_12M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      ...Array(6).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + (PARKING_INDOOR_PRICE - 100)),
      ...Array(6).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 6 months - relative adjustment - from last',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -50,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE * (50 / 100)),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM, // The amount of last month is applied to this one concession
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM, // With concession one month free
    ]),
  },
  {
    description: 'Parking indoor fee with - one time (applied to last period) - recurring applied to all terms',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -50,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE * (50 / 100)),
      ...Array(2).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM),
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - excluded from rent',
    leaseStartDate: '2017-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: true,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      ...Array(6).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE), // No concession amount applied since it's excludeFromRentFlag = true
    ]),
  },
  {
    description: 'Parking indoor fee with - one-time (applied to last period)- variable adjustment',
    leaseStartDate: '2016-03-01',
    paymentsForPeriods: generateBasePayments(TIMEFRAME_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: VARIABLE_ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -6,
        amountVariableAdjustment: VARIABLE_ADJUSTMENT_AMOUNT_6,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + (UTILITIES_SUM + PARKING_INDOOR_PRICE - VARIABLE_ADJUSTMENT_AMOUNT_6),
    ]),
  },
];

export const MOVE_IN_ON_MARCH_16TH_WITH_VARIABLE_ADJUSTMENT_CONCESSION_2M = [
  {
    description: 'Variable Concession $1000 one time discount / equals to period amount / applied at first month - variable adjustment',
    leaseStartDate: '2016-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, BASE_RENT_AMOUNT_2000, [
      {
        name: VARIABLE_ONE_TIME,
        amountVariableAdjustment: 1000,
        nonRecurringAppliedAt: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - 1000,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // 15 days remaining concession from Mar
    ]),
  },
  {
    description: 'Variable Concession $500 one time discount / lower than period amount / applied at first month - variable adjustment',
    leaseStartDate: '2016-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, BASE_RENT_AMOUNT_2000, [
      {
        name: VARIABLE_ONE_TIME,
        amountVariableAdjustment: 500,
        nonRecurringAppliedAt: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH - 500,
      BASE_RENT_AMOUNT_2000,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // 15 days remaining concession from Mar
    ]),
  },
  {
    description: 'Variable Concession $1500 one time discount / lower than base rent / applied at first month - variable adjustment',
    leaseStartDate: '2016-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, BASE_RENT_AMOUNT_2000, [
      {
        name: VARIABLE_ONE_TIME,
        amountVariableAdjustment: 1500,
        nonRecurringAppliedAt: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - 500,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // 15 days remaining concession from Mar
    ]),
  },
  {
    description: 'Variable Concession $1500 one time discount / equals to base rent / applied at first month - variable adjustment',
    leaseStartDate: '2016-03-16',
    leaseTerm: generateLeaseTerm('2017-05-15', 2, BASE_RENT_AMOUNT_2000, [
      {
        name: VARIABLE_ONE_TIME,
        amountVariableAdjustment: 2000,
        nonRecurringAppliedAt: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_2M, BASE_RENT_AMOUNT_2000),
    paymentsResult: generatePaymentsResult([
      0,
      BASE_RENT_AMOUNT_2000 - 1000,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH, // 15 days remaining concession from Mar
    ]),
  },
];

export const MOVE_IN_ON_NOV_16TH_PARKING_INDOOR_FEE_WITH_CONCESSIONS = [
  {
    description: '1 Parking indoor fee with - one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_15_DAYS_30MONTH,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_15_DAYS_30MONTH,
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -50,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + (PARKING_INDOOR_15_DAYS_30MONTH * 50) / 100,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE * (50 / 100)),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + (PARKING_INDOOR_15_DAYS_30MONTH * 50) / 100,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - recurring applied to all terms',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -50,
        absoluteAdjustment: null,
        recurringCount: 6,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + (PARKING_INDOOR_15_DAYS_30MONTH * 50) / 100,
      ...Array(3).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + (PARKING_INDOOR_PRICE * 50) / 100),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + (PARKING_INDOOR_PRICE * 50) / 100 - (PARKING_INDOOR_15_DAYS_30MONTH * 50) / 100,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM, // 15 days fre remaining from "one month free" + 50% off from other concession, then no parking indoor amount charged
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(PAYMENTS_START_ON_MARCH_16TH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -50,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH - (PARKING_INDOOR_15_DAYS_30MONTH / 100) * 50,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - (PARKING_INDOOR_PRICE / 100) * 50,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - (PARKING_INDOOR_15_DAYS_30MONTH / 100) * 50,
      ...Array(3).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
];
