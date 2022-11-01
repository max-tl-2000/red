/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { setTimeout } from './globals';

// import loggerModule from './logger';
// const logger = loggerModule.child({ subType: 'attempt' });

export const attempt = ({
  func,
  attempts,
  autoExec = true,
  onAttemptFail = null,
  delay = 1000,
  onBeforeAttempt = null,
  onFail = null,
  couldBeCancelled = false,
  waitFn = time => new Promise(r => setTimeout(r, time)),
}) => {
  const decorated = async () => {
    let retry = 0;
    let cancelled = false;
    let exception = null;

    while (!cancelled && retry < attempts) {
      const attemptNumber = retry + 1;
      try {
        if (onBeforeAttempt) {
          await onBeforeAttempt({ attemptNumber });
        }
        return await func(attemptNumber);
      } catch (error) {
        retry++;
        exception = error;
        // do not use the logger here
        // use the onAttempt to log, since this module
        // might be used from client code
        // logger.error({ error }, `Retry ${retry}`);
        if (onAttemptFail) {
          const result = await onAttemptFail({ retry, error, attemptNumber, couldBeCancelled });
          cancelled = couldBeCancelled && result === true;
        }

        await waitFn(delay);
      }
    }

    if (!onFail) throw new Error(`Number of call attempts exceeded ${attempts}`);

    onFail({ error: exception, cancelled });
    return undefined;
  };

  return autoExec ? decorated() : decorated;
};

export const doAndRetry = (func, opts) => {
  const { maxAttempts = 20, autoExec = true, couldBeCancelled = false, onBeforeAttempt, onAttemptFail, onFail, waitBetweenAttempts = 200, waitFn } = opts || {};

  return attempt({
    func,
    attempts: maxAttempts,
    autoExec,
    onAttemptFail,
    delay: waitBetweenAttempts,
    onBeforeAttempt,
    onFail,
    couldBeCancelled,
    waitFn,
  });
};
