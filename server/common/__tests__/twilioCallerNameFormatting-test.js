/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable camelcase */
import { expect } from 'chai';
import { parseResult } from '../twillioHelper';

describe('when calling parseResult with null as the caller name', () => {
  it('should return an empty string as the formatted caller name', () => {
    const { callerName } = parseResult({ caller_name: { caller_name: null } });
    expect(callerName).to.equal('');
  });
});

describe('when calling parseResult with a caller name that does not contain a comma', () => {
  it('should return the caller name with first letter of each word capitalized', () => {
    const { callerName } = parseResult({ caller_name: { caller_name: 'JOHN DOE' } });
    expect(callerName).to.equal('John Doe');
  });
});

describe('when calling parseResult with a caller name containing a comma, we split the name by comma and trim each value', () => {
  it('should return the name by joining the array by space if the length of the array is 2 and one of the strings in the resulting array has < 3 characters', () => {
    const { callerName } = parseResult({ caller_name: { caller_name: 'JOHN, JR' } });
    expect(callerName).to.equal('John Jr');
  });
  it('should return the name by joining the reversed array by space if the length of the array is 2 and all of the strings in the resulting array have > 3 characters', () => {
    const { callerName } = parseResult({ caller_name: { caller_name: 'DOE, JOHN' } });
    expect(callerName).to.equal('John Doe');
  });
  it('should return the name by joining the array by space if the length of the array is 1', () => {
    const { callerName } = parseResult({ caller_name: { caller_name: 'JOHN DOE,' } });
    expect(callerName).to.equal('John Doe');
  });
  it('should return the name by joining the array by space if the length of the array is > 2', () => {
    const { callerName } = parseResult({ caller_name: { caller_name: 'JOHN, DOE, JR' } });
    expect(callerName).to.equal('John Doe Jr');
  });
});
