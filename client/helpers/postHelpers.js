/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const calculatePostCharactersRemaining = (limit, currentLength) => {
  if (!limit) return 0;
  const charactersRemaining = limit - (currentLength || 0);
  return charactersRemaining < 0 ? 0 : charactersRemaining;
};

export const getStatisticPercentage = (dividend, divisor) => Math.floor((100 * dividend) / divisor);
