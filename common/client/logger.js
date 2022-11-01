/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { window } from '../helpers/globals';
import { isString } from '../helpers/type-of';

const getBrowserData = () => {
  const { navigator, location } = window;

  const { userAgent } = navigator;
  const { href: currentUrl } = location;

  return { userAgent, currentUrl };
};

const logMethods = ['trace', 'debug', 'info', 'error', 'warn'];

// these will be printed to the console so we can check then in FS
const allowedLevels = ['info', 'error', 'warn'];

export const logger = logMethods.reduce((acc, methodName) => {
  acc[methodName] = (...args) => console.warn('logger not initialized', ...args);
  return acc;
}, {});

export const initClientLogger = ({ apiClient: client, getContextData } = {}) => {
  if (!client) {
    throw new Error('apiClient parameter not provided');
  }

  const logMessage = (level, logData, message) => {
    const logArgs = {
      loggingMessage: message,
      severity: level,
      ...getBrowserData(),
      ...logData,
    };

    if (getContextData) {
      logArgs.contextData = getContextData();
    }

    const shouldPostToServer = logData?.shouldPostToServer;

    if (level === 'error' || shouldPostToServer) {
      client
        .post('/log', {
          data: [logArgs],
        })
        .catch(err => {
          console.error('UNABLE TO POST LOG!', err);
        });
    }

    if (process.env.NODE_ENV === 'development') {
      console[level](message, logData);
    } else if (allowedLevels.includes(level)) {
      // in case of production like logs will be caught by FS
      // so we can see then also in the console during the session replies
      const { loggingMessage, ...argsForLogging } = logArgs;
      let obj = argsForLogging;

      try {
        obj = JSON.stringify(argsForLogging, null, 2);
        console[level](`${loggingMessage}, ${obj}`);
      } catch (err) {
        console[level](loggingMessage, obj);
      }
    }
  };

  return logMethods.reduce((acc, methodName) => {
    acc[methodName] = (logData, message = '') => {
      if (isString(logData)) {
        message = logData;
        logData = {};
      }

      logMessage(methodName, logData, message);
    };
    return acc;
  }, logger);
};
