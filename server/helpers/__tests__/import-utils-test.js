/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { translateFlagCellValue, findInvalidElements, getMatchingElementIdsByName, validateIfElementsExist } from '../importUtils';

describe('importUtils', () => {
  describe('translateFlagCellValue', () => {
    it('should return true when receive "x" values', async () => {
      const test1 = translateFlagCellValue('x');
      expect(test1).to.be.true;
      const test2 = translateFlagCellValue('X');
      expect(test2).to.be.true;
    });

    it('should return true when receive "true" values', async () => {
      const test1 = translateFlagCellValue('true');
      expect(test1).to.be.true;
      const test2 = translateFlagCellValue('TRUE');
      expect(test2).to.be.true;
    });

    it('should return false when receive "" empty or "false" values', async () => {
      const test1 = translateFlagCellValue('');
      expect(test1).to.be.false;
      const test2 = translateFlagCellValue('false');
      expect(test2).to.be.false;
      const test3 = translateFlagCellValue('FALSE');
      expect(test3).to.be.false;
    });

    it('should return null when receive not allowed values for flags', async () => {
      const test1 = translateFlagCellValue('Another value');
      expect(test1).to.be.null;
    });

    it('should return null when receive undefined values', async () => {
      const test1 = translateFlagCellValue(undefined);
      expect(test1).to.be.null;
    });
  });

  describe('findInvalidElements', () => {
    const storedElements = [
      { id: '856629a4-8820-4503-9d11-b0d9bf9b8a3a', name: 'TestA' },
      { id: '906629a4-8820-4503-9d11-b0d9bf9b8a3a', name: 'TestB' },
    ];

    it('should return empty array when looking for invalid elements', async () => {
      const elementNames = ['TestA', 'TestB'];
      const result = findInvalidElements(elementNames, storedElements);
      expect(result).to.be.empty;
    });

    it('should return not empty array when looling for invalid elements', async () => {
      const elementNames = ['TestA', 'TestB', 'testc'];
      const result = findInvalidElements(elementNames, storedElements);
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.be.equal('testc');
    });
  });

  describe('getMatchingElementIdsByName', () => {
    const storedElements = [
      { id: '856629a4-8820-4503-9d11-b0d9bf9b8a3a', name: 'TestA' },
      { id: '906629a4-8820-4503-9d11-b0d9bf9b8a3a', name: 'TestB' },
    ];

    it('should return an array with matching Ids', async () => {
      const elementNames = ['TestA', 'TestB'];
      const result = getMatchingElementIdsByName(elementNames, storedElements);
      expect(result.length).to.be.equal(2);
      expect(result[0]).to.be.equal('856629a4-8820-4503-9d11-b0d9bf9b8a3a');
      expect(result[1]).to.be.equal('906629a4-8820-4503-9d11-b0d9bf9b8a3a');
    });

    it('should return an empty array when the list of names is undefined', () => {
      const elementNames = undefined;
      const result = getMatchingElementIdsByName(elementNames, storedElements);
      expect(result).to.be.empty;
    });

    it('should return only the Ids that match the storedElements', async () => {
      const elementNames = ['TestA', 'testc', 'testd'];
      const result = getMatchingElementIdsByName(elementNames, storedElements);
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.be.equal('856629a4-8820-4503-9d11-b0d9bf9b8a3a');
    });
  });

  describe('validateIfElementsExist', () => {
    const storedElementsObj = [
      { id: '856629a4-8820-4503-9d11-b0d9bf9b8a3a', name: 'AmenityA' },
      { id: '906629a4-8820-4503-9d11-b0d9bf9b8a3a', name: 'AmenityB' },
    ];

    it('should return an object with no error when all elements where found', async () => {
      const validateObj = {
        elementsStr: 'AmenityA, AmenityB',
        storedElements: storedElementsObj,
        columnName: 'amenities',
        errorMessage: 'ERROR_AMENITIES',
      };

      const result = validateIfElementsExist(validateObj);
      expect(result.elements.length).to.be.equal(2);
      expect(result.error).to.be.empty;
    });

    it('should return an object with error when all elements where not found', async () => {
      const validateObj = {
        elementsStr: 'AmenityA, AmenityC',
        storedElements: storedElementsObj,
        columnName: 'amenities',
        errorMessage: 'ERROR_AMENITIES',
      };

      const result = validateIfElementsExist(validateObj);
      expect(result.elements).to.be.equal(null);
      expect(result.error.length).to.be.equal(1);
      expect(result.error[0].name).to.be.equal('amenities');
      expect(result.error[0].message).to.be.equal('ERROR_AMENITIES: AmenityC');
    });
  });
});
