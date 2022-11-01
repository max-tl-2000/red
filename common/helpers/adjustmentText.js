/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { getFixedAmount } from './number';
import { formatMoney } from '../money-formatter';
import { USD } from '../currency';
import { DALTypes } from '../enums/DALTypes';

const shortPeriods = {
  year: 'y',
  week: 'w',
  month: 'm',
  day: 'd',
  hour: 'h',
};

const calculateAdjustmentValue = concession => {
  const { absoluteAdjustment, relativeAmount, amountVariableAdjustment, floorCeilingAmount } = concession;

  let adjustment = 0;

  if (amountVariableAdjustment > 0) {
    adjustment = amountVariableAdjustment;
  } else if (floorCeilingAmount > 0) {
    adjustment = floorCeilingAmount;
  } else if (relativeAmount) {
    adjustment = relativeAmount;
  } else if (parseFloat(absoluteAdjustment) !== 0) {
    adjustment = Math.abs(absoluteAdjustment);
  }

  return getFixedAmount(adjustment, 2);
};

const getShortPeriodFor = period => (period && shortPeriods[period]) || period;

export const adjustmentText = (concession, term) => {
  // *** This is where we need the override value
  const { recurringCount } = concession;

  const shortPeriod = getShortPeriodFor(term.period);
  const adjustmentValue = calculateAdjustmentValue(concession);
  const { result: formattedAdjustmentValue } = formatMoney({
    amount: adjustmentValue,
    currency: USD.code,
  });
  const adjustment = `(${formattedAdjustmentValue}${t('PER_PERIOD', {
    period: shortPeriod,
  })}`;

  const count = recurringCount > 0 ? recurringCount : term.termLength;

  return `${adjustment} ${t('FOR_PERIOD', {
    length: count,
    period: shortPeriod,
  })})`;
};

export const getStartingAtPriceText = (marketRent, term = { termLength: 12, period: DALTypes.LeasePeriod.MONTH }, appendPeriodInfo = true) => {
  const { integerPart, decimalPart } = formatMoney({
    amount: marketRent,
    currency: USD.code,
  });
  const startingAtPriceText = t('STARTING_AT', {
    integerPart,
    decimalPart,
  });
  if (!appendPeriodInfo) return startingAtPriceText;

  const shortPeriod = getShortPeriodFor(term.period);
  const shortPreiordText = t('PER_PERIOD', { period: shortPeriod });
  const forPeriodText = `${shortPreiordText} ${t('FOR_PERIOD', {
    length: term.termLength,
    period: shortPeriod,
  })}`;

  return `${startingAtPriceText}${forPeriodText}`;
};
