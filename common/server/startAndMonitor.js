/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Monitor } from 'forever-monitor';

const startAndMonitor = (pathOrCommand, options = {}) => {
  const { onRestart, onError, onStderr, onStdout, onStop, onMessage, onExit, onExitCode } = options;

  const childProcess = new Monitor(pathOrCommand);

  onStderr && childProcess.on('stderr', err => onStderr(err));
  onStdout && childProcess.on('stdout', output => onStdout(output));
  onRestart && childProcess.on('restart', () => onRestart(childProcess.times));
  onError && childProcess.on('error', onError);
  onStop && childProcess.on('stop', onStop);
  onMessage && childProcess.on('message', onMessage);
  onExit && childProcess.on('exit', onExit);
  onExitCode && childProcess.on('exit:code', onExitCode);

  childProcess.start();

  return childProcess;
};

export default startAndMonitor;
