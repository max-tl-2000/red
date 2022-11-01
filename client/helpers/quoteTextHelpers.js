/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';

export const trans = {
  year: 'YEAR',
  week: 'WEEK',
  month: 'MONTH',
  day: 'DAY',
  hour: 'HOUR',
};

export const periodText = term => {
  const { termLength, period } = term;
  return t(trans[period] + ((termLength !== 1 && 'S') || ''));
};

export const termText = term => {
  const { termLength } = term;
  const period = periodText(term);
  return `${termLength} ${period}`;
};
