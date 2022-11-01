/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import path from 'path';

import envVal from '../../helpers/env-val';
import { deferred } from '../../helpers/deferred';
import { mkdirp, write } from '../../helpers/xfs';
import sleep from '../../helpers/sleep';

const takeMemorySnapshot = pathToSnapshot => {
  const dfd = deferred();
  const profiler = require('v8-profiler-next'); // eslint-disable-line global-require
  const snapshot = profiler.takeSnapshot();

  snapshot
    .export()
    .pipe(fs.createWriteStream(pathToSnapshot))
    .on('finish', () => {
      dfd.resolve();
      snapshot.delete();
    });

  return dfd;
};

interface IStopCPUProfileFnOptions {
  pathToCPUProfile: string;
}

interface IStopCPUProfileFn {
  (options: IStopCPUProfileFnOptions): Promise<void>;
}

interface IStartCPUProfileFn {
  (): Promise<IStopCPUProfileFn>;
}

const invoke = (session, method) => {
  const dfd = deferred();

  session.post(method, (err, ...rest) => {
    if (err) {
      dfd.reject(err);
      return;
    }
    dfd.resolve(...rest);
  });

  return dfd;
};

export const startCPUProfile: IStartCPUProfileFn = async () => {
  const inspector = require('inspector'); // eslint-disable-line global-require

  let session = new inspector.Session();
  session.connect();

  await invoke(session, 'Profiler.enable');
  await invoke(session, 'Profiler.start');

  const ret: IStopCPUProfileFn = async ({ pathToCPUProfile }: IStopCPUProfileFnOptions) => {
    const { profile } = await invoke(session, 'Profiler.stop');
    await invoke(session, 'Profiler.disable');
    session.disconnect();
    session = null;

    // TODO: probably we will have to write this profile using a stream
    await write(pathToCPUProfile, JSON.stringify(profile));
  };

  return ret;
};

interface ITakeSomeMemorySnapshotsOptions {
  snapshotsDir: string;
  snapshotsToTake?: number;
  delay?: number;
}

export const takeSomeMemorySnapshots = async ({ snapshotsDir, snapshotsToTake = 3, delay = 1000 }: ITakeSomeMemorySnapshotsOptions) => {
  const dir = path.resolve(snapshotsDir);
  await mkdirp(dir);

  const processName = envVal('RED_PROCESS_NAME', 'unknown-process');

  for (let i = 0; i < snapshotsToTake; i++) {
    const pathToSnapshot = path.join(dir, `${processName}-snapshot-${i}.heapsnapshot`);
    await takeMemorySnapshot(pathToSnapshot);
    await sleep(delay);
  }
};
