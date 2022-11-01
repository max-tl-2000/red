/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import metadata from 'libphonenumber-js/metadata.min.json';
import parseCustom from 'libphonenumber-js/build/parse';
import formatCustom from 'libphonenumber-js/build/format';
import isValidNumberCustom from 'libphonenumber-js/build/validate';

export const parse = (...args) => {
  args.push(metadata);
  return parseCustom(...args);
};

export const format = (...parameters) => {
  parameters.push(metadata);
  return formatCustom(...parameters);
};

export const isValidNumber = (...parameters) => {
  parameters.push(metadata);
  return isValidNumberCustom(...parameters);
};

export const getPhoneCode = country => {
  if (!metadata.countries[country]) {
    throw new Error(`Unknown country: "${country}"`);
  }
  // phone code is the first index
  return metadata.countries[country][0];
};
