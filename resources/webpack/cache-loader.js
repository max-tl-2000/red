/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/*
original license header https://github.com/webpack-contrib/cache-loader/blob/master/LICENSE
Copyright JS Foundation and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
*/

// Main differences with the original implementation is that we only read from disk once
// and load the cache to memory, this saves the access to disk (unless you have less than 16)
// in my tests this perfomed better than saving several small files per dependency

import async from 'async';
import { stat } from '../../common/helpers/xfs';

// it has to be a function because of the usage of `this`
export default function loader(...args) {
  const callback = this.async();
  const { data } = this;
  const dependencies = this.getDependencies().concat(this.loaders.map(l => l.path));
  const contextDependencies = this.getContextDependencies();
  const toDepDetails = async (dep, mapCallback) => {
    try {
      const stats = await stat(dep);
      mapCallback(null, {
        path: dep,
        mtime: stats.mtime.getTime(),
      });
    } catch (err) {
      mapCallback(err);
    }
  };
  async.parallel(
    [cb => async.mapLimit(dependencies, 20, toDepDetails, cb), cb => async.mapLimit(contextDependencies, 20, toDepDetails, cb)],
    (err, taskResults) => {
      if (err) {
        callback(null, ...args);
        return;
      }
      const [deps, contextDeps] = taskResults;

      const saveToCache = () => {
        this._compiler.__cache.setKey(data.cacheKey, {
          remainingRequest: data.remainingRequest,
          dependencies: deps,
          contextDependencies: contextDeps,
          result: args,
        });
        callback(null, ...args);
      };

      saveToCache();
    },
  );
}

// it has to be a function because of the usage of `this`
export function pitch(remainingRequest, prevRequest, dataInput) {
  const cache = this._compiler.__cache;

  const data = dataInput;
  data.remainingRequest = remainingRequest;
  const callback = this.async();
  data.cacheKey = remainingRequest;

  const cacheData = cache.getKey(data.cacheKey);

  if (!cacheData) {
    callback();
    return;
  }

  async.each(
    [...cacheData.dependencies, ...cacheData.contextDependencies],
    async (dep, eachCallback) => {
      try {
        const st = await stat(dep.path);
        if (st.mtime.getTime() !== dep.mtime) {
          eachCallback(true);
          return;
        }
        eachCallback();
      } catch (err) {
        eachCallback(err);
      }
    },
    err => {
      if (err) {
        callback();
        return;
      }

      cacheData.dependencies.forEach(dep => this.addDependency(dep.path));
      cacheData.contextDependencies.forEach(dep => this.addContextDependency(dep.path));
      callback(null, ...cacheData.result);
    },
  );
}
