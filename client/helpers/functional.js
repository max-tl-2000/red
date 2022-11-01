/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export function once(fn) {
  let alreadyCalled = false;
  let memoizedResult = null;

  return function innerOnce(...args) {
    if (alreadyCalled) {
      return memoizedResult;
    }

    alreadyCalled = true;
    memoizedResult = fn.apply(this, args);
    fn = null; // eslint-disable-line

    return memoizedResult;
  };
}
