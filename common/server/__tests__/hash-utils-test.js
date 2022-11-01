/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import { getObjectHash, getStringHash, getQueryHash, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION } from '../hash-utils';

describe('common/server/hash-utils', () => {
  describe('when calling getStringHash()', () => {
    it('should return a hash string for the given string', () => {
      expect(getStringHash('')).to.equal('d41d8cd98f00b204e9800998ecf8427e');

      const testString = 'test';
      const expectedStringHash = '098f6bcd4621d373cade4e832627b4f6';
      expect(getStringHash(testString)).to.equal(expectedStringHash);
      expect(getStringHash(testString)).to.equal(expectedStringHash);
    });

    it('should throw an exception when something other than a string is passed', () => {
      const testObject = { testObj: 'testObject' };
      expect(() => getStringHash()).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getStringHash(testObject)).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getStringHash(0)).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getStringHash([3, 2, 1])).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getObjectHash(true)).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getObjectHash('test')).not.to.throw;
    });
  });

  describe('when calling getObjectHash()', () => {
    it('should return a hash string for the given object', () => {
      expect(getObjectHash({})).to.equal('99914b932bd37a50b983c5e7c90ae93b');

      const testObject = { testObj: 'testString' };
      const expectedObjectHash = '2a4541bbce2cf1e7bd4e826e98e640bb';
      expect(getObjectHash(testObject)).to.equal(expectedObjectHash);
      expect(getObjectHash(testObject)).to.equal(expectedObjectHash);
      expect(getObjectHash({ ...testObject, newProp: 'newProp' })).to.not.equal(expectedObjectHash);
    });

    it('should throw an exception when something other than an object is passed', () => {
      expect(() => getObjectHash()).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getObjectHash(0)).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getObjectHash([3, 4, 5])).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getObjectHash(true)).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getObjectHash({})).not.to.throw;
    });
  });

  describe('when calling getQueryHash()', () => {
    it('should return a hash string for the given knex query', () => {
      const query = 'SELECT * FROM "fddf3b8e-6c9f-11eb-83d8-8f5e5d601d61"."Activity"';
      const testQueryObj = { query };
      const expectedQueryHashFromObj = '1441a7909c087dbbe7ce59881b9df8b9';
      expect(getQueryHash(testQueryObj)).to.equal(expectedQueryHashFromObj);
      expect(getQueryHash(testQueryObj)).to.equal(expectedQueryHashFromObj);

      const expectedQueryHashFromString = '7df65c737676358d29ad6db7b48ee48e';
      expect(getQueryHash(query)).to.equal(expectedQueryHashFromString);
      expect(getQueryHash(query)).to.equal(expectedQueryHashFromString);
    });

    it('should throw an exception when something other than an object or string is passed', () => {
      expect(() => getQueryHash()).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getQueryHash(0)).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getQueryHash([1, 2, 3])).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getQueryHash(true)).to.throw(Error, HASH_UNEXPECTED_PARAM_TYPE_EXCEPTION);
      expect(() => getQueryHash({ query: 'update ...' })).not.to.throw;
      expect(() => getQueryHash('select ...')).not.to.throw;
    });
  });
});
