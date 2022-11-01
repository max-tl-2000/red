/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import url from 'url';
import path from 'path';

import { mkdirp } from '../../helpers/xfs';
import envVal from '../../helpers/env-val';
import loggerInstance from '../../helpers/logger';
import { ServiceError } from '../../../server/common/errors';
import { takeSomeMemorySnapshots, startCPUProfile } from './profiler';
import { createSimpleServer, sendJSON } from './simple-server';
import { now } from '../../helpers/moment-utils';

const logger = loggerInstance.child({ subType: 'profiler' });

let stopProfiling;

const handleRequest = async (req, res) => {
  const { pathname } = url.parse(req.url);

  if (pathname === '/snapshots/take') {
    const { dir = './temp/snapshots/' } = req.body;
    if (!dir) throw new ServiceError({ token: 'SNAPSHOTS_DIR_NOT_SPECIFIED', message: 'Please specify a dir for the snapshots' });
    await takeSomeMemorySnapshots({ snapshotsDir: dir });
    return sendJSON(res, { status: 'snapshot taken' });
  }

  if (pathname === '/cpu/profile/start') {
    if (stopProfiling) {
      throw new ServiceError({ token: 'CPU_PROFILER_RUNNING', message: 'CPU profiler running' });
    }
    stopProfiling = await startCPUProfile();
    return sendJSON(res, { status: 'cpu profiling started' });
  }

  if (pathname === '/cpu/profile/stop') {
    if (!stopProfiling) {
      throw new ServiceError({ token: 'CPU_PROFILER_NOT_STARTED', message: 'Please call first /cpu/profile/start' });
    }
    const profileId = now().toJSON().replace(/:/g, '_');
    let { profileName = `./temp/cpu_profile/cpu_${profileId}.profile` } = req.body;
    if (!profileName) throw new ServiceError({ token: 'CPU_PROFILE_DIR_NOT_SPECIFIED', message: 'Please specify a dir for the cpu profiles' });

    profileName = path.resolve(profileName);

    await mkdirp(path.dirname(profileName));
    await stopProfiling({ pathToCPUProfile: profileName });

    stopProfiling = null;

    return sendJSON(res, { status: 'cpu profiling done' });
  }

  return sendJSON(res, { status: 'no action found' }, 404);
};

let server;

const toggleProfileServer = async () => {
  if (server) {
    server.close(({ port, host }) => {
      logger.info({ port, host }, `profiler runnig at ${host}:${port} is stopped`);
      server = null;
    });
    return;
  }

  server = await createSimpleServer(handleRequest);

  server.listen(({ port, host }) => {
    logger.info({ port, host }, `profiler running at ${host}:${port} is ready to accept connections`);
  });
};

export const initProfiler = () => {
  const processName = envVal('RED_PROCESS_NAME', 'unknown-process');
  logger.info({ pid: process.pid, processName }, `process: "${processName}" running with pid: "${process.pid}"`);
  process.on('SIGUSR2', toggleProfileServer);
};
