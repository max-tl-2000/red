/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { RentappTypes } from '../enums/rentapp-types';

const WEEKS_IN_A_MONTH = 4.2;

export const getGrossIncomeMonthly = ({ grossIncome, grossIncomeFrequency }) => {
  switch (grossIncomeFrequency) {
    case RentappTypes.TimeFrames.YEARLY:
      return Math.round(grossIncome / 12);
    case RentappTypes.TimeFrames.WEEKLY:
      return Math.round(grossIncome * WEEKS_IN_A_MONTH);
    case RentappTypes.TimeFrames.MONTHLY:
    default:
      return grossIncome;
  }
};
