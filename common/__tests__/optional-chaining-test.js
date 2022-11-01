/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

describe('optional chaining', () => {
  it('should allow to access safely any prop on an object', () => {
    const struct = {
      foo: {
        bar: {
          hello: 'world',
        },
      },
    };

    const value = struct?.foo?.bar?.hello;

    expect(value).toEqual('world');
  });

  it("should allow to access safely any prop even when that prop doesn't exist", () => {
    const struct = {
      foo1: {
        bar1: {
          hello1: 'world',
          fn: () => 'foo:bar',
        },
      },
    };

    const value = struct?.foo?.bar?.hello;
    const fn = struct?.foo1?.bar1?.fn;
    const result = fn();

    expect(result).toEqual('foo:bar');
    expect(value).toEqual(undefined);
  });
});
