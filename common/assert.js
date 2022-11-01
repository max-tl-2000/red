/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import nullish from './helpers/nullish';
import { toHumanReadableString } from './helpers/strings';

export const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

export const assertLog = (condition, logger, message) => {
  if (!condition) logger.error(message);
};

export const nonNullishProps = (obj, props = []) => {
  const missingProps = props.reduce((acc, key) => {
    nullish(get(obj, key)) && acc.push(key);
    return acc;
  }, []);

  if (missingProps.length) throw new Error(`Invalid or missing value for ${toHumanReadableString(missingProps)}.`);
  return true;
};
