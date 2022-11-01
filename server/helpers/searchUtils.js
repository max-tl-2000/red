/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isEmailValid } from '../../common/helpers/validations/email';
import { isPhoneValid } from '../../common/helpers/validations/phone';

const DEFAULT_CHARACTER = ' ';

function replacer(match) {
  if (match === '-' || match === '+') {
    return `\\${match}`;
  }
  return DEFAULT_CHARACTER;
}

export function replaceSpecialChar(query) {
  return query.replace(/[-+=&|><!(){}[\]^~":*?\/\\]/g, replacer).trim(); // eslint-disable-line no-useless-escape
}

export const isEmailAddress = query => isEmailValid(query);

export const isPhoneNo = query => isPhoneValid(query);

export const phoneSanitize = query =>
  query
    .replace(/[^\d\w\s]/g, '')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .trim()
    .toLowerCase();
