/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { doAndRetry } from '../../common/helpers/attempt';

export const execWithRetry = async (fn, { logger, fnName, maxAttempts, waitBetweenAttempts, onFail }) => {
  const logs = [];
  const ret = await doAndRetry(fn, {
    maxAttempts,
    waitBetweenAttempts,
    onBeforeAttempt: ({ attemptNumber }) => logs.push({ level: 'trace', msg: `${fnName}: attempt #${attemptNumber}` }),
    onAttemptFail: () => ({ attemptNumber, error }) => logs.push({ level: 'warn', msg: `${fnName}: attempt #${attemptNumber}, failed`, data: { error } }),
    onFail: () => {
      const msg = `${fnName}: no more attempts left`;
      if (logger) {
        logs.forEach(entry => {
          logger[entry.level](...[entry.data, entry.msg].filter(f => !!f));
        });
        logger.error(msg);
      }
      onFail && onFail();
      throw new Error(msg);
    },
  });

  logger.trace(`${fnName}: done`);
  return ret;
};
