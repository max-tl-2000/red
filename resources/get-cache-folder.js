/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import findCacheDir from 'find-cache-dir';
import userHome from 'user-home';
import path from 'path';
import { subtle } from './logger';

export const getCacheFolder = name => {
  const isCI = process.env.CONTINUOUS_INTEGRATION === 'true';
  const dir = isCI ? `${userHome}/.build-cache/${name}` : findCacheDir({ name });

  if (process.argv.indexOf('--json') === -1) {
    subtle('cache folder for', name, '>', dir);
  }

  return dir;
};

export const getBaseCacheFolder = () => {
  const isCI = process.env.CONTINUOUS_INTEGRATION === 'true';
  return path.resolve(isCI ? `${userHome}/.build-cache` : 'node_modules/.cache/');
};
