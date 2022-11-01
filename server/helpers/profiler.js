/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isFunction from 'lodash/isFunction';
import logger from '../../common/helpers/logger';

let logProfilingResult = (info, duration) => logger.info(`'${info}' took ${duration} milliseconds to execute`);

export const setLoggingFunction = f => (logProfilingResult = f);

const isPromise = p => p && isFunction(p.then);

export const toProfiledFunction = (func, funcInfo) => {
  if (!isFunction(func)) throw new Error('parameter is not a function');

  return async (...args) => {
    const start = new Date().getTime();
    // for some reason spreading `func(...args)` does not work with async functions
    let res = func.apply(null, args); // eslint-disable-line prefer-spread
    if (isPromise(res)) res = await res;

    const end = new Date().getTime();
    const info = funcInfo || func.name || (func.toString().match(/function [^(]*/) || [])[0] || 'anonymous';
    logProfilingResult(info, end - start);
    return res;
  };
};

export const toObjectWithProfiledFunctions = object => {
  Object.keys(object)
    .filter(key => isFunction(object[key]))
    .forEach(key => (object[key] = toProfiledFunction(object[key], key)));
  return object;
};
