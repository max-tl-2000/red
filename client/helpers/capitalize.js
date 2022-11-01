/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const toTitleCase = (str = '') =>
  str
    .split(' ')
    .map((word, idx) => {
      if (!word) return word;
      const shouldCap = !idx || word.length > 3;
      const firstLetter = shouldCap ? word[0].toUpperCase() : word[0].toLowerCase();
      return firstLetter + word.substring(1);
    })
    .join(' ');

export const toSentenceCase = (str = '') =>
  str
    .split(' ')
    .map((word, idx) => {
      if (!word) return word;

      // QUESTION: this assumes children are all strings.  Is that valid?
      if (str.children) return str.children.map(child => toSentenceCase(child));

      const shouldCap = !idx;
      const firstLetter = shouldCap ? word[0].toUpperCase() : word[0].toLowerCase();
      return firstLetter + word.substring(1).toLowerCase();
    })
    .join(' ');

export const firstLetterToLowerCase = (str = '') => `${str.charAt(0).toLowerCase()}${str.slice(1)}`;
