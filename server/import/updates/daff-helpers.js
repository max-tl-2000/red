/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import daff from '@redisrupt/daff';

export const DIFF_ACTION_TAG = {
  header: '@@',
  insert: '+++',
  update: '->',
  delete: '---',
  unchanged: '',
};

export const getUpdatedDiffValue = diffValue =>
  diffValue && diffValue.indexOf(DIFF_ACTION_TAG.update) > -1 ? diffValue.split(DIFF_ACTION_TAG.update)[1] : diffValue;

export const isValueUpdated = diffValue => !!(diffValue && diffValue.indexOf(DIFF_ACTION_TAG.update) > -1);

export const createDaffFlags = () => new daff.CompareFlags();

export const getDifferences = (headers, previousContent, currentContent, customflags = createDaffFlags()) =>
  daff.diff([headers, ...previousContent], [headers, ...currentContent], customflags) || {};

export const mapEntity = (keys, values, mapValue) =>
  keys.reduce((acc, key, index) => {
    const value = getUpdatedDiffValue(values[index]);
    const tupple = mapValue(key, value, acc);
    acc[tupple[0]] = tupple[1];
    return acc;
  }, {});

export const mapDifferences = (differences, reduceDiffHandler, initialValues = []) =>
  differences.reduce((acc, row) => {
    const action = row.shift();
    const diffHandler = reduceDiffHandler(action);
    return diffHandler(acc, row);
  }, initialValues);
