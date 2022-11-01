/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable no-process-exit */
const os = require('os');
const { map } = require('bluebird');
const spawn = require('spawnly');
const createDeferred = ({ timeout } = {}) => {
  let _resolve;
  let _reject;

  const p = new Promise((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  let timerId;

  if (timeout) {
    timerId = setTimeout(() => _reject(new Error(`TIMEOUT REACHED: ${timeout}`)), timeout);
  }

  p.reject = err => {
    clearTimeout(timerId);
    _reject(err);
  };
  p.resolve = arg => {
    clearTimeout(timerId);
    _resolve(arg);
  };

  return p;
};

const loadConfig = cfg => {
  const MAX_TIME_TO_LOAD_CONFIGS = 5500;
  const dfd = createDeferred({ timeout: MAX_TIME_TO_LOAD_CONFIGS });

  const cmd = `node --require babel-register-ts ./resources/load-config-only.js ${cfg.path}`;

  const cp = spawn(cmd, {
    stdio: 'inherit',
    detached: false,
    env: {
      ...process.env,
      BABEL_DISABLE_CACHE: 1,
    },
  });

  cp.on('exit', () => {
    dfd.resolve();
  });

  cp.on('error', err => {
    dfd.reject(err);
  });

  dfd.catch(() => {
    cp.kill(9);
  });

  return dfd;
};

const processConfigEntry = async entry => {
  console.time(`Loaded config ${entry.name}`);
  console.log('Loading config', entry.name);
  await loadConfig(entry);
  console.timeEnd(`Loaded config ${entry.name}`);
};

const main = () => {
  const cpuCount = Math.floor(os.cpus().length / 2);

  const dfd = createDeferred();
  const configs = [
    { path: './auth/config.js', name: 'auth-config' },
    { path: './consumer/config.js', name: 'consumer-config' },
    { path: './cucumber/config.js', name: 'cucumber-config' },
    { path: './rentapp/config.js', name: 'rentapp-config' },
    { path: './rentapp/server/workers/config.js', name: 'rentapp-workers-config' },
    { path: './roommates/config.js', name: 'roommates-config' },
    { path: './server/config.js', name: 'leasing-config' },
    { path: './server/decision_service/config.js', name: 'decision-service-config' },
    { path: './server/workers/config.js', name: 'workers-config' },
  ];

  const p = (async () => {
    await map(configs, cfg => processConfigEntry(cfg), { concurrency: cpuCount - 1 });

    dfd.resolve();
  })();

  p.catch(err => dfd.reject(err));

  return dfd;
};

main().catch(err => {
  console.error('>>', err);
  process.exit(1);
});
