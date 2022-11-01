/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { window } from '../../common/helpers/globals';

let clientLogger;

const doLog = (logData, loggingMessage, severity = 'error') => {
  clientLogger && clientLogger[severity](logData, loggingMessage);
};

export const initErrorModule = (logger, { id } = {}) => {
  if (!logger) throw new Error('logger object not provided');
  clientLogger = logger;

  if (!id) throw new Error('id not provided');

  const oldWinError = window.onerror;

  window.onerror = (...args) => {
    let [errorMessage, file, line, col, err] = args;

    err = err || {};

    const ignoredPatterns = [
      { pattern: /^script error/i, level: 'log' },
      { pattern: /ResizeObserver loop limit exceeded/i, level: 'warn' },
      { pattern: /Blocked a frame with origin/i, level: 'warn' },
    ];

    for (let i = 0; i < ignoredPatterns.length; i++) {
      const entry = ignoredPatterns[i];

      if (errorMessage.match(entry.pattern) || err?.message?.match?.(entry.pattern)) {
        const level = entry.level || 'log';
        console[level]?.('Ignored error', errorMessage, err);
        return;
      }
    }

    doLog(
      {
        file,
        line,
        col,
        errorMessage,
        errorObject: {
          message: err.message,
          stack: err.stack,
        },
      },
      `${id}, application error`,
    );

    oldWinError && oldWinError.apply(window, args);
  };

  window.addEventListener('unhandledrejection', e => {
    if (process.env.NODE_ENV === 'production') {
      // in prod we don't want the error to be shown in the console
      e.preventDefault && e.preventDefault();
    }

    doLog(
      {
        reason: e.reason?.message || e.reason,
        stack: e.reason?.stack,
      },
      `${id}, unhandled rejection`,
      'error',
    );
  });
};
