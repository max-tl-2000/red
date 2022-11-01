/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { expect } from 'chai';
import * as sinon from 'sinon';

const { mockModules } = require('test-helpers/mocker').default(jest);

const {
  validateQuoteSectionName,
  validateMaxQuantityInQuote,
  validateServicePeriod,
  validateVariableAdjustmentFlag,
  validateEstimatedFlag,
  validateRelativeAndAbsolutePrice,
  validateDepositInterestFlag,
  validateDepositFeesHaveNoAdditionalFees,
  validateDepositFeesHaveNoRelatedFees,
  validateFeeCycle,
  RELATED_FEES_FIELD,
  ADDITIONAL_FEES_FIELD,
  CLYCLE_ERROR_DETECTED,
} = require('../inventory/fee');

const { INVALID_FEES } = require('../../services/fees.js');

describe('Fee import', () => {
  it('should validate correctly a quote section based on the fee type', async () => {
    const validFee = {
      feeType: 'leaseBreak',
      quoteSectionName: 'Inventory',
    };

    const validFee2 = {
      feeType: 'penalty',
      quoteSectionName: '',
    };

    const invalidFee = {
      feeType: 'penalty',
      quoteSectionName: 'Inventory',
    };

    const validResult = await validateQuoteSectionName(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateQuoteSectionName(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateQuoteSectionName(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('quoteSectionName');
    expect(invalidResult[0].message).equal('QUOTE_SECTION_NAME_SHOULD_BE_EMPTY_FOR_PENALTY');
  });

  it('should validate correctly a max quantity in quote section based on the fee type', async () => {
    const validFee = {
      feeType: 'service',
      maxQuantityInQuote: 5,
    };

    const validFee2 = {
      feeType: 'inventoryGroup',
      maxQuantityInQuote: 3,
    };

    const invalidFee = {
      feeType: 'penalty',
      maxQuantityInQuote: 5,
    };

    const validResult = await validateMaxQuantityInQuote(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateMaxQuantityInQuote(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateMaxQuantityInQuote(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('maxQuantityInQuote');
    expect(invalidResult[0].message).equal('INVALID_QUANTITY_IN_QUOTE_VALUE_FOR_TYPE');
  });

  it('should validate correctly a service period based on the fee type', async () => {
    const validFee = {
      feeType: 'service',
      servicePeriod: 'month',
    };

    const validFee2 = {
      feeType: 'deposit',
      servicePeriod: 'oneTime',
    };

    const invalidFee = {
      feeType: 'penalty',
      servicePeriod: 'month',
    };

    const invalidFee2 = {
      feeType: 'service',
      servicePeriod: '',
    };

    const validResult = await validateServicePeriod(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateServicePeriod(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateServicePeriod(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('servicePeriod');
    expect(invalidResult[0].message).equal('INVALID_SERVICE_PERIOD_FOR_TYPE');

    const invalidResult2 = await validateServicePeriod(invalidFee2);
    expect(invalidResult2.length).to.equal(1);
    expect(invalidResult2[0].name).equal('servicePeriod');
    expect(invalidResult2[0].message).equal('MUST_HAVE_VALID_SERVICE_PERIOD_FOR_SERVICE_TYPE');
  });

  it('should validate correctly the variable adjustment flag based on the fee type', async () => {
    const validFee = {
      feeType: 'service',
      variableAdjustmentFlag: 'x',
    };

    const validFee2 = {
      feeType: 'inventoryGroup',
      variableAdjustmentFlag: '',
    };

    const invalidFee = {
      feeType: 'inventoryGroup',
      variableAdjustmentFlag: 'x',
    };

    const validResult = await validateVariableAdjustmentFlag(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateVariableAdjustmentFlag(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateVariableAdjustmentFlag(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('variableAdjustmentFlag');
    expect(invalidResult[0].message).equal('VARIABLE_ADJUSTMENT_FLAG_SHOULD_BE_EMPTY_FOR_INVENTORY_GROUP');
  });

  it('should validate correctly the variable adjustment flag based on the fee type', async () => {
    const validFee = {
      feeType: 'service',
      estimatedFlag: 'x',
    };

    const validFee2 = {
      feeType: 'inventoryGroup',
      estimatedFlag: '',
    };

    const invalidFee = {
      feeType: 'inventoryGroup',
      estimatedFlag: 'x',
    };

    const validResult = await validateEstimatedFlag(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateEstimatedFlag(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateEstimatedFlag(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('estimatedFlag');
    expect(invalidResult[0].message).equal('ESTIMATED_FLAG_SHOULD_BE_EMPTY_FOR_INVENTORY_GROUP');
  });

  it('should validate correctly the absolute and relative price based on the fee type', async () => {
    const validFee = {
      name: 'fee1',
      feeType: 'service',
      relativePrice: 100,
      absolutePrice: '',
    };

    const validFee2 = {
      name: 'fee2',
      feeType: 'inventoryGroup',
      relativePrice: '',
      absolutePrice: '',
    };

    const invalidFee = {
      name: 'fee3',
      feeType: 'service',
      relativePrice: 123,
      absolutePrice: 123,
    };

    const invalidFee2 = {
      name: 'fee4',
      feeType: 'inventoryGroup',
      relativePrice: '',
      absolutePrice: 123,
    };

    const validResult = await validateRelativeAndAbsolutePrice(validFee, [{ data: { relatedFees: 'fee1', additionalFees: '' } }]);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateRelativeAndAbsolutePrice(validFee2, []);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateRelativeAndAbsolutePrice(invalidFee, [{ data: { relatedFees: 'fee3', additionalFees: '' } }]);
    expect(invalidResult.length).to.equal(2);
    expect(invalidResult[0].name).equal('relativePrice');
    expect(invalidResult[0].message).equal('ONLY_ONE_OF_RELATIVE_OR_ABSOLUTE_PRICE_ALLOWED_WHEN_PRICE_FLOOR_CEILING_IS_DISABLED');
    expect(invalidResult[1].name).equal('absolutePrice');
    expect(invalidResult[1].message).equal('ONLY_ONE_OF_RELATIVE_OR_ABSOLUTE_PRICE_ALLOWED_WHEN_PRICE_FLOOR_CEILING_IS_DISABLED');

    const invalidResult2 = await validateRelativeAndAbsolutePrice(invalidFee2, []);
    expect(invalidResult2.length).to.equal(1);
    expect(invalidResult2[0].name).equal('absolutePrice');
    expect(invalidResult2[0].message).equal('ABSOLUTE_PRICE_SHOULD_BE_EMPTY_FOR_INVENTORY_GROUP');
  });

  it('should validate correctly the deposit interest flag based on the fee type', async () => {
    const validFee = {
      feeType: 'deposit',
      depositInterestFlag: 'x',
    };

    const validFee2 = {
      feeType: 'inventoryGroup',
      depositInterestFlag: '',
    };

    const invalidFee = {
      feeType: 'inventoryGroup',
      depositInterestFlag: 'x',
    };

    const validResult = await validateDepositInterestFlag(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateDepositInterestFlag(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateDepositInterestFlag(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('depositInterestFlag');
    expect(invalidResult[0].message).equal('DEPOSIT_FLAG_SHOULD_BE_EMPTY_FOR_NON_DEPOSIT_FEES');
  });

  it('should validate correctly the Related Fees based on the fee type', async () => {
    const validFee = {
      feeType: 'deposit',
      relatedFees: '',
    };

    const validFee2 = {
      feeType: 'inventoryGroup',
      relatedFees: 'Fee1, Fee',
    };

    const invalidFee = {
      feeType: 'deposit',
      relatedFees: 'Fee1',
    };

    const validResult = await validateDepositFeesHaveNoRelatedFees(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateDepositFeesHaveNoRelatedFees(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateDepositFeesHaveNoRelatedFees(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('relatedFees');
    expect(invalidResult[0].message).equal('RELATED_FEES_SHOULD_BE_EMPTY_FOR_DEPOSIT_FEES');
  });

  it('should validate correctly the additonal fees based on the fee type', async () => {
    const validFee = {
      feeType: 'deposit',
      additionalFees: '',
    };

    const validFee2 = {
      feeType: 'inventoryGroup',
      additionalFees: 'Fee1, Fee',
    };

    const invalidFee = {
      feeType: 'deposit',
      additionalFees: 'Fee1',
    };

    const validResult = await validateDepositFeesHaveNoAdditionalFees(validFee);
    expect(validResult.length).to.equal(0);

    const validResult2 = await validateDepositFeesHaveNoAdditionalFees(validFee2);
    expect(validResult2.length).to.equal(0);

    const invalidResult = await validateDepositFeesHaveNoAdditionalFees(invalidFee);
    expect(invalidResult.length).to.equal(1);
    expect(invalidResult[0].name).equal('additionalFees');
    expect(invalidResult[0].message).equal('ADDITIONAL_FEES_SHOULD_BE_EMPTY_FOR_DEPOSIT_FEES');
  });

  it('should return the error related to cycle in relatedFees and additionalFees', async () => {
    const feesWithCycle = {
      isThereACycle: true,
      fees: ['Apartment', 'Water'],
    };
    const resultRelatedFee = validateFeeCycle(feesWithCycle);
    expect(resultRelatedFee.length).to.equal(2);
    expect(resultRelatedFee[0].name).equal(RELATED_FEES_FIELD);
    expect(resultRelatedFee[0].message).equal('');
    expect(resultRelatedFee[1].name).equal(ADDITIONAL_FEES_FIELD);
    expect(resultRelatedFee[1].message).equal(CLYCLE_ERROR_DETECTED.concat(': Apartment,Water'));
  });

  it('should return empty error when there is no cycles in the relatedFees/additionalFees', async () => {
    const noCycleFound = validateFeeCycle(false);
    expect(noCycleFound.length).to.equal(0);
  });

  describe('updateWithValidFees with invalid relatedFees', () => {
    let updateWithValidFees;

    beforeEach(() => {
      jest.resetModules();
      mockModules({
        '../../services/fees.js': {
          validateFees: sinon.stub().returns({
            error: {
              name: RELATED_FEES_FIELD,
              message: `${INVALID_FEES}: invalid fee`,
            },
          }),
        },
      });
      updateWithValidFees = require('../inventory/concession.js').updateWithValidFees;
    });

    it('should return the error related to invalid fee listed in relatedFees column', async () => {
      const feeObj = {
        name: 'Apartments',
        propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
        relatedFees: 'Unit Deposit, Invalid Fee',
      };

      const result = await updateWithValidFees('tenantId', feeObj, RELATED_FEES_FIELD);
      expect(result.name).equal(RELATED_FEES_FIELD);
      expect(result.message).equal(`${INVALID_FEES}: invalid fee`);
    });
  });

  describe('updateWithValidFees with valid relatedFees', () => {
    let updateWithValidFees;

    beforeEach(() => {
      jest.resetModules();
      mockModules({
        '../../services/fees.js': {
          validateFees: sinon.stub().returns([]),
        },
      });
      updateWithValidFees = require('../inventory/concession.js').updateWithValidFees;
    });

    it('should return no error when relatedFees are valid', async () => {
      const feeObj = {
        name: 'Apartments',
        propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
        relatedFees: 'Unit Deposit, EV Fee',
      };

      const result = await updateWithValidFees('tenantId', feeObj, RELATED_FEES_FIELD);
      expect(result).to.be.empty;
    });
  });

  describe('updateWithValidFees with invalid additionalFees', () => {
    let updateWithValidFees;

    beforeEach(() => {
      jest.resetModules();
      mockModules({
        '../../services/fees.js': {
          validateFees: sinon.stub().returns({
            error: {
              name: ADDITIONAL_FEES_FIELD,
              message: `${INVALID_FEES}: invalid fee`,
            },
          }),
        },
      });
      updateWithValidFees = require('../inventory/concession.js').updateWithValidFees;
    });

    it('should return the error related to invalid fee listed in additionalFees column', async () => {
      const feeObj = {
        name: 'Apartments',
        additionalFees: 'Pet Fees Montly, Invalid Fee',
      };

      const result = await updateWithValidFees('tenantId', feeObj, ADDITIONAL_FEES_FIELD);
      expect(result.name).equal(ADDITIONAL_FEES_FIELD);
      expect(result.message).equal(`${INVALID_FEES}: invalid fee`);
    });
  });

  describe('updateWithValidFees with valid relatedFees', () => {
    let updateWithValidFees;

    beforeEach(() => {
      jest.resetModules();
      mockModules({
        '../../services/fees.js': {
          validateFees: sinon.stub().returns([]),
        },
      });
      updateWithValidFees = require('../inventory/concession.js').updateWithValidFees;
    });

    it('should return no error when additionalFees are valid', async () => {
      const feeObj = {
        name: 'Apartments',
        propertyId: '1dd7f65b-520e-40d9-bb78-ecc207d74b85',
        additionalFees: 'Dryer, Washer',
      };

      const result = await updateWithValidFees('tenantId', feeObj, ADDITIONAL_FEES_FIELD);
      expect(result).to.be.empty;
    });
  });
});
