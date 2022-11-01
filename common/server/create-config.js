/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import extend from 'extend';
import { process } from '../helpers/globals';
import deepExtend from '../helpers/deepExtend';
import { cacheResults } from './cache-results';

export const isPublicEnv = cloudEnv => /^prod$|^staging.*/i.test(cloudEnv);

export const createConfig = ({ configsDir, addWorkersConfigGetter }) => {
  const pathToBaseConfig = `${configsDir}/production`;

  const { workerConfig: baseWorkerConfig, ...base } = require(pathToBaseConfig); // eslint-disable-line

  let nodeEnv = process.env.NODE_ENV || '';

  if (!nodeEnv.match(/^development$|^integration$|^production$/)) {
    nodeEnv = 'development';
  }

  // cloudEnv is a mandatory environment variable
  // Note that this should only be part of the workers config, but the workers config is using the app config.
  // The current config is actually the rabbitmq config.
  const cloudEnv = process.env.CLOUD_ENV || '';
  if (cloudEnv === '') {
    console.error(`
  *********************************************************
  CLOUD_ENV needs to be specified
  (ex: dev, demo, {developer name from reverseproxy}, etc.)
  *********************************************************`);

    process.exit(2); // eslint-disable-line
  }

  // accordingly to Christophe the base configuration should be
  // production. Other configurations should override it
  const { workerConfig, ...envConfig } = nodeEnv === 'production' ? {} : require(`${configsDir}/${nodeEnv}`); // eslint-disable-line

  let cfg = deepExtend(base, envConfig);
  const isProdEnv = cloudEnv === 'prod';
  const domainSuffix = isProdEnv ? 'reva.tech' : `${cloudEnv}.env.reva.tech`;
  cfg = extend(cfg, {
    env: nodeEnv, // TODO: check why need the env in the config object
    cloudEnv,
    domainSuffix,
    isPublicEnv: isPublicEnv(cloudEnv),
    isProdEnv,
    isProduction: /^production$/i.test(nodeEnv),
    isDevelopment: /^development$/i.test(nodeEnv),
    isIntegration: /^integration$/i.test(nodeEnv),
    isTestcafe: process.env.TESTCAFE_ENV === 'true',
  });

  const workerCfgFn = cacheResults(() => {
    const baseResult = typeof baseWorkerConfig === 'function' ? baseWorkerConfig() : baseWorkerConfig;
    const envResult = typeof workerConfig === 'function' ? workerConfig() : workerConfig;
    return deepExtend(baseResult, envResult);
  });

  if (baseWorkerConfig && addWorkersConfigGetter) {
    // workerConfig is treated differently mostly to avoid loading too many modules when the config is loaded
    // as config files were intended to only contain primitive values, but we have used the config to store
    // functions. These functions are imported from other modules (files) but these files have also imports
    // that point to the config module, creating cycles that take a lot of time to de-cycle
    //
    // transforming the workerConfig prop to a function allows us to lazy load the config and only perform the
    // costly traversal of the module graph the first time the `workerConfig` is actually needed
    Object.defineProperty(cfg, 'workerConfig', {
      get() {
        return workerCfgFn();
      },
    });
  }

  cfg.__workerConfigFn = workerCfgFn;

  return cfg;
};
