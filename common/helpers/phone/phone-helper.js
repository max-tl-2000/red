/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { parse, format, isValidNumber } from './libphone';
import trim from '../trim';

const normalizePrefix = (phoneNumber, countryCode = '1') => {
  phoneNumber = trim(phoneNumber);

  let res;

  if (phoneNumber.match(/^\+/)) {
    res = phoneNumber;
  } else if (phoneNumber.startsWith('00')) {
    res = `+${phoneNumber.slice(2)}`;
  } else {
    res = `+${countryCode}${phoneNumber}`;
  }

  return res.replace(/\*/g, '');
};

export const parsePhone = phoneNumber => {
  let number = normalizePrefix(phoneNumber, '1');

  let parsedPhone = parse(number);

  let valid = isValidNumber(parsedPhone);

  if (!valid) {
    // if failed maybe it already contained the country code
    // so we pass the prefix as empty. This seems to be a mistake, but
    // unit tests were considering this case so I will just follow suit
    number = normalizePrefix(phoneNumber, '');
    parsedPhone = parse(number);
    valid = isValidNumber(parsedPhone);
  }

  let international = '';
  let national = '';
  let normalized = '';

  if (valid) {
    international = format(parsedPhone, 'INTERNATIONAL');
    national = format(parsedPhone, 'NATIONAL');
    normalized = format(parsedPhone, 'E.164');
  }

  return {
    country: (parsedPhone || {}).country,
    valid,
    international,
    national,
    normalized,
  };
};

export const isValidPhoneNumber = number => {
  const { valid } = parsePhone(number) || {};
  return valid;
};

export const formatPhoneNumber = number => {
  const { normalized } = parsePhone(number) || {};
  return normalized;
};

export const formatPhoneToDisplay = number => {
  const { country, international, national, valid } = parsePhone(number) || {};
  if (!valid) {
    return number; // if not valid just return the number itself
  }
  return country === 'US' ? national : international;
};
