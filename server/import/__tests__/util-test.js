/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { isValidDecimal, isValidPercentage, trimAndSplitByComma } from '../../../common/regex';
const { mock } = require('test-helpers/mocker').default(jest);

describe('Import validations', () => {
  let Validation;
  let validate;
  let validateData;
  let isValidMinimumValue;
  let getValueToPersist;
  let getRelatedIds;

  beforeEach(() => {
    mock('../../dal/genericRepo.js', () => ({
      selectIdAndFieldFromValueList: sinon.stub().returns([
        {
          id: 1,
          propertyName: 'property',
        },
      ]),
      selectIdFromValueGroups: sinon.stub().returns([
        {
          id: 123,
          propertyId: 1,
          name: 'building',
        },
      ]),
    }));

    const utils = require('../inventory/util.js'); // eslint-disable-line

    Validation = utils.Validation;
    validate = utils.validate;
    validateData = utils.validateData;
    isValidMinimumValue = utils.isValidMinimumValue;
    getValueToPersist = utils.getValueToPersist;
    getRelatedIds = utils.getRelatedIds;
  });

  it('should return fieldName with empty value on NotEmpty error', async () => {
    const REQUIRED_NOT_EMPTY = [
      {
        fieldName: 'name',
        validation: Validation.NOT_EMPTY,
      },
    ];

    const elementEmpty = {
      name: '',
    };

    const elementNull = {
      name: null,
    };

    const elementNotEmpty = {
      name: 'Name',
    };

    const resultEmpty = validateData(elementEmpty, REQUIRED_NOT_EMPTY);
    expect(resultEmpty.length).to.equal(1);
    expect(resultEmpty[0].name).to.equal('name');
    expect(resultEmpty[0].message).to.equal('FIELD_REQUIRED');

    const resultNull = validateData(elementNull, REQUIRED_NOT_EMPTY);
    expect(resultNull).to.not.be.empty;
    expect(resultNull.length).to.equal(1);
    expect(resultNull[0].name).to.equal('name');
    expect(resultNull[0].message).to.equal('FIELD_REQUIRED');

    const resultNotEmpty = validateData(elementNotEmpty, REQUIRED_NOT_EMPTY);
    expect(resultNotEmpty.length).to.equal(0);
  });

  it('should return fieldName with invalid value on existIn error', async () => {
    const VALID_VALUES = {
      VALID_TYPE1: 'Valid Type1',
      VALID_TYPE2: 'Valid Type2',
    };

    const REQUIRED_EXISTS_IN = [
      {
        fieldName: 'type',
        validation: Validation.EXISTS_IN,
        validValues: VALID_VALUES,
      },
    ];

    const elementEmpty = {
      type: '',
    };

    const elementInvalidTypes = [{ type: 'Invalid Type' }, { type: 'Valid Type, Valid Type2' }, { type: 'Valid Type1, Valid Type' }];

    const elementValidTypes = [{ type: 'Valid Type2, Valid Type1' }, { type: 'valid type2, VaLiD Type1' }];

    elementInvalidTypes.forEach(elementInvalidType => {
      const resultInvalidType = validateData(elementInvalidType, REQUIRED_EXISTS_IN);
      expect(resultInvalidType.length).to.equal(1);
      expect(resultInvalidType[0].name).to.equal('type');
      expect(resultInvalidType[0].message).to.equal('INVALID_VALUE');
    });

    const resultEmpty = validateData(elementEmpty, REQUIRED_EXISTS_IN);
    expect(resultEmpty.length).to.equal(0);

    elementValidTypes.forEach(elementValidType => {
      const resultValidType = validateData(elementValidType, REQUIRED_EXISTS_IN);
      expect(resultValidType.length, `${elementValidType.type} expected to validate EXISTS_IN from ${JSON.stringify(VALID_VALUES)}`).to.equal(0);
    });
  });

  it('should return fieldNames with empty value on atLeastOneNotEmpty error', async () => {
    const REQUIRED_AT_LEAST_ONE_NOT_EMPTY = [
      {
        fieldNames: ['owner', 'ownerGroup'],
        validation: Validation.AT_LEAST_ONE_NOT_EMPTY,
      },
    ];

    const elementEmpty = {
      owner: '',
      ownerGroup: '',
    };

    const elementNotEmpty = {
      owner: '',
      ownerGroup: 'Name',
    };

    const resultEmpty = validateData(elementEmpty, REQUIRED_AT_LEAST_ONE_NOT_EMPTY);
    expect(resultEmpty.length).to.equal(2);
    expect(resultEmpty[0].name).to.equal('owner');
    expect(resultEmpty[0].message).to.equal('ONE_OF_THIS_FIELDS_REQUIRED');
    expect(resultEmpty[1].name).to.equal('ownerGroup');
    expect(resultEmpty[1].message).to.equal('ONE_OF_THIS_FIELDS_REQUIRED');

    const resultNotEmpty = validateData(elementNotEmpty, REQUIRED_AT_LEAST_ONE_NOT_EMPTY);
    expect(resultNotEmpty.length).to.equal(0);
  });

  it('should return fields with invalid length', async () => {
    const ALPHANUMERIC_VALIDATION = [
      {
        fieldName: 'name',
        validation: Validation.ALPHANUMERIC,
        maxLength: 5,
      },
    ];

    const correctElementSize = {
      name: 'name',
    };

    const incorrectElementSize = {
      name: 'incorrectName',
    };

    const incorrectResult = validateData(incorrectElementSize, ALPHANUMERIC_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('name');
    expect(incorrectResult[0].message).to.equal('INVALID_LENGTH');

    const correctResult = validateData(correctElementSize, ALPHANUMERIC_VALIDATION);
    expect(correctResult.length).to.equal(0);
  });

  it('should return fields with invalid boolean value', async () => {
    const BOOLEAN_VALIDATION = [
      {
        fieldName: 'boolean',
        validation: Validation.BOOLEAN,
      },
    ];

    const correctElement = {
      boolean: 'true',
    };

    const incorrectElement = {
      boolean: 'incorrectName',
    };

    const incorrectResult = validateData(incorrectElement, BOOLEAN_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('boolean');
    expect(incorrectResult[0].message).to.equal('NOT_BOOLEAN');

    const correctResult = validateData(correctElement, BOOLEAN_VALIDATION);
    expect(correctResult.length).to.equal(0);
  });

  it('should return fields with invalid url value', async () => {
    const URL_VALIDATION = [
      {
        fieldName: 'displayUrl',
        validation: Validation.URL,
      },
    ];

    const correctElement = {
      displayUrl: 'https://customeroldapartments.com/forest-park-apartments/fb',
    };

    const incorrectElement = {
      displayUrl: 'www.customeroldapartments.com/forest-park-apartments/fb',
    };

    const incorrectResult = validateData(incorrectElement, URL_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('displayUrl');
    expect(incorrectResult[0].message).to.equal('INVALID_URL');

    const correctResult = validateData(correctElement, URL_VALIDATION);
    expect(correctResult.length).to.equal(0);
  });

  it('should return fields with invalid date value', async () => {
    const DATE_VALIDATION = [
      {
        fieldName: 'date',
        validation: Validation.DATE,
      },
    ];

    const correctElement = {
      date: '05/25/2016',
    };

    const incorrectElement = {
      date: 'incorrectName',
    };

    const incorrectResult = validateData(incorrectElement, DATE_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('date');
    expect(incorrectResult[0].message).to.equal('INVALID_DATE');

    const correctResult = validateData(correctElement, DATE_VALIDATION);
    expect(correctResult.length).to.equal(0);
  });

  it('should return fields with validation percentage value', async () => {
    const PERCENTAGE_VALIDATION = [
      {
        fieldName: 'relativePrice',
        validation: Validation.PERCENTAGE,
      },
    ];

    const correctElement = {
      relativePrice: '10.5',
    };

    const correctElement2 = {
      relativePrice: '-100',
    };

    const incorrectElement = {
      relativePrice: '101',
    };

    const correctResult = validateData(correctElement, PERCENTAGE_VALIDATION);
    expect(correctResult.length).to.equal(0);
    const correctResult2 = validateData(correctElement2, PERCENTAGE_VALIDATION);
    expect(correctResult2.length).to.equal(0);
    const incorrectResult = validateData(incorrectElement, PERCENTAGE_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('relativePrice');
    expect(incorrectResult[0].message).to.equal('INVALID_PERCENTAGE_VALUE');
  });

  describe('Splitting strings into arrays', () => {
    const string1 = 'Adamsville,        Aberdeen Place, Abigton';

    const string2 = 'Adamsville, Aberdeen Place,,, Abigton, ,,,, AdCity';

    const nullString = null;

    it('should return correct array from string split', async () => {
      const elementsArray1 = trimAndSplitByComma(string1);
      expect(elementsArray1).to.eql(['Adamsville', 'Aberdeen Place', 'Abigton']);
      const elementsArray2 = trimAndSplitByComma(string2);
      expect(elementsArray2).to.eql(['Adamsville', 'Aberdeen Place', 'Abigton', 'AdCity']);

      const elementsArray3 = trimAndSplitByComma('Messages, Hello\\, World, Hobbies, JavaScript\\, Programming');
      expect(elementsArray3).to.eql(['Messages', 'Hello, World', 'Hobbies', 'JavaScript, Programming']);

      const elementsArray4 = trimAndSplitByComma('The unit was incredibly clean\\, updated & refreshed & friendly staff.');
      expect(elementsArray4).to.eql(['The unit was incredibly clean, updated & refreshed & friendly staff.']);
    });

    it('should return null from null string split', async () => {
      const elementsArray1 = trimAndSplitByComma(nullString);
      expect(elementsArray1).to.be.empty;
    });
  });

  [2, 5].forEach(itemNumber => {
    describe(`Valid min allowed values # ${itemNumber}`, () => {
      const minValue = 2;

      it('should return is valid value >=  to min value', async () => {
        const validValue = isValidMinimumValue(itemNumber, minValue);
        expect(validValue).to.be.true;
      });
    });
  });

  [-3, 0, 1].forEach(itemNumber => {
    describe(`Invalid min allowed values # ${itemNumber}`, () => {
      const minValue = 2;

      it('should return is invalid value < to min value', async () => {
        const validValue = isValidMinimumValue(itemNumber, minValue);
        expect(validValue).to.be.false;
      });
    });
  });

  ['100', -115, 100.57, '-115.9999'].forEach(itemNumber => {
    describe(`Valid decimal value ${itemNumber} with precision`, () => {
      it('should return is valid decimal entry', async () => {
        const isDecimal = isValidDecimal(itemNumber);
        expect(isDecimal).to.be.true;
      });
    });
  });

  ['-75.', '10.'].forEach(itemNumber => {
    describe(`Invalid decimal value ${itemNumber} with precision`, () => {
      it('should return is invalid decimal entry', async () => {
        const isDecimal = isValidDecimal(itemNumber);
        expect(isDecimal).to.be.false;
      });
    });
  });

  ['-100', '-1.15', '0', '0.5', '10.5', '90', '100', '-8.3333333'].forEach(itemNumber => {
    describe(`Valid percentage value ${itemNumber}`, () => {
      it('should return true for validation percentage number', async () => {
        const validPercentage = isValidPercentage(itemNumber);
        expect(validPercentage).to.be.true;
      });
    });
  });

  ['-101', '101'].forEach(itemNumber => {
    describe(`Invalid percentage value ${itemNumber}`, () => {
      it('should return false for validation percentage number', async () => {
        const invalidPercentage = isValidPercentage(itemNumber);
        expect(invalidPercentage).to.be.false;
      });
    });
  });

  describe('Validating numbers', () => {
    const correctInteger = {
      number: '5',
    };

    const correctDecimal = {
      number: '6.5',
    };

    const correctNegativeInteger = {
      number: '-1',
    };

    const correctNegativeDecimal = {
      number: '-5.5',
    };

    const incorrectNumber = {
      number: 'incorrectName',
    };

    it('should return incorrect field with numeric values', async () => {
      const NUMERIC_VALIDATION = [
        {
          fieldName: 'number',
          validation: Validation.NUMERIC,
        },
      ];

      const integerValidation = validateData(correctInteger, NUMERIC_VALIDATION);
      expect(integerValidation.length).to.equal(0);

      const decimalValidation = validateData(correctDecimal, NUMERIC_VALIDATION);
      expect(decimalValidation.length).to.equal(0);

      const negativeIntegerValidation = validateData(correctNegativeInteger, NUMERIC_VALIDATION);
      expect(negativeIntegerValidation.length).to.equal(0);

      const negativeDecimalValidation = validateData(correctNegativeDecimal, NUMERIC_VALIDATION);
      expect(negativeDecimalValidation.length).to.equal(0);

      const stringValidation = validateData(incorrectNumber, NUMERIC_VALIDATION);
      expect(stringValidation).to.not.be.empty;
      expect(stringValidation.length).to.equal(1);
      expect(stringValidation[0].name).to.equal('number');
      expect(stringValidation[0].message).to.equal('NOT_A_NUMBER');
    });

    it('should return incorrect field with non integer values', async () => {
      const NUMERIC_VALIDATION = [
        {
          fieldName: 'number',
          validation: Validation.INTEGER,
        },
      ];

      const integerValidation = validateData(correctInteger, NUMERIC_VALIDATION);
      expect(integerValidation.length).to.equal(0);

      const decimalValidation = validateData(correctDecimal, NUMERIC_VALIDATION);
      expect(decimalValidation.length).to.equal(1);
      expect(decimalValidation[0].name).to.equal('number');
      expect(decimalValidation[0].message).to.equal('NOT_INTEGER');

      const negativeIntegerValidation = validateData(correctNegativeInteger, NUMERIC_VALIDATION);
      expect(negativeIntegerValidation.length).to.equal(0);

      const negativeDecimalValidation = validateData(correctNegativeDecimal, NUMERIC_VALIDATION);
      expect(negativeDecimalValidation).to.not.be.empty;
      expect(negativeDecimalValidation.length).to.equal(1);
      expect(negativeDecimalValidation[0].name).to.equal('number');
      expect(negativeDecimalValidation[0].message).to.equal('NOT_INTEGER');

      const stringValidation = validateData(incorrectNumber, NUMERIC_VALIDATION);
      expect(stringValidation).to.not.be.empty;
      expect(stringValidation.length).to.equal(1);
      expect(stringValidation[0].name).to.equal('number');
      expect(stringValidation[0].message).to.equal('NOT_INTEGER');
    });

    it('should return incorrect field with non currency values', async () => {
      const incorrectCurrency = {
        amount: '100.00',
      };

      const CURRENCY_VALIDATION = [
        {
          fieldName: 'amount',
          validation: Validation.CURRENCY,
        },
      ];

      const currencyValidation = validateData(incorrectCurrency, CURRENCY_VALIDATION);
      expect(currencyValidation.length).to.equal(1);
      expect(currencyValidation[0].name).to.equal('amount');
      expect(currencyValidation[0].message).to.equal('INVALID_CURRENCY');
    });

    it('should return correct field with currency values', async () => {
      const correctPositiveCurrency = {
        amount: '$100.00',
      };

      const correctNegativeCurrency = {
        amount: '$-100.00',
      };

      const CURRENCY_VALIDATION = [
        {
          fieldName: 'amount',
          validation: Validation.CURRENCY,
        },
      ];

      const currencyPositiveValidation = validateData(correctPositiveCurrency, CURRENCY_VALIDATION);
      expect(currencyPositiveValidation.length).to.equal(0);
      const currencyNegativeValidation = validateData(correctNegativeCurrency, CURRENCY_VALIDATION);
      expect(currencyNegativeValidation.length).to.equal(0);
    });

    it('should return correct field with numeric array values', async () => {
      const correctNumericArray = {
        numericArray: '2, -4, 10, 12, 24',
      };

      const NUMERIC_ARRAY_VALIDATION = [
        {
          fieldName: 'numericArray',
          validation: Validation.NUMERIC_ARRAY,
        },
      ];

      const numericArrayValidation = validateData(correctNumericArray, NUMERIC_ARRAY_VALIDATION);
      expect(numericArrayValidation.length).to.equal(0);
    });

    it('should return incorrect field with numeric array values', async () => {
      const incorrectNumericArray = {
        numericArray: '2, "a", 10, "b", 24',
      };

      const NUMERIC_ARRAY_VALIDATION = [
        {
          fieldName: 'numericArray',
          validation: Validation.NUMERIC_ARRAY,
        },
      ];

      const numericArrayValidation = validateData(incorrectNumericArray, NUMERIC_ARRAY_VALIDATION);
      expect(numericArrayValidation.length).to.equal(1);
      expect(numericArrayValidation[0].name).to.equal('numericArray');
      expect(numericArrayValidation[0].message).to.equal('INVALID_NUMERIC_ARRAY');
    });

    it('should return correct field with min value validation', async () => {
      const correctValueWithMinimum = {
        valueWithMinimum: 2,
      };

      const MIN_VALUE_VALIDATION = [
        {
          fieldName: 'valueWithMinimum',
          validation: Validation.MIN_VALUE,
          minValue: 1,
        },
      ];

      const minValueValidation = validateData(correctValueWithMinimum, MIN_VALUE_VALIDATION);
      expect(minValueValidation.length).to.equal(0);
    });

    it('should return incorrect field with min value validation', async () => {
      const incorrectValueWithMinimum = {
        valueWithMinimum: 1,
      };

      const MIN_VALUE_VALIDATION = [
        {
          fieldName: 'valueWithMinimum',
          validation: Validation.MIN_VALUE,
          minValue: 2,
        },
      ];

      const minValueValidation = validateData(incorrectValueWithMinimum, MIN_VALUE_VALIDATION);
      expect(minValueValidation.length).to.equal(1);
      expect(minValueValidation[0].name).to.equal('valueWithMinimum');
      expect(minValueValidation[0].message).to.equal('INVALID_MIN_VALUE');
    });

    it('should return no error when the field to be validated is less than MAX_VALUE', async () => {
      const data = {
        fieldToBeValidated: 2,
      };

      const MAX_VALUE_VALIDATION = [
        {
          fieldName: 'fieldToBeValidated',
          validation: Validation.MAX_VALUE,
          maxValue: 3,
        },
      ];

      const maxValueValidation = validateData(data, MAX_VALUE_VALIDATION);
      expect(maxValueValidation.length).to.equal(0);
    });

    it('should return an error when the field to be validated is greater than MAX_VALUE', async () => {
      const data = {
        fieldToBeValidated: 2,
      };

      const MAX_VALUE_VALIDATION = [
        {
          fieldName: 'fieldToBeValidated',
          validation: Validation.MAX_VALUE,
          maxValue: 1,
        },
      ];

      const maxValueValidation = validateData(data, MAX_VALUE_VALIDATION);
      expect(maxValueValidation.length).to.equal(1);
      expect(maxValueValidation[0].name).to.equal('fieldToBeValidated');
      expect(maxValueValidation[0].message).to.equal('INVALID_MAX_VALUE');
    });

    it('should return no error when the field to be validated is a valid time zone', async () => {
      const data = {
        fieldToBeValidated: 'America/Los_Angeles',
      };

      const TIME_ZONE_VALIDATION = [
        {
          fieldName: 'fieldToBeValidated',
          validation: Validation.TIME_ZONE,
        },
      ];

      const timeZoneValidation = validateData(data, TIME_ZONE_VALIDATION);
      expect(timeZoneValidation.length).to.equal(0);
    });

    it('should return an error when the field to be validated is not a valid time zone', async () => {
      const data = {
        fieldToBeValidated: 'invalid-time-zone',
      };

      const TIME_ZONE_VALIDATION = [
        {
          fieldName: 'fieldToBeValidated',
          validation: Validation.TIME_ZONE,
        },
      ];

      const timeZoneValidation = validateData(data, TIME_ZONE_VALIDATION);
      expect(timeZoneValidation.length).to.equal(1);
      expect(timeZoneValidation[0].name).to.equal('fieldToBeValidated');
      expect(timeZoneValidation[0].message).to.equal('INVALID_TIME_ZONE');
    });

    it('should return correct decimal number with precision validation', async () => {
      const correctPrecisionValidation = {
        decimal: 110.99,
      };

      const DECIMAL_VALIDATION = [
        {
          fieldName: 'decimal',
          validation: Validation.DECIMAL,
          precision: 2,
        },
      ];

      const decimalValidation = validateData(correctPrecisionValidation, DECIMAL_VALIDATION);
      expect(decimalValidation.length).to.equal(0);
    });

    it('should return incorrect decimal number with precision validation', async () => {
      const incorrectPrecisionValidation = {
        decimal: '-100.',
      };

      const DECIMAL_VALIDATION = [
        {
          fieldName: 'decimal',
          validation: Validation.DECIMAL,
          precision: 2,
        },
      ];

      const decimalValidation = validateData(incorrectPrecisionValidation, DECIMAL_VALIDATION);
      expect(decimalValidation.length).to.equal(1);
      expect(decimalValidation[0].name).to.equal('decimal');
      expect(decimalValidation[0].message).to.equal('INVALID_DECIMAL');
    });

    it('should return incorrect field with positive decimal values', async () => {
      const NUMERIC_VALIDATION = [
        {
          fieldName: 'number',
          validation: Validation.NEGATIVE_DECIMAL,
        },
      ];

      const positiveInteger = {
        number: '5',
      };

      const positiveDecimal = {
        number: '6.5',
      };

      const integerValidation = validateData(correctNegativeInteger, NUMERIC_VALIDATION);
      expect(integerValidation.length).to.equal(0);

      const negativeDecimalValidation = validateData(correctNegativeDecimal, NUMERIC_VALIDATION);
      expect(negativeDecimalValidation.length).to.equal(0);

      const positiveIntegerValidation = validateData(positiveInteger, NUMERIC_VALIDATION);
      expect(positiveIntegerValidation.length).to.equal(1);
      expect(positiveIntegerValidation[0].name).to.equal('number');
      expect(positiveIntegerValidation[0].message).to.equal('NOT_NEGATIVE_DECIMAL');

      const positiveDecimalValidation = validateData(positiveDecimal, NUMERIC_VALIDATION);
      expect(positiveDecimalValidation.length).to.equal(1);
      expect(positiveDecimalValidation[0].name).to.equal('number');
      expect(positiveDecimalValidation[0].message).to.equal('NOT_NEGATIVE_DECIMAL');
    });

    it('should return incorrect field with negative decimal values', async () => {
      const NUMERIC_VALIDATION = [
        {
          fieldName: 'number',
          validation: Validation.POSITIVE_DECIMAL,
        },
      ];

      const integerValidation = validateData(correctInteger, NUMERIC_VALIDATION);
      expect(integerValidation.length).to.equal(0);

      const decimalValidation = validateData(correctDecimal, NUMERIC_VALIDATION);
      expect(decimalValidation.length).to.equal(0);

      const negativeIntegerValidation = validateData(correctNegativeInteger, NUMERIC_VALIDATION);
      expect(negativeIntegerValidation.length).to.equal(1);
      expect(negativeIntegerValidation[0].name).to.equal('number');
      expect(negativeIntegerValidation[0].message).to.equal('NOT_POSITIVE_DECIMAL');

      const negativeDecimalValidation = validateData(correctNegativeDecimal, NUMERIC_VALIDATION);
      expect(negativeDecimalValidation.length).to.equal(1);
      expect(negativeDecimalValidation[0].name).to.equal('number');
      expect(negativeDecimalValidation[0].message).to.equal('NOT_POSITIVE_DECIMAL');

      const stringValidation = validateData(incorrectNumber, NUMERIC_VALIDATION);
      expect(stringValidation.length).to.equal(1);
      expect(stringValidation[0].name).to.equal('number');
      expect(stringValidation[0].message).to.equal('NOT_POSITIVE_DECIMAL');
    });

    it('should return incorrect field with negative integer values', async () => {
      const NUMERIC_VALIDATION = [
        {
          fieldName: 'number',
          validation: Validation.POSITIVE_INTEGER,
        },
      ];

      const integerValidation = validateData(correctInteger, NUMERIC_VALIDATION);
      expect(integerValidation.length).to.equal(0);

      const decimalValidation = validateData(correctDecimal, NUMERIC_VALIDATION);
      expect(decimalValidation).to.not.be.empty;
      expect(decimalValidation.length).to.equal(1);
      expect(decimalValidation[0].name).to.equal('number');
      expect(decimalValidation[0].message).to.equal('NOT_POSITIVE_INTEGER');

      const negativeIntegerValidation = validateData(correctNegativeInteger, NUMERIC_VALIDATION);
      expect(negativeIntegerValidation.length).to.equal(1);
      expect(negativeIntegerValidation[0].name).to.equal('number');
      expect(negativeIntegerValidation[0].message).to.equal('NOT_POSITIVE_INTEGER');

      const negativeDecimalValidation = validateData(correctNegativeDecimal, NUMERIC_VALIDATION);
      expect(negativeDecimalValidation.length).to.equal(1);
      expect(negativeDecimalValidation[0].name).to.equal('number');
      expect(negativeDecimalValidation[0].message).to.equal('NOT_POSITIVE_INTEGER');

      const stringValidation = validateData(incorrectNumber, NUMERIC_VALIDATION);
      expect(stringValidation.length).to.equal(1);
      expect(stringValidation[0].name).to.equal('number');
      expect(stringValidation[0].message).to.equal('NOT_POSITIVE_INTEGER');
    });
  });

  it('should return fields with invalid mail format', async () => {
    const MAIL_VALIDATION = [
      {
        fieldName: 'email',
        validation: Validation.MAIL,
      },
    ];

    const correctMail = {
      email: 'name@domain.com',
    };

    const incorrectMail = {
      email: 'name@name@name',
    };

    const incorrectResult = validateData(incorrectMail, MAIL_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('email');
    expect(incorrectResult[0].message).to.equal('INVALID_EMAIL');

    const correctResult = validateData(correctMail, MAIL_VALIDATION);
    expect(correctResult.length).to.equal(0);
  });

  it('should return fields with valid shorthand', async () => {
    const SHORTHAND_VALIDATION = [
      {
        fieldName: 'name',
        validation: Validation.SHORTHAND,
      },
    ];

    const correctName = {
      name: 'swparkme',
    };

    const correctNameRes = validateData(correctName, SHORTHAND_VALIDATION);
    expect(correctNameRes.length).to.equal(0);
  });

  it('should return fields with invalid shorthand', async () => {
    const SHORTHAND_VALIDATION = [
      {
        fieldName: 'name',
        validation: Validation.SHORTHAND,
      },
    ];

    const incorrectNameTest1 = {
      name: 'swpar-kme',
    };

    const incorrectNameTest2 = {
      name: 'sw.parkme',
    };

    const incorrectNameTest3 = {
      name: 'swpark/me',
    };

    const incorrectNameTest1Res = validateData(incorrectNameTest1, SHORTHAND_VALIDATION);
    expect(incorrectNameTest1Res.length).to.equal(1);
    expect(incorrectNameTest1Res[0].name).to.equal('name');
    expect(incorrectNameTest1Res[0].message).to.equal('INVALID_SHORTHAND_NAME');

    const incorrectNameTest2Res = validateData(incorrectNameTest2, SHORTHAND_VALIDATION);
    expect(incorrectNameTest2Res.length).to.equal(1);
    expect(incorrectNameTest2Res[0].name).to.equal('name');
    expect(incorrectNameTest2Res[0].message).to.equal('INVALID_SHORTHAND_NAME');

    const incorrectNameTest3Res = validateData(incorrectNameTest3, SHORTHAND_VALIDATION);
    expect(incorrectNameTest3Res.length).to.equal(1);
    expect(incorrectNameTest3Res[0].name).to.equal('name');
    expect(incorrectNameTest3Res[0].message).to.equal('INVALID_SHORTHAND_NAME');
  });

  it('should return fields with invalid phone format', async () => {
    const PHONE_VALIDATION = [
      {
        fieldName: 'phone',
        validation: Validation.PHONE_NUMBER,
      },
    ];

    const correctPhones = [{ phone: '+1-(210)680-9980' }, { phone: '+1-(210)*680-9980' }, { phone: '(877) 243-5544' }];

    const incorrectPhones = [{ phone: '+1-(210)680-998' }, { phone: '+1-(210)680-99980' }];

    incorrectPhones.forEach(phone => {
      const incorrectResult1 = validateData(phone, PHONE_VALIDATION);
      expect(incorrectResult1.length).to.equal(1);
      expect(incorrectResult1[0].name).to.equal('phone');
      expect(incorrectResult1[0].message).to.equal('INVALID_PHONE_NUMBER');
    });

    correctPhones.forEach(phone => {
      const correctResult = validateData(phone, PHONE_VALIDATION);
      expect(correctResult.length).to.equal(0);
    });
  });

  it('should return fields with invalid inventory name format', async () => {
    const INVENTORY_NAME_VALIDATION = [
      {
        fieldName: 'name',
        validation: Validation.INVENTORY_NAME,
      },
    ];

    const correctNames = [{ name: '1012' }, { name: '1012 #1' }];

    const incorrectNames = [{ name: '1012-1' }, { name: '1013.3' }];

    incorrectNames.forEach(name => {
      const incorrectResult1 = validateData(name, INVENTORY_NAME_VALIDATION);
      expect(incorrectResult1.length).to.equal(1);
      expect(incorrectResult1[0].name).to.equal('name');
      expect(incorrectResult1[0].message).to.equal('INVALID_INVENTORY_NAME');
    });

    correctNames.forEach(name => {
      const correctResult = validateData(name, INVENTORY_NAME_VALIDATION);
      expect(correctResult.length).to.equal(0);
    });
  });

  it('should return fields with invalid postal code format', async () => {
    const POSTAL_CODE_VALIDATION = [
      {
        fieldName: 'postalCode',
        validation: Validation.POSTAL_CODE,
      },
    ];

    const correctPostals = [{ postalCode: 'A680-998' }, { postalCode: '94132' }];

    const incorrectPostal = {
      postalCode: 'A680/998',
    };

    const incorrectResult = validateData(incorrectPostal, POSTAL_CODE_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('postalCode');
    expect(incorrectResult[0].message).to.equal('INVALID_POSTAL_CODE');

    correctPostals.forEach(postal => {
      const correctResult = validateData(postal, POSTAL_CODE_VALIDATION);
      expect(correctResult.length).to.equal(0);
    });
  });

  it('should return fields with invalid phone format', async () => {
    const PHONE_VALIDATION = [
      {
        fieldName: 'phone',
        validation: Validation.PHONE_NUMBER,
      },
    ];

    const correctPhones = [{ phone: '+1-(210)680-9980' }, { phone: '+1-(210)*680-9980' }, { phone: '(877) 243-5544' }];

    const incorrectPhones = [{ phone: '+1-(210)680-998' }, { phone: '+1-(210)680-99980' }];

    incorrectPhones.forEach(phone => {
      const incorrectResult1 = validateData(phone, PHONE_VALIDATION);
      expect(incorrectResult1.length).to.equal(1);
      expect(incorrectResult1[0].name).to.equal('phone');
      expect(incorrectResult1[0].message).to.equal('INVALID_PHONE_NUMBER');
    });

    correctPhones.forEach(phone => {
      const correctResult = validateData(phone, PHONE_VALIDATION);
      expect(correctResult.length).to.equal(0);
    });
  });

  it('should return fields with invalid postal code format', async () => {
    const POSTAL_CODE_VALIDATION = [
      {
        fieldName: 'postalCode',
        validation: Validation.POSTAL_CODE,
      },
    ];

    const correctPostals = [{ postalCode: 'A680-998' }, { postalCode: '94132' }];

    const incorrectPostal = {
      postalCode: 'A680/998',
    };

    const incorrectResult = validateData(incorrectPostal, POSTAL_CODE_VALIDATION);
    expect(incorrectResult.length).to.equal(1);
    expect(incorrectResult[0].name).to.equal('postalCode');
    expect(incorrectResult[0].message).to.equal('INVALID_POSTAL_CODE');

    correctPostals.forEach(postal => {
      const correctResult = validateData(postal, POSTAL_CODE_VALIDATION);
      expect(correctResult.length).to.equal(0);
    });
  });

  it('should iterate and get errors with corresponding index', async () => {
    const REQUIRED_NOT_EMPTY = [
      {
        fieldName: 'name',
        validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
        maxLength: 10,
      },
    ];

    const elements = [
      {
        index: 1,
        data: {
          name: '',
        },
      },
      {
        index: 2,
        data: {
          name: 'Valid Name',
        },
      },
      {
        index: 3,
        data: {
          name: 'Max length fail',
        },
      },
    ];

    const result = await validate(elements, {
      requiredFields: REQUIRED_NOT_EMPTY,
      async onValidEntity() {
        return;
      },
      async customCheck() {
        return [
          {
            name: 'incorrectField',
            message: 'ERROR_REASON',
          },
        ];
      },
    });

    expect(result.length).to.equal(3);

    expect(result[0].index).to.equal(1);
    expect(result[0].invalidFields[0].name).to.equal('name');
    expect(result[0].invalidFields[0].message).to.equal('FIELD_REQUIRED');

    expect(result[1].index).to.equal(2);
    expect(result[1].invalidFields[0].name).to.equal('incorrectField');
    expect(result[1].invalidFields[0].message).to.equal('ERROR_REASON');

    expect(result[2].index).to.equal(3);
    expect(result[2].invalidFields[0].name).to.equal('name');
    expect(result[2].invalidFields[0].message).to.equal('INVALID_LENGTH');
  });

  it('should validate fields correctly using the obtained ids', async () => {
    const REQUIRED_FIELDS = [];
    const PREREQUISITES = [
      {
        field: 'propertyName',
        tableFieldName: 'name',
        table: 'Property',
        idReceiver: 'propertyId',
      },
      {
        field: 'buildingName',
        tableFieldName: 'name',
        table: 'Building',
        idReceiver: 'buildingId',
        relatedField: 'propertyName',
        relatedTableFieldName: 'propertyId',
      },
    ];

    const elements = [
      {
        index: 1,
        data: {
          propertyName: 'Invalid Name',
          buildingName: '',
        },
      },
      {
        index: 2,
        data: {
          propertyName: 'valid name with related 2nd',
          buildingName: 'Valid Name 2',
        },
      },
      {
        index: 3,
        data: {
          propertyName: 'Valid Name Without Related 2nd',
          buildingName: 'Valid Name 2',
        },
      },
    ];

    const RELATED_IDS = {
      propertyName: [
        {
          id: 1,
          name: 'Valid Name With Related 2nd',
        },
        {
          id: 2,
          name: 'Valid Name Without Related 2nd',
        },
      ],
      buildingName: [
        {
          id: 123,
          propertyId: 1,
          name: 'Valid Name 2',
        },
      ],
    };

    const invalidResult = await validateData(elements[0].data, REQUIRED_FIELDS, PREREQUISITES, RELATED_IDS);

    expect(invalidResult.length).to.equal(1);

    expect(invalidResult[0].name).to.equal('propertyName');
    expect(invalidResult[0].message).to.equal('ELEMENT_DOESNT_EXIST');

    const invalidRelatedResult = await validateData(elements[2].data, REQUIRED_FIELDS, PREREQUISITES, RELATED_IDS);

    expect(invalidRelatedResult.length).to.equal(1);
    expect(invalidRelatedResult[0].name).to.equal('buildingName');
    expect(invalidRelatedResult[0].message).to.equal('ELEMENT_DOESNT_EXIST');

    const validResult = await validateData(elements[1].data, REQUIRED_FIELDS, PREREQUISITES, RELATED_IDS);
    expect(validResult.length).to.equal(0);
  });

  describe('Obtaining related ids', () => {
    it('should get the ids from related and standalone in the same object', async () => {
      const PREREQUISITES = [
        {
          field: 'propertyName',
          tableFieldName: 'name',
          table: 'Property',
          idReceiver: 'propertyId',
        },
        {
          field: 'buildingName',
          tableFieldName: 'name',
          table: 'Building',
          idReceiver: 'buildingId',
          relatedField: 'propertyName',
          relatedTableFieldName: 'propertyId',
        },
      ];

      const elements = [
        {
          index: 1,
          data: {
            propertyName: 'property',
            buildingName: 'building',
          },
        },
      ];

      const relatedIds = await getRelatedIds(elements, PREREQUISITES);
      expect(relatedIds.propertyName[0].id).to.equal(1);
      expect(relatedIds.propertyName[0].propertyName).to.equal('property');
      expect(relatedIds.buildingName[0].id).to.equal(123);
      expect(relatedIds.buildingName[0].propertyId).to.equal(1);
      expect(relatedIds.buildingName[0].name).to.equal('building');
    });

    it('should throw an error when using a wrong related field', async () => {
      const PREREQUISITES = [
        {
          field: 'buildingName',
          tableFieldName: 'name',
          table: 'Building',
          idReceiver: 'buildingId',
          relatedField: 'propertyName',
          relatedTableFieldName: 'propertyId',
        },
      ];

      try {
        await getRelatedIds({}, PREREQUISITES);
        // This throw should not be executed due the exception been thrown,
        // set up to assure the test fails if getRelatedIds don't throw an exception
        throw new Error('Error not generated');
      } catch (error) {
        expect(error.message).to.equal('REFERRING_INVALID_RELATED_PREREQUISITE');
      }
    });
  });

  describe('getValueToPersist', () => {
    it('should return strings without spaces when value is not empty', () => {
      const valueToPersist = getValueToPersist(' testPropertyName ', null);
      expect(valueToPersist).to.equal('testPropertyName');
      expect(valueToPersist).to.not.be.null;
    });

    it('should return null when value is an string with blank spaces', () => {
      const valueToPersist = getValueToPersist(' ', null);
      expect(valueToPersist).to.equal(null);
    });

    it('should return the number when value is an integer', () => {
      const valueToPersist = getValueToPersist(5, null);
      expect(valueToPersist).to.equal(5);
    });

    it('should return defaultValue when is expected a number but value is empty', () => {
      const valueToPersist = getValueToPersist('', 0);
      expect(valueToPersist).to.equal(0);
    });

    it('should return 0 when the value is 0 as number', () => {
      const valueToPersist = getValueToPersist(0, null);
      expect(valueToPersist).to.equal(0);
    });
  });
});
