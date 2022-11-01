/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTimeLastMessageReceived } from '../workers/consumer';
import { now, momentMax } from '../../common/helpers/moment-utils';

export const waitForQueueIdle = async (quietTime = 1, timeout = 10) => {
  const startTime = now();
  return new Promise((resolve, reject) => {
    const checkIntervalMS = 500;
    const timer = setInterval(() => {
      const lastMessageReceived = momentMax(getTimeLastMessageReceived(), startTime);
      const secondsSinceLastMessageReceived = now().diff(lastMessageReceived, 'seconds');
      if (secondsSinceLastMessageReceived > quietTime) {
        clearInterval(timer);
        resolve();
      }
      const secondsSinceStartOfWait = now().diff(startTime, 'seconds');
      if (secondsSinceStartOfWait > timeout) {
        clearInterval(timer);
        reject(new Error(`queue remainined busy for more than ${timeout} seconds`));
      }
    }, checkIntervalMS);
  });
};
