/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * return the first defined element. This is different from `coalescy`
 * which will return null in case of no defined element found. We need
 * to be able to return undefined if that happen to be the initialValue
 *
 * @param {Array<any>} args
 * @returns
 */
const clsc = (...args) => {
  let result;

  for (let i = 0, len = args.length; i < len; i++) {
    const current = args[i];
    if (typeof current !== 'undefined' && current !== null) {
      result = current;
      break;
    }
  }

  return result;
};

export default clsc;
