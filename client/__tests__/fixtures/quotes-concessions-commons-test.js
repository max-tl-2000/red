/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getFixedAmount } from '../../helpers/quotes';
export const BASE_RENT_AMOUNT_2264 = 2264;
const BASE_RENT_AMOUNT_2000 = 2000;
const ADJUSTED_MARKET_RENT = 3000;
const MONTH_31 = 31;
const MONTH_30 = 30;
const NON_LEAP_YEAR_FEB_DAYS = 28;
const LEAP_YEAR_FEB_DAYS = 29;

const ONE_TIME = '1 period free';
const RECURRING_CONCESSION = 'recurring concession applied to all terms or to subset';
const VARIABLE_ONE_TIME = 'Variable One time concession';

export const BASE_RENT_AMOUNT_2000_15_DAYS_30MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_30) * 15, 2);
export const BASE_RENT_AMOUNT_2000_16_DAYS_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 16, 2);
export const BASE_RENT_AMOUNT_2000_15_DAYS_31MONTH = getFixedAmount((BASE_RENT_AMOUNT_2000 / MONTH_31) * 15, 2);

const generateConcession = concession => {
  const concessionObj = {
    ...concession,
    selected: true,
  };
  return concessionObj;
};

const generateConcessionArray = concessionsReq => {
  const concessions = [];
  concessionsReq.forEach(concession => {
    const newConcession = {
      nonRecurringAppliedAt: concession.nonRecurringAppliedAt,
      relativeAdjustment: concession.relativeAdjustment,
      absoluteAdjustment: concession.absoluteAdjustment,
      variableAdjustment: concession.variableAdjustment,
      recurring: false,
      recurringCount: 0,
      excludeFromRentFlag: false,
      selected: true,
    };

    switch (concession.name) {
      case ONE_TIME:
        newConcession.variableAdjustment = false;
        break;
      case RECURRING_CONCESSION:
        newConcession.recurring = true;
        newConcession.recurringCount = concession.recurringCount;
        newConcession.excludeFromRentFlag = concession.excludeFromRentFlag;
        newConcession.amountVariableAdjustment = concession.amountVariableAdjustment;
        break;
      case VARIABLE_ONE_TIME:
        newConcession.absoluteAdjustment = null;
        newConcession.variableAdjustment = true;
        newConcession.amountVariableAdjustment = concession.amountVariableAdjustment;
        break;
      default:
        // 1 month free
        newConcession.nonRecurringAppliedAt = 'first';
        newConcession.relativeAdjustment = -100;
        newConcession.absoluteAdjustment = null;
        newConcession.variableAdjustment = false;
    }
    concessions.push(newConcession);
  });
  return concessions;
};

const generateLeaseTerm = (leaseEndDate, leaseTermLength, marketRent, concessions) => {
  const marketRentValue = marketRent || ADJUSTED_MARKET_RENT;
  const concessionsArray = concessions ? generateConcessionArray(concessions) : null;

  const leaseTerm = {
    adjustedMarketRent: marketRentValue,
    period: 'month',
    endDate: leaseEndDate,
    termLength: leaseTermLength,
    concessions: concessionsArray,
  };
  return leaseTerm;
};

const getPaymentFromInfo = (period, baseRent) => {
  period.daysInMonth = period.daysInMonth ? period.daysInMonth : MONTH_30;
  const payment = {
    timeframe: period.timeframe,
    billableDays: period.billableDays,
    daysInMonth: period.daysInMonth,
    pendingConcessionAmount: 0,
    remainingConcessionAmount: 0,
    amount: parseFloat(((baseRent / period.daysInMonth) * period.billableDays).toFixed(2)),
  };
  return payment;
};

const generateBasePayments = (periods, baseRent) => periods.map(period => getPaymentFromInfo(period, baseRent));

const generatePaymentsResult = paymentsValues => {
  const payments = [];
  paymentsValues.forEach(value => {
    payments.push({ amount: value });
  });
  return payments;
};

export {
  generateConcession,
  generateLeaseTerm,
  generateBasePayments,
  generatePaymentsResult,
  generateConcessionArray,
  getPaymentFromInfo,
  BASE_RENT_AMOUNT_2000,
  ADJUSTED_MARKET_RENT,
  MONTH_31,
  MONTH_30,
  NON_LEAP_YEAR_FEB_DAYS,
  LEAP_YEAR_FEB_DAYS,
  ONE_TIME,
  RECURRING_CONCESSION,
  VARIABLE_ONE_TIME,
};
