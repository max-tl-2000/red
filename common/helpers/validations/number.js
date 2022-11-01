/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DECIMAL_NUMBER, NUMBER } from '../../regex';
import { now } from '../moment-utils';

const removeCommasFromNumber = numberStr => numberStr.replace(/,/g, '');

export const isNumberValid = numberStr => {
  const numberWithoutCommas = removeCommasFromNumber(numberStr);
  if (!numberWithoutCommas.match(DECIMAL_NUMBER)) {
    return false;
  }
  const num = parseFloat(numberWithoutCommas);
  return typeof num === 'number' && !isNaN(num);
};

const YEARS_IN_THE_FUTURE = 2;

export const isVehicleMakeYearValid = (numberStr, yearsInFuture = YEARS_IN_THE_FUTURE) => {
  const numberWithoutCommas = removeCommasFromNumber(numberStr);
  if (!numberWithoutCommas.match(NUMBER)) return false;

  const num = parseInt(numberWithoutCommas, 10);
  return num >= 1900 && num <= now().year() + yearsInFuture;
};
