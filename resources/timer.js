/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatCache from 'flat-cache';

const startTimer = () => {
  const startTime = Date.now();

  const stop = () => {
    const now = Date.now();
    return now - startTime;
  };

  return stop;
};

const formatAsSeconds = amount => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 1000);

export const getTimer = (name, logger) => {
  if (!name) throw new Error('name expected');
  if (!logger) throw new Error('logger expected');
  const stopTimer = startTimer();

  logger.info(`${name} process starting...`);

  return () => {
    let delta = stopTimer();
    const cache = flatCache.load(`${name}_execs`);
    const startupTimes = cache.getKey('startupTimes') || [];

    const lastStartupTime = startupTimes[startupTimes.length - 1];

    let lastStartupDiff;

    if (lastStartupTime) {
      lastStartupDiff = delta - lastStartupTime;
    }

    startupTimes.push(delta);
    let avgStartupTime =
      startupTimes.reduce((acc, time) => {
        acc += time;
        return acc;
      }, 0) / startupTimes.length;

    delta = `${formatAsSeconds(delta)} s`;
    lastStartupDiff = lastStartupDiff ? `${formatAsSeconds(lastStartupDiff)} s` : '';
    avgStartupTime = `${formatAsSeconds(avgStartupTime)} s`;

    logger.info({ delta, lastStartupDiff, avgStartupTime }, `${name} process started after ${delta}`);
    // keep only last 10 startup times
    cache.setKey('startupTimes', startupTimes.slice(-10));
    cache.save();
  };
};
