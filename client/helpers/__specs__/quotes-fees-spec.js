/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import dataDriven from 'data-driven';
import { expect } from '../../../common/test-helpers';
import { getCharges, getDepositRelativeAmountForSelectedLeaseTerms, setStatesConcessionsForSelectedFees } from '../quotes';
import {
  setQuantityAdditional,
  setVisibleAndSelected,
  applyMonthlyAdditonalCharges,
  getSelectedConcessionsFromFee,
  setDepositsRelativeAmount,
} from '../../../common/helpers/quotes';

import {
  FEES_STRUCTURE,
  SELECT_FEE,
  CHANGE_QUANTITY_FEE,
  DIFFERENT_DEPOSIT_FOR_EACH_LEASE_TERM,
  SAME_DEPOSIT_FOR_EACH_LEASE_TERM,
  DIFFERENT_DEPOSIT_RELATIVE_AMOUNTS,
  SAME_DEPOSIT_RELATIVE_AMOUNTS,
} from '../../__specs__/fixtures/fees-data-spec';

import {
  MOVE_IN_ON_FIRST_PARKING_INDOOR_FEE_WITH_CONCESSIONS,
  MOVE_IN_ON_NOV_16TH_PARKING_INDOOR_FEE_WITH_CONCESSIONS,
} from '../../__tests__/fixtures/quotes-concessions-data-test';

import {
  MOVE_IN_ON_16TH_PARKING_INDOOR_WITH_CONCESSION_6M_CM,
  MOVE_IN_ON_LAST_DAY_PARKING_INDOOR_WITH_CONCESSION_6M_CM,
} from '../../__tests__/fixtures/concessions-fees-calendar-month-test';

describe('Fees from a Quote', () => {
  const ADDITIONAL = 'additional';
  const ONETIME = 'oneTime';
  const MONTH = 'month';

  describe('grouping by quoteSectionName', () => {
    dataDriven(FEES_STRUCTURE, () => {
      it('compare if getCharges function grouping additional fees by month', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[0].fees;
        const charges = getCharges(additionalAndOneTimeFees, ADDITIONAL);
        expect(ctx.expectedFeesForMonthPeriod.additionalCharges).to.eql(charges);
      });
      it('compare if getCharges function grouping additional fees by week', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[1].fees;
        const charges = getCharges(additionalAndOneTimeFees, ADDITIONAL);
        expect(ctx.expectedFeesForWeekPeriod.additionalCharges).to.eql(charges);
      });
      it('compare if getCharges function grouping additional fees by day', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[2].fees;
        const charges = getCharges(additionalAndOneTimeFees, ADDITIONAL);
        expect(ctx.expectedFeesForDayPeriod.additionalCharges).to.eql(charges);
      });
      it('compare if getCharges function grouping additional fees by hour', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[3].fees;
        const charges = getCharges(additionalAndOneTimeFees, ADDITIONAL);
        expect(ctx.expectedFeesForHourPeriod.additionalCharges).to.eql(charges);
      });
      it('compare if getCharges function grouping one-time fees by month', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[0].fees;
        const charges = getCharges(additionalAndOneTimeFees, ONETIME);
        expect(ctx.expectedFeesForMonthPeriod.oneTimeCharges).to.eql(charges);
      });
      it('compare if getChargse function grouping one-time fees by week', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[1].fees;
        const charges = getCharges(additionalAndOneTimeFees, ONETIME);
        expect(ctx.expectedFeesForWeekPeriod.oneTimeCharges).to.eql(charges);
      });
      it('compare if getCharges function grouping one-time fees by day', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[2].fees;
        const charges = getCharges(additionalAndOneTimeFees, ONETIME);
        expect(ctx.expectedFeesForDayPeriod.oneTimeCharges).to.eql(charges);
      });
      it('compare if getCharges function grouping one-time fees by hour', ctx => {
        const additionalAndOneTimeFees = ctx.feesWithPeriods[3].fees;
        const charges = getCharges(additionalAndOneTimeFees, ONETIME);
        expect(ctx.expectedFeesForHourPeriod.oneTimeCharges).to.eql(charges);
      });
    });
  });

  describe('selected a fee', () => {
    dataDriven(SELECT_FEE, () => {
      it('should be select the fee and their children', ctx => {
        const feesGroupingByPeriods = ctx.structure;
        const charges = setVisibleAndSelected(feesGroupingByPeriods, MONTH, true, ctx.feeToSelect);
        expect(ctx.expectedResult).to.eql(charges);
      });
    });
  });

  describe('select a fee and change quantity of it', () => {
    dataDriven(CHANGE_QUANTITY_FEE, () => {
      it('should be change quantity of fee and their children', ctx => {
        const feesGroupingByPeriods = ctx.structure;
        let charges = setVisibleAndSelected(feesGroupingByPeriods, MONTH, true, ctx.feeToSelect);
        charges = setQuantityAdditional(charges, MONTH, ctx.newQuantity, ctx.feeToSelect);
        expect(ctx.expectedResult).to.eql(charges);
      });
    });
  });

  describe('Get Deposit Relative Amount of fee for each selected lease term', () => {
    it('should return deposit relative amount for fee without expansion, 1 month - 1 lease term (no expansion)', () => {
      const fee = {
        leaseTerms: DIFFERENT_DEPOSIT_FOR_EACH_LEASE_TERM,
        relativePrice: 100,
        relativeAmountsByLeaseTerm: DIFFERENT_DEPOSIT_RELATIVE_AMOUNTS,
      };

      const result = getDepositRelativeAmountForSelectedLeaseTerms(fee, ['123']);
      expect(result.depositAmount).to.eql((fee.leaseTerms[0].adjustedMarketRent * fee.relativePrice) / 100);
      expect(result.leaseTerms).to.eql(undefined);
    });

    it('should return deposit relative amount - calculated amount varies by lease length, multiple lease terms (expansion)', () => {
      const fee = {
        leaseTerms: DIFFERENT_DEPOSIT_FOR_EACH_LEASE_TERM,
        relativePrice: 100,
        relativeAmountsByLeaseTerm: DIFFERENT_DEPOSIT_RELATIVE_AMOUNTS,
      };

      const result = getDepositRelativeAmountForSelectedLeaseTerms(fee, ['123', '456', '789']);
      expect(result.depositAmount).to.eql(undefined);
      expect(result.leaseTerms[0].depositAmount).to.eql((fee.leaseTerms[0].adjustedMarketRent * fee.relativePrice) / 100);
      expect(result.leaseTerms[1].depositAmount).to.eql((fee.leaseTerms[1].adjustedMarketRent * fee.relativePrice) / 100);
      expect(result.leaseTerms[2].depositAmount).to.eql((fee.leaseTerms[2].adjustedMarketRent * fee.relativePrice) / 100);
    });

    it('should return deposit relative amount - calculated amount same by lease length, multiple lease terms (no expansion)', () => {
      const fee = {
        leaseTerms: SAME_DEPOSIT_FOR_EACH_LEASE_TERM,
        relativePrice: 100,
        relativeAmountsByLeaseTerm: SAME_DEPOSIT_RELATIVE_AMOUNTS,
      };

      const result = getDepositRelativeAmountForSelectedLeaseTerms(fee, ['123', '456', '789']);
      expect(result.depositAmount).to.eql((fee.leaseTerms[0].adjustedMarketRent * fee.relativePrice) / 100);
      expect(result.leaseTerms).to.eql(undefined);
    });
  });

  describe('GetSelectedConcessionsFromFee', () => {
    it('should return only the selected concessions', () => {
      const fee = {
        concessions: [
          {
            id: '123',
            displayName: '1 month free',
            selected: true,
          },
          {
            id: '456',
            displayName: 'App fee concession',
            selected: false,
          },
        ],
      };

      const result = getSelectedConcessionsFromFee(fee);
      expect(result[0].displayName).to.eql(fee.concessions[0].displayName);
    });
  });

  describe('SetStatesConcessionsForSelectedFees', () => {
    it('should set selected = true to those concessions that match the selectedConcessions in the fee', () => {
      const fee = {
        concessions: [
          {
            id: '123',
            displayName: '1 month free',
            selected: false,
          },
          {
            id: '456',
            displayName: 'App fee concession',
            selected: false,
          },
        ],
        selectedConcessions: [
          {
            id: '456',
            displayName: 'App fee concession',
            selected: true,
          },
        ],
      };

      const result = setStatesConcessionsForSelectedFees(fee.selectedConcessions, fee.concessions);
      expect(result[1].displayName).to.eql(fee.selectedConcessions[0].displayName);
      expect(result[1].selected).to.eql(true);
    });
  });

  describe('setDepositsRelativeAmount', () => {
    const leaseTerms = [
      {
        id: 1,
        adjustedMarketRent: 3200,
        termLength: 6,
      },
      {
        id: 2,
        adjustedMarketRent: 3125,
        termLength: 12,
      },
    ];

    const additionalOneTimeFees = [
      {
        fees: [
          {
            relativePrice: 100,
            feeType: 'deposit',
            displayName: 'Security Deposit',
            isAdditional: true,
            leaseTerms,
          },
        ],
      },
    ];

    const leaseTermsIds = [1, 2];

    it('should return the correct relativeAmounts for a fee with a parentFee with feeType === IG with leaseTerms associated', () => {
      const result = setDepositsRelativeAmount({
        additionalOneTimeFees,
        leaseTermsIds,
      });
      expect(result[0].fees[0].relativeAmountsByLeaseTerm[0].leaseTermId).to.equal(1);
      expect(result[0].fees[0].relativeAmountsByLeaseTerm[0].amount).to.equal(
        (leaseTerms[0].adjustedMarketRent * additionalOneTimeFees[0].fees[0].relativePrice) / 100,
      );
      expect(result[0].fees[0].relativeAmountsByLeaseTerm[1].leaseTermId).to.equal(2);
      expect(result[0].fees[0].relativeAmountsByLeaseTerm[1].amount).to.equal(
        (leaseTerms[1].adjustedMarketRent * additionalOneTimeFees[0].fees[0].relativePrice) / 100,
      );
    });
  });

  describe('applyMonthlyAdditonalCharges with fees that includes concessions with 30 day month propration strategy', () => {
    dataDriven(MOVE_IN_ON_FIRST_PARKING_INDOOR_FEE_WITH_CONCESSIONS, () => {
      it('should return the correct amount for each month with additional charges that include concessions: {description}.', ctx => {
        const termLength = ctx.termLength || 6;
        const payments = applyMonthlyAdditonalCharges(ctx.additionalCharges, ctx.paymentsForPeriods, termLength, ctx.leaseStartDate);
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('applyMonthlyAdditonalCharges with fees that includes concessions with 30 day month propration strategy', () => {
    dataDriven(MOVE_IN_ON_NOV_16TH_PARKING_INDOOR_FEE_WITH_CONCESSIONS, () => {
      it('should return the correct amount for each month with additional charges that include concessions: {description}', ctx => {
        const termLength = 6;
        const payments = applyMonthlyAdditonalCharges(ctx.additionalCharges, ctx.paymentsForPeriods, termLength, ctx.leaseStartDate);
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('applyMonthlyAdditonalCharges with fees that includes concession with calendar month propration strategy', () => {
    dataDriven(MOVE_IN_ON_16TH_PARKING_INDOOR_WITH_CONCESSION_6M_CM, () => {
      it('should return the correct amount for each month with additional charges that include concessions: {description}', ctx => {
        const termLength = 6;
        const payments = applyMonthlyAdditonalCharges(ctx.additionalCharges, ctx.paymentsForPeriods, termLength, ctx.leaseStartDate);
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('applyMonthlyAdditonalCharges with fees that includes concession with calendar month propration strategy', () => {
    dataDriven(MOVE_IN_ON_LAST_DAY_PARKING_INDOOR_WITH_CONCESSION_6M_CM, () => {
      it('should return the correct amount for each month with additional charges that include concessions: {description}', ctx => {
        const termLength = 6;
        const payments = applyMonthlyAdditonalCharges(ctx.additionalCharges, ctx.paymentsForPeriods, termLength, ctx.leaseStartDate);
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });
});
