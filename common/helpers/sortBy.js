/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment } from './moment-utils';

export const sortByCreationDate = (itemA, itemB, { field = 'createdAt', sortOrder = 'ASC' } = {}) => {
  const itemACreatedAt = toMoment(itemA[field]);
  const itemBCreatedAt = toMoment(itemB[field]);

  const itemACreatedAtIsValid = itemACreatedAt.isValid();
  const itemBCreatedAtIsValid = itemBCreatedAt.isValid();

  if (itemACreatedAtIsValid && itemBCreatedAtIsValid) {
    if (itemACreatedAt.isSame(itemBCreatedAt)) return 0;

    if (sortOrder === 'DESC') return itemBCreatedAt.isBefore(itemACreatedAt) ? -1 : 1;

    return itemACreatedAt.isBefore(itemBCreatedAt) ? -1 : 1;
  }

  if (!itemACreatedAtIsValid && !itemBCreatedAtIsValid) {
    // none of them valid?
    return 0;
  }
  if (itemACreatedAtIsValid) {
    return 1;
  }

  return -1;
};
