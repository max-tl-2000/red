/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  BASE_RENT_AMOUNT_2000,
  MONTH_31,
  MONTH_30,
  ONE_TIME,
  RECURRING_CONCESSION,
  BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH,
  generateBasePayments,
  generatePaymentsResult,
} from './quotes-concessions-commons-test';

import {
  UTILITIES_SUM,
  UTILITIES_SUM_16_DAYS_31MONTH,
  UTILITIES_SUM_1_DAY_31MONTH,
  PARKING_INDOOR_PRICE,
  UTILITIES_SUM_15_DAYS_30MONTH,
  PARKING_INDOOR_15_DAYS_30MONTH,
  generateUtilitiesAndParkingFeeWithConcessions,
} from './quotes-fees-commons-test';

import { START_ON_16TH_31_DAY_MONTH_6M, START_ON_31ST_31_DAY_MONTH_6M } from './time-frames-calendar-month-data-test';

import { getFixedAmount } from '../../helpers/quotes';

const PARKING_INDOOR_16_DAYS_31MONTH = getFixedAmount((PARKING_INDOOR_PRICE / MONTH_31) * 16, 2);
const PARKING_INDOOR_15_DAYS_31MONTH = getFixedAmount((PARKING_INDOOR_PRICE / MONTH_31) * 15, 2);
const PARKING_INDOOR_1_DAYS_31MONTH = getFixedAmount((PARKING_INDOOR_PRICE / MONTH_31) * 1, 2);
const BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 16, 2);
const BASE_RENT_AMOUNT_2000_1_DAY_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 1, 2);

export const MOVE_IN_ON_16TH_PARKING_INDOOR_WITH_CONCESSION_6M_CM = [
  {
    description: '1 Parking indoor fee with - one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_PRICE / MONTH_31) * 15, 2), // 15 days remaining concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH + PARKING_INDOOR_16_DAYS_31MONTH - getFixedAmount(71.23, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount(28.77, 2), // Remaining concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH + PARKING_INDOOR_16_DAYS_31MONTH,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_PRICE / MONTH_30) * 15, 2), // 15 days remaining concession from Sep
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH + PARKING_INDOOR_16_DAYS_31MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE,
      ...Array(3).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount(31, 2), // Remaining concession from Sep
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH - getFixedAmount(69, 2),
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH + getFixedAmount((PARKING_INDOOR_PRICE / 31) * 16, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH + getFixedAmount((PARKING_INDOOR_PRICE / 31) * 16, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH +
        UTILITIES_SUM_16_DAYS_31MONTH +
        PARKING_INDOOR_16_DAYS_31MONTH -
        getFixedAmount((PARKING_INDOOR_16_DAYS_31MONTH / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_PRICE / 100) * 10, 2)),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH +
        UTILITIES_SUM_15_DAYS_30MONTH +
        PARKING_INDOOR_15_DAYS_30MONTH -
        getFixedAmount((((PARKING_INDOOR_PRICE / MONTH_31) * 15) / 100) * 10, 2), // 15 days remaining from concession Mar
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH + PARKING_INDOOR_16_DAYS_31MONTH - getFixedAmount((100 / MONTH_31) * 16, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH - getFixedAmount((100 / MONTH_31) * 15, 2), // 15 days remaining from Mar
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH +
        UTILITIES_SUM_16_DAYS_31MONTH +
        PARKING_INDOOR_16_DAYS_31MONTH -
        getFixedAmount((PARKING_INDOOR_16_DAYS_31MONTH / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_PRICE / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_15_DAYS_31MONTH / 100) * 10, 2), // 15 days remaining concession from Mar
      ...Array(3).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_16TH_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH + UTILITIES_SUM_16_DAYS_31MONTH + PARKING_INDOOR_16_DAYS_31MONTH - getFixedAmount((100 / MONTH_31) * 16, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((100 / MONTH_31) * 15, 2), // 15 days remaining concession from Mar
      ...Array(3).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH + UTILITIES_SUM_15_DAYS_30MONTH + PARKING_INDOOR_15_DAYS_30MONTH,
    ]),
  },
];

export const MOVE_IN_ON_LAST_DAY_PARKING_INDOOR_WITH_CONCESSION_6M_CM = [
  {
    description: '1 Parking indoor fee with - one-time (applied to first period) - relative adjustment',
    leaseStartDate: '2017-03-31',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_PRICE / MONTH_31) * 30, 2), // 30 days remaining concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE, // 30 days Sep
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first period) - absolute adjustment',
    leaseStartDate: '2017-03-31',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'first',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH + getFixedAmount(PARKING_INDOOR_1_DAYS_31MONTH - getFixedAmount(4.45, 2), 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount(95.55, 2), // 30 days remaining concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE, // 30 days Sep
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - relative adjustment',
    leaseStartDate: '2017-03-31',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH + PARKING_INDOOR_1_DAYS_31MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to last period) - absolute adjustment',
    leaseStartDate: '2017-03-31',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'last',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH + PARKING_INDOOR_1_DAYS_31MONTH,
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100,
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first full month period) - relative adjustment',
    leaseStartDate: '2017-03-31',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: -100,
        absoluteAdjustment: null,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH + PARKING_INDOOR_1_DAYS_31MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE, // 30 days Sep
    ]),
  },
  {
    description: '1 Parking indoor fee with - one-time (applied to first full month period) - absolute adjustment',
    leaseStartDate: '2017-03-31',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: ONE_TIME,
        nonRecurringAppliedAt: 'firstFull',
        relativeAdjustment: null,
        absoluteAdjustment: -100,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH + PARKING_INDOOR_1_DAYS_31MONTH,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100,
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE, // 30 days Sep
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - relative adjustment',
    leaseStartDate: '2017-03-31',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH +
        UTILITIES_SUM_1_DAY_31MONTH +
        PARKING_INDOOR_1_DAYS_31MONTH -
        getFixedAmount((PARKING_INDOOR_1_DAYS_31MONTH / 100) * 10, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_PRICE / 100) * 10, 2)),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((((PARKING_INDOOR_PRICE / MONTH_31) * 30) / 100) * 10, 2),
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to all terms - absolute adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 0,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH + PARKING_INDOOR_1_DAYS_31MONTH - getFixedAmount((100 / MONTH_31) * 1, 2),
      ...Array(5).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((100 / MONTH_31) * 30, 2),
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 2 months - relative adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: -10,
        absoluteAdjustment: null,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH +
        UTILITIES_SUM_1_DAY_31MONTH +
        PARKING_INDOOR_1_DAYS_31MONTH -
        getFixedAmount((PARKING_INDOOR_1_DAYS_31MONTH / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((PARKING_INDOOR_PRICE / 100) * 10, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((((PARKING_INDOOR_PRICE / MONTH_31) * 30) / 100) * 10, 2), // 30 days remaining concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
    ]),
  },
  {
    description: '1 Parking indoor fee with - recurring applied to 2 months - absolute adjustment',
    leaseStartDate: '2017-03-16',
    paymentsForPeriods: generateBasePayments(START_ON_31ST_31_DAY_MONTH_6M, BASE_RENT_AMOUNT_2000),
    additionalCharges: generateUtilitiesAndParkingFeeWithConcessions([
      {
        name: RECURRING_CONCESSION,
        nonRecurringAppliedAt: null,
        relativeAdjustment: null,
        absoluteAdjustment: -100,
        recurringCount: 2,
        excludeFromRentFlag: false,
      },
    ]),
    paymentsResult: generatePaymentsResult([
      BASE_RENT_AMOUNT_2000_1_DAY_31MONTH + UTILITIES_SUM_1_DAY_31MONTH + PARKING_INDOOR_1_DAYS_31MONTH - getFixedAmount((100 / MONTH_31) * 1, 2),
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - 100,
      BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE - getFixedAmount((100 / MONTH_31) * 30, 2), // 30 days remaining concession from Mar
      ...Array(4).fill(BASE_RENT_AMOUNT_2000 + UTILITIES_SUM + PARKING_INDOOR_PRICE),
    ]),
  },
];
