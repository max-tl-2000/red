/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from 'helpers/trim';
import { formatPhoneToDisplay } from '../../common/helpers/phone/phone-helper';

const chunkString = (string, { size } = {}) => {
  const re = new RegExp(`.{1,${size}}`, 'g');
  return string.match(re);
};

export const formatPhoneNumber = number => formatPhoneToDisplay(number);

export const addBreakHintsOnWords = (text, { wordMaxLength = 20 } = {}) => {
  text = trim(text);
  text = text.replace(/[.+|*@\-_]/g, match => `${match}\u200B`);
  text = text.replace(/\w+/, match => {
    if (match.length < wordMaxLength) return match;
    return chunkString(match, { size: wordMaxLength }).join('\u200B');
  });

  return text;
};

export const stripFirstAndLastQuotesFromString = string => string.replace(/^"|"$/g, '').trim();

export const getClosestWordByPosition = (str, pos) => {
  const rightPartOfString = (str || '').substring(pos); // from the current index to the end of the string

  // finds the index of the first blank space after the selectionEnd index
  // if no matches it will use the length of string as the index
  const blankSpaceAfterSelectionEnd = rightPartOfString.match(/\s+/) || { index: rightPartOfString.length };

  const leftPartOfStringContainingTheWord = str.substring(0, pos + blankSpaceAfterSelectionEnd.index);

  // convert the string into an array separated by spaces
  const parts = leftPartOfStringContainingTheWord.split(/\s+/);

  // take the last one as the word under the selection
  return !parts.length ? '' : parts[parts.length - 1];
};
