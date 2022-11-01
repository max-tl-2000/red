/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { combineCallbacks } from '../callbacks-helper';

const expectCalledWithoutNext = (fn, args) => {
  const [a, b] = fn.mock.calls[0];
  expect([a, b]).toEqual(args);
};

describe('callbacks-helper', () => {
  describe('combineCallbacks', () => {
    it('if no fns to combine are provided it should return undefined', () => {
      expect(combineCallbacks()).toEqual(undefined);
    });

    it('should call all of the callbacks if all of them call next', () => {
      const fnA = jest.fn((a, b, next) => {
        next();
      });

      const fnB = jest.fn((a, b, next) => {
        next();
      });

      const fnC = jest.fn((a, b, next) => {
        next();
      });

      const fn = combineCallbacks([fnA, fnB, fnC]);

      fn('hello', 'world');

      expectCalledWithoutNext(fnA, ['hello', 'world']);
      expectCalledWithoutNext(fnB, ['hello', 'world']);
      expectCalledWithoutNext(fnC, ['hello', 'world']);
    });

    it('should only call the first one if this one does not call next', () => {
      const fnA = jest.fn(() => {});
      const fnB = jest.fn(() => {});
      const fnC = jest.fn(() => {});

      const fn = combineCallbacks([fnA, fnB, fnC]);

      fn('hello', 'world');

      expectCalledWithoutNext(fnA, ['hello', 'world']);
      expect(fnB).not.toHaveBeenCalled();
      expect(fnC).not.toHaveBeenCalled();
    });

    it('should not execute fnC if fnB does not call next', () => {
      const fnA = jest.fn((a, b, next) => {
        next();
      });
      const fnB = jest.fn(() => {});
      const fnC = jest.fn(() => {});

      const fn = combineCallbacks([fnA, fnB, fnC]);

      fn('hello', 'world');

      expectCalledWithoutNext(fnA, ['hello', 'world']);
      expectCalledWithoutNext(fnB, ['hello', 'world']);
      expect(fnC).not.toHaveBeenCalled();
    });
  });
});
