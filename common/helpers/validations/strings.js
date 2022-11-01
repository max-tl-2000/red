/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { SPECIAL_CHARACTERS } from '../../regex';
import { replaceEmptySpaces } from '../utils';
import Diacritics from '../diacritics';

export const isCommonWords = (forbiddenLegalNames, value) =>
  (forbiddenLegalNames || []).some(legalName => (value || '').toUpperCase().includes(legalName.toUpperCase()));

export const hasSpecialCharacter = value => !!Diacritics.replaceDiacritics(replaceEmptySpaces(value)).match(SPECIAL_CHARACTERS);

export const isLenghOfTextValid = (str, limit) => str.length <= limit;
