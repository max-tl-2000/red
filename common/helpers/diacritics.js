/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import diacriticsMap from 'diacritics-map';

export default class Diacritics {
  static diacriticsKeys = Object.keys(diacriticsMap);

  static diacriticsMapSize = () => Diacritics.diacriticsKeys.length;

  static isValueSizeLongerThanMap = strSize => strSize > Diacritics.diacriticsMapSize;

  isArray = prop => prop && prop.constructor === Array;

  isObject = prop => prop && typeof prop === 'object';

  isString = prop => prop && typeof prop === 'string';

  replaceDiacriticsBasedOnValueType = value => {
    if (this.isObject(value)) return this.reduceObject(value);
    if (this.isString(value)) return Diacritics.replaceDiacritics(value);
    if (this.isArray(value)) return this.reduceArray(value);

    return value;
  };

  reduceArray = array =>
    array.reduce((acc, current) => {
      acc.push(this.replaceDiacriticsBasedOnValueType(current));
      return acc;
    }, []);

  reduceObject = object =>
    Object.keys(object).reduce((acc, current) => {
      const value = object[current];
      acc[current] = this.replaceDiacriticsBasedOnValueType(value);
      return acc;
    }, {});

  static replaceWithDiacriticsMapIterator = str => Diacritics.diacriticsKeys.reduce((acc, diacritic) => acc.replace(diacritic, diacriticsMap[diacritic]), str);

  static replaceWithStrIterator = (str, strSize) => {
    let result = '';
    for (let i = 0; i < strSize; i++) {
      const character = str.charAt(i);
      result += diacriticsMap[character] || character;
    }
    return result;
  };

  static replaceDiacritics = str => {
    const strSize = str.length;

    if (Diacritics.isValueSizeLongerThanMap(strSize)) {
      return Diacritics.replaceWithDiacriticsMapIterator(str);
    }

    return Diacritics.replaceWithStrIterator(str, strSize);
  };

  static replaceDiacriticsInObjectOrArray = data => {
    try {
      const diacritics = new Diacritics();
      return diacritics.isArray(data) ? diacritics.reduceArray(data) : diacritics.reduceObject(data);
    } catch (ex) {
      console.error(ex, 'error during replaceDiacriticsInObjectOrArray');
    }
    return data;
  };
}
