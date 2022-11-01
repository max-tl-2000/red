/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { addParamsToUrl } from '../urlParams';

describe("when calling addParamsToUrl with undefined 'params'", () => {
  it("should throw 'missing params' error", async () => {
    expect(() => addParamsToUrl('http://www.something.com')).to.throw(/missing params/);
  });
});

describe("when calling addParamsToUrl with 'params' that is not an object", () => {
  it("should throw 'invalid params' error", async () => {
    expect(() => addParamsToUrl('http://www.something.com', 42)).to.throw(/invalid params/);
  });
});

describe("when calling addParamsToUrl and 'params' contains a field that is undefined", () => {
  it('should ignore the field', async () => {
    const res = addParamsToUrl('http://www.something.com?c=test', {
      a: undefined,
      b: '42',
    });
    expect(res).to.equal('http://www.something.com?c=test&b=42');
  });
});

describe('when adding query parameters to url with no params', () => {
  it('should return correct url', async () => {
    const res = addParamsToUrl('http://www.something.com', { a: 1, b: '42' });
    expect(res).to.equal('http://www.something.com?a=1&b=42');
  });
});

describe('when adding query parameters to url with existing params', () => {
  it('should return correct url', async () => {
    const res = addParamsToUrl('http://www.something.com?c=test', {
      a: 1,
      b: '42',
    });
    expect(res).to.equal('http://www.something.com?c=test&a=1&b=42');
  });
});
