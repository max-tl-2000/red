/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import hasha from 'hasha';
import { isString, isObject } from '../helpers/type-of';

export const HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION = 'HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION';

const throwTypeError = () => {
  throw new Error(HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
};

const hash = (val, opts = { algorithm: 'md5' }) => hasha(val, opts);

export const getStringHash = val => {
  !isString(val) && throwTypeError();
  return hash(val);
};

export const getObjectHash = obj => {
  !isObject(obj) && throwTypeError();
  return getStringHash(JSON.stringify(obj));
};

export const getQueryHash = query => {
  const isObj = isObject(query);
  !isString(query) && !isObj && throwTypeError();

  const queryToHash = isObj ? query.toString() : query;

  return getStringHash(queryToHash);
};
