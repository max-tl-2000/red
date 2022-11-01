/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { hasOwnProp } from './objUtils';

export default function deepExtend(...args) {
  const out = args[0];

  for (let i = 1; i < args.length; i++) {
    const obj = args[i];

    if (!obj) continue; // eslint-disable-line

    // since we need to shortcircuit the loop
    // in this case we're using the restricted syntax
    // https://github.com/airbnb/javascript#iterators-and-generators

    // for-in loop is guarded by the hasOwnProp helper
    // eslint-disable-next-line guard-for-in
    for (const key in obj) {
      if (!hasOwnProp(out, key)) { // eslint-disable-line
        throw new Error(`key "${key}" is not present in the base object`);
      }

      if (!hasOwnProp(obj, key)) continue; // eslint-disable-line no-continue

      if (typeof obj[key] === 'object') {
        deepExtend(out[key], obj[key]);
      } else {
        out[key] = obj[key];
      }
    }
  }

  return out;
}
