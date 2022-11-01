/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { MONTH_31, MONTH_30, NON_LEAP_YEAR_FEB_DAYS } from './quotes-concessions-commons-test';

const FULL_MONTHS_FROM_MAY_TO_AUG_CM = [
  { timeframe: 'May 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Jun 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'Jul 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Aug 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
];

export const START_ON_1ST_30_DAY_MONTH_6M = [
  { timeframe: 'Apr 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_MAY_TO_AUG_CM,
  { timeframe: 'Sep 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
];

export const START_ON_16TH_30_DAY_MONTH_6M = [
  { timeframe: 'Apr 2017', billableDays: 15, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_MAY_TO_AUG_CM,
  { timeframe: 'Sep 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'Oct 2017', billableDays: 15, daysInMonth: MONTH_31 },
];

export const START_ON_30TH_30_DAY_MONTH_6M = [
  { timeframe: 'Apr 2017', billableDays: 1, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_MAY_TO_AUG_CM,
  { timeframe: 'Sep 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'Oct 2017', billableDays: 29, daysInMonth: MONTH_31 },
];

export const START_ON_1ST_31_DAY_MONTH_6M = [
  { timeframe: 'Mar 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Apr 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_MAY_TO_AUG_CM,
];

export const START_ON_16TH_31_DAY_MONTH_6M = [
  { timeframe: 'Mar 2017', billableDays: 16, daysInMonth: MONTH_31 },
  { timeframe: 'Apr 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_MAY_TO_AUG_CM,
  { timeframe: 'Sep 2017', billableDays: 15, daysInMonth: MONTH_30 },
];

export const START_ON_31ST_31_DAY_MONTH_6M = [
  { timeframe: 'Mar 2017', billableDays: 1, daysInMonth: MONTH_31 },
  { timeframe: 'Apr 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_MAY_TO_AUG_CM,
  { timeframe: 'Sep 2017', billableDays: 30, daysInMonth: MONTH_30 },
];

const FULL_MONTHS_FROM_OCT_TO_FEB = [
  { timeframe: 'Oct 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Nov 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 },
  { timeframe: 'Dec 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  { timeframe: 'Jan 2017', billableDays: MONTH_31, daysInMonth: MONTH_31 },
  {
    timeframe: 'Feb 2018',
    billableDays: NON_LEAP_YEAR_FEB_DAYS,
    daysInMonth: NON_LEAP_YEAR_FEB_DAYS,
  },
];

export const START_ON_SEP_1ST_30_DAY_MONTH_6M = [{ timeframe: 'Sep 2017', billableDays: MONTH_30, daysInMonth: MONTH_30 }, ...FULL_MONTHS_FROM_OCT_TO_FEB];

export const START_ON_SEP_16TH_30_DAY_MONTH_6M = [
  { timeframe: 'Sep 2017', billableDays: 15, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_OCT_TO_FEB,
  { timeframe: 'Mar 2018', billableDays: 15, daysInMonth: MONTH_31 },
];

export const START_ON_SEP_25TH_30_DAY_MONTH_6M = [
  { timeframe: 'Sep 2017', billableDays: 6, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_OCT_TO_FEB,
  { timeframe: 'Mar 2018', billableDays: 24, daysInMonth: MONTH_31 },
];

export const START_ON_SEP_5TH_30_DAY_MONTH_6M = [
  { timeframe: 'Sep 2017', billableDays: 26, daysInMonth: MONTH_30 },
  ...FULL_MONTHS_FROM_OCT_TO_FEB,
  { timeframe: 'Mar 2018', billableDays: 4, daysInMonth: MONTH_31 },
];
