/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import accounting from 'accounting';
import * as Currency from './currency';
import nullish from './helpers/nullish';

export const formatMoney = ({ currency, amount }) => {
  const { symbol, decimal_digits: precision } = Currency[currency];
  const sign = amount < 0 ? '-' : '';
  const result = `${sign}${accounting.formatMoney(Math.abs(amount), { symbol, precision })}`;
  const integerPart = result.slice(0, result.length - (precision + 1));
  const decimalPart = result.slice(-1 * precision);

  return {
    decimalPart,
    integerPart,
    result,
  };
};

export const formatToMoneyString = amount => formatMoney({ amount, currency: Currency.USD.code }).result;

export const formatNumber = (amount, { precision = 2, thousand = ',', decimal = '.' } = {}) => {
  if (nullish(amount)) return amount;
  return accounting.formatNumber(amount, { precision, thousand, decimal });
};

export const convertToFloat = value => parseFloat(`${value}`.replace(/,/g, ''));

export class ParseableNumber {
  constructor(value, options = {}) {
    this.value = value;
    this.options = options;
  }

  setOptions(opts) {
    this.options = { ...this.options, opts };
  }

  get isValid() {
    const parsedValue = this.parsedValue;
    return !isNaN(parsedValue);
  }

  get parsedValue() {
    if (nullish(this.value)) return null;
    return convertToFloat(this.value);
  }

  isEqual(otherNumber) {
    if (!otherNumber) return false;
    return this.isValid === otherNumber.isValid && this.formatted === otherNumber.formatted;
  }

  get formatted() {
    if (!this.isValid) return '';
    return formatNumber(this.value);
  }

  static create(value, options) {
    return new ParseableNumber(value, options);
  }
}

export { Currency };
