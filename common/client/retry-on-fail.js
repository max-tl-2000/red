/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const retryOnFail = (func, { maxAttempts = 2, onFail, fnName = 'annonymous' } = {}) => {
  if (typeof func !== 'function') throw new Error('Parameter `func` has to be a function');
  if (typeof onFail !== 'function') throw new Error('Parameter `next` has to be a function');

  let attemptNo = 0;
  let prevError;

  const doTry = async () => {
    attemptNo++;
    if (attemptNo > maxAttempts) {
      const msg = `Max number of attemps reached: ${maxAttempts} on "${fnName}" fn`;
      console.warn(msg);
      throw prevError || new Error(msg);
    }
    try {
      return await func();
    } catch (error) {
      prevError = error;
      return await onFail(error, doTry, { attemptNo, fnName });
    }
  };

  return doTry();
};
