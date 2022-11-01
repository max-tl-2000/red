/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import truncate from 'lodash/truncate';
import stringify from 'json-stringify-safe';
import {
  STRING_FORMAT_PLACEHOLDER,
  FILE_NAME_INVALID_CHARACTERS,
  FILE_NAME_INVALID_CTR_CHARACTERS,
  FILE_NAME_INVALID_RESERVED_CHARACTERS,
  FILE_NAME_INVALID_WINDOWS_RESERVED_CHARACTERS,
  FILE_NAME_INVALID_WINDOWS_TRAILING_CHARACTERS,
  FILE_NAME_INVALID_MULTIPLE_SPACES_CHARACTERS,
  FILE_NAME_INVALID_NON_BMP_CHARACTERS,
  NON_PRINTABLE_ASCII_CHARACTERS,
  FILE_EXTENSION,
  ANY_WORD_SEPARATOR,
} from '../regex';
import trim from './trim';

export const extractPreferredName = fullName => {
  if (!fullName) return '';

  const [preferredName] = fullName.split(' ');
  return preferredName;
};

export const formatStringWithPlaceholders = (str, data = {}) => str && str.replace(STRING_FORMAT_PLACEHOLDER, match => data[match] || '');

export const toHumanReadableString = (values = [], andConnector = 'and') => {
  if (values.length <= 2) return values.join(` ${andConnector} `);

  const lastValue = values.pop();
  return `${values.join(', ')}, ${andConnector} ${lastValue}`;
};

export const greet = (salute, personName) => (personName ? `${salute} ${personName},` : `${salute},`);

export const encodeSIP = str => encodeURIComponent(trim(str)).replace(/[-.!'()*~_]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);

export const removeToken = str => str.replace(/token(.*)|eyJ0(.*)/g, '');

export const toArrayBuffer = str => {
  const buf = new ArrayBuffer(str.length);
  const view = new Uint8Array(buf);

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i !== str.length; ++i) {
    // eslint-disable-next-line no-bitwise
    view[i] = str.charCodeAt(i) & 0xff;
  }
  return buf;
};

export const getEmailIdentifierFromUuid = id => id.replace(/-/g, '').substring(0, 20);

export const convertToBoolean = value => {
  if (!value) return false;
  const stringValue = value.toString().toLowerCase();
  return stringValue === 'true' || stringValue === '1';
};

export const convertToCamelCaseAndRemoveBrackets = stringValue =>
  stringValue
    ? stringValue
        .toLowerCase()
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (string, index) => (index === 0 ? string?.toLowerCase() : string?.toUpperCase()))
        .replace(/-|\(|\)|\s+/g, '')
    : '';

export const sanitizeFilename = (filename, { replacement = '', replaceUnicode = false } = {}) => {
  let invalidRegex = [
    FILE_NAME_INVALID_CHARACTERS,
    FILE_NAME_INVALID_CTR_CHARACTERS,
    FILE_NAME_INVALID_RESERVED_CHARACTERS,
    FILE_NAME_INVALID_WINDOWS_RESERVED_CHARACTERS,
    FILE_NAME_INVALID_WINDOWS_TRAILING_CHARACTERS,
    FILE_NAME_INVALID_NON_BMP_CHARACTERS,
  ];

  invalidRegex = replaceUnicode ? [...invalidRegex, NON_PRINTABLE_ASCII_CHARACTERS] : invalidRegex;

  let sanitizedFilename = invalidRegex.reduce((acc, regex) => {
    acc = acc.replace(regex, replacement);
    return acc;
  }, filename);

  sanitizedFilename = sanitizedFilename.replace(FILE_NAME_INVALID_MULTIPLE_SPACES_CHARACTERS, ' ');

  const truncateOptions = { length: 255, separator: '', omission: '' };
  const result = replacement === '' ? truncate(sanitizedFilename, truncateOptions) : sanitizeFilename(sanitizedFilename, { replacement: '' });

  if (!result || result.match(FILE_EXTENSION)) {
    return result.replace('', 'unnamed');
  }

  return result;
};

export const encodeBase64Url = url => {
  const buff = Buffer.from(url);
  const base64data = buff.toString('base64');
  return base64data.replace(new RegExp('/', 'g'), '_').replace(new RegExp('=', 'g'), '');
};

export const extractValuesFromCommaSeparatedString = str =>
  str
    .split(',')
    .map(p => p.trim())
    .filter(p => !!p);

export const shortenedToString = (string, limit, startPosition = 0) => {
  if (limit) {
    return stringify(string).substring(startPosition, limit);
  }
  return stringify(string);
};

export const equalsIgnoreCase = (s1, s2) => s1?.toLowerCase() === s2?.toLowerCase();

const MAX_PUSH_NOTIF_BODY_LENGTH = 75;

export const truncateForPushNotificationBody = text => truncate(text, { separator: ANY_WORD_SEPARATOR, length: MAX_PUSH_NOTIF_BODY_LENGTH });
