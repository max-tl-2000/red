/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const cache = [];

export const restore = () => cache.forEach(ins => ins.restore());

export const create = (obj, allowNonExistentProps) => {
  const originals = {};
  const ins = {
    override(prop, newProp) {
      if (!(prop in obj) && !allowNonExistentProps) {
        throw new Error('Only properties that exist could be overriden');
      }
      const objMethod = obj[prop];

      if (!originals[prop]) {
        originals[prop] = objMethod;
      }

      obj[prop] = newProp;
    },
    restore() {
      const keys = Object.keys(originals);
      keys.forEach(key => {
        obj[key] = originals[key];
      });
    },
  };

  cache.push(ins);

  return ins;
};

export const override = (obj, propsToOverride, allowNonExistentProps) => {
  const ov = create(obj, allowNonExistentProps);
  Object.keys(propsToOverride).forEach(key => ov.override(key, propsToOverride[key]));
  return ov;
};
