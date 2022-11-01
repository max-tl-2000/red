/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import path from 'path';
import expectedRentMatrixForLastUnit from './resources/expectedRentMatrixForLastUnit.json';
import expectedRentMatrixForMissingRentCase from './resources/expectedRentMatrixForMissingRentCase.json';
import expectedRentMatrixForMismatchCase from './resources/expectedRentMatrixForMismatchCase.json';
import { RmsImportError } from '../../../../common/enums/enums';
import { DALTypes } from '../../../../common/enums/DALTypes';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

const READING_TIMEOUT = 30 * 1000;

const parsedUnitKeys = [
  'externalId',
  'availDate',
  'status',
  'amenityValue',
  'rmsProvider',
  'fileName',
  'rentMatrix',
  'standardLeaseLength',
  'standardRent',
  'minRentLeaseLength',
  'minRentStartDate',
  'minRentEndDate',
  'minRent',
  'amenities',
  'type',
];

const validateErrorsAndUnits = (results, errorsLength, unitExternalId, errorMsgs, unitsLength) => {
  expect(results.errors).to.have.lengthOf(errorsLength);
  expect(results.errors[0].externalId).to.equal(unitExternalId);

  results.errors[0].messages.forEach((msg, index) => {
    expect(errorMsgs[index]).to.equal(msg);
  });
  expect(results.units).to.have.lengthOf(unitsLength);
};

const validateParserOutputData = (unit, expectedValues) => {
  const {
    unitExternalId,
    standardLeaseLength,
    standardRent,
    minRentLeaseLength,
    minRentStartDate,
    minRentEndDate,
    minRent,
    rentMatrix,
    amenities,
    type,
  } = expectedValues;
  expect(unit).to.have.all.keys(...parsedUnitKeys);
  expect(unit.externalId).to.equal(unitExternalId);
  expect(unit.standardLeaseLength).to.equal(standardLeaseLength);
  expect(unit.standardRent).to.equal(standardRent);
  expect(unit.minRentLeaseLength).to.equal(minRentLeaseLength);
  expect(unit.minRentStartDate).to.equal(minRentStartDate);
  expect(unit.minRentEndDate).to.equal(minRentEndDate);
  expect(unit.minRent).to.equal(minRent);
  expect(unit.amenities).to.equal(amenities);
  expect(unit.type).to.equal(type);

  expect(unit.rentMatrix).to.deep.equal(rentMatrix);
};

describe('LRO Parser', () => {
  mockModules({
    '../../../dal/propertyRepo.js': {
      getPropertyByRmsExternalId: () => ({ timezone: 'America/Los_Angeles' }),
    },
  });

  const { parseFile } = require('../parsers/lro'); //eslint-disable-line

  describe('When the xml has correct data and structure', () => {
    it(
      'should return the parsed xml object with all the units',
      async () => {
        const filePath = path.join(__dirname, './resources/LROPricing_With_CorrectData.XML');
        const results = await parseFile({}, { filePath });

        expect(results.errors).to.have.lengthOf(0);
        expect(results.units).to.have.lengthOf(18);

        results.units.forEach(unit => expect(unit).to.have.all.keys(...parsedUnitKeys));

        const lastUnit = results.units[17];
        expect(lastUnit.externalId).to.equal('141-BARB');
        expect(lastUnit.rentMatrix).to.deep.equal(expectedRentMatrixForLastUnit);
      },
      READING_TIMEOUT,
    );
  });

  describe('When the xml has a unit with a lease term missing a rent in a date range', () => {
    it(
      'should return the parsed xml object without that unit and error message',
      async () => {
        const filePath = path.join(__dirname, './resources/LROPricing_With_Missing_Rent_For_Date_Range.XML');
        const results = await parseFile({}, { filePath });
        validateErrorsAndUnits(results, 1, '141-BARB', ['Rent missing for a date range between lease terms 3 - 4'], 1);

        const unit = results.units[0];
        validateParserOutputData(unit, {
          unitExternalId: '131-BARB',
          standardLeaseLength: '12',
          standardRent: '3467.00',
          minRentLeaseLength: '14',
          minRentStartDate: '2017-12-07',
          minRentEndDate: '2017-12-21',
          minRent: '3462.00',
          rentMatrix: expectedRentMatrixForMissingRentCase,
          amenities: 'End Unit - 1BD - B | Vaulted Ceilings - 1BD - B',
          type: DALTypes.InventoryType.UNIT,
        });
      },
      READING_TIMEOUT,
    );
  });

  describe('When the xml has a unit with a lease term mismatching the date range', () => {
    it(
      'should return the parsed xml object without that unit and error message',
      async () => {
        const filePath = path.join(__dirname, './resources/LROPricing_With_Mismatch_Date_Range.XML');
        const results = await parseFile({}, { filePath });
        validateErrorsAndUnits(results, 1, '131-BARB', ['Mismatch in date ranges for lease terms 3 - 4'], 1);

        const unit = results.units[0];
        validateParserOutputData(unit, {
          unitExternalId: '141-BARB',
          standardLeaseLength: '12',
          standardRent: '4874.00',
          minRentLeaseLength: '10',
          minRentStartDate: '2017-11-22',
          minRentEndDate: '2017-12-06',
          minRent: '4269.00',
          rentMatrix: expectedRentMatrixForMismatchCase,
          amenities: 'End Unit - 2BD - B | Vaulted Ceilings - 2BD - B',
          type: DALTypes.InventoryType.UNIT,
        });
      },
      READING_TIMEOUT,
    );
  });

  describe('When the xml has a unit with a lease term with an startDate not consecutive after de last range endDate', () => {
    it('should return the parsed xml object without that unit and error message', async () => {
      const filePath = path.join(__dirname, './resources/LROPricing_With_StartDates_Overlaping_EndDates.XML');
      const results = await parseFile({}, { filePath });

      validateErrorsAndUnits(results, 1, '141-BARB', ['Start date is not after previous end date for lease term 3'], 0);
    });
  });

  describe('When the xml has a unit with a lease term with a total concession different than zero', () => {
    it('should return the parsed xml object without that unit and error message', async () => {
      const filePath = path.join(__dirname, './resources/LROPricing_With_Non_Zero_Total_Concession.XML');
      const results = await parseFile({}, { filePath });
      validateErrorsAndUnits(results, 1, '141-BARB', ['Non-zero concession for', 'Rent missing for a date range between lease terms 13 - 14'], 0);
    });
  });

  describe('When the xml has a unit with a lease term with a bad structure', () => {
    it(
      'should throw an error',
      async () => {
        try {
          const filePath = path.join(__dirname, './resources/LROPricing_With_Bad_Structure.XML');
          await parseFile({}, { filePath });
        } catch (e) {
          expect(e[0].rmsErrorType).to.equal(RmsImportError.PARSING_FAILED_ERROR);
          const errorMsg = e[0].messages[0].split('\nLine:');
          expect(errorMsg[0]).to.equal('Unexpected close tag');
        }
      },
      READING_TIMEOUT,
    );
  });
});
