/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const getHumanRep = (value, { decimals = 1, showFirstSignificative = true, maxDecimals = 5 } = {}) => {
  value = parseFloat(value);

  if (isNaN(value) || !isFinite(value)) return ''; // what to do in this case???

  if (value === 0) return '0';

  const defValue = value.toFixed(decimals);

  const isInteger = Number.isInteger(value);
  if (!showFirstSignificative || isInteger) return defValue;

  const valueAsString = `${value}`;
  const [, decPart] = valueAsString.split('.');

  const match = decPart.match(/[1-9]/);

  if (!match) {
    return defValue;
  }

  const decimalsPosition = Math.min(match.index + 1, maxDecimals);
  return value.toFixed(decimalsPosition);
};

export const isNumber = n => !isNaN(parseFloat(n)) && isFinite(n);

export const getFixedAmount = (amount, decimalDigits) => {
  const fixedAmount = parseFloat(amount).toFixed(decimalDigits);

  return parseFloat(fixedAmount);
};

export const getMinValue = (...args) => {
  const numbers = args.map(it => (it ? Number(it) : null)).filter(it => it);
  return numbers.reduce((min, value) => (value < min ? value : min), numbers[0]);
};
