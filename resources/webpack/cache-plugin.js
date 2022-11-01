/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatCache from 'flat-cache';
import { getCacheFolder } from '../get-cache-folder';

export default class CachePlugin {
  constructor(cacheId) {
    this.id = cacheId;
    // loads the cache, if one does not exists for the given
    // Id a new one will be prepared to be created
    this.cache = flatCache.load(`cache-loader_${cacheId}`, getCacheFolder('cache-plugin'));
  }

  apply(compiler) {
    compiler.plugin(['run', 'watch-run'], (c, cb) => {
      compiler.__cache = this.cache;
      cb();
    });

    compiler.plugin('done', () => {
      this.cache.save();
    });
  }
}

export const addCachePlugin = (config, { isProd, id } = {}) => {
  if (isProd) return;
  config.plugins.push(new CachePlugin(id));
};
