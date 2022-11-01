/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { toProfiledFunction, setLoggingFunction, toObjectWithProfiledFunctions } from '../profiler';

let funcInfo;
let duration;
setLoggingFunction((f, d) => {
  funcInfo = f;
  duration = d;
});

describe('given a function', () => {
  const timeout = 100;
  const slowSum = async (a, b) => new Promise(resolve => setTimeout(() => resolve(a + b), timeout));

  describe('when it is wrapped in profiler', () => {
    const profiledSlowSum = toProfiledFunction(slowSum);

    it('should preserve behaviour', async () => {
      const funcRes = await slowSum(21, 21);
      const profiledFuncRes = await profiledSlowSum(21, 21);
      expect(profiledFuncRes).to.equal(funcRes);
    }, 14000);

    it('should log results', async () => {
      await profiledSlowSum(20, 22);

      expect(funcInfo).to.contain('slowSum');
      expect(duration).to.be.at.least(0.9 * timeout); // we can't trust JS timers to be 100% accurate
    }, 14000);
  });
});

describe('given an object', () => {
  const math = {
    square: x => x * x,
    squareRoot: x => Math.sqrt(x),
    pi: 3.1415,
  };

  describe('when it is wrapped in profiler', () => {
    const profiledMath = toObjectWithProfiledFunctions(math);

    it('should preserve object keys', () => {
      expect(profiledMath).to.have.all.keys(Object.keys(math));
    });

    it('should log profiling results for its functions', async () => {
      profiledMath.square(3);
      expect(funcInfo).to.contain('square');

      profiledMath.squareRoot(9);
      expect(funcInfo).to.contain('squareRoot');
    });
  });
});
