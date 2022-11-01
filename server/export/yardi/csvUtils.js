/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { EXPORT_FILENAME_TIMESTAMP_FORMAT } from '../../../common/date-constants';
import { now } from '../../../common/helpers/moment-utils';

const fieldSeparator = ',';

const getQuotedString = value => {
  if (!value && value !== 0) return '';
  return `"${value}"`;
};

export const transformMapsToCSV = (fileType, fieldMaps) => {
  if (fieldMaps.length <= 0) return '';

  const [head, ...tail] = fieldMaps;

  const headEntries = Object.entries(head);
  if (!headEntries.length) return '';
  const fileHeader = fileType + fieldSeparator.repeat(headEntries.length - 1 || 0);

  const keys = [];
  const values = [];
  headEntries.forEach(([key, value]) => {
    keys.push(key);
    values.push(getQuotedString(value));
  });

  const csv = [fileHeader, keys.join(fieldSeparator), values.join(fieldSeparator)].join('\n');

  const linesInFile = [csv];
  if (tail && tail.length) {
    tail.forEach(obj => {
      values.length = 0;
      Object.entries(obj).forEach(([_key, value]) => {
        values.push(getQuotedString(value));
      });

      linesInFile.push(values.join(fieldSeparator));
    });

    return linesInFile.join('\n');
  }

  return csv;
};

export const generateTimestamp = () => now().format(EXPORT_FILENAME_TIMESTAMP_FORMAT);
