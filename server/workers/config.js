/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import extend from 'extend';
import path from 'path';
import { createConfig } from '../../common/server/create-config';
import { createRentappConfig } from '../../rentapp/server/workers/create-rentapp-config';
import { cacheResults } from '../../common/server/cache-results';

// workers config is loading the rentapp/workers/config. Not entirely sure why this is done like this, proably we should just copy those configs over here
// but that will require tons of changes.

// For now applying this hack will make the code to work again. We need to refactor this at some point.
// config modules were intended to contain only Primitive values, having configs with functions and using ES6 Syntax with imports forces babel to traverse
// almost the entire set of modules from the very beginning. This process might take up to a minute (mostly due to this bug with the babel cache: https://github.com/babel/babel/issues/5667)
//
// TODO: Refactor the code to remove functions from configs and possibly remove this hack
const { __workerConfigFn: baseWorkersCfgFn, ...cfg } = createConfig({ configsDir: path.resolve(__dirname, './configs'), addWorkersConfigGetter: false });
const { __workerConfigFn: overrideWorkersCfgFn, ...rentappCfg } = createRentappConfig({ addWorkersConfigGetter: false });

const result = extend(true, cfg, rentappCfg, {
  RETRY_EXCHANGE: `${cfg.env}_retry_topic_exchange`,
  DEAD_LETTER_EXCHANGE: `${cfg.env}_dead_letter_topic_exchange`,
});

const workerCfgFn = cacheResults(() => {
  const base = baseWorkersCfgFn() || {};
  const overrider = overrideWorkersCfgFn() || {};

  return extend(true, base, overrider);
});

Object.defineProperty(result, 'workerConfig', {
  get() {
    return workerCfgFn();
  },
});

export default result;
