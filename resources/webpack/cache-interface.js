/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatCache from 'flat-cache';
import debounce from 'debouncy';
import { getCacheFolder } from '../get-cache-folder';

export const getCacheInterface = cacheId => {
  // Generate own cache key
  const cache = flatCache.load(`cache-loader_${cacheId}`, getCacheFolder('cache-plugin'));

  const cacheKey = (options, request) => `build:cache:${request}`;

  const sync = debounce(() => {
    cache.save(true);
    console.log('save called');
  }, 1000);

  // Read data from database and parse them
  const read = (key, callback) => {
    const data = cache.getKey(key);
    if (!data) {
      console.log('>>> reading from cache failed: ', key);
      callback(new Error(`Key ${key} not found`));
      return;
    }
    // console.log('>>> reading from cache', key);
    callback(null, data);
  };

  // Write data to database under cacheKey
  const write = (key, data, callback) => {
    console.log('>>> writing to cache', key);
    cache.setKey(key, data);
    sync();
    callback();
  };

  return {
    cacheKey,
    read,
    write,
  };
};
