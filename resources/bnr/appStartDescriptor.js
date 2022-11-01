/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import spawn from 'spawnly';
import request from 'superagent';
import { ok, success, subtle, error } from 'clix-logger/logger';
import { moduleNotIncludedInSet } from './bnr-helpers';
import { commonEnvVars, envForDevelopment, buildDepsTasks, cucumberEnvs } from './common';
import execCommand from '../exec-command';
import { attempt } from '../../common/helpers/attempt';
import sleep from '../../common/helpers/sleep';

const generateStartCommand = ({ name, debugPort, args, customMaxHTTPHeaderSize }) => {
  const debugFlag = moduleNotIncludedInSet(args.debug, name) ? '' : `--debug --debugPort=${debugPort} ${args.debugBrk ? '--debugBrk' : ''}`;
  const prodFlag = args.production ? ' --production' : '';
  const memLimitFlag = args.memLimit ? ` --memLimit ${args.memLimit}` : '';
  const maxHTTPHeaderSize = args.maxHTTPHeaderSize || customMaxHTTPHeaderSize;
  const maxHTTPHeaderSizeFlag = maxHTTPHeaderSize ? ` --maxHTTPHeaderSize ${maxHTTPHeaderSize}` : '';
  const watchFlag = args.watch ? '  --watch' : '';

  return `bnr ${name}:start ${debugFlag} ${prodFlag} ${memLimitFlag} ${maxHTTPHeaderSizeFlag} ${watchFlag}`;
};

const prepareExecCommands = (modules, args) => {
  let startPort = 9228;

  const getDebugPort = () => ++startPort;

  return modules.reduce((seq, { name, healthCheckUrl, backend, frontend, handleServiceShutdown, customMaxHTTPHeaderSize }) => {
    const allModulesCanBeExecuted = args.all;
    const moduleIsRequiredToExecuteByName = args[name];
    const isBackendModuleAnBackendModulesShouldStart = backend && args.backend;
    const isFrontendModuleAndFrontendModulesShouldStart = frontend && args.frontend;
    const moduleIsNotExcluded = moduleNotIncludedInSet(args.exclude, name);

    const includeModule =
      moduleIsNotExcluded &&
      (allModulesCanBeExecuted ||
        moduleIsRequiredToExecuteByName ||
        isBackendModuleAnBackendModulesShouldStart ||
        isFrontendModuleAndFrontendModulesShouldStart);

    if (includeModule) {
      const startCommand = generateStartCommand({ name, debugPort: getDebugPort(), args, customMaxHTTPHeaderSize });
      seq.push({
        startCommand,
        healthCheckUrl,
        name,
        backend,
        frontend,
        handleServiceShutdown,
      });
    }
    return seq;
  }, []);
};

const startService = async (name, startCommand, healthCheckUrl, handleServiceShutdown) => {
  const cp = spawn(startCommand, {
    stdio: 'inherit',
    detached: false,
    env: {
      ...process.env,
      BABEL_CACHE_PATH: `./node_modules/.cache/babel/process/${name}`,
    },
  });

  cp.on('error', err => {
    console.error(err);
    throw new Error(`service ${name} failed to start...`);
  });

  const childProcess = {
    service: name,
    handleServiceShutdown,
    stop() {
      subtle(`stopping ${name} service`);
      spawn(`./bnr ${name}:stop`);
      // TODO: catch errors for this
    },
  };

  if (!healthCheckUrl) {
    ok(`no health check needed for ${name}`);
    return childProcess;
  }

  const DELAY_FOR_FIRST_CHECK = 25000;
  const DELAY_BETWEEN_CHECKS = 2000;
  const MAX_ATTEMPTS = 100;

  const performHealthCheck = async attemptNumber => {
    subtle(`checking health of ${name} service using: ${healthCheckUrl}, attempt number ${attemptNumber}`);
    return await request.get(healthCheckUrl);
  };

  // the check will pass if performHealtCheck promise is resolved with a non error value
  // super agent will resolve the promise if the request return 200 and reject otherwise
  const check = attempt({
    func: performHealthCheck,
    attempts: MAX_ATTEMPTS,
    autoExec: false,
    delay: DELAY_BETWEEN_CHECKS,
  });

  await sleep(DELAY_FOR_FIRST_CHECK);
  await check();

  ok(`${name} service started. Health check passed!`);
  return childProcess;
};

const shutdownService = async (service, stop, shutdownTimeout = 60000) => {
  ok('Handling', service, 'service shutdown');

  try {
    await Promise.race([
      execCommand(`./bnr shutdown-service --service=${service}`),
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`${service} service did not shutdown in a timely fashion so exiting!`));
        }, shutdownTimeout);
      }),
    ]).then(
      val => val,
      err => {
        throw err;
      },
    );
  } catch (err) {
    error(err);
  } finally {
    ok('Finished waiting for', service, 'shutdown');
    stop();
  }
};

const appStartDescriptor = {
  task: async ({ args }) => {
    // TODO: move the ping url to the configuration of the services
    // so it can be used here
    const modules = [
      { name: 'socket', healthCheckUrl: 'http://127.0.0.1:3040/ping', backend: true },
      { name: 'worker', healthCheckUrl: '', backend: true, handleServiceShutdown: true },
      { name: 'api', healthCheckUrl: 'http://127.0.0.1:3030/ping', backend: true, customMaxHTTPHeaderSize: 16384 },
      { name: 'decision_api', healthCheckUrl: 'http://127.0.0.1:3070/ping', backend: true, customMaxHTTPHeaderSize: 16384 },
      { name: 'export_api', healthCheckUrl: 'http://127.0.0.1:3080/ping', backend: true, customMaxHTTPHeaderSize: 16384 },
      { name: 'leasing', healthCheckUrl: 'http://127.0.0.1:3000/ping', frontend: true },
      { name: 'consumer', healthCheckUrl: 'http://127.0.0.1:4000/ping', frontend: true },
      { name: 'auth', healthCheckUrl: 'http://127.0.0.1:3500/ping', frontend: true },
    ];

    const services = prepareExecCommands(modules, args);

    if (!services.length) {
      throw new Error(
        'app-start does not start leasing modules anymore. Please run it like: `app-start --socket --leasing --api --worker` to start only leasing modules',
      );
    }

    const allProcessesAreForBackend = services.every(service => service.backend);

    let env = { ...commonEnvVars };

    if (!args.production) {
      env = envForDevelopment;
      // if the command is called like `./bnr app-start --cucumber`
      // then we use the cucumberEnvs vars
      if (args.cucumber) {
        env = { ...env, ...cucumberEnvs };
      }

      if (args.skipDevServer) {
        env.SKIP_WEBPACK_DEV_SERVER = true;
        env.USE_ASSETS_PROD_DIST_FOLDER = true;
      }
    }

    if (args.componentsInVendors) {
      env.INCLUDE_COMPONENTS_IN_VENDORS = true;
    }

    env.INCLUDE_COMPONENTS_DEMO = !args.noDemo;

    if (args.chromeOnly) {
      env.DEV_CHROME_ONLY = true;
    }
    // make sure we have the common Environment variables loaded
    process.env = {
      ...process.env,
      ...env,
      // default babel-cache
      BABEL_CACHE_PATH: './node_modules/.cache/babel/default-server-cache.json',
    };

    const beforeStartTasks = ['npm run install-hooks', ...buildDepsTasks];

    if (args.skipVendors || args.production || allProcessesAreForBackend) {
      subtle('skipping vendors generation...');
    } else {
      for (let i = 0; i < beforeStartTasks.length; i++) {
        await execCommand(beforeStartTasks[i]);
      }
    }

    // keeps track of all processes we create
    const spawned = [];

    const { skipHealthCheck } = args;

    for (let i = 0; i < services.length; i++) {
      const { startCommand, name, healthCheckUrl, handleServiceShutdown } = services[i];
      const res = await startService(name, startCommand, skipHealthCheck ? '' : healthCheckUrl, handleServiceShutdown);
      spawned.push(res);
    }

    let exitInProgress = false;

    const handleExit = async (...exitArgs) => {
      if (exitInProgress) {
        subtle('exit in progress');
        return;
      }

      exitInProgress = true;

      if (exitArgs.length > 0) {
        subtle('exit because', exitArgs);
      }
      await Promise.all(
        spawned.map(async cp => {
          const { handleServiceShutdown, service, stop } = cp;
          if (!handleServiceShutdown) {
            stop();
            return;
          }

          await shutdownService(service, stop);
        }),
      );
    };

    process.on('uncaughtException', handleExit);
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    success('\n\nReva app is now up and running!\n\n');

    if (!args.production && !args.skipDevServer) success('Note: you still have to wait until all the assets are built by webpack...');
  },
};

export default appStartDescriptor;
