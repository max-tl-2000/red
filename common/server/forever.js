/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import stringify from 'json-stringify-safe';
import logger from '../helpers/logger';
import startAndMonitor from './startAndMonitor';
import envVal from '../helpers/env-val';

const { argv } = process;

const processName = envVal('RED_PROCESS_NAME', 'forever-monitor');

const onRestart = times => {
  const logMessage = `Forever restarted [${processName}], ${times} time(s)`;
  logger.error(logMessage);
};

const onError = error => {
  logger.error({ error }, `Forever error running [${processName}]`);
};

const main = () => {
  const { createStream } = require('rotating-file-stream');

  const logStream = createStream(`./logs/${processName}-forever-errors.log`, {
    size: '3M',
    interval: '1d',
    compress: 'gzip',
    maxFiles: 4,
    maxSize: '3M',
  });

  const writeLog = (logMessage, source, content) => {
    const date = new Date();
    logStream.write(`[${date.toJSON()}] ${logMessage} \n${source}: ${content}\n`);
  };

  const onStderr = stderr => {
    const logMessage = `Forever [${processName}] stderr`;
    writeLog(logMessage, 'stderr', stderr);
  };

  const onStdout = stdout => {
    const logMessage = `Forever [${processName}] stdout`;
    writeLog(logMessage, 'stdout', stdout);
  };

  const onStop = childData => {
    const logMessage = `Forever [${processName}] stop`;
    writeLog(logMessage, 'stop', stringify(childData));
  };

  const onMessage = msg => {
    const logMessage = `Forever [${processName}] message received`;
    writeLog(logMessage, 'message', msg);
  };

  const onExit = (code, signal) => {
    const logMessage = `Forever [${processName}] exit`;
    writeLog(logMessage, 'exit', `${code}: ${signal}`);
  };

  const onExitCode = (code, signal) => {
    const logMessage = `Forever [${processName}] exit:code`;
    writeLog(logMessage, 'exit:code', `${code}: ${signal}`);
  };

  const command = ['node', '--require', './enable-ts.js', ...argv.slice(2)];
  startAndMonitor(command, { onRestart, onError, onStderr, onStdout, onExitCode, onExit, onMessage, onStop });
};

main();
