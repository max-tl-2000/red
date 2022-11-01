/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from './helpers/logger';

process.on('uncaughtException', error => {
  const THRESHOLD_TO_EXIT = 1000;
  // we will attempt to use the console to avoid losing this
  // info if the serializer fails to store this log entry
  // It should not happen, but better safe than sorry
  console.log('uncaught exception found', error);

  logger.error({ error, subType: 'uncaughtException' }, 'uncaught exception found -- process will exit!');

  // Yes, I know it is weird to do something like this
  // but bunyan is an asynchronous logger library, so if we just exit the process
  // immediately it won't have time to save this to the logs
  setTimeout(() => {
    process.exit(7); // eslint-disable-line no-process-exit
  }, THRESHOLD_TO_EXIT);
});

process.on('unhandledRejection', reason => {
  logger.warn({ exceptionReason: JSON.stringify(reason), subType: 'unhandledRejection' }, 'unhandled rejection found');
});

export default {};
