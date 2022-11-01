/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import clsc from './coalescy';

const trim = str => {
  if (typeof str !== 'string' && typeof str !== 'boolean' && typeof str !== 'number') {
    if (str !== null && str !== undefined) {
      // adding a warning for better identify cases where we
      // pass an object where a string is expected
      console.trace('string expected, but received an object', str);
    }
  }

  // we cannot use || operator as it produces the wrong values when we pass 0
  // when we pass `0` as number trim should return '0' as string but it was returning '';
  return `${clsc(str, '')}`.trim();
};

export default trim;
