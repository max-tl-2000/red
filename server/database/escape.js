/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mapValues from 'lodash/mapValues';
import stringify from 'json-stringify-safe';

import { isObject } from '../../common/helpers/type-of';

const doEscapeSingleQuotes = (value, processed) => {
  if (typeof value === 'string') return value.replace(/'/g, "''");

  const isArray = Array.isArray(value);
  const isObj = isObject(value);

  if (isArray || isObj) {
    if (processed.has(value)) {
      return value;
    }

    processed.add(value);
  }

  if (Array.isArray(value)) return value.map(entry => doEscapeSingleQuotes(entry, processed));
  if (value && typeof value === 'object') return mapValues(value, entry => doEscapeSingleQuotes(entry, processed));
  return value;
};

export const escapeSingleQuotes = value => doEscapeSingleQuotes(value, new WeakSet());

export const serializeAndEscapeSingleQuotes = value => {
  let hasCycles = false;

  const cycleDetector = () => {
    hasCycles = true;
    return 'Circular';
  };

  const serialized = stringify(escapeSingleQuotes(value), null, 0, cycleDetector);

  return { hasCycles, serialized };
};
