/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('preprocess-value', () => {
  let preprocessValue;

  beforeEach(() => {
    mockModules({ '../gen-short-id': () => 'randomValue' });
    preprocessValue = require('../preprocess-value').default; // eslint-disable-line
  });

  afterEach(() => jest.resetModules());

  it('should return the original value if no command is found in the string', () => {
    const generatedEmail = preprocessValue('snoopy@reva.tech');
    expect(generatedEmail).toEqual('snoopy@reva.tech');
  });

  it('should return empty string if no value is provided', () => {
    const generatedEmail = preprocessValue();
    expect(generatedEmail).toEqual('');
  });

  it('should return empty string if empty string is provided', () => {
    const generatedEmail = preprocessValue('');
    expect(generatedEmail).toEqual('');
  });

  it('should throw if an object is provided', () => {
    expect(() => preprocessValue({})).toThrow('Value should be a string');
  });

  it('should throw if null is provided', () => {
    expect(() => preprocessValue(null)).toThrow('Value should be a string');
  });

  it('should throw if the command is not a recognized command', () => {
    expect(() => preprocessValue('__randomPhone()')).toThrow('Unknown command randomPhone');
  });

  describe('command: randomEmail', () => {
    // commands will follow this pattern __command(arg)
    it('should add a random unique value to the provided email if one is provided', () => {
      const generatedEmail = preprocessValue('__randomEmail(snoopy@reva.tech)');
      expect(generatedEmail).toEqual('snoopy+randomValue@reva.tech');
    });
  });
});
