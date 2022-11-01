/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const typeSizes = {
  undefined: () => 0,
  boolean: () => 4,
  number: () => 8,
  string: obj => 2 * obj.length,
  object: obj => Object.keys(obj || {}).reduce((total, key) => sizeOfObj(key) + sizeOfObj(obj[key]) + total, 0), // eslint-disable-line
};

const sizeOfObj = value => typeSizes[typeof value](value);

export const size = obj => sizeOfObj(obj);

export const sortObject = obj =>
  Object.keys(obj)
    .sort()
    .reduce(
      (acc, key) => ({
        ...acc,
        [key]: obj[key],
      }),
      {},
    );
