/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { create } from 'shell-executor';
import { subtle, success, warn, error } from './logger';
import ellipsis from '../common/helpers/ellipsis';
/**
 * wrapper around shell-executor that returns
 * a promise that is resolved if the command
 * exits with exitCode 0, or rejected if there
 * is an error.
 */
export default function execCommand(cmd, { id, maxLength = 1000, env = {} } = {}) {
  const executor = create();
  const summaryCMD = ellipsis(cmd, { maxLength });
  subtle('command:', id || cmd, `\n${id ? `\n    ${summaryCMD}\n` : ''}`);

  return new Promise((resolve, reject) => {
    executor.one('command:error', (e, err) => {
      error('command:', id || cmd, 'took:', err.durationFormatted);
      reject(err);
    });

    executor.one('command:exit', (e, { exitCode, durationFormatted }) => {
      const method = exitCode === 0 ? success : warn;
      method('command:', id || cmd, 'took:', durationFormatted);
      resolve(exitCode === 0, exitCode);
    });

    executor.run(cmd, { env: { ...process.env, ...env } });
  });
}
