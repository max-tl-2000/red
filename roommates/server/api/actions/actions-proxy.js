/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolve } from 'path';

import exportsInActionIndex from './generated-actions-requires.json';

export const requireFromActions = prop => {
  const exported = exportsInActionIndex[prop];
  if (!exported) {
    throw new Error(`export not found: ${prop} in index.js`);
  }
  const exportedName = exported.localName || prop;
  const mod = require(resolve(__dirname, exported.module));
  return exported.default ? mod.default || mod : mod[exportedName];
};

export const actions = new Proxy(
  {},
  {
    get(obj, prop) {
      obj.__cache = obj.__cache || {};
      if (!obj.__cache[prop]) {
        obj.__cache[prop] = (...args) => {
          const fn = requireFromActions(prop);
          if (!fn) throw new Error(`Cannot find module ${prop} in ./actions`, prop);
          if (typeof fn !== 'function') throw new Error(`${prop} is not function`);
          return fn(...args);
        };
      }
      return obj.__cache[prop];
    },
  },
);
