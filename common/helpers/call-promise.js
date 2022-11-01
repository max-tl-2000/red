/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * run a function that have to notify when the process begins and ends.
 *
 * @method callPromise
 * @static
 * @param fn {Function} the function to call
 * @param inProgressProperty {String} the property name to update during the process
 * @param [ctx=undefined] {Object} the context on which this function will be executed
 */
export const callPromise = (fn, inProgressProperty, ctx) => {
  ctx[inProgressProperty] = true;

  const result = fn();
  result
    .then(() => {
      ctx[inProgressProperty] = false;
    }) // when done set it to false
    .catch(() => {
      ctx[inProgressProperty] = false;
    }); // when there are errors set it to false as well

  return result;
};
