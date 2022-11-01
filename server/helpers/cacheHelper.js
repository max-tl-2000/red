/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subtype: 'helpers/cacheHelper' });

const weakCache = new WeakMap();
const createEntityKey = (type, id) => `${type}_${id}`;

export const setCachedEntity = (ctx, { type, id, entity }) => {
  if (!ctx || !type || !id || entity === null) {
    logger.error({ ctx, type, id }, 'Required params needs to be defined');
    return;
  }

  const cache = weakCache.get(ctx) || new Map();
  cache.set(createEntityKey(type, id), entity);

  weakCache.set(ctx, cache);
};

export const getCachedEntity = (ctx, { type, id }) => {
  if (!ctx || !type || !id) {
    logger.error({ ctx, type, id }, 'Required params needs to be defined');
    return null;
  }

  const cache = weakCache.get(ctx);
  if (!cache) return null;

  return cache.get(createEntityKey(type, id)) || null;
};
