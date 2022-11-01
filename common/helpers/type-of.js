/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// code for `typeOf` borrowed from `jQuery.type`
// to avoid including jquery only to have this
const class2type = {};

const types = ['Boolean', 'Number', 'String', 'Function', 'Array', 'Date', 'RegExp', 'Object'];

const toStr = Object.prototype.toString;

types.forEach(name => {
  class2type[`[object ${name}]`] = name.toLowerCase();
});

export default function typeOf(obj) {
  if (typeof obj === 'undefined') {
    return 'undefined';
  }
  return obj === null ? String(obj) : class2type[toStr.call(obj)] || 'object';
}

export const isBoolean = arg => typeOf(arg) === 'boolean';
export const isNumber = arg => typeOf(arg) === 'number';
export const isString = arg => typeOf(arg) === 'string';
export const isFunction = arg => typeOf(arg) === 'function';
export const isArray = arg => typeOf(arg) === 'array';
export const isDate = arg => typeOf(arg) === 'date';
export const isRegExp = arg => typeOf(arg) === 'regexp';
export const isObject = arg => typeOf(arg) === 'object';

export const isNum = arg => isNumber(arg) && !isNaN(arg);
