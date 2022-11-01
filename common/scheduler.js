/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export class SimpleScheduler {
  fnsQueue = [];

  scheduleForLater = fn => {
    this.fnsQueue.push(fn);
  };

  constructor(logger) {
    this.logger = logger;
  }

  flush = async () => {
    for (let i = 0; i < this.fnsQueue.length; i++) {
      const fn = this.fnsQueue[i];
      try {
        await fn();
      } catch (err) {
        const { logger } = this;
        logger && logger.error({ err }, 'flush error');
      }
    }
  };
}
