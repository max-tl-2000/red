/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

function isEmpty(value) {
  return (!value && value !== 0) || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0);
}

function objectToPairs(obj, parentKey = null, acc = []) {
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const currentKey = parentKey ? `${parentKey}-${key}` : key;

    if (isEmpty(value)) return;

    if (Array.isArray(value)) {
      value.forEach(v => acc.push(`${currentKey}=${encodeURIComponent(v)}`));
    } else if (typeof value === 'string') {
      acc.push(`${currentKey}=${encodeURIComponent(value)}`);
    } else if (Object.keys(value).length > 0) {
      objectToPairs(value, currentKey, acc);
    } else {
      acc.push(`${currentKey}=${encodeURIComponent(value)}`);
    }
  });
  return acc;
}

export function objectToQueryString(obj) {
  return objectToPairs(obj).join('&');
}

/*
 * @param {string} pair
 *
 * examples:
 *    "foo=1" => { foo: 1 }
 *    "foo-bar-baz=1" => { foo: { bar: { baz: 1 } } }
 */
function pairToObject(pair) {
  const [key, value] = pair.split('=');
  const nestedKeys = key.split('-');

  // no nested keys, just a regular pair
  if (nestedKeys.length === 1) {
    return {
      [key]: value,
    };
  }

  // we want to start from the innermost key
  nestedKeys.reverse();
  return nestedKeys.reduce((acc, _key, index) => ({ [_key]: index === 0 ? value : acc }), {});
}

export function queryStringToObject(qs) {
  return qs.split('&').reduce((acc, pair) => {
    const obj = pairToObject(pair);
    const key = Object.keys(obj)[0];
    // if key exists, convert it into an array
    if ({}.hasOwnProperty.call(acc, key)) {
      acc[key] = Array.concat.apply([], [acc[key], obj[key]]);
      return acc;
    }
    return Object.assign(acc, pairToObject(pair));
  }, {});
}
