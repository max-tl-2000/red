/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isString } from './type-of';

export const sortAndSplitList = list => {
  const listArray = [...list].sort();
  return listArray.join(', ');
};

export const convertToList = (list, separator) => {
  if (isString(list)) {
    separator = separator || '|';
    return (list || '').split(separator).filter(value => value);
  }
  return list || [];
};

export const convertToStringifyList = (list, separator) => {
  if (isString(list)) return list;
  separator = separator || '|';
  return (list || []).filter(val => val).join(separator);
};

export const hasItemFromList = (list, item, separator) => {
  if (isString(list)) {
    separator = separator || '|';
    const _list = convertToList(list, separator).map(value => value.toUpperCase());
    return _list.some(val => val === (item || '').toUpperCase());
  }
  return (list || [])
    .filter(val => val)
    .map(val => val.toUpperCase())
    .some(val => val === (item || '').toUpperCase());
};

export const removeItemList = (list, item, separator) => {
  if (!hasItemFromList(list, item, separator)) return list || [];
  if (isString(list)) {
    separator = separator || '|';
    const _list = convertToList(list, separator);
    return _list.filter(val => val.toUpperCase() !== (item || '').toUpperCase()).join(separator);
  }
  return (list || []).filter(val => val && val.toUpperCase() !== item.toUpperCase());
};

export const addItemToList = (list, item, separator) => {
  if (hasItemFromList(list, item, separator)) return list || [];
  if (isString(list)) {
    separator = separator || '|';
    const _list = convertToList(list, separator);
    return _list.concat(item).join(separator);
  }
  return (list || []).filter(val => val).concat(item);
};

export const isEmptyList = list => !list.length;

export const getListWithString = string => (string && isString(string) ? [string] : string);

export const listToHash = list =>
  list.reduce((acc, elem) => {
    acc[elem.id] = elem;
    return acc;
  }, {});
