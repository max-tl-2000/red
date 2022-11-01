/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getNow } from './date-helper';

export const addTimeFnsToBunyan = bunyan => {
  const timers = {};

  bunyan.prototype.time = function time(payload, name) {
    if (!name && typeof payload === 'string') {
      name = payload;
    }

    // payload is kept to use the same signature for all logger methods
    timers[name] = getNow();
  };

  bunyan.prototype.timeEnd = function timeEnd(payload, name) {
    // needs access to the this
    if (!name && typeof payload === 'string') {
      name = payload;
      payload = {};
    }

    const prevTime = timers[name];

    if (prevTime) {
      delete timers[name];
      const duration = getNow() - prevTime;
      this.trace({ ...payload, info: { duration, name } }, `${name}, ${duration}ms`);
    }
  };
};
