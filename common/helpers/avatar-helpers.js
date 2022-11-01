/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from './trim';
import { isEmailValid } from './validations/email';

const ignorePrefixesAndSuffixes = [
  'Jr',
  'Sr',
  'Jnr',
  'Snr',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'Esq',
  'PhD',
  'MD',
  'Mr',
  'Ms',
  'Mrs',
  'Mme',
].map(entry => new RegExp(`^${entry}\\.$|^${entry}$`, 'i'));

export const colors = [
  '#B3E5FC',
  '#FFE0B2',
  '#FFCCBC',
  '#B2DFDB',
  '#D7CCC8',
  '#FFF9C4',
  '#C8E6C9',
  '#B2EBF2',
  '#F0F4C3',
  '#DCEDC8',
  '#F5F5F5',
  '#FFECB3',
  '#BBDEFB',
  '#CFD8DC',
];

/* Disabling all colors except for grey100
const avatarsBgColor = [
  'amber100.png',
  'blue100.png',
  'blueGrey100.png',
  'brown100.png',
  'cyan100.png',
  'deepOrange100.png',
  'deepPurple100.png',
  'green100.png',
  'grey100.png',
  'indigo100.png',
  'lightBlue100.png',
  'lightGreen100.png',
  'lime100.png',
  'orange100.png',
  'pink100.png',
  'purple100.png',
  'red100.png',
  'teal100.png',
  'yellow100.png',
];
*/
const avatarsBgColor = ['grey300.png'];
const renewalAndActiveLeaseAvatarsBgColor = ['purple200.png'];

const colorByNameCache = {};
const colorByBgColorCache = {};
let currentIndex = 0;

export const getAvatarInitials = (displayedName, includeNumbersOnInitials = false) => {
  const isEmail = isEmailValid(displayedName);
  let parts = trim(displayedName).split(/\s+/);

  if (parts.length > 1) {
    // might be controversial but someone can actually be named Mrs or might be as well have a surname like Esq
    // so to try to avoid all those cases we only attempt to remove prefixes/suffixes if more than 1 parts are found
    parts = parts.filter((part, i) => {
      if (i === 0 || i === parts.length - 1) {
        const isMatch = ignorePrefixesAndSuffixes.some(regex => part.match(regex));
        return !isMatch;
      }
      return true;
    });
  }

  parts = parts.map(line => line[0]);

  const initialsArr = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0] || ''];
  const initialRegex = includeNumbersOnInitials ? /[a-zA-Z0-9\u00C0-\u024F]/ : /[a-zA-Z\u00C0-\u024F]/;
  return isEmail || !initialsArr.every(letter => letter.match(initialRegex)) ? '?' : initialsArr.join('').toUpperCase();
};

const getMetaFromNameWithOptions = (displayedName, { colorSetCache, colorSet = colors, includeNumbersOnInitials = false }) => {
  const initials = getAvatarInitials(displayedName, includeNumbersOnInitials);

  currentIndex = (currentIndex + 1) % colorSet.length;

  const cacheKey = `${displayedName} ${colorSet[currentIndex]}`;

  colorSetCache[cacheKey] = colorSetCache[cacheKey] || colorSet[currentIndex];

  return { initials, color: colorSetCache[cacheKey] };
};

export const getMetaFromName = (displayedName, includeNumbersOnInitials = false) =>
  getMetaFromNameWithOptions(displayedName, { colorSetCache: colorByNameCache, colorSet: colors, includeNumbersOnInitials });

export const getMetaFromNameWithBgColor = (displayedName, includeNumbersOnInitials = false, isRenewalOrActiveLease = false) =>
  getMetaFromNameWithOptions(displayedName, {
    colorSetCache: colorByBgColorCache,
    colorSet: !isRenewalOrActiveLease ? avatarsBgColor : renewalAndActiveLeaseAvatarsBgColor,
    includeNumbersOnInitials,
  });
