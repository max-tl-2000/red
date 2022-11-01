/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { obscureObject, normalizeFields } from '../logger-utils';
import { toMoment } from '../moment-utils';
import { LA_TIMEZONE } from '../../date-constants';

const propertiesToObscure = ['socSecNumber', 'token', 'Token', 'key', 'Key', 'authorization', 'Authorization', 'ssn', 'password'];

describe('logger-util-test', () => {
  describe('obscureObject', () => {
    it('should obscure the fields on an object', () => {
      const obj = {
        socSecNumber: 'socSecNumber',
        token: 'token',
        Token: 'Token',
        key: 'key',
        Key: 'Key',
        authorization: 'authorization',
        Authorization: 'Authorization',
        ssn: 'ssn',
        password: 'some password',
      };

      const result = obscureObject(obj, propertiesToObscure);

      expect(result).toMatchSnapshot();
    });

    it('should obscure the fields on an object except the ones that do not match the properties to obscure', () => {
      const obj = {
        socSecNumber: 'socSecNumber',
        token: 'token',
        Token: 'Token',
        key: 'key',
        Key: 'Key',
        authorization: 'authorization',
        Authorization: 'Authorization',
        ssn: 'ssn',
        password: 'some password',
        anotherField: 'some field',
        another: {
          field: {
            foo: 'bar',
          },
        },
      };

      const result = obscureObject(obj, propertiesToObscure);

      expect(result).toMatchSnapshot();
    });

    it('should obscure properties on nested objects', () => {
      const obj = {
        obscureMe: {
          ifYouCan: {
            whenNested: {
              socSecNumber: 'socSecNumber',
              token: 'token',
              Token: 'Token',
              key: 'key',
              Key: 'Key',
              authorization: 'authorization',
              Authorization: 'Authorization',
              ssn: 'ssn',
              password: 'some password',
              exceptMe: 'I should not be redacted',
            },
          },
        },
        anotherField: 'some field',
        another: {
          field: {
            foo: 'bar',
          },
        },
      };

      const result = obscureObject(obj, propertiesToObscure);

      expect(result).toMatchSnapshot();
    });

    it('should obscure properties on arrays as well', () => {
      const obj = {
        obscureMe: {
          ifYouCan: {
            whenNestedAsArray: [
              { socSecNumber: 'socSecNumber' },
              { token: 'token' },
              { Token: 'Token' },
              { key: 'key' },
              { Key: 'Key' },
              { authorization: 'authorization' },
              { Authorization: 'Authorization' },
              { ssn: 'ssn' },
              { password: 'some password', exceptMe: 'I should not be redacted' },
              { exceptMe: 'I should not be redacted' },
              'I should not be changed',
              'Or me since we are strings',
              { IShouldNotBeRedacted: { foo: 'bar' } },
            ],
          },
        },
        anotherField: 'some field',
        another: {
          field: {
            foo: 'bar',
          },
        },
        anArray: [
          { socSecNumber: 'socSecNumber' },
          { token: 'token' },
          { Token: 'Token' },
          { key: 'key' },
          { Key: 'Key' },
          { authorization: 'authorization' },
          { Authorization: 'Authorization' },
          { ssn: 'ssn' },
          { password: 'some password', exceptMe: 'I should not be redacted' },
          { exceptMe: 'I should not be redacted' },
          'I should not be changed',
          'Or me since we are strings',
          { IShouldNotBeRedacted: { foo: 'bar' } },
        ],
      };

      const result = obscureObject(obj, propertiesToObscure);

      expect(result).toMatchSnapshot();
    });

    describe('when null or undefined is provided', () => {
      it('should return null', () => {
        const obj = null;

        let result = obscureObject(obj, propertiesToObscure);
        expect(result).toEqual(null);

        result = obscureObject(undefined, propertiesToObscure);
        expect(result).toEqual(undefined);
      });
    });
  });

  describe('normalizeFields', () => {
    describe('when passing a nested object with 2 levels', () => {
      it('should return stringify the second level', () => {
        const obj = {
          levelId: 'level1',
          levelDifficulty: 'easy',
          nestedLevelTwo: {
            levelId: 'level2',
            levelDifficulty: 'medium',
          },
        };

        normalizeFields(obj);
        expect(obj).toMatchSnapshot();
      });
    });
    describe('when passing a nested object with 3 levels or more', () => {
      it('should return stringify the second level and beyond', () => {
        const obj = {
          levelId: 'level1',
          levelDifficulty: 'easy',
          nestedLevelTwo: {
            levelId: 'level2',
            levelDifficulty: 'medium',
            nestedLevelThree: {
              levelId: 'level3',
              levelDifficulty: 'hard',
              nestedLevelFour: {
                levelId: 'level4',
                levelDifficulty: 'extremly hard',
                nestedLevelFive: {
                  levelId: 'level5',
                  levelDifficulty: 'Stormy Ascent',
                },
              },
            },
          },
        };

        normalizeFields(obj);
        expect(obj).toMatchSnapshot();
      });
    });
    describe('when passing a nest object with multiple 2 levels', () => {
      it('should return stringify all second level', () => {
        const obj = {
          levelId: 'level1',
          levelDifficulty: 'easy',
          nestedLevelTwo: {
            levelId: 'level2',
            levelDifficulty: 'medium',
            nestedLevelThreeV1: {
              levelId: 'level3v1',
              levelDifficulty: 'hard',
            },
            nestedLevelTwoV2: {
              levelId: 'level2v2',
              levelDifficulty: 'medium',
            },
          },
        };

        normalizeFields(obj);
        expect(obj).toMatchSnapshot();
      });
    });
    describe('when passing an object with a valid moment object', () => {
      it('should return the moment property formated', () => {
        const momentValue = toMoment('2021-01-28T05:00:00Z', { timezone: LA_TIMEZONE });

        const obj = {
          levelId: 'level1',
          levelDifficulty: 'easy',
          momentValue,
        };

        normalizeFields(obj);
        expect(obj).toMatchSnapshot();
      });
    });
    describe('when passing an object with an invalid moment object', () => {
      it('should return the moment property as null', () => {
        const momentValue = toMoment('', { timezone: LA_TIMEZONE });

        const obj = {
          levelId: 'level1',
          levelDifficulty: 'easy',
          momentValue,
        };

        normalizeFields(obj);
        expect(obj).toMatchSnapshot();
      });
    });
  });

  describe('when passing an object with a nested quote object', () => {
    it('it should remove all quote object properties except the id as quoteId, and remove any cache objects', () => {
      const obj = {
        quote: { name: 'quoteAtTopLevel', id: 'quoteTopLevelId' },
        levelId: 'level1',
        levelDifficulty: 'easy',
        nestedLevelTwo: {
          levelId: 'level2',
          levelDifficulty: 'medium',
          cache: 'cacheAtLevel2',
        },
        cache: 'topLevelCache',
        person: { name: 'yoda', isYedi: true },
        application: {
          quote: { id: 2, name: 'name', cache: 'cacheInQuote' },
          cache: 'cacheInApplication',
          deepQuote: { deepQuoteId: '1234', quote: { id: 3, name: 'deepQuoteName', cache: 'cacheInDeepQuote' } },
        },
      };

      normalizeFields(obj); // this mutates obj
      expect(obj).toMatchSnapshot();

      // TODO: test to verify restorer function can be used to restore obj to its original sttate
    });
  });
});
