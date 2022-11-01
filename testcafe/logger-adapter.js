/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// This logger adapter is used to trap calls to the logger used in babel-plugin-auto-logger
// so we can use our own logger and logging levels.
import loggerInstance from '../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'console-adapter' });

const loggerAdapter = {
  // logger inside the babel-plugin-auto-logger
  // uses log instead of trace as bunyan logger does
  log: (position, message) => {
    logger.trace({ position }, message);
  },
  debug: (position, message) => {
    logger.debug({ position }, message);
  },
  info: (position, message) => {
    logger.info({ position }, message);
  },
  warn: (position, message) => {
    logger.warn({ position }, message);
  },
  error: (position, message) => {
    logger.error({ position }, message);
  },
};

export default loggerAdapter;
