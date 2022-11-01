/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import data_driven from 'data-driven'; // eslint-disable-line
import { t } from 'i18next';
import {
  MONTH_30,
  getMonthlyFeeAmountForBillableDays,
  getMinDepositAmount,
  getMaxDepositAmount,
  getIdsOfDefaultLeaseTerms,
  PS_30_DAY_MONTH,
  getQuoteStatusForQuoteList,
} from '../quotes';

import {
  getMoveInOutDateDay,
  getMonthlyBasePayments,
  applyMonthlyAdditonalCharges,
  getSelectedFeesMonthlyAmount,
  getAdjustmentForConcession,
  applyConcessionsToPeriod,
  getBasePaymentForEachPeriod,
  calculateTimeAndAmountOfPeriod,
  getMonthlyPeriodsGroupsByAmount,
  getFormatedTimeframeDate,
  getNumberOfMonthsInLeaseTerm,
  applyMonthlyConcessions,
  calculateAbsoluteAdjustmentPerMonthlyPeriod,
  calculateMonthlyBasePaymentPerPeriod,
} from '../../../common/helpers/quotes';

import {
  MOVE_IN_ON_FIRST_6M,
  MOVE_OUT_ON_LAST_6M,
  MOVE_IN_ON_LAST_FEBRUARY_LEAP_YEAR_6M,
  MOVE_IN_ON_FIRST_LEAP_YEAR_6M,
  MOVE_IN_OTHER_DATES_NON_LEAP_YEAR_6M,
  MOVE_IN_ON_OTHER_DATES_LEAP_YEAR_6M,
  MOVE_IN_ON_FIRST_1M,
  MOVE_IN_ON_LAST_1M,
  MOVE_IN_ON_SECOND_1M,
  MOVE_IN_ON_FIRST_FEBRUARY_LEAP_YEAR_1M,
  MOVE_IN_ON_SECOND_FEBRUARY_LEAP_YEAR_1M,
  MOVE_IN_ON_DATES_NON_LEAP_YEAR_1M,
} from '../../__tests__/fixtures/quotes-data-test';

import {
  MOVE_IN_ON_FIRST_WITH_CONCESSION,
  MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION,
  MOVE_IN_ON_FIRST_WITH_MULTIPLE_CONCESSIONS,
  MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION_2M,
  MOVE_IN_ON_MARCH_16TH_WITH_VARIABLE_ADJUSTMENT_CONCESSION_2M,
  MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION_1M,
} from '../../__tests__/fixtures/quotes-concessions-data-test';

import { WATER, TRASH, GAS, WATER_PRICE, TRASH_PRICE, GAS_PRICE, generateFee } from '../../__tests__/fixtures/quotes-fees-commons-test';

import { DALTypes } from '../../../common/enums/DALTypes';

import {
  CASE_NON_LEAP_YEAR_FEB_START_ON_1ST_6M,
  CASE_NON_LEAP_YEAR_FEB_START_ON_16TH_6M,
  CASE_NON_LEAP_YEAR_FEB_START_ON_28TH_6M,
} from '../../__tests__/fixtures/case-non-leap-year-data-test';

import {
  CASE_30_DAY_MONTH_START_ON_1ST_6M,
  CASE_30_DAY_MONTH_START_ON_16TH_6M,
  CASE_30_DAY_MONTH_START_ON_30TH_6M,
} from '../../__tests__/fixtures/case-30-day-month-data-test';

import {
  CASE_31_DAY_MONTH_START_ON_1ST_6M,
  CASE_31_DAY_MONTH_START_ON_16TH_6M,
  CASE_31_DAY_MONTH_START_ON_31ST_6M,
  NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_FIRST_PERIOD,
  NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_FIRST_FULL_PERIOD,
  NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_LAST_PERIOD,
  ALWAYS_PRORATE_VARIABLE_RECURRING_CONCESSIONS,
} from '../../__tests__/fixtures/case-31-day-month-data-test';

import {
  CASE_LEAP_YEAR_FEB_START_ON_1ST_6M,
  CASE_LEAP_YEAR_FEB_START_ON_16TH_6M,
  CASE_LEAP_YEAR_FEB_START_ON_29TH_6M,
} from '../../__tests__/fixtures/case-leap-year-data-test';

import { toMoment, now } from '../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../common/date-constants';

describe('Quotes helper', () => {
  const MONTHLY_MARKET_RENT = 2213.2;
  const WEEKLY_MARKET_RENT = 588.8;
  const DAILY_MARKET_RENT = 128.8;
  const HOURLY_MARKET_RENT = 52.0;

  describe('getMoveInOutDateDay', () => {
    it('should return the correct day number from the given date', () => {
      const moveInDateDay = getMoveInOutDateDay('2017-08-09');
      expect(moveInDateDay).to.equal(9);
    });
  });

  describe('getQuoteStatusForQuoteList', () => {
    const EXPIRED_STATUS = {
      text: t('EXPIRED'),
      info: true,
    };

    const MANUAL_HOLD_STATUS = {
      text: t('ON_HOLD'),
      warn: true,
    };

    const MANUAL_HOLD_FOR_PARTY_STATUS = {
      text: t('ON_HOLD_FOR_PARTY'),
      info: true,
    };

    const LEASE_HOLD_STATUS = {
      text: t('ON_LEASE_HOLD'),
      warn: true,
    };

    const LEASE_HOLD_FOR_PARTY_STATUS = {
      text: t('ON_LEASE_HOLD_FOR_PARTY'),
      info: true,
    };

    const DRAFT_STATUS = {
      text: t('DRAFT'),
      info: true,
    };

    const PENDING_APPROVAL_STATUS = {
      text: t('PENDING_APPROVAL'),
      info: true,
    };

    const partyId = 1;
    const expiredMoment = now({ timezone: LA_TIMEZONE }).startOf('day').subtract(1, 'month');

    const expiredDate = expiredMoment.format('YYYY-MM-DD');
    const createQuote = ({ id, expirationDate, inventoryHolds, publishDate }) => ({
      id,
      expirationDate: expirationDate || expiredMoment.clone().add(1, 'year').format('YYYY-MM-DD'),
      partyId,
      inventory: {
        inventoryHolds: inventoryHolds || [],
        marketRent: 1000,
      },
      publishDate,
    });

    const executeTest = (input, output) => {
      const statusList = getQuoteStatusForQuoteList(input.quote, input.quotePromotions);

      expect(statusList.length).to.equal(output.expectedLength);

      if (statusList.length === 1) {
        expect(statusList[0]).to.deep.equal(output.expectedResult);
      } else {
        expect(statusList).to.have.deep.members(output.expectedResult);
      }
    };

    describe('when quote is expired', () => {
      it('should return a list with the EXPIRED status in it', () => {
        const quote = createQuote({ expirationDate: expiredDate });
        executeTest({ quote, quotePromotions: [] }, { expectedLength: 1, expectedResult: EXPIRED_STATUS });
      });
    });

    describe('when unit has a MANUAL hold from other party', () => {
      it('should return a list with the MANUAL HOLD status in it', () => {
        const quote = createQuote({
          inventoryHolds: [
            {
              reason: DALTypes.InventoryOnHoldReason.MANUAL,
              partyId: 2,
            },
          ],
        });

        executeTest({ quote, quotePromotions: [] }, { expectedLength: 1, expectedResult: MANUAL_HOLD_STATUS });
      });
    });

    describe('when unit has a MANUAL hold from the same party', () => {
      it('should return a list with the MANUAL HOLD FOR PARTY status in it', () => {
        const quote = createQuote({
          inventoryHolds: [
            {
              reason: DALTypes.InventoryOnHoldReason.MANUAL,
              partyId,
            },
          ],
        });

        executeTest({ quote, quotePromotions: [] }, { expectedLength: 1, expectedResult: MANUAL_HOLD_FOR_PARTY_STATUS });
      });
    });

    describe('when unit has a LEASE hold from other party', () => {
      it('should return a list with the LEASE HOLD status in it', () => {
        const quote = createQuote({
          inventoryHolds: [
            {
              reason: DALTypes.InventoryOnHoldReason.LEASE,
              partyId: 2,
            },
          ],
        });

        executeTest({ quote, quotePromotions: [] }, { expectedLength: 1, expectedResult: LEASE_HOLD_STATUS });
      });
    });

    describe('when unit has a LEASE hold from the same party', () => {
      it('should return a list with the LEASE HOLD FOR PARTY status in it', () => {
        const quote = createQuote({
          inventoryHolds: [
            {
              reason: DALTypes.InventoryOnHoldReason.LEASE,
              partyId,
            },
          ],
        });

        executeTest({ quote, quotePromotions: [] }, { expectedLength: 1, expectedResult: LEASE_HOLD_FOR_PARTY_STATUS });
      });
    });

    describe('when unit has a LEASE and a MANUAL hold from other party', () => {
      it('should return a list with both status in it', () => {
        const quote = createQuote({
          inventoryHolds: [
            {
              reason: DALTypes.InventoryOnHoldReason.LEASE,
              partyId: 2,
            },
            {
              reason: DALTypes.InventoryOnHoldReason.MANUAL,
              partyId: 2,
            },
          ],
        });

        executeTest({ quote, quotePromotions: [] }, { expectedLength: 2, expectedResult: [LEASE_HOLD_STATUS, MANUAL_HOLD_STATUS] });
      });
    });

    describe('when unit has a LEASE and a MANUAL hold from the same party', () => {
      it('should return a list with both status in it', () => {
        const quote = createQuote({
          inventoryHolds: [
            {
              reason: DALTypes.InventoryOnHoldReason.LEASE,
              partyId,
            },
            {
              reason: DALTypes.InventoryOnHoldReason.MANUAL,
              partyId,
            },
          ],
        });

        executeTest({ quote, quotePromotions: [] }, { expectedLength: 2, expectedResult: [LEASE_HOLD_FOR_PARTY_STATUS, MANUAL_HOLD_FOR_PARTY_STATUS] });
      });
    });

    describe('when quote is a draft and the unit does not have holds', () => {
      it('should return only the DRAFT status in it', () => {
        const quote = createQuote({ publishDate: null });
        executeTest({ quote, quotePromotions: [] }, { expectedLength: 1, expectedResult: DRAFT_STATUS });
      });
    });

    describe('when quote is a draft and the unit has manual hold', () => {
      it('should return a list with the DRAFT and MANUAL hold status in it', () => {
        const quote = createQuote({
          publishDate: null,
          inventoryHolds: [
            {
              reason: DALTypes.InventoryOnHoldReason.MANUAL,
              partyId,
            },
          ],
        });
        executeTest({ quote, quotePromotions: [] }, { expectedLength: 2, expectedResult: [DRAFT_STATUS, MANUAL_HOLD_FOR_PARTY_STATUS] });
      });
    });

    describe('when quote has a quote promotion with PENDING APPROVAL', () => {
      it('should return a list with the PENDING APPROVAL status in it', () => {
        const quoteId = 1;
        const quote = createQuote({ id: quoteId });
        const quotePromotions = [
          {
            quoteId,
            promotionStatus: DALTypes.PromotionStatus.PENDING_APPROVAL,
          },
        ];

        executeTest({ quote, quotePromotions }, { expectedLength: 1, expectedResult: PENDING_APPROVAL_STATUS });
      });
    });

    describe('when quote is expired', () => {
      describe('and has a quote promotion with PENDING APPROVAL', () => {
        describe('and the unit has two types of inventory holds', () => {
          it('should return a list with EXPIRED, PENDING APPROVAL, LEASE HOLD, MANUAL HOLD status in it', () => {
            const quoteId = 1;
            const quote = createQuote({
              id: quoteId,
              expirationDate: expiredDate,
              inventoryHolds: [
                {
                  reason: DALTypes.InventoryOnHoldReason.LEASE,
                  partyId: 2,
                },
                {
                  reason: DALTypes.InventoryOnHoldReason.MANUAL,
                  partyId: 2,
                },
              ],
            });

            const quotePromotions = [
              {
                quoteId,
                promotionStatus: DALTypes.PromotionStatus.PENDING_APPROVAL,
              },
            ];

            executeTest(
              { quote, quotePromotions },
              { expectedLength: 4, expectedResult: [EXPIRED_STATUS, PENDING_APPROVAL_STATUS, LEASE_HOLD_STATUS, MANUAL_HOLD_STATUS] },
            );
          });
        });
      });
    });
  });

  describe('calculateAbsoluteAdjustmentPerMonthlyPeriod', () => {
    it('should return the absolute value without division when period equals to a month - recurring', () => {
      const period = { daysInMonth: MONTH_30, billableDays: MONTH_30 };
      const absoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(20, period, true);
      expect(absoluteAdjustment).to.equal(20);
      const negativeAbsoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(-20, period, true);
      expect(negativeAbsoluteAdjustment).to.equal(20);
    });
    it('should return the absolute value divided for the part of the month we have - recurring', () => {
      const period = { daysInMonth: MONTH_30, billableDays: 15 };
      const absoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(20, period, true);
      expect(absoluteAdjustment).to.equal(10);
      const negativeAbsoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(-20, period, true);
      expect(negativeAbsoluteAdjustment).to.equal(10);
    });
    it('should return the absolute value without division when period equals to a month - non recurring', () => {
      const period = { daysInMonth: MONTH_30, billableDays: MONTH_30 };
      const absoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(20, period, false);
      expect(absoluteAdjustment).to.equal(20);
      const negativeAbsoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(-20, period, false);
      expect(negativeAbsoluteAdjustment).to.equal(20);
    });
    it('should return the absolute value divided for the part of the month we have - non recurring', () => {
      const period = { daysInMonth: MONTH_30, billableDays: 15 };
      const absoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(20, period, false);
      expect(absoluteAdjustment).to.equal(20);
      const negativeAbsoluteAdjustment = calculateAbsoluteAdjustmentPerMonthlyPeriod(-20, period, false);
      expect(negativeAbsoluteAdjustment).to.equal(20);
    });
  });

  describe('getNumberOfMonthsInLeaseTerm', () => {
    const leaseTerm = {
      termLength: 6,
    };
    // case when # of month/periods  = to termLength
    it('should have expected leaseTerms length if starting on the first day of the month', () => {
      const leaseTermLength = getNumberOfMonthsInLeaseTerm(leaseTerm, '2017-08-01');
      expect(leaseTermLength).to.equal(6);
    });
    // case when # of month/periods > to termLength
    it('should have expected leaseTerms length  plus a month if starting on the first day of the month', () => {
      const leaseTermLength = getNumberOfMonthsInLeaseTerm(leaseTerm, '2017-08-15');
      expect(leaseTermLength).to.equal(7);
    });
  });

  describe('calculateMonthlyBasePaymentPerPeriod using 30 day proration strategy', () => {
    it('It should work correctly for a complete month', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-08-08',
      };

      const leaseStartDate = '2016-08-09';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 2, 13, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(3000);
      expect(payment.billableDays).to.equal(30);
    });

    it('It shoud work correctly for february', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-01-08',
      };

      const leaseStartDate = '2016-01-09';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 1, 13, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(3000);
      expect(payment.billableDays).to.equal(30);
    });

    it('It shoud work correctly for a complete first month', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-07-31',
      };

      const leaseStartDate = '2016-08-01';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 0, 12, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(3000);
      expect(payment.billableDays).to.equal(30);
    });
    it('It shoud work correctly for a complete last month', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-07-31',
      };

      const leaseStartDate = '2016-08-01';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 11, 12, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(3000);
      expect(payment.billableDays).to.equal(30);
    });

    it('It shoud work correctly for a incomplete first month', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-08-14',
      };

      const leaseStartDate = '2016-08-15';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 0, 13, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(1600);
      expect(payment.billableDays).to.equal(16);
    });

    it('It shoud work correctly for a incomplete last month', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-08-14',
      };

      const leaseStartDate = '2016-08-15';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 12, 13, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(1400);
      expect(payment.billableDays).to.equal(14);
    });

    it('It shoud work correctly for february as last month if its the last date', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-02-28',
      };

      const leaseStartDate = '2016-03-01';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 12, 13, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(3000);
      expect(payment.billableDays).to.equal(30);
    });

    it('It shoud work correctly for february as last month if its not the last date', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-02-25',
      };

      const leaseStartDate = '2016-02-26';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 12, 13, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(2500);
      expect(payment.billableDays).to.equal(25);
    });
  });

  describe('calculateMonthlyBasePaymentPerPeriod', () => {
    // case when period = month is tested on calculate for Monthly Period
    it('It shoud work the same as calculateMonthlyBasePaymentPerPeriod for months', () => {
      const leaseTerm = {
        adjustedMarketRent: 3000,
        period: 'month',
        termLength: 12,
        endDate: '2017-07-31',
      };

      const leaseStartDate = '2016-08-01';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 0, 12, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(3000);
      expect(payment.billableDays).to.equal(30);
    });
    // case when period != month
    it('It shoud work correctly for a period different than month', () => {
      const leaseTerm = {
        adjustedMarketRent: 300,
        period: 'week',
        termLength: 4,
        endDate: '2016-02-28',
      };

      const leaseStartDate = '2016-03-31';

      const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, 1, 4, PS_30_DAY_MONTH);
      expect(payment.amount).to.equal(300);
    });
  });

  describe('getFormatedTimeframeDate', () => {
    it('Should work correctly for a monthly period', () => {
      const formatedTimeframe = getFormatedTimeframeDate(toMoment('2016-08-01'), 'month');
      expect(formatedTimeframe).to.equal('Aug 2016');
    });

    it('Should work correctly for week period', () => {
      const formatedTimeframe = getFormatedTimeframeDate(toMoment('2016-08-01'), 'week');
      expect(formatedTimeframe).to.equal('Aug 01, 2016');
    });
  });

  describe('getMonthlyPeriodsGroupsByAmount', () => {
    // Simulating a case where we start at Jan 16th and end at July 15th with one month free

    const payments = [
      {
        timeframe: 'Jan 2016',
        amount: 0,
      },
      {
        timeframe: 'Feb 2016',
        amount: 1500.7,
      },
      {
        timeframe: 'Mar 2016',
        amount: 3000.700001,
      },
      {
        timeframe: 'Apr 2016',
        amount: 3000.7,
      },
      {
        timeframe: 'May 2016',
        amount: 3000.70005,
      },
      {
        timeframe: 'Jun 2016',
        amount: 3000.7,
      },
      {
        timeframe: 'Jul 2016',
        amount: 1500,
      },
    ];

    const groupedPeriods = getMonthlyPeriodsGroupsByAmount(payments);
    it('It shoud work correctly for a period different groups of payments', () => {
      expect(groupedPeriods.length).to.equal(4);
    });

    it('It should generate timeframes of one month for unique payments', () => {
      expect(groupedPeriods[0].amount).to.equal((0.0).toFixed(2));
      expect(groupedPeriods[0].timeframe).to.equal('Jan 2016');
    });

    it('It should group consecutive timeframes with the same amount to pay', () => {
      expect(groupedPeriods[2].amount).to.equal((3000.7).toFixed(2));
      expect(groupedPeriods[2].timeframe).to.equal('Mar - Jun 2016');
    });

    it('It should not group non consecutive timeframes with the same amount to pay', () => {
      expect(groupedPeriods[1].amount).to.equal((1500.7).toFixed(2));
      expect(groupedPeriods[1].timeframe).to.equal('Feb 2016');
      expect(groupedPeriods[3].amount).to.equal((1500.0).toFixed(2));
      expect(groupedPeriods[3].timeframe).to.equal('Jul 2016');
    });
  });

  describe('getBasePaymentForEachPeriod where periods are week/day/hour', () => {
    const leaseStartDate = '2016-09-15';

    it('4 Weeks Period - Should get the base payment of the given period', () => {
      const leaseTerm = {
        adjustedMarketRent: WEEKLY_MARKET_RENT,
        period: 'week',
        termLength: 4,
        endDate: '2016-10-12',
      };

      const paymentsForPeriods = getBasePaymentForEachPeriod(leaseTerm, leaseStartDate);
      expect(paymentsForPeriods.length).to.equal(leaseTerm.termLength);
      paymentsForPeriods.forEach(payment => {
        expect(payment.amount).to.equal(WEEKLY_MARKET_RENT);
      });
    });

    it('12 Days Period - Should get the base payment of the given period', () => {
      const leaseTerm = {
        adjustedMarketRent: DAILY_MARKET_RENT,
        period: 'day',
        termLength: 12,
        endDate: '2016-09-26',
      };

      /*
       * The given start date is Sep 15, 2016. The lease term is 12 days starting
       * from Sep 15th. For daily lease term, the payment should be displayed for
       * every day. The expected dates are from Sep 15, 2016 included to 2016-09-26.
       * Sep 15, Sep 16, Sep17, ..., Sep 24, Sep 25 and 2016-09-26.
       */
      const paymentsForPeriods = getBasePaymentForEachPeriod(leaseTerm, leaseStartDate);
      expect(paymentsForPeriods.length).to.equal(leaseTerm.termLength);
      paymentsForPeriods.forEach(payment => {
        expect(payment.amount).to.equal(DAILY_MARKET_RENT);
      });
      expect(paymentsForPeriods[0].timeframe).to.equal('Sep 15, 2016');
      expect(paymentsForPeriods[1].timeframe).to.equal('Sep 16, 2016');
      expect(paymentsForPeriods[10].timeframe).to.equal('Sep 25, 2016');
      expect(paymentsForPeriods[11].timeframe).to.equal('Sep 26, 2016');
    });

    it('18 Hours Period - Should get the base payment of the given period', () => {
      // TODO: Add another test to coverage for an 18 hour period that crosses
      // day, week month, and year boundaries
      const leaseTerm = {
        adjustedMarketRent: HOURLY_MARKET_RENT,
        period: 'hour',
        termLength: 18,
        endDate: '2016-09-15',
      };

      const paymentsForPeriods = getBasePaymentForEachPeriod(leaseTerm, leaseStartDate);
      expect(paymentsForPeriods.length).to.equal(leaseTerm.termLength);
      expect(paymentsForPeriods[0].amount).to.equal(HOURLY_MARKET_RENT);
      expect(paymentsForPeriods[0].timeframe).to.equal('Sep 15 2016, 12:00 am');
      expect(paymentsForPeriods[17].amount).to.equal(HOURLY_MARKET_RENT);
      expect(paymentsForPeriods[17].timeframe).to.equal('Sep 15 2016, 5:00 pm');
    });
  });

  describe('calculateTimeAndAmountOfPeriod works with week/day/hour periods ', () => {
    const leaseStartDate = '2016-09-15';

    const leaseStartDateMonthYearBoundary = '2016-12-25';

    it('Should return time and amount of the given term and period index: 2nd week of 4 weeks term', () => {
      const leaseTerm = {
        adjustedMarketRent: WEEKLY_MARKET_RENT,
        period: 'week',
        termLength: 4,
        endDate: '2016-10-12',
      };

      const periodTimeAmount = calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, 1);
      expect(periodTimeAmount.timeframe).to.equal('Sep 22, 2016 - Sep 28, 2016');
      expect(periodTimeAmount.amount).to.equal(WEEKLY_MARKET_RENT);
    });

    it('Should return time and amount of given term and period index: first day / 12 days term', () => {
      const leaseTerm = {
        adjustedMarketRent: DAILY_MARKET_RENT,
        period: 'day',
        termLength: 12,
        endDate: '2016-09-26',
      };

      const periodTimeAmount = calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, 0);
      expect(periodTimeAmount.timeframe).to.equal('Sep 15, 2016');
      expect(periodTimeAmount.amount).to.equal(DAILY_MARKET_RENT);
    });

    it('Should return time and amount of given term and period index: last day / 12 days term', () => {
      const leaseTerm = {
        adjustedMarketRent: DAILY_MARKET_RENT,
        period: 'day',
        termLength: 12,
        endDate: '2016-09-26',
      };

      const periodTimeAmount = calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, 11);
      expect(periodTimeAmount.timeframe).to.equal('Sep 26, 2016');
      expect(periodTimeAmount.amount).to.equal(DAILY_MARKET_RENT);
    });

    it('Should return time and amount of given term last day / 12 days term with month/year boundaries', () => {
      const leaseTerm = {
        adjustedMarketRent: DAILY_MARKET_RENT,
        period: 'day',
        termLength: 12,
        endDate: '2017-01-05',
      };

      const periodTimeAmount = calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDateMonthYearBoundary, 11);
      expect(periodTimeAmount.timeframe).to.equal('Jan 05, 2017');
      expect(periodTimeAmount.amount).to.equal(DAILY_MARKET_RENT);
    });

    it('Should return time and amount of given term and period index: first hour / 18 hours term', () => {
      const leaseTerm = {
        adjustedMarketRent: HOURLY_MARKET_RENT,
        period: 'hour',
        termLength: 18,
        endDate: '2016-09-15',
      };

      const periodTimeAmount = calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, 0);
      expect(periodTimeAmount.timeframe).to.equal('Sep 15 2016, 12:00 am');
      expect(periodTimeAmount.amount).to.equal(HOURLY_MARKET_RENT);
    });

    it('Should return time and amount of given term and period index: last hour / 18 hours term', () => {
      const leaseTerm = {
        adjustedMarketRent: HOURLY_MARKET_RENT,
        period: 'hour',
        termLength: 18,
        endDate: '2016-09-15',
      };

      const periodTimeAmount = calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, 17);
      expect(periodTimeAmount.timeframe).to.equal('Sep 15 2016, 5:00 pm');
      expect(periodTimeAmount.amount).to.equal(HOURLY_MARKET_RENT);
    });

    it('Should throws invalid argument error when adjustedMarketRent is undefined', () => {
      const leaseTerm = {
        period: 'hour',
        termLength: 18,
        endDate: '2016-09-15',
      };
      expect(() => calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, 1)).to.throw(
        Error,
        /Cannot calculateTimeAndAmountOfPeriod of undefined adjustedMarketRent/,
      );
    });

    it('Should throws invalid argument error when period is undefined', () => {
      const leaseTerm = {
        adjustedMarketRent: HOURLY_MARKET_RENT,
        termLength: 18,
        endDate: '2016-09-15',
      };
      expect(() => calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, 1)).to.throw(Error, /Cannot calculateTimeAndAmountOfPeriod of undefined period/);
    });
  });

  describe('applyConcessionsToPeriod works with week/day/hour periods', () => {
    const paymentsForPeriodsWeek = [
      {
        amount: WEEKLY_MARKET_RENT,
        timeframe: 'Sep 15, 2016 - Sep 21, 2016',
      },
      {
        amount: WEEKLY_MARKET_RENT,
        timeframe: 'Sep 22, 2016 - Sep 28, 2016',
      },
      {
        amount: WEEKLY_MARKET_RENT,
        timeframe: 'Sep 29, 2016 - Oct 05, 2016',
      },
      {
        amount: WEEKLY_MARKET_RENT,
        timeframe: 'Oct 06, 2016 - 2016-10-12',
      },
    ];

    const paymentsForPeriodsDay = [
      {
        amount: DAILY_MARKET_RENT,
        timeframe: 'Sep 15, 2016',
      },
      {
        amount: DAILY_MARKET_RENT,
        timeframe: 'Sep 16, 2016',
      },
      {
        amount: DAILY_MARKET_RENT,
        timeframe: 'Sep 17, 2016',
      },
      {
        amount: DAILY_MARKET_RENT,
        timeframe: 'Sep 18, 2016',
      },
      {
        amount: DAILY_MARKET_RENT,
        timeframe: 'Sep 19, 2016',
      },
      {
        amount: DAILY_MARKET_RENT,
        timeframe: 'Sep 20, 2016',
      },
    ];

    it('Should apply concession (Lease Incentive 10% per week) to 4 Weeks term', () => {
      const leaseTerm = {
        adjustedMarketRent: WEEKLY_MARKET_RENT,
        period: 'week',
        termLength: 4,
        endDate: '2016-10-12',
        concessions: [
          {
            selected: true,
            recurring: true,
            recurringCount: 0,
            nonRecurringAppliedAt: '',
            absoluteAdjustment: '0.00',
            relativeAdjustment: '-10.00',
          },
        ],
      };

      const relativeAdjustmentAmount = Math.abs(leaseTerm.concessions[0].relativeAdjustment / 100) * WEEKLY_MARKET_RENT;
      const paymentsForPeriodsResult = applyConcessionsToPeriod(leaseTerm, paymentsForPeriodsWeek);
      expect(paymentsForPeriodsResult.length).to.equal(leaseTerm.termLength);
      paymentsForPeriodsResult.forEach(payment => {
        expect(payment.amount).to.equal(WEEKLY_MARKET_RENT - relativeAdjustmentAmount);
      });
    });

    it('Should apply concession (1 day free) to 6 Days term', () => {
      const leaseTerm = {
        adjustedMarketRent: DAILY_MARKET_RENT,
        period: 'day',
        termLength: 6,
        endDate: '2016-09-20',
        concessions: [
          {
            selected: true,
            recurring: false,
            recurringCount: 0,
            nonRecurringAppliedAt: 'first',
            absoluteAdjustment: '0.00',
            relativeAdjustment: '-100.00',
          },
        ],
      };

      const paymentsForPeriodsResult = applyConcessionsToPeriod(leaseTerm, paymentsForPeriodsDay);
      const relativeAdjustmentAmount = Math.abs(leaseTerm.concessions[0].relativeAdjustment / 100) * DAILY_MARKET_RENT;
      expect(paymentsForPeriodsResult.length).to.equal(leaseTerm.termLength);
      expect(paymentsForPeriodsResult[0].amount).to.equal(DAILY_MARKET_RENT - relativeAdjustmentAmount); // 1 day free applied at first
      expect(paymentsForPeriodsResult[1].amount).to.equal(DAILY_MARKET_RENT); // second day amount it's the base rent
      expect(paymentsForPeriodsResult[5].amount).to.equal(DAILY_MARKET_RENT); // last day amount it's the base rent
    });

    it('Should apply concession (Special lease incentive - day) to 6 Days term', () => {
      const leaseTerm = {
        adjustedMarketRent: DAILY_MARKET_RENT,
        period: 'day',
        termLength: 6,
        endDate: '2016-09-20',
        concessions: [
          {
            selected: true,
            recurring: true,
            recurringCount: 0,
            amountVariableAdjustment: '25',
            variableAdjustment: true,
          },
        ],
      };

      paymentsForPeriodsDay.forEach(payment => {
        payment.amount = DAILY_MARKET_RENT;
      });

      const paymentsForPeriodsResult = applyConcessionsToPeriod(leaseTerm, paymentsForPeriodsDay);
      const amountVariableAdjustment = Math.abs(leaseTerm.concessions[0].amountVariableAdjustment);

      expect(paymentsForPeriodsResult.length).to.equal(leaseTerm.termLength);
      expect(paymentsForPeriodsResult[0].timeframe).to.equal('Sep 15, 2016');
      expect(paymentsForPeriodsResult[0].amount).to.equal(DAILY_MARKET_RENT - amountVariableAdjustment);
      expect(paymentsForPeriodsResult[5].timeframe).to.equal('Sep 20, 2016');
      expect(paymentsForPeriodsResult[5].amount).to.equal(DAILY_MARKET_RENT - amountVariableAdjustment);
    });

    it('Should apply concession (Lease incentive one time applied at LAST)', () => {
      const leaseTerm = {
        adjustedMarketRent: DAILY_MARKET_RENT,
        period: 'day',
        termLength: 6,
        endDate: '2016-09-20',
        concessions: [
          {
            selected: true,
            recurring: false,
            recurringCount: 0,
            amountVariableAdjustment: '20',
            variableAdjustment: true,
            nonRecurringAppliedAt: 'last',
          },
        ],
      };

      paymentsForPeriodsDay.forEach(payment => {
        payment.amount = DAILY_MARKET_RENT;
      });

      const paymentsForPeriodsResult = applyConcessionsToPeriod(leaseTerm, paymentsForPeriodsDay);
      const amountVariableAdjustment = Math.abs(leaseTerm.concessions[0].amountVariableAdjustment);

      expect(paymentsForPeriodsResult.length).to.equal(leaseTerm.termLength);
      expect(paymentsForPeriodsResult[0].timeframe).to.equal('Sep 15, 2016');
      expect(paymentsForPeriodsResult[0].amount).to.equal(DAILY_MARKET_RENT); // It doesn't change because the concession is applied at LAST day
      expect(paymentsForPeriodsResult[5].timeframe).to.equal('Sep 20, 2016');
      expect(paymentsForPeriodsResult[5].amount).to.equal(DAILY_MARKET_RENT - amountVariableAdjustment); // Last day of period then the concession is applied
    });
  });

  describe('getAdjustmentForConcession', () => {
    const leaseTerm = {
      adjustedMarketRent: 1000,
    };

    const concession = {
      variableAdjustment: true,
      amountVariableAdjustment: 200,
      absoluteAdjustment: '300',
    };

    it('Should return the amountVariableAdjustment value when concession.variableAdjustment is TRUE', () => {
      const adjustment = getAdjustmentForConcession(leaseTerm, concession);
      expect(adjustment).to.equal(concession.amountVariableAdjustment);
    });

    it('Should return the absoluteAdjustment when variableAdjustment is FALSE and absoluteAdjustment != 0', () => {
      concession.variableAdjustment = false;
      concession.amountVariableAdjustment = 0;

      const adjustment = getAdjustmentForConcession(leaseTerm, concession);
      expect(adjustment).to.equal(Math.abs(concession.absoluteAdjustment));
    });

    it('Should return the relativeAdjustment when variableAdjustment is FALSE and absoluteAdjustment is == 0', () => {
      concession.relativeAdjustment = '-10.00';
      concession.absoluteAdjustment = '0';

      const adjustment = getAdjustmentForConcession(leaseTerm, concession);
      expect(adjustment).to.equal(100);
    });

    it('Should throws invalid argument error when relativeAdjustment is defined and adjustedMarketRent is undefined', () => {
      concession.relativeAdjustment = '-10.00';
      concession.absoluteAdjustment = '0';
      const leaseTermTest = {
        marketRent: 1000,
      };

      expect(() => getAdjustmentForConcession(leaseTermTest, concession)).to.throw(Error, /Cannot getAdjustmentForConcession of undefined adjustedMarketRent/);
    });
  });

  describe('getMonthlyFeeAmountForBillableDays', () => {
    it('Should return the right amount when billableDays = 30', () => {
      const feeAmount = 30;
      const billableDays = 30;
      const amount = getMonthlyFeeAmountForBillableDays(feeAmount, billableDays);
      expect(amount).to.equal((feeAmount / MONTH_30) * billableDays);
    });

    it('Should return the right amount when billableDays = 16', () => {
      const feeAmount = 30;
      const billableDays = 16;
      const amount = getMonthlyFeeAmountForBillableDays(feeAmount, billableDays);
      expect(amount).to.equal((feeAmount / MONTH_30) * billableDays);
    });
  });

  describe('getSelectedFeesMonthlyAmount', () => {
    const fees = [
      generateFee({
        id: 1,
        name: WATER,
        price: WATER_PRICE,
        selected: true,
        concessions: [],
        quotePaymentScheduleFlag: true,
      }),
      generateFee({
        id: 2,
        name: TRASH,
        price: TRASH_PRICE,
        selected: true,
        concessions: [],
        quotePaymentScheduleFlag: true,
      }),
      generateFee({
        id: 3,
        name: GAS,
        price: GAS_PRICE,
        selected: false,
        concessions: [],
        quotePaymentScheduleFlag: true,
      }),
    ];

    const additionalCharges = { fees };

    const paymentFullMonth = {
      amount: MONTHLY_MARKET_RENT, // complete month
      billableDays: MONTH_30, // 30 days
      daysInMonth: MONTH_30,
      timeframe: 'Sep 2016',
    };

    const paymentHalfMonth = {
      amount: MONTHLY_MARKET_RENT / 2, // half month
      billableDays: MONTH_30 / 2, // half month
      daysInMonth: MONTH_30,
      timeframe: 'Sep 2016',
    };

    it('Should get the amount of selected additional charges -  only Utilities fees full month', () => {
      const additionalChargeAmount = getSelectedFeesMonthlyAmount(additionalCharges, paymentFullMonth);
      expect(additionalChargeAmount).to.equal(
        (WATER_PRICE / MONTH_30) * paymentFullMonth.billableDays + (TRASH_PRICE / MONTH_30) * paymentFullMonth.billableDays,
      );
    });

    it('Should get the amount of selected additional charges -  only Utilities fees half month', () => {
      const additionalChargeAmount = getSelectedFeesMonthlyAmount(additionalCharges, paymentHalfMonth);
      expect(additionalChargeAmount).to.equal(
        (WATER_PRICE / MONTH_30) * paymentHalfMonth.billableDays + (TRASH_PRICE / MONTH_30) * paymentHalfMonth.billableDays,
      );
    });

    it('Should get the amount of selected additional charges - all fees selected full month', () => {
      additionalCharges.fees[2].selected = true; // Gas is now selected
      const additionalChargeAmount = getSelectedFeesMonthlyAmount(additionalCharges, paymentFullMonth);
      expect(additionalChargeAmount).to.equal(
        (WATER_PRICE / MONTH_30) * paymentFullMonth.billableDays +
          (TRASH_PRICE / MONTH_30) * paymentFullMonth.billableDays +
          (GAS_PRICE / MONTH_30) * paymentFullMonth.billableDays,
      );
    });
  });

  describe('applyMonthlyAdditonalCharges to payments', () => {
    const fees = [
      generateFee({
        id: 1,
        name: WATER,
        price: WATER_PRICE,
        selected: true,
        concessions: [],
        quotePaymentScheduleFlag: true,
      }),
      generateFee({
        id: 2,
        name: TRASH,
        price: TRASH_PRICE,
        selected: true,
        concessions: [],
        quotePaymentScheduleFlag: true,
      }),
      generateFee({
        id: 3,
        name: GAS,
        price: GAS_PRICE,
        selected: false,
        concessions: [],
        quotePaymentScheduleFlag: true,
      }),
    ];

    const additionalCharges = { fees };

    it('Should apply the selected additional charges to the monthly payments', () => {
      // leaseStartDate Aug 26th
      const paymentsForPeriods = [
        {
          amount: (MONTHLY_MARKET_RENT / 30) * 5, // paid 5 days
          billableDays: 5, // leaseStartDate Aug 26th, 2016
          daysInMonth: MONTH_30,
          timeframe: 'Aug 2016',
        },
        {
          amount: MONTHLY_MARKET_RENT, // complete month
          billableDays: MONTH_30, // 30 days
          daysInMonth: MONTH_30,
          timeframe: 'Sep 2016',
        },
        {
          amount: MONTHLY_MARKET_RENT, // complete month
          billableDays: MONTH_30, // 30 days
          daysInMonth: MONTH_30,
          timeframe: 'Oct 2016',
        },
      ];

      const paymentsWithAdditionalCharges = applyMonthlyAdditonalCharges(additionalCharges, paymentsForPeriods);
      expect(paymentsWithAdditionalCharges[0].amount).to.equal(
        (MONTHLY_MARKET_RENT / 30) * 5 +
          (WATER_PRICE / MONTH_30) * paymentsForPeriods[0].billableDays +
          (TRASH_PRICE / MONTH_30) * paymentsForPeriods[0].billableDays,
      );
      expect(paymentsWithAdditionalCharges[1].amount).to.equal(
        MONTHLY_MARKET_RENT + (WATER_PRICE / MONTH_30) * paymentsForPeriods[1].billableDays + (TRASH_PRICE / MONTH_30) * paymentsForPeriods[1].billableDays,
      );
      expect(paymentsWithAdditionalCharges[2].amount).to.equal(
        MONTHLY_MARKET_RENT + (WATER_PRICE / MONTH_30) * paymentsForPeriods[2].billableDays + (TRASH_PRICE / MONTH_30) * paymentsForPeriods[2].billableDays,
      );
    });

    it('Should return the payments without any additional amount when additionalCharges does not have fees associated', () => {
      const additionalChargesWithoutFees = {};
      // leaseStartDate Nov 1st
      const paymentsForPeriods = [
        {
          amount: MONTHLY_MARKET_RENT, // complete month
          billableDays: MONTH_30, // leaseStartDate Nov 1st, 2016
          daysInMonth: MONTH_30,
          timeframe: 'Nov 2016',
        },
        {
          amount: MONTHLY_MARKET_RENT, // complete month
          billableDays: MONTH_30, // 30 days
          daysInMonth: MONTH_30,
          timeframe: 'Dec 2016',
        },
        {
          amount: MONTHLY_MARKET_RENT, // complete month
          billableDays: MONTH_30, // 30 days
          daysInMonth: MONTH_30,
          timeframe: 'Jan 2016',
        },
      ];

      const paymentsWithAdditionalCharges = applyMonthlyAdditonalCharges(additionalChargesWithoutFees, paymentsForPeriods);
      paymentsWithAdditionalCharges.forEach(payment => {
        expect(payment.amount).to.equal(MONTHLY_MARKET_RENT);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 6 month lease term, move in on 1st, non leap year', () => {
    data_driven(MOVE_IN_ON_FIRST_6M, () => {
      it('should return the correct billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDays).to.equal(payments[0].billableDays);
        expect(ctx.billableDays).to.equal(payments[5].billableDays);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 6 month lease term, move in on last non leap year', () => {
    data_driven(MOVE_OUT_ON_LAST_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[6].billableDays);
        expect(ctx.amountOut).to.equal(payments[6].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 6 months lease term, move in on last leap year', () => {
    data_driven(MOVE_IN_ON_LAST_FEBRUARY_LEAP_YEAR_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[6].billableDays);
        expect(ctx.amountOut).to.equal(payments[6].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 6 months lease term, move in on 1st leap year', () => {
    data_driven(MOVE_IN_ON_FIRST_LEAP_YEAR_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[5].billableDays);
        expect(ctx.amountOut).to.equal(payments[5].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 6 months lease term, move in on other dates leap year', () => {
    data_driven(MOVE_IN_ON_OTHER_DATES_LEAP_YEAR_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[6].billableDays);
        expect(ctx.amountOut).to.equal(payments[6].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 6 months lease term, move in on other dates non leap year', () => {
    data_driven(MOVE_IN_OTHER_DATES_NON_LEAP_YEAR_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[6].billableDays);
        expect(ctx.amountOut).to.equal(payments[6].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 1 month lease term, move in on 1st', () => {
    data_driven(MOVE_IN_ON_FIRST_1M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDays).to.equal(payments[0].billableDays);
        expect(ctx.amount).to.equal(payments[0].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 1 month lease term, move in on 2nd', () => {
    data_driven(MOVE_IN_ON_SECOND_1M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[1].billableDays);
        expect(ctx.amountOut).to.equal(payments[1].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge cases in Payment Schedule - 1 month lease term, move in on last', () => {
    data_driven(MOVE_IN_ON_LAST_1M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[1].billableDays);
        expect(ctx.amountOut).to.equal(payments[1].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for cases in Payment Schedule - 1 month lease term, move in different dates non leap year', () => {
    data_driven(MOVE_IN_ON_DATES_NON_LEAP_YEAR_1M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_30_DAY_MONTH);
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(ctx.amountIn).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[1].billableDays);
        expect(ctx.amountOut).to.equal(payments[1].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for edge case in Payment Schedule - 1 month lease term, move in on Feb 1st leap year', () => {
    it('should return the correct amount and billableDays for 2020-02-01', () => {
      const ctx = MOVE_IN_ON_FIRST_FEBRUARY_LEAP_YEAR_1M;
      const payments = getMonthlyBasePayments(ctx[0].leaseTerm, ctx[0].leaseStartDate, PS_30_DAY_MONTH);
      expect(ctx[0].billableDays).to.equal(payments[0].billableDays);
      expect(ctx[0].amount).to.equal(payments[0].amount);
    });
  });

  describe('Validation of amount and billableDays for edge case in Payment Schedule - 1 month lease term, move in on Feb 2nd leap year', () => {
    it('should return the correct amount and billableDays for 2020-02-02', () => {
      const ctx = MOVE_IN_ON_SECOND_FEBRUARY_LEAP_YEAR_1M;
      const payments = getMonthlyBasePayments(ctx[0].leaseTerm, ctx[0].leaseStartDate, PS_30_DAY_MONTH);
      expect(ctx[0].billableDaysIn).to.equal(payments[0].billableDays);
      expect(ctx[0].amountIn).to.equal(payments[0].amount);
      expect(ctx[0].billableDaysOut).to.equal(payments[1].billableDays);
      expect(ctx[0].amountOut).to.equal(payments[1].amount);
    });
  });

  describe('Validation of concessions applied to payments', () => {
    data_driven(MOVE_IN_ON_FIRST_WITH_CONCESSION, () => {
      it('should return the correct amount for each month with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Validation of concessions applied to payments with proration', () => {
    data_driven(MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION, () => {
      it('should return the correct amount for each month with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Validation of multiple concessions applied to payments. Negative amounts trimmed to 0 and applied to the following month/period', () => {
    data_driven(MOVE_IN_ON_FIRST_WITH_MULTIPLE_CONCESSIONS, () => {
      it('should return the correct amount for each month with concession: {description}. The overage should be cancelled if the same fee does not exist in subsequents periods', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Validation of one concession applied to payments with one month lease term. Negative amounts rollover should be rolled to next month on same fee', () => {
    data_driven(MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION_1M, () => {
      it('should return the correct amount for each month with concession: {description}. The overage should be cancelled if the same fee does not exist in subsequents periods', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Validation of multiple concessions applied to payments. Negative amounts rollover should be rolled to next month on same fee', () => {
    data_driven(MOVE_IN_ON_MARCH_16TH_WITH_CONCESSION_2M, () => {
      it('should return the correct amount for each month with concession: {description}. The overage should be cancelled if the same fee does not exist in subsequents periods', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply variable concessions lower or equals to the period or base rent amounts', () => {
    data_driven(MOVE_IN_ON_MARCH_16TH_WITH_VARIABLE_ADJUSTMENT_CONCESSION_2M, () => {
      it('should return the correct amount for every period starting on March 16th ', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case 31 day month - start on 1st', () => {
    data_driven(CASE_31_DAY_MONTH_START_ON_1ST_6M, () => {
      it('should return the correct amount for every period starting on 1st with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case 31 day month - start on 16th', () => {
    data_driven(CASE_31_DAY_MONTH_START_ON_16TH_6M, () => {
      it('should return the correct amount for every period starting on 16th with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case 31 day month - start on 31st', () => {
    data_driven(CASE_31_DAY_MONTH_START_ON_31ST_6M, () => {
      it('should return the correct amount for every period starting on 31st with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply non-recurring concessions without proration to the first period - case 31 day month - calendar month', () => {
    data_driven(NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_FIRST_PERIOD, () => {
      it('should return the correct amount for every period: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply non-recurring concessions without proration to the first full period - case 31 day month - calendar month', () => {
    data_driven(NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_FIRST_FULL_PERIOD, () => {
      it('should return the correct amount for every period: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply non-recurring concessions without proration to the last period - case 31 day month - calendar month', () => {
    data_driven(NO_PRORATION_IN_NON_RECURRING_APPLIED_AT_LAST_PERIOD, () => {
      it('should return the correct amount for every period: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply recurring concessions with proration - case 31 day month - calendar month', () => {
    data_driven(ALWAYS_PRORATE_VARIABLE_RECURRING_CONCESSIONS, () => {
      it('should return the correct amount for every period: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case leap year - start on 1st', () => {
    data_driven(CASE_LEAP_YEAR_FEB_START_ON_1ST_6M, () => {
      it('should return the correct amount for every period starting on 1st with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case leap year - start on 16th', () => {
    data_driven(CASE_LEAP_YEAR_FEB_START_ON_16TH_6M, () => {
      it('should return the correct amount for every period starting on 16th with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case leap year - start on 29th', () => {
    data_driven(CASE_LEAP_YEAR_FEB_START_ON_29TH_6M, () => {
      it('should return the correct amount for every period starting on 29th with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case non leap year - start on 1st', () => {
    data_driven(CASE_NON_LEAP_YEAR_FEB_START_ON_1ST_6M, () => {
      it('should return the correct amount for every period starting on 1st with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case non leap year - start on 16th', () => {
    data_driven(CASE_NON_LEAP_YEAR_FEB_START_ON_16TH_6M, () => {
      it('should return the correct amount for every period starting on 16th with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case non leap year - start on 28th', () => {
    data_driven(CASE_NON_LEAP_YEAR_FEB_START_ON_28TH_6M, () => {
      it('should return the correct amount for every period starting on 28th with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case 30 day month - start on 1st', () => {
    data_driven(CASE_30_DAY_MONTH_START_ON_1ST_6M, () => {
      it('should return the correct amount for every period starting on 1st with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case 30 day month - start on 16th', () => {
    data_driven(CASE_30_DAY_MONTH_START_ON_16TH_6M, () => {
      it('should return the correct amount for every period starting on 16th with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Apply concessions calendar month proration strategy - case 30 day month - start on 30th', () => {
    data_driven(CASE_30_DAY_MONTH_START_ON_30TH_6M, () => {
      it('should return the correct amount for every period starting on 30th with concession: {description}', ctx => {
        const payments = applyMonthlyConcessions(
          ctx.leaseTerm.adjustedMarketRent,
          ctx.leaseTerm.concessions,
          ctx.leaseTerm.termLength,
          ctx.paymentsForPeriods,
          ctx.leaseStartDate,
        );
        for (let i = 0; i < payments.length; i++) {
          expect(ctx.paymentsResult[i].amount).to.equal(payments[i].amount);
        }
      });
    });
  });

  describe('Get min or max deposit amount from selected leaseTerms', () => {
    const fee = {
      leaseTerms: [
        {
          termLength: 6,
          depositAmount: 1500,
          period: 'month',
        },
        {
          termLength: 12,
          depositAmount: 1200,
          period: 'month',
        },
      ],
    };

    it('should return the min value from the given lease terms', () => {
      const result = getMinDepositAmount(fee.leaseTerms);
      expect(result.depositAmount).to.equal(1200);
    });

    it('should return the max value from the given lease terms', () => {
      const result = getMaxDepositAmount(fee.leaseTerms);
      expect(result.depositAmount).to.equal(1500);
    });
  });

  describe('getIdsOfDefaultLeaseTerms should return the default lease term', () => {
    const leaseTermIds = ['12314-asdas-4545', '12314-asdas-4546', '12314-asdas-4547'];
    const leaseTerms = [
      {
        id: leaseTermIds[0],
        period: DALTypes.LeasePeriod.MONTH,
        termLength: 6,
      },
      {
        id: leaseTermIds[1],
        period: DALTypes.LeasePeriod.MONTH,
        termLength: 12,
      },
      {
        id: leaseTermIds[2],
        period: DALTypes.LeasePeriod.MONTH,
        termLength: 9,
      },
    ];

    const defaultLeaseTerms = [6, 12];

    it('should return the matching lease term ids for a new quote', () => {
      const leaseState = DALTypes.LeaseState.NEW;
      const defaultTermIds = getIdsOfDefaultLeaseTerms(leaseTerms, defaultLeaseTerms, leaseState);
      expect(defaultTermIds).to.have.lengthOf(2);
      expect(defaultTermIds).to.not.include.members(['12314-asdas-4547']);
      defaultTermIds.forEach(id => expect(leaseTermIds).to.include(id));
    });

    it('should return all the lease term ids for a renewal quote', () => {
      const leaseState = DALTypes.LeaseState.RENEWAL;
      const defaultTermIds = getIdsOfDefaultLeaseTerms(leaseTerms, defaultLeaseTerms, leaseState);
      expect(defaultTermIds).to.have.lengthOf(3);
      expect(defaultTermIds).to.include.members(['12314-asdas-4545', '12314-asdas-4546', '12314-asdas-4547']);
      defaultTermIds.forEach(id => expect(leaseTermIds).to.include(id));
    });
  });
});
