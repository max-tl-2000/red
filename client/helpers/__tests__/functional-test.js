/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, sandboxer } from 'test-helpers';
import { once } from '../functional';

describe('functional', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sandboxer.create();
  });

  describe('#once()', () => {
    it('invokes the wrapped function only once', () => {
      let callsCount = 0;
      const someFunction = sandbox.spy(() => callsCount++);

      const wrappedFunction = once(someFunction);
      wrappedFunction();
      wrappedFunction();

      expect(callsCount).to.equal(1);
    });

    it('returns memoized function result on subsequent calls', () => {
      const someResult = {};
      const someFunction = sandbox.spy(() => someResult);

      const wrappedFunction = once(someFunction);
      const firstResult = wrappedFunction();
      const secondResult = wrappedFunction();

      expect(firstResult).to.equal(someResult);
      expect(secondResult).to.equal(someResult);
    });

    it('passes list of arguments to wrapped functions', done => {
      const someParams = [1, 'some', true];
      const someFunction = sandbox.spy((...args) => {
        expect(args.length).to.equal(someParams.length);
        expect(args[0]).to.equal(someParams[0]);
        expect(args[1]).to.equal(someParams[1]);
        expect(args[2]).to.equal(someParams[2]);
        done();
      });

      const wrappedFunction = once(someFunction);
      wrappedFunction(...someParams);
    });

    it('context of wrapped function is object if assigned to one', done => {
      const someContext = {};
      const someFunction = sandbox.spy(function someName() {
        expect(this === someContext).to.equal(true);
        done();
      });

      someContext.wrappedFunction = once(someFunction);
      someContext.wrappedFunction();
    });
  });
});
