/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import produce, { setAutoFreeze } from 'immer';
import stringify from 'json-stringify-safe';
import set from 'lodash/set';
import has from 'lodash/has';
import get from 'lodash/get';
import unset from 'lodash/unset';
import pick from 'lodash/pick';
import envVal from './env-val';
import { isMoment } from './moment-utils';
import { isObject } from './type-of';
import { isUrl, getUrlParamsValueMatcher } from '../regex';

const isLogTransformEnabled = envVal('ENABLE_LOG_TRANSFORM', 'true') === 'true';

const excludedFieldsEntries = ['sendSsnEnabled'];

export const privateLogEntries = ['password', 'socSecNumber', 'api-token', 'authorization_token'];

const useLogConsole = envVal('ENABLE_LOG_CONSOLE', 'false') === 'true';
const logConsole = {
  log: (...args) => useLogConsole && console.log(...args),
  error: (...args) => useLogConsole && console.error(...args),
};

// the values specify the field to remain from the object.
// e.g. "quote": { "id": "123", "quoteContent": "555" } would be reduced to "quote": { "id": "123"}
// if no value is defined, the field will be omitted completely
const LOG_PATHS_TO_OMIT = [
  'messageEntity.message',
  'emailInfo.ctx',
  'deliveryResponses',
  'responses',
  'eventResponse',
  'inventories',
  'payload.msgCtx',
  'commData.message',
];

const LOG_FIELDS_TO_COLLAPSE = ['cache', 'quote:id'];

export const logCtx = ctx => {
  const { tenantId, reqId, msgId, routingKey, retryCount, documentVersion, originalRequestIds, authUser, trx } = ctx || {};

  const { userId, fullName } = authUser || {};
  const { trxId } = trx || {};

  const outValues = {
    tenantId,
    reqId,
    msgId,
    routingKey,
    retryCount,
    documentVersion,
    originalRequestIds,
  };

  const retVal = Object.keys(outValues).reduce((acc, key) => {
    if (outValues[key] !== undefined) {
      acc[key] = outValues[key];
    }
    return acc;
  }, {});

  if (userId || fullName) {
    const aUser = {};
    if (userId) {
      aUser.userId = userId;
    }
    if (fullName) {
      aUser.fullName = fullName;
    }
    retVal.authUser = aUser;
  }

  if (trxId) {
    retVal.trx = { trxId };
  }

  return retVal;
};

export const OBSCURE_VALUE = 'REDACTED';

export const obscureUrl = (url = '', obscureQueryParams = privateLogEntries, replaceValue = `$1${OBSCURE_VALUE}$2`) =>
  url.replace(getUrlParamsValueMatcher(obscureQueryParams), replaceValue);

const isExcludedField = key => excludedFieldsEntries.includes(key);
const replaceValue = (key, value, properties) => {
  if (!isExcludedField(key) && properties.some(property => property && (property === key || key.toLowerCase().includes(property)))) {
    return OBSCURE_VALUE;
  }

  if (key.toLowerCase().includes('url') && isUrl(value)) {
    return obscureUrl(value);
  }

  return value;
};

const redactValuesInObjectIfNeeded = (obj, properties) => {
  if (!isObject(obj)) return obj;
  const keys = Object.keys(obj || {});

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = obj[key];
    if (!Array.isArray(value) && !isObject(value)) {
      obj[key] = replaceValue(key, value, properties);
    }

    if (isObject(value)) {
      obj[key] = redactValuesInObjectIfNeeded(value, properties);
    }

    if (Array.isArray(value)) {
      obj[key] = value.map(val => redactValuesInObjectIfNeeded(val, properties));
    }
  }

  return obj;
};

export const obscureObject = (obj, properties = privateLogEntries) => {
  if (!(obj && properties.length)) return obj;
  // we should consider to remove this as this makes the returned draft
  // not to be frozen, but our code currently modifies the returned object
  // from obscureObject in some places
  setAutoFreeze(false);
  return produce(obj, draft => redactValuesInObjectIfNeeded(draft, properties));
};

export const getSensitiveObject = obj => ({ sensitiveData: { ...obj } });

export const removeTokenFromObject = data => {
  const { token, ...rest } = data || {};
  return rest;
};

export const handleErrorObject = log => {
  const { err, error, ...rest } = log || {};
  return { ...rest, error: err || error };
};

// ensures that no field that is a valid Moment object ever gets serialized as an empty string
// This prevents ES from complaining when an empty string is passed into a mapped date field
const normalizeMomentField = (obj, key) => {
  const objValue = obj[key];
  if (isMoment(objValue)) {
    obj[key] = objValue.isValid() ? objValue.format('DD MMM, YYYY') : null;
    return true;
  }
  return false;
};

const stringifyIfArray = (obj, key) => {
  const objValue = obj[key];
  if (Array.isArray(objValue)) {
    obj[key] = stringify(objValue);
    return true;
  }
  return false;
};

// Removes any excluded paths  from the provided object, returning them in a map so they can be restored later
function removeExcludedPaths(obj) {
  const excludedObjs = [];
  // stash excludedPath objects
  LOG_PATHS_TO_OMIT.forEach(path => {
    if (has(obj, path)) {
      const val = get(obj, path);
      excludedObjs.unshift([path, val]);
      unset(obj, path);
    }
  });
  // logConsole.log(stringify({ excludedObjs }, null, 2));
  return excludedObjs;
}

const restoreModifiedPaths = (obj, modifiedPaths) => {
  // stash excludedPath objects
  modifiedPaths.forEach(([path, val]) => {
    if (val !== undefined) {
      set(obj, path, val);
    } else {
      unset(obj, path);
    }
  });
};

export const collapsedFieldReplacer = (key, value) => {
  // logConsole.log('collapsedFieldReplacer', { key, fullPath }); // stringifyvalue });
  const collapsedValue = LOG_FIELDS_TO_COLLAPSE.find(f => f.startsWith(key));

  if (collapsedValue && !!key) {
    logConsole.log('==== collapsedFieldReplacer found key', key); // , stringify(collapsedValue));
    const [_, replacementKey] = collapsedValue.split(':');
    logConsole.log('==== collapsedFieldReplacer found key', key); // , stringify(collapsedValue), replacementKey);
    return replacementKey === undefined ? undefined : pick(value, replacementKey);
  }
  return value;
};

// parentPath is array of keys qleading up to the root object
export const normalizeFields = (obj, parentPath = []) => {
  // console.log('normalizeFields', parentPath);
  const depth = parentPath.length;
  const savedFields = [];
  const fieldsToOmit = [];
  if (obj === null) {
    logConsole.log('normalizeFields got passed null obj - nothing to do');
    return [];
  }
  Object.keys(obj).forEach(key => {
    const objValue = obj[key];
    const fullPath = [...parentPath, key].join('.');
    // console.log(fullPath);
    let collapsedField;
    logConsole.log('handling key', fullPath, ' at depth', depth);
    logConsole.log(LOG_FIELDS_TO_COLLAPSE.find(f => f.startsWith(key)));
    if (normalizeMomentField(obj, key) || stringifyIfArray(obj, key)) {
      // console.log('pushing specifal field')
      savedFields.push([fullPath, objValue]);
    } else if (LOG_PATHS_TO_OMIT.includes(fullPath)) {
      // logConsole.log('PUSHING EXCLUDED FIELD');
      fieldsToOmit.push([key, objValue, fullPath]);
    } else if ((collapsedField = LOG_FIELDS_TO_COLLAPSE.find(f => f.startsWith(key)))) {  // eslint-disable-line
      // console.log('=====found omitable field', key, fullPath);
      const [_, replacementField] = collapsedField.split(':');
      // console.log('replacementField is',replacementField);
      if (replacementField) {
        // console.log('setting from replacementField');
        savedFields.push([fullPath, objValue]);
        obj[key] = objValue[replacementField];
      } else {
        // console.log('pushed key to fieldsToOmit');
        fieldsToOmit.push([key, obj[key], fullPath]);
      }
    } else if (typeof objValue === 'object') {
      // console.log('handling object at depth', depth);
      if (!depth) {
        // console.log('calling normalizeFields for obj');
        // logConsole.log('adding saved field for top-level object', fullPath, key);
        const newSavedField = normalizeFields(objValue, [...parentPath, key]);
        if (newSavedField.length) {
          savedFields.push(...newSavedField);
        }
      } else {
        // console.log('stringifying deep obj', key, fullPath);
        obj[key] = stringify(objValue, collapsedFieldReplacer);
        // console.log('back from stringifying deep obj', key, fullPath);
        // console.log('obj is now', stringify(obj));
        savedFields.push([fullPath, objValue]);
      }
    }
  });
  // console.log('clearing omitted fields');
  fieldsToOmit.forEach(([key, restoreValue, fullPath]) => {
    logConsole.log('OMITTING', key, fullPath);
    unset(obj, key);
    // logConsole.log(stringify(obj));
    savedFields.push([fullPath, restoreValue]);
  });

  // console.log('normalize returning savedFields')
  return savedFields;
};

// mutates the passed in "logs" object by:
// 1 - removing excluded paths
// 2 - replacing quote objects with quote ID
// 3 - stringifying any objects at level 2 or below
// 4 - stringifying arrays
// 5 - normalizing moment objects
// Because we mutate the passed in object, we have to restore it
// after the logs are emitted.  This is done by returning a restorer function to be called by the emit override
// after it has called the original emit function.
export const formatLogs = logs => {
  const pathsToRestore = [];
  const restorer = () => restoreModifiedPaths(logs, pathsToRestore);
  try {
    if (isLogTransformEnabled) {
      pathsToRestore.push(...removeExcludedPaths(logs), ...normalizeFields(logs));
    }
  } catch (e) {
    logConsole.log('ERROR in log transform!');
    logConsole.error('Error while transforming log entry', e);
    logs = { ...logs, orgMsg: logs.msg, orgLevel: logs.level, msg: 'UNFORMATTABLE LOG', loggingError: e.stack, level: 50 /* error */ };
  }
  return restorer;
};
