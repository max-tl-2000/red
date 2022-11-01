/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import clsc from '../coalescy';

describe('coalescy', () => {
  it('should return the first non null value', () => {
    let result = clsc(null, []);
    expect(result).toEqual([]);

    result = clsc(null, {});
    expect(result).toEqual({});

    result = clsc(null, [], {});
    expect(result).toEqual([]);

    result = clsc(null, undefined, 0, {});
    expect(result).toEqual(0);

    const a = null;
    let b;
    const c = 0;
    const d = 1;

    result = clsc(a, b, c, d);
    expect(result).toEqual(0);
  });

  it('should return null when no arguments are passed', () => {
    const result = clsc();
    expect(result).toEqual(undefined);
  });
});
