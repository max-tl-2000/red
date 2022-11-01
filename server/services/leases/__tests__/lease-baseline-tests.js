/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { getDepositAmount } from '../baseline';
import { isPetDepositFee, isHoldDepositFee } from '../../../../client/helpers/quotes';
import { isUnitDepositFee } from '../../../../common/helpers/quotes';
import { DALTypes } from '../../../../common/enums/DALTypes';

const quoteLeaseTermId = getUUID();
const securityDeposit = { feeType: DALTypes.FeeType.DEPOSIT, quoteSectionName: DALTypes.QuoteSection.DEPOSIT, firstFee: true };
const holdDeposit = { feeType: DALTypes.FeeType.HOLD_DEPOSIT, quoteSectionName: DALTypes.QuoteSection.DEPOSIT, firstFee: true };
const petDeposit = { name: DALTypes.FeeName.PET_DEPOSIT, quoteSectionName: DALTypes.QuoteSection.DEPOSIT };

const depositsWithTypeMismatch = [
  { type: 'SecurityDeposit', deposit: { fee: { ...securityDeposit, feeType: DALTypes.FeeType.HOLD_DEPOSIT }, typeValidator: isUnitDepositFee } },
  { type: 'HoldDeposit', deposit: { fee: { ...holdDeposit, firstFee: false }, typeValidator: isHoldDepositFee } },
  { type: 'PetDeposit', deposit: { fee: { ...petDeposit, quoteSectionName: DALTypes.QuoteSection.HOLD_DEPOSIT }, typeValidator: isPetDepositFee } },
];

const depositsWithoutAmount = [
  {
    type: 'SecurityDeposit',
    deposit: { fee: { ...securityDeposit, relativeAmountsByLeaseTerm: [{ leaseTermId: quoteLeaseTermId }] }, typeValidator: isUnitDepositFee },
  },
  {
    type: 'HoldDeposit',
    deposit: { fee: { ...holdDeposit, relativeAmountsByLeaseTerm: [{ leaseTermId: quoteLeaseTermId }] }, typeValidator: isHoldDepositFee },
  },
  { type: 'PetDeposit', deposit: { fee: { ...petDeposit, relativeAmountsByLeaseTerm: [{ leaseTermId: quoteLeaseTermId }] }, typeValidator: isPetDepositFee } },
];

const depositsWithZeroAmount = [
  { type: 'SecurityDeposit', deposit: { fee: { ...securityDeposit, amount: 0 }, typeValidator: isUnitDepositFee } },
  { type: 'HoldDeposit', deposit: { fee: { ...holdDeposit, amount: 0 }, typeValidator: isHoldDepositFee } },
  { type: 'PetDeposit', deposit: { fee: { ...petDeposit, amount: 0 }, typeValidator: isPetDepositFee } },
];

const depositsWithoutRelativeAmountsByLeaseTerm = [
  { type: 'SecurityDeposit', deposit: { fee: { ...securityDeposit }, typeValidator: isUnitDepositFee } },
  { type: 'HoldDeposit', deposit: { fee: { ...holdDeposit }, typeValidator: isHoldDepositFee } },
  { type: 'PetDeposit', deposit: { fee: { ...petDeposit }, typeValidator: isPetDepositFee } },
];

const depositsWithLeaseTermIdMismatch = [
  {
    type: 'SecurityDeposit',
    deposit: { fee: { ...securityDeposit, relativeAmountsByLeaseTerm: [{ leaseTermId: getUUID() }] }, typeValidator: isUnitDepositFee },
  },
  {
    type: 'HoldDeposit',
    deposit: { fee: { ...holdDeposit, relativeAmountsByLeaseTerm: [{ leaseTermId: getUUID() }] }, typeValidator: isHoldDepositFee },
  },
  {
    type: 'PetDeposit',
    deposit: { fee: { ...petDeposit, relativeAmountsByLeaseTerm: [{ leaseTermId: getUUID() }] }, typeValidator: isPetDepositFee },
  },
];

const depositWithAmountAndRelativeAmountsByLeaseTerm = [
  {
    type: 'SecurityDeposit',
    deposit: { fee: { ...securityDeposit, amount: 100, relativeAmountsByLeaseTerm: [{ leaseTermId: quoteLeaseTermId }] }, typeValidator: isUnitDepositFee },
  },
  {
    type: 'HoldDeposit',
    deposit: { fee: { ...holdDeposit, amount: 200, relativeAmountsByLeaseTerm: [{ leaseTermId: quoteLeaseTermId }] }, typeValidator: isHoldDepositFee },
  },
  {
    type: 'PetDeposit',
    deposit: { fee: { ...petDeposit, amount: 300, relativeAmountsByLeaseTerm: [{ leaseTermId: quoteLeaseTermId }] }, typeValidator: isPetDepositFee },
  },
];

const validateResult = (deposit, expectedValue = 0) => {
  const result = getDepositAmount(deposit, quoteLeaseTermId, deposit.typeValidator);
  expect(result).to.equal(expectedValue);
};

describe('When calling the getDepositAmount', () => {
  depositsWithTypeMismatch.forEach(d => {
    describe(`To get the ${d.type}`, () => {
      describe('And not deposit exists', () => {
        it('should return O as value', () => {
          validateResult(d.deposit);
        });
      });
    });
  });

  depositsWithoutAmount.forEach(d => {
    describe(`To get the ${d.type}`, () => {
      describe('And not deposit amount is found', () => {
        it('should return O as value', () => {
          validateResult(d.deposit);
        });
      });
    });
  });

  depositsWithZeroAmount.forEach(d => {
    describe(`To get the ${d.type}`, () => {
      describe('And it has an amount of 0', () => {
        it('should return O as value', () => {
          validateResult(d.deposit);
        });
      });
    });
  });

  depositsWithoutRelativeAmountsByLeaseTerm.forEach(d => {
    describe(`To get the ${d.type}`, () => {
      describe('And not relativeAmountsByLeaseTerm is found for the deposit', () => {
        it('should return O as value', () => {
          validateResult(d.deposit);
        });
      });
    });
  });

  depositsWithLeaseTermIdMismatch.forEach(d => {
    describe(`To get the ${d.type}`, () => {
      describe('And deposit leaseTermId doesnt match the quote leaseTermId', () => {
        it('should return O as value', () => {
          validateResult(d.deposit);
        });
      });
    });
  });

  depositWithAmountAndRelativeAmountsByLeaseTerm.forEach(d => {
    describe(`To get the ${d.type}`, () => {
      describe('And amount/relativeAmountsByLeaseTerm exists', () => {
        it('should return the deposit value', () => {
          validateResult(d.deposit, d.deposit.fee.amount);
        });
      });
    });
  });
});
