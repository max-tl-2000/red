/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const publicRoutes = new Proxy(
  {},
  {
    get(obj, prop) {
      obj.__cache = obj.__cache || {};
      if (!obj.__cache[prop]) {
        obj.__cache[prop] = (...args) => {
          const module = require('./public');
          const fn = module[prop];
          return fn(...args);
        };
      }
      return obj.__cache[prop];
    },
  },
);
