/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import data_driven from 'data-driven'; // eslint-disable-line
import { getFixedAmount, PS_CALENDAR_MONTH, MONTH_30, MONTH_31 } from '../quotes';
import { getSelectedFeesMonthlyAmount, getMonthlyBasePayments, applyMonthlyAdditonalCharges } from '../../../common/helpers/quotes';
import { CASE_NON_LEAP_YEAR_FEB_6M } from '../../__tests__/fixtures/case-non-leap-year-data-test';
import { CASE_LEAP_YEAR_FEB_6M } from '../../__tests__/fixtures/case-leap-year-data-test';
import { CASE_30_DAYS_MONTH_6M } from '../../__tests__/fixtures/case-30-day-month-data-test';
import { CASE_31_DAYS_MONTH_6M } from '../../__tests__/fixtures/case-31-day-month-data-test';

import { WATER, TRASH, GAS, WATER_PRICE, TRASH_PRICE, GAS_PRICE, generateFee } from '../../__tests__/fixtures/quotes-fees-commons-test';

describe('Quotes apply calendar month proration strategy to get base rent and fees values', () => {
  const MONTHLY_MARKET_RENT = 3000;

  describe('Validation of amount and billableDays for base rent - 6 months, move in FEB non leap year', () => {
    data_driven(CASE_NON_LEAP_YEAR_FEB_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_CALENDAR_MONTH);
        const paymentsLength = payments.length;
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(getFixedAmount(ctx.amountIn, 2)).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[paymentsLength - 1].billableDays);
        expect(getFixedAmount(ctx.amountOut, 2)).to.equal(payments[paymentsLength - 1].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for base rent - 6 months, move in FEB leap year', () => {
    data_driven(CASE_LEAP_YEAR_FEB_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_CALENDAR_MONTH);
        const paymentsLength = payments.length;
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(getFixedAmount(ctx.amountIn, 2)).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[paymentsLength - 1].billableDays);
        expect(getFixedAmount(ctx.amountOut, 2)).to.equal(payments[paymentsLength - 1].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for base rent - 6 months, 30 day month', () => {
    data_driven(CASE_30_DAYS_MONTH_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_CALENDAR_MONTH);
        const paymentsLength = payments.length;
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(getFixedAmount(ctx.amountIn, 2)).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[paymentsLength - 1].billableDays);
        expect(getFixedAmount(ctx.amountOut, 2)).to.equal(payments[paymentsLength - 1].amount);
      });
    });
  });

  describe('Validation of amount and billableDays for base rent - 6 months, 31 day month', () => {
    data_driven(CASE_31_DAYS_MONTH_6M, () => {
      it('should return the correct amount and billableDays for {leaseStartDate}', ctx => {
        const payments = getMonthlyBasePayments(ctx.leaseTerm, ctx.leaseStartDate, PS_CALENDAR_MONTH);
        const paymentsLength = payments.length;
        expect(ctx.billableDaysIn).to.equal(payments[0].billableDays);
        expect(getFixedAmount(ctx.amountIn, 2)).to.equal(payments[0].amount);
        expect(ctx.billableDaysOut).to.equal(payments[paymentsLength - 1].billableDays);
        expect(getFixedAmount(ctx.amountOut, 2)).to.equal(payments[paymentsLength - 1].amount);
      });
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
          amount: (MONTHLY_MARKET_RENT / MONTH_31) * 5, // paid 5 days
          billableDays: 5, // leaseStartDate Aug 26th, 2016
          daysInMonth: MONTH_31,
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
          billableDays: MONTH_31, // 31 days
          daysInMonth: MONTH_31,
          timeframe: 'Oct 2016',
        },
      ];

      const paymentsWithAdditionalCharges = applyMonthlyAdditonalCharges(additionalCharges, paymentsForPeriods);
      expect(getFixedAmount(paymentsWithAdditionalCharges[0].amount, 2)).to.equal(
        getFixedAmount(
          (MONTHLY_MARKET_RENT / MONTH_31) * 5 +
            (WATER_PRICE / MONTH_31) * paymentsForPeriods[0].billableDays +
            (TRASH_PRICE / MONTH_31) * paymentsForPeriods[0].billableDays,
          2,
        ),
      );
      expect(getFixedAmount(paymentsWithAdditionalCharges[1].amount, 2)).to.equal(
        getFixedAmount(
          MONTHLY_MARKET_RENT + (WATER_PRICE / MONTH_30) * paymentsForPeriods[1].billableDays + (TRASH_PRICE / MONTH_30) * paymentsForPeriods[1].billableDays,
          2,
        ),
      );
      expect(getFixedAmount(paymentsWithAdditionalCharges[2].amount, 2)).to.equal(
        getFixedAmount(
          MONTHLY_MARKET_RENT + (WATER_PRICE / MONTH_31) * paymentsForPeriods[2].billableDays + (TRASH_PRICE / MONTH_31) * paymentsForPeriods[2].billableDays,
          2,
        ),
      );
    });
  });

  describe('getSelectedFeeMonthlyAmount', () => {
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
      billableDays: MONTH_31, // 31 days
      daysInMonth: MONTH_31,
      timeframe: 'Aug 2016',
    };

    it('Should get the amount of selected additional charges -  only Utilities fees full month', () => {
      const additionalChargeAmount = getSelectedFeesMonthlyAmount(additionalCharges, paymentFullMonth);
      expect(getFixedAmount(additionalChargeAmount, 2)).to.equal(
        getFixedAmount((WATER_PRICE / MONTH_31) * paymentFullMonth.billableDays + (TRASH_PRICE / MONTH_31) * paymentFullMonth.billableDays),
        2,
      );
    });

    it('Should get the amount of selected additional charges - all fees selected full month', () => {
      additionalCharges.fees[2].selected = true; // Gas is now selected
      const additionalChargeAmount = getSelectedFeesMonthlyAmount(additionalCharges, paymentFullMonth);
      expect(getFixedAmount(additionalChargeAmount, 2)).to.equal(
        getFixedAmount(
          (WATER_PRICE / MONTH_31) * paymentFullMonth.billableDays +
            (TRASH_PRICE / MONTH_31) * paymentFullMonth.billableDays +
            (GAS_PRICE / MONTH_31) * paymentFullMonth.billableDays,
        ),
        2,
      );
    });
  });
});
