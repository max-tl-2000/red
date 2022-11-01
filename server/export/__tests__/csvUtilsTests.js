/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { transformMapsToCSV } from '../yardi/csvUtils';

describe('export csvUtilsTests', () => {
  describe('given a file type and an empty array', () => {
    it('csv should be empty', () => {
      const resultCSV = transformMapsToCSV('type', []);

      expect(resultCSV).to.deep.equal('');
    });
  });

  describe('given a file type and an empty object', () => {
    it('csv should be empty', () => {
      const resultCSV = transformMapsToCSV('type', [{}]);
      expect(resultCSV).to.deep.equal('');
    });
  });

  describe('given a file type and an object with a single entry', () => {
    it('csv should have a file type header, a column header, and a value row', () => {
      const obj = {
        key1: 'value1',
      };

      const resultCSV = transformMapsToCSV('type', [obj]);
      const expectedResult = `type
key1
"value1"`;

      expect(resultCSV).to.deep.equal(expectedResult);
    });
  });

  describe('given a file type and an object with and multiple entries', () => {
    it('csv should have a file type header, a column header, and values separated by comma', () => {
      const obj = {
        key1: 'value1',
        key2: 'value2',
      };

      const resultCSV = transformMapsToCSV('type', [obj]);

      const expectedResult = `type,
key1,key2
"value1","value2"`;

      expect(resultCSV).to.deep.equal(expectedResult);
    });

    it('undefined values should be included as empty strings', () => {
      const obj = {
        key1: 'value1',
        key2: undefined,
        key3: 'value3',
      };
      const resultCSV = transformMapsToCSV('type', [obj]);

      const expectedResult = `type,,
key1,key2,key3
"value1",,"value3"`;

      expect(resultCSV).to.deep.equal(expectedResult);
    });

    it('null values should be included as empty strings', () => {
      const obj = {
        key1: 'value1',
        key2: null,
        key3: 'value3',
      };

      const resultCSV = transformMapsToCSV('type', [obj]);

      const expectedResult = `type,,
key1,key2,key3
"value1",,"value3"`;

      expect(resultCSV).to.deep.equal(expectedResult);
    });
  });

  describe('given a file type and two objects with a single entry', () => {
    it('csv should have a file type header, a column header, and two value rows', () => {
      const obj1 = { key1: 'value1' };
      const obj2 = { key1: 'value2' };
      const resultCSV = transformMapsToCSV('type', [obj1, obj2]);

      const expectedResult = `type
key1
"value1"
"value2"`;

      expect(resultCSV).to.deep.equal(expectedResult);
    });
  });

  describe('given a file type and two maps with multiple entries', () => {
    it('csv should have a file header, column header, and value rows with more values', () => {
      const map1 = new Map();
      const map2 = new Map();
      map1.set('key1', 'value1');
      map1.set('key2', 'value2');
      map1.set('key3', 'value3');
      map2.set('key1', 'value4');
      map2.set('key2', 'value5');
      map2.set('key3', 'value6');

      const obj1 = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      };
      const obj2 = {
        key1: 'value4',
        key2: 'value5',
        key3: 'value6',
      };
      const resultCSV = transformMapsToCSV('type', [obj1, obj2]);

      const expectedResult = `type,,
key1,key2,key3
"value1","value2","value3"
"value4","value5","value6"`;

      expect(resultCSV).to.deep.equal(expectedResult);
    });
  });
});
