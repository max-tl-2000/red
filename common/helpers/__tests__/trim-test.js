/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from '../trim';

describe('jq-trim', () => {
  it('should trim a string', () => {
    const val = trim(' a simple string    ');
    expect(val).toEqual('a simple string');
  });
  it('should return an empty string if null is passed', () => {
    const val = trim(null);
    expect(val).toEqual('');
  });
  it('should return an empty string if undefined is passed', () => {
    const val = trim(undefined);
    expect(val).toEqual('');
  });
  it('should return the toString() of the passed object if non a string', () => {
    const val = trim({});
    expect(val).toEqual('[object Object]');
  });
});
