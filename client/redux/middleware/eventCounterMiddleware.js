/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const MAX_EVENTS = 40;
let counter = [];
let client;

function logMessage(msg) {
  if (process.env.NODE_ENV === 'development') {
    console.error(msg);
  }
  client.post('/log', {
    data: [
      {
        loggingMessage: msg,
        severity: 'error',
      },
    ],
  });
}

async function analyzeEventCounter() {
  try {
    const groups = counter.reduce((acc, ev) => {
      const s = ev.timestamp.getSeconds();
      acc[s] = acc[s] ? [...acc[s], ev] : [ev];
      return acc;
    }, {});

    const highValueMessages = Object.values(groups)
      .filter(g => g.length >= MAX_EVENTS)
      .map(v => ` ${v.length} events/second \nEvents: ${v.map(e => e.type)}`);

    if (highValueMessages.length) {
      logMessage(`Too many Redux events per second:${highValueMessages.join('\n')}`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    counter = [];
  }
}

setInterval(analyzeEventCounter, 5000);

const eventCounter = ({ getState, dispatch }) => next => action => {
  counter.push({
    timestamp: new Date(),
    type: action.type,
  });

  if (typeof action === 'function') {
    return action(dispatch, getState);
  }

  return next(action);
};

export function createCounterMiddleware(apiClient) {
  client = apiClient;
  return eventCounter;
}
