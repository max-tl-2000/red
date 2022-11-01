/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const LEFT = 37;
export const RIGHT = 39;
export const UP = 38;
export const DOWN = 40;
export const ENTER = 13;
export const SPACE = 32;
export const ESCAPE = 27;
export const BACKSPACE = 8;
export const TAB = 9;

export const isNavigationOrEntryKey = keyCode => {
  const cKeys = [UP, DOWN, LEFT, RIGHT, BACKSPACE, ENTER];

  const foundKey = cKeys.filter(ele => ele === keyCode);

  return foundKey.length > 0;
};
