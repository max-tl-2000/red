/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const cache = {};

export const requiresRight = right => (...args) => {
  let fn = cache[right];

  if (!fn) {
    const authorization = require('./authorization');
    fn = authorization.requiresRight(right);
    cache[right] = fn;
  }

  return fn(...args);
};
