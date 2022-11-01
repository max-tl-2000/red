/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isEmailValid, isPhoneValid, isCommonWords, hasSpecialCharacter } from '../../../common/helpers/validations';

export const isSuspiciousContent = (forbiddenLegalNames, fullName) =>
  isCommonWords(forbiddenLegalNames, fullName) || isPhoneValid(fullName) || hasSpecialCharacter(fullName) || isEmailValid(fullName);

export const removeSpaces = str => str && str.replace(/\s+/g, ' ').trim();
