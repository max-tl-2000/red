/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const getDevicePixelRatio = () => {
  const devicePixelRatio = Math.round(window?.devicePixelRatio || 1);
  if (devicePixelRatio <= 1) return 1;
  if (devicePixelRatio <= 2) return 2;
  return 3;
};

const avatarDefaultSizes = [32, 40, 56, 64];

/* This function calculates the closest avatar default size, for example:
 * If the input is 72 it will return 64 or if the input is 57 the result will be 56
 * This is based on the avatarDefaultSizes array defined above
 */
export const computeAvatarDefaultSize = avatarSize =>
  avatarDefaultSizes.reduce((acc, size) => (Math.abs(size - avatarSize) < Math.abs(acc - avatarSize) ? size : acc), avatarDefaultSizes[0]);

export const avatarBadgeIconStyleMapping = {
  32: { width: 12, height: 12, right: '-0.075rem', bottom: '-.075rem' },
  40: { width: 16, height: 16, right: '-0.175rem', bottom: '-.175rem' },
  56: { width: 24, height: 24, right: '-0.375rem', bottom: '-.150rem' },
  64: { width: 24, height: 24, right: '-0.375rem', bottom: '-.150rem' },
};
