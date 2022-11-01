/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const MONTH_30 = 30;
const ADJUSTED_MARKET_RENT = 3000;

const generateLeaseTerm = (leaseEndDate, leaseTermLength) => {
  const leaseTerm = {
    adjustedMarketRent: ADJUSTED_MARKET_RENT,
    period: 'month',
    endDate: leaseEndDate,
    termLength: leaseTermLength,
  };
  return leaseTerm;
};

const MOVE_IN_ON_FIRST_6M = [
  {
    leaseStartDate: '2017-01-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-06-30', 6),
  },
  {
    leaseStartDate: '2017-02-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-07-31', 6),
  },
  {
    leaseStartDate: '2017-03-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-08-31', 6),
  },
  {
    leaseStartDate: '2017-04-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-09-30', 6),
  },
  {
    leaseStartDate: '2017-05-01',
    billableDays: MONTH_30,
    moveOut: '2017-10-31',
    leaseTerm: generateLeaseTerm('2017-10-31', 6),
  },
  {
    leaseStartDate: '2017-06-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-11-30', 6),
  },
  {
    leaseStartDate: '2017-07-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-12-31', 6),
  },
  {
    leaseStartDate: '2017-08-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-01-31', 6),
  },
  {
    leaseStartDate: '2017-09-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-02-28', 6),
  },
  {
    leaseStartDate: '2017-10-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-03-31', 6),
  },
  {
    leaseStartDate: '2017-11-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-04-30', 6),
  },
  {
    leaseStartDate: '2017-12-01',
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-05-31', 6),
  },
];

const MOVE_OUT_ON_LAST_6M = [
  {
    leaseStartDate: '2017-01-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2017-07-29', 6),
  },
  {
    leaseStartDate: '2017-01-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-07-30', 6),
  },
  {
    leaseStartDate: '2017-02-28',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 3, // 3 billableDaysIn
    billableDaysIn: 3,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 27, // 27 billableDaysOut
    billableDaysOut: 27,
    leaseTerm: generateLeaseTerm('2017-08-27', 6),
  },
  {
    leaseStartDate: '2017-03-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2017-09-29', 6),
  },
  {
    leaseStartDate: '2017-03-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-09-30', 6),
  },
  {
    leaseStartDate: '2017-04-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2017-10-29', 6),
  },
  {
    leaseStartDate: '2017-05-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2017-11-29', 6),
  },
  {
    leaseStartDate: '2017-05-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-11-30', 6),
  },
  {
    leaseStartDate: '2017-06-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2017-12-29', 6),
  },
  {
    leaseStartDate: '2017-07-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2018-01-29', 6),
  },
  {
    leaseStartDate: '2017-07-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-01-30', 6),
  },
  {
    leaseStartDate: '2017-08-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-02-28', 6),
  },
  {
    leaseStartDate: '2017-09-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2018-03-29', 6),
  },
  {
    leaseStartDate: '2017-10-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-04-30', 6),
  },
  {
    leaseStartDate: '2017-11-30',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysOut
    billableDaysOut: 29,
    leaseTerm: generateLeaseTerm('2018-05-29', 6),
  },
  {
    leaseStartDate: '2017-12-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2018-06-30', 6),
  },
];

const MOVE_IN_ON_LAST_FEBRUARY_LEAP_YEAR_6M = [
  {
    leaseStartDate: '2020-02-28',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 3, // 3 billableDaysIn
    billableDaysIn: 3,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 27, // 27 billableDaysOut
    billableDaysOut: 27,
    leaseTerm: generateLeaseTerm('2020-08-27', 6),
  },
  {
    leaseStartDate: '2020-02-29',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 2, // 2 billableDaysIn
    billableDaysIn: 2,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 28, // 28 billableDaysOut
    billableDaysOut: 28,
    leaseTerm: generateLeaseTerm('2020-08-28', 6),
  },
];

const MOVE_IN_ON_FIRST_LEAP_YEAR_6M = [
  {
    leaseStartDate: '2020-09-01',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysIn
    billableDaysIn: MONTH_30,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2020-02-29', 6),
  },
];

const MOVE_IN_ON_OTHER_DATES_LEAP_YEAR_6M = [
  {
    leaseStartDate: '2019-09-02',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysIn
    billableDaysIn: 29,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2020-03-01', 6),
  },
  {
    leaseStartDate: '2019-08-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2020-02-29', 6),
  },
];

const MOVE_IN_OTHER_DATES_NON_LEAP_YEAR_6M = [
  {
    leaseStartDate: '2017-09-02',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysIn
    billableDaysIn: 29,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2018-03-01', 6),
  },
  {
    leaseStartDate: '2017-01-15',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 16, // 16 billableDaysIn
    billableDaysIn: 16,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 14, // 28 billableDaysOut
    billableDaysOut: 14,
    leaseTerm: generateLeaseTerm('2017-07-14', 6),
  },
  {
    leaseStartDate: '2017-06-29',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 2, // 2 billableDaysIn
    billableDaysIn: 2,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 28, // 28 billableDaysOut
    billableDaysOut: 28,
    leaseTerm: generateLeaseTerm('2017-12-28', 6),
  },
  {
    leaseStartDate: '2017-06-10',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 21, // 21 billableDaysIn
    billableDaysIn: 21,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 9, // 9 billableDaysOut
    billableDaysOut: 9,
    leaseTerm: generateLeaseTerm('2017-12-09', 6),
  },
];

const MOVE_IN_ON_FIRST_1M = [
  {
    leaseStartDate: '2017-01-01',
    amount: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysIn
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-01-31', 1),
  },
];

const MOVE_IN_ON_SECOND_1M = [
  {
    leaseStartDate: '2017-01-02',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysIn
    billableDaysIn: 29,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2017-02-01', 1),
  },
];

const MOVE_IN_ON_LAST_1M = [
  {
    leaseStartDate: '2017-07-31',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysIn
    billableDaysIn: 1,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysOut
    billableDaysOut: MONTH_30,
    leaseTerm: generateLeaseTerm('2017-08-30', 1),
  },
  {
    leaseStartDate: '2017-02-28',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 3, // 3 billableDaysIn
    billableDaysIn: 3,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 27, // 27 billableDaysOut
    billableDaysOut: 27,
    leaseTerm: generateLeaseTerm('2017-03-27', 1),
  },
];

const MOVE_IN_ON_FIRST_FEBRUARY_LEAP_YEAR_1M = [
  {
    leaseStartDate: '2020-02-01',
    amount: (ADJUSTED_MARKET_RENT / MONTH_30) * MONTH_30, // 30 billableDaysIn
    billableDays: MONTH_30,
    leaseTerm: generateLeaseTerm('2020-02-29', 1),
  },
];

const MOVE_IN_ON_SECOND_FEBRUARY_LEAP_YEAR_1M = [
  {
    leaseStartDate: '2020-02-02',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysIn
    billableDaysIn: 29,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2020-03-01', 1),
  },
];

const MOVE_IN_ON_DATES_NON_LEAP_YEAR_1M = [
  {
    leaseStartDate: '2017-02-02',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 29, // 29 billableDaysIn
    billableDaysIn: 29,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 1, // 1 billableDaysOut
    billableDaysOut: 1,
    leaseTerm: generateLeaseTerm('2017-03-01', 1),
  },
  {
    leaseStartDate: '2017-02-03',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 28, // 28 billableDaysIn
    billableDaysIn: 28,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 2, // 2 billableDaysOut
    billableDaysOut: 2,
    leaseTerm: generateLeaseTerm('2017-03-02', 1),
  },
  {
    leaseStartDate: '2017-03-05',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 26, // 26 billableDaysIn
    billableDaysIn: 26,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 4, // 4 billableDaysOut
    billableDaysOut: 4,
    leaseTerm: generateLeaseTerm('2017-04-04', 1),
  },
  {
    leaseStartDate: '2017-04-20',
    amountIn: (ADJUSTED_MARKET_RENT / MONTH_30) * 11, // 11 billableDaysIn
    billableDaysIn: 11,
    amountOut: (ADJUSTED_MARKET_RENT / MONTH_30) * 19, // 19 billableDaysOut
    billableDaysOut: 19,
    leaseTerm: generateLeaseTerm('2017-05-19', 1),
  },
];

export {
  MOVE_IN_ON_FIRST_6M,
  MOVE_OUT_ON_LAST_6M,
  MOVE_IN_ON_LAST_FEBRUARY_LEAP_YEAR_6M,
  MOVE_IN_ON_FIRST_LEAP_YEAR_6M,
  MOVE_IN_OTHER_DATES_NON_LEAP_YEAR_6M,
  MOVE_IN_ON_OTHER_DATES_LEAP_YEAR_6M,
  MOVE_IN_ON_FIRST_1M,
  MOVE_IN_ON_LAST_1M,
  MOVE_IN_ON_SECOND_1M,
  MOVE_IN_ON_FIRST_FEBRUARY_LEAP_YEAR_1M,
  MOVE_IN_ON_SECOND_FEBRUARY_LEAP_YEAR_1M,
  MOVE_IN_ON_DATES_NON_LEAP_YEAR_1M,
};
