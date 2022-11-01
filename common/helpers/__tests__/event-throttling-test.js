/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initThrottlerer } from '../eventThrottling';

describe('similar events throttling', () => {
  const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));

  let throttler;
  beforeEach(() => {
    throttler = initThrottlerer({ duration: 50 });
  });

  describe('given two similar events', () => {
    describe('within the defined interval', () => {
      it('only 1 ocurrence should be observed', async () => {
        let callbackCount = 0;

        throttler.onNext({
          data: 'party 1',
          handler: () => callbackCount++,
        });

        throttler.onNext({
          data: 'party 1',
          handler: () => callbackCount++,
        });

        await delay(100);
        expect(callbackCount).toEqual(1);
      });
    });

    describe('with a larger delay than defined interval between them', () => {
      it('both ocurrences should be observed', async () => {
        let callbackCount = 0;

        throttler.onNext({
          data: 'party 1',
          handler: () => callbackCount++,
        });

        await delay(100);

        throttler.onNext({
          data: 'party 1',
          handler: () => callbackCount++,
        });

        await delay(100);
        expect(callbackCount).toEqual(2);
      });
    });

    describe('within the defined interval, with a different event between them', () => {
      it('1 ocurrence of each event type should be observed', async () => {
        let event1CallbackCount = 0;
        let event2CallbackCount = 0;

        throttler.onNext({
          data: 'party 1',
          handler: () => event1CallbackCount++,
        });

        throttler.onNext({
          data: 'party 2',
          handler: () => event2CallbackCount++,
        });

        throttler.onNext({
          data: 'party 1',
          handler: () => event1CallbackCount++,
        });

        await delay(100);
        expect(event1CallbackCount).toEqual(1);
        expect(event2CallbackCount).toEqual(1);
      });
    });
  });
});
