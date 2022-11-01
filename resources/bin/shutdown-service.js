/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import ipc from 'node-ipc';
import process from 'process';
import minimist from 'minimist';
import { promisify } from 'bluebird';
import { log, error, success } from 'clix-logger/logger';
import { assert } from '../../common/assert';

const fileExists = promisify(fs.stat);
const CONN_TIMEOUT = 3000; // 3 seconds
const TIMEOUT = 30000; // 30 seconds

const getArgs = args => {
  const argv = minimist(args.slice(2));

  return {
    service: argv.service,
  };
};

const connectToIPCServer = async (service, socketPath) =>
  new Promise((resolve, reject) => {
    ipc.config.id = 'client';
    ipc.config.retry = 1000; // 1 second

    ipc.connectTo('worker', socketPath, () => {
      ipc.of[service].on('connect', () => {
        success('ipc client connected');
        resolve();
      });

      ipc.of[service].on('error', err => {
        reject(err);
      });

      ipc.of[service].on('disconnect', async () => {
        log('ipc client disconnected');
      });
    });
  });

const shutdownComplete = service =>
  new Promise(resolve => {
    ipc.of[service].on('shutdown', async msg => {
      success(service, 'service shutdown complete', msg);
      resolve();
    });
  });

const runOnTimeout = (promise, timeout, errorMsg = 'Execution timed out') =>
  Promise.race([
    promise,
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(errorMsg));
      }, timeout);
    }),
  ]).then(
    val => val,
    err => {
      throw err;
    },
  );

/*
  Usage: ./bnr shutdown-service
  Options:
    --service=<worker|leasing,...> set which service
*/
const main = async args => {
  const { service } = getArgs(args);

  assert(service, '--service must be set');

  const socketPath = `/tmp/${service}.socket`;

  try {
    await fileExists(socketPath);
  } catch (err) {
    throw new Error(`socket ${socketPath} not found`);
  }

  log('waiting up to', CONN_TIMEOUT / 1000, 'seconds to connect to', service, 'ipc server');
  await runOnTimeout(connectToIPCServer(service, socketPath), CONN_TIMEOUT, `Connection timed out after ${CONN_TIMEOUT}`);

  ipc.of[service].emit('shutdown', { event: 'SIGTERM' });

  log('waiting up to', TIMEOUT / 1000, 'seconds to complete', service, 'shutdown');
  await runOnTimeout(shutdownComplete(service), TIMEOUT, `Service shutdown timed out after ${TIMEOUT}`);

  success(service, 'shutdown complete');
};

main(process.argv)
  .then(process.exit)
  .catch(err => {
    error(err);
    process.exit(1); // eslint-disable-line no-process-exit
  });
