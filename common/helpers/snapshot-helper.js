/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isObject, isDate, isString } from './type-of';

const representAUUID = pretendUuid => {
  if (!isString(pretendUuid)) {
    return false;
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(pretendUuid);
};

const representADate = str => {
  if (isDate(str)) return true;
  if (!isString(str)) return false;

  const ISO_8601_FULL = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)?$/i;
  return str.match(ISO_8601_FULL);
};

export const editUnpredictable = (obj, { ignore = [] } = {}) => {
  if (!obj) return obj;

  if (isString(obj)) {
    if (representAUUID(obj)) {
      return '[UUID_EDITED]';
    }

    const isDateLike = representADate(obj);
    if (isDateLike) {
      return '[DATE_EDITED]';
    }

    return obj;
  }

  if (representADate(obj)) {
    return '[DATE_EDITED]';
  }

  if (Array.isArray(obj)) {
    return obj.map(item => editUnpredictable(item, { ignore }));
  }

  if (isObject(obj)) {
    Object.keys(obj).forEach(key => {
      if (ignore.includes(key)) {
        obj[key] = '[EDITED]';
      } else {
        obj[key] = editUnpredictable(obj[key], { ignore });
      }
    });
  }

  return obj;
};
