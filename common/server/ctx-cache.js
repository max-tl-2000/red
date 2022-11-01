/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import set from 'lodash/set';
import get from 'lodash/get';
import config from '../../server/config';
import loggerModule from '../helpers/logger';

const logger = loggerModule.child({ subType: 'ctxCache' });

const { isCtxCacheEnabled, shouldLogCtxCache } = config?.ctxCache || {};

const getCachePath = (path, tenantId) => `cache.${tenantId}.${path}`;

export const getCtxCache = (ctx, path) => {
  if (!isCtxCacheEnabled) return null;
  const { tenantId } = ctx;
  const cachePath = getCachePath(path, tenantId);
  shouldLogCtxCache && logger.info({ ctx, cachePath }, 'getting cached value');
  return get(ctx, cachePath);
};

export const setCtxCache = (ctx, path, value, opts) => {
  if (!isCtxCacheEnabled) return null;
  const tenantId = opts?.tenantId || ctx.tenantId;
  const cachePath = getCachePath(path, tenantId);
  shouldLogCtxCache && logger.info({ ctx, cachePath }, 'setting cached value');
  return set(ctx, cachePath, value);
};
