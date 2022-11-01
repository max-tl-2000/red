/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import tryParse from './try-parse';
import nullish from './nullish';
import { process } from './globals';

/**
 * @method envVal retrieves the value of a env variable
 * and try to parse it as a javascript value
 *
 * If the value is null-ish it will return the default value
 */
export default function envVal(key, defaultVal) {
  const val = process?.env[key];

  if (nullish(val) || val === '') {
    return defaultVal;
  }
  // in case of failure we want the original string
  // as it might be a simple string not representing a JSON object
  return tryParse(val, val);
}
