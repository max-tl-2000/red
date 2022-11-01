/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const fns = ['mapOriginalName', 'forbiddenOnCorporate', 'forbiddenOnProd', 'replacePersonIdForMergedPerson', 'ignoreBot'];

export const middleware = new Proxy(
  {},
  {
    get(obj, prop) {
      obj.__cache = obj.__cache || {};
      if (!obj.__cache[prop]) {
        if (fns.includes(prop)) {
          obj.__cache[prop] = (...args) => {
            const module = require('./middleware');
            const fn = module[prop];
            if (typeof fn !== 'function') throw new Error(`${prop} is not a function`);
            return fn(...args);
          };
        } else {
          obj.__cache[prop] = (...args) => (...innerArgs) => {
            const module = require('./middleware');
            const fn = module[prop];
            if (typeof fn !== 'function') throw new Error(`${prop} is not a function`);
            return fn(...args)(...innerArgs);
          };
        }
      }
      return obj.__cache[prop];
    },
  },
);
