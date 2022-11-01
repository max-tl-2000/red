/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { getEnhancedLeaseObject } from '../leases/setsMapping';
import { getTotalConcessionsOnMoveInCharges, getSelectedConcessions, getLeaseTermPaymentsByPeriods } from '../leases/baseline';
import { getFixedAmount } from '../../../common/helpers/number';
import { calculateAbsoluteAdjustmentPerMonthlyPeriod } from '../../../common/helpers/quotes';
import { PS_CALENDAR_MONTH } from '../../../client/helpers/quotes';
import { LA_TIMEZONE } from '../../../common/date-constants';
const { mockModules } = require('test-helpers/mocker').default(jest);

const ctx = { tenantId: 'fbcc00c0-a151-46d6-bc72-cfdc38b017e3' };

describe('services/leaseService', () => {
  const fakeInputSet = {
    sets: {
      479: {
        documents: ['docId1', 'docId2'],
      },
    },
    documents: {
      docId1: {
        displayName: 'Core lease',
        formId: 1,
        fields: {
          fieldId1: {
            displayName: 'Resident name',
            type: 'string',
            length: 30,
          },
          fieldId2: {
            displayName: 'Quote value',
            type: 'currency',
          },
          fieldId3: {
            displayName: 'Pet name',
            type: 'string',
            length: 30,
          },
          fieldId6: {
            displayName: 'TTTTTT',
          },
        },
      },
      docId2: {
        displayName: 'Pet addendum',
        formId: 2,
        fields: {
          fieldId3: {
            displayName: 'Pet name',
            type: 'string',
            length: 30,
          },
          fieldId4: {
            displayName: 'Pet breed',
            type: 'string',
            length: 30,
          },
          fieldId5: {
            displayName: 'Pet birth date',
            type: 'datetime',
          },
        },
      },
    },
  };

  const leaseNonRecurringConcessions = {
    1: {
      name: '1FreePeriod',
      amount: 2500,
    },
    2: {
      name: 'PeriodDiscount',
      amount: 1000,
    },
    3: {
      name: 'Lease Incentive - $100 Gift Card',
      amount: 100,
    },
  };

  const concessions = [
    {
      id: '1',
      name: '1FreePeriod',
      nonRecurringAppliedAt: 'firstFull',
      recurring: false,
      absoluteAdjustment: 2500,
      selected: true,
    },
    {
      id: '2',
      name: 'PeriodDiscount',
      nonRecurringAppliedAt: 'first',
      recurring: false,
      absoluteAdjustment: 1000,
      selected: true,
    },
    {
      id: '3',
      name: 'Lease Incentive',
      nonRecurringAppliedAt: 'first',
      recurring: false,
      absoluteAdjustment: 100,
      selected: true,
    },
    {
      id: '4',
      name: 'recurringConcession',
      recurring: true,
      recurringCount: 2,
      absoluteAdjustment: 2500,
      selected: true,
    },
    {
      id: '5',
      name: 'recurringConcession2',
      recurring: true,
      recurringCount: 2,
      absoluteAdjustment: 1000,
      selected: true,
    },
    {
      id: '6',
      name: 'recurringConcession3',
      recurring: true,
      recurringCount: 2,
      absoluteAdjustment: 100,
      selected: true,
    },
  ];

  const leaseRecurringConcessions = {
    4: {
      name: 'recurringConcession',
      amount: 2500,
    },
    5: {
      name: 'recurringConcession2',
      amount: 1000,
    },
    6: {
      name: 'recurringConcession3',
      amount: 100,
    },
  };

  const SIX_MONTHS_LEASE_TERM = {
    period: 'month',
    adjustedMarketRent: 2500,
    termLength: 6,
  };

  const ONE_MONTH_LEASE_TERM = {
    period: 'month',
    adjustedMarketRent: 2500,
    termLength: 1,
  };

  const PERIOD_JANUARY_STARTING_ON_FIFTEEN = {
    daysInMonth: 31,
    billableDays: 17,
  };

  const PERIOD_JANUARY_STARTING_ON_FIRST = {
    daysInMonth: 31,
    billableDays: 31,
  };

  const PERIOD_JANUARY_STARTING_ON_TWEENTY_FIVE = {
    daysInMonth: 31,
    billableDays: 7,
  };

  const PERIOD_JANUARY_STARTING_ON_TWEENTY_SIX = {
    daysInMonth: 31,
    billableDays: 6,
  };

  const PERIOD_JANUARY_STARTING_ON_THIRTY_ONE = {
    daysInMonth: 31,
    billableDays: 1,
  };

  const PERIOD_FEBRUARY_STARTING_ON_FIRST = {
    daysInMonth: 28,
    billableDays: 28,
  };

  const PERIOD_LEAP_FEBRUARY_STARTING_ON_FIRST = {
    daysInMonth: 29,
    billableDays: 29,
  };

  const leaseRecurringAndNonRecurringConcessions = { ...leaseRecurringConcessions, ...leaseNonRecurringConcessions };

  const NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST = leaseNonRecurringConcessions['2'].amount + leaseNonRecurringConcessions['3'].amount;
  const NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_AND_FIRST_FULL =
    leaseNonRecurringConcessions['1'].amount + leaseNonRecurringConcessions['2'].amount + leaseNonRecurringConcessions['3'].amount;
  const NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_FULL = leaseNonRecurringConcessions['1'].amount;

  const RECURRING_CONCESSIONS_TOTAL = leaseRecurringConcessions['4'].amount + leaseRecurringConcessions['5'].amount + leaseRecurringConcessions['6'].amount;
  const NON_LEAP_FEBRUARY_DAYS = 28;
  const TWENTY_FIVE_DAYS = 25;
  const TWENTY_FIVE_DAYS_PRORATED_RECURRING_CONCESSIONS_TOTAL =
    ONE_MONTH_LEASE_TERM.adjustedMarketRent < RECURRING_CONCESSIONS_TOTAL
      ? getFixedAmount((ONE_MONTH_LEASE_TERM.adjustedMarketRent / NON_LEAP_FEBRUARY_DAYS) * TWENTY_FIVE_DAYS, 2)
      : getFixedAmount((RECURRING_CONCESSIONS_TOTAL / NON_LEAP_FEBRUARY_DAYS) * TWENTY_FIVE_DAYS, 2);

  describe('when calling the document enhancer service', () => {
    it('should enhance the lease template with additional attributes ', async () => {
      const data = {
        residents: [
          {
            fullName: 'Ion',
            location: {},
          },
        ],
        guarantors: [],
        pets: [
          {
            name: 'Azorel',
            breed: 'CaineRau',
          },
        ],
        occupants: [],
        children: [],
        quote: {
          ammount: 2000,
          concessions: [],
        },
        vehicles: [],
        officeWorkingTime: {},
      };

      const result = getEnhancedLeaseObject(ctx, fakeInputSet, data);
      expect(result).to.contain.all.keys(['setId', 'documents', 'applicable']);
      expect(result.documents.docId1).to.contain.all.keys(['mandatory', 'displayName', 'isIncluded', 'fields', 'formId']);
      expect(result.documents.docId1.fields.fieldId1).to.contain.all.keys(['mandatory', 'value', 'showOnForm', 'readOnly']);
    });
  });

  describe('when calling getTotalConcessionsOnMoveInCharges function', () => {
    const calculateExpectedResult = ({ baseRent, period, predifinedBillableDays, recurringConcession, nonRecurringConcession }) => {
      const { daysInMonth, billableDays } = period;
      const days = predifinedBillableDays || billableDays;
      const finalBaseRent = (baseRent / daysInMonth) * days;

      const recurringConcessionAmount = recurringConcession
        ? calculateAbsoluteAdjustmentPerMonthlyPeriod(recurringConcession.absoluteAdjustment, period, true)
        : 0;
      const nonRecurringConcessionAmount = nonRecurringConcession
        ? calculateAbsoluteAdjustmentPerMonthlyPeriod(nonRecurringConcession.absoluteAdjustment, period, false)
        : 0;

      const finalConcessionAmount = recurringConcessionAmount + nonRecurringConcessionAmount;

      if (finalConcessionAmount > finalBaseRent) return finalBaseRent;
      return finalConcessionAmount;
    };

    const executeConcessionScenario = data => {
      const { leaseTerm, leaseStartDate, leaseEndDate } = data;
      const selectedConcessions = getSelectedConcessions(data.concessions, data.leaseConcessions);
      const paymentsByPeriods = getLeaseTermPaymentsByPeriods({
        leaseTerm,
        leaseStartDate,
        leaseEndDate,
        prorationStrategy: PS_CALENDAR_MONTH,
        selectedConcessions,
        timezone: LA_TIMEZONE,
      });

      const result = getTotalConcessionsOnMoveInCharges(data.leaseStartDate, paymentsByPeriods, LA_TIMEZONE);
      expect(result).to.equal(data.expectedResult);
    };

    describe('when the lease start day is lower than 25 but higher than 1 (Non Recurring Concessions)', () => {
      it('should apply just the FIRST non recurring concessions', async () => {
        const leaseStartDate = '2017-01-15T08:00:00.000Z';
        const leaseEndDate = '2017-07-15T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_FIFTEEN,
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is 1st of the month', () => {
      it('should apply the FIRST_FULL and FIRST non recurring concessions to the first month  (Non Recurring Concessions)', async () => {
        const leaseStartDate = '2017-01-01T08:00:00.000Z';
        const leaseEndDate = '2017-06-30T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_FIRST,
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_AND_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is equals to 25 (Non Recurring Concessions)', () => {
      it('should apply the FIRST non recurring concessions to the first month and the FIRST_FULL non recurring concession to the second month', async () => {
        const leaseStartDate = '2017-01-25T08:00:00.000Z';
        const leaseEndDate = '2017-07-25T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_FIVE,
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is higher than 25 (Non Recurring Concessions)', () => {
      it('should apply the FIRST non recurring concessions to the first month and the FIRST_FULL non recurring concession to the second month', async () => {
        const leaseStartDate = '2017-01-26T08:00:00.000Z';
        const leaseEndDate = '2017-07-26T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_SIX,
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is lower than 25 (Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions to the first month', async () => {
        const leaseStartDate = '2017-01-15T08:00:00.000Z';
        const leaseEndDate = '2017-07-15T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_FIFTEEN,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is equals to 25 (Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions to the first and second months', async () => {
        const leaseStartDate = '2017-01-25T08:00:00.000Z';
        const leaseEndDate = '2017-07-25T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_FIVE,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is higher than 25 (Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions to the first and second months', async () => {
        const leaseStartDate = '2017-01-26T08:00:00.000Z';
        const leaseEndDate = '2017-07-26T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_SIX,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is higher or equals to 25 and is a one month lease (Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions to the first month and apply the proration correctly just to 25 days of the second month', async () => {
        const leaseStartDate = '2017-01-25T08:00:00.000Z';
        const leaseEndDate = '2017-02-25T08:00:00.000Z';
        const secondMonthBillableDays = 25;

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_FIVE,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          predifinedBillableDays: secondMonthBillableDays,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });

        executeConcessionScenario({
          leaseTerm: ONE_MONTH_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });

        expect(getFixedAmount(secondMonthAmount, 2)).to.equal(TWENTY_FIVE_DAYS_PRORATED_RECURRING_CONCESSIONS_TOTAL);
      });
    });

    describe('when the lease start day is lower than 25 but higher than 1 (Recurring and Non Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions and the FIRST non recurring concessions to the first month', async () => {
        const leaseStartDate = '2017-01-15T08:00:00.000Z';
        const leaseEndDate = '2017-07-15T08:00:00.000Z';

        const firstMonthRecurringAndNonRecurringConcessionsAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_FIFTEEN,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringAndNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthRecurringAndNonRecurringConcessionsAmount, 2),
        });
      });
    });

    describe('when the lease start day is 1st of the month (Recurring and Non Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions and the FIRST and FIRST_FULL non recurring concessions to the first month', async () => {
        const leaseStartDate = '2017-01-01T08:00:00.000Z';
        const leaseEndDate = '2017-07-15T08:00:00.000Z';

        const firstMonthRecurringAndNonRecurringConcessionsAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_FIRST,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_AND_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringAndNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthRecurringAndNonRecurringConcessionsAmount, 2),
        });
      });
    });

    describe('when the lease start day is equals to 25 (Recurring and Non Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions and FIRST non recurring concessions to first and second month, and apply the FIRST_FULL non recurring concessions to the second month', async () => {
        const leaseStartDate = '2017-01-25T08:00:00.000Z';
        const leaseEndDate = '2017-07-25T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_FIVE,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringAndNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is higher than 25 (Recurring and Non Recurring Concessions)', () => {
      it('should apply all the prorated recurring concessions and FIRST non recurring concessions to first and second month, and apply the FIRST_FULL non recurring concessions to the second month', async () => {
        const leaseStartDate = '2017-01-26T08:00:00.000Z';
        const leaseEndDate = '2017-07-26T08:00:00.000Z';

        const firstMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_SIX,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: SIX_MONTHS_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: SIX_MONTHS_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringAndNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start day is higher or equals to 25 and is a one month lease (Recurring and Non Recurring Concessions)', () => {
      xit('should apply the prorated recurring concessions and FIRST non recurring concessions to first and second month, prorate 25 days of the recurring concessions to the second month, and do not apply the FIRST_FULL non recurring concessions to the second month', async () => {
        const leaseStartDate = '2017-01-25T08:00:00.000Z';
        const leaseEndDate = '2017-02-25T08:00:00.000Z';
        const secondMonthBillableDays = 25;

        const firstMonthAmount = calculateExpectedResult({
          baseRent: ONE_MONTH_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_TWEENTY_FIVE,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: ONE_MONTH_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          predifinedBillableDays: secondMonthBillableDays,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
        });
        executeConcessionScenario({
          leaseTerm: ONE_MONTH_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringAndNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start date is January 31, the year is non leap and is a one month lease (Recurring and Non Recurring Concessions)', () => {
      it('should apply the prorated recurring concessions and FIRST non recurring concessions to first and second month, prorate 28 days from february of recurring concessions to the second month, and apply the FIRST_FULL non recurring concessions to the second month', async () => {
        const leaseStartDate = '2017-01-31T08:00:00.000Z';
        const leaseEndDate = '2017-02-28T08:00:00.000Z';
        const secondMonthBillableDays = 28;

        const firstMonthAmount = calculateExpectedResult({
          baseRent: ONE_MONTH_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_THIRTY_ONE,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: ONE_MONTH_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_FEBRUARY_STARTING_ON_FIRST,
          predifinedBillableDays: secondMonthBillableDays,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: ONE_MONTH_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringAndNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });

    describe('when the lease start date is January 31, is a leap year and is a one month lease (Recurring and Non Recurring Concessions)', () => {
      it('should apply the prorated recurring concessions and FIRST non recurring concessions to first and second month, just 29 days from february of recurring concessions to the second month, and apply the FIRST_FULL non recurring concessions to the second month', async () => {
        const leaseStartDate = '2016-01-31T08:00:00.000Z';
        const leaseEndDate = '2016-02-29T08:00:00.000Z';
        const secondMonthBillableDays = 29;

        const firstMonthAmount = calculateExpectedResult({
          baseRent: ONE_MONTH_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_JANUARY_STARTING_ON_THIRTY_ONE,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST,
          },
        });

        const secondMonthAmount = calculateExpectedResult({
          baseRent: ONE_MONTH_LEASE_TERM.adjustedMarketRent,
          period: PERIOD_LEAP_FEBRUARY_STARTING_ON_FIRST,
          predifinedBillableDays: secondMonthBillableDays,
          recurringConcession: {
            absoluteAdjustment: RECURRING_CONCESSIONS_TOTAL,
          },
          nonRecurringConcession: {
            absoluteAdjustment: NON_RECURRING_CONCESSIONS_TOTAL_APPLIED_AT_FIRST_FULL,
          },
        });

        executeConcessionScenario({
          leaseTerm: ONE_MONTH_LEASE_TERM,
          leaseStartDate,
          leaseEndDate,
          leaseConcessions: leaseRecurringAndNonRecurringConcessions,
          concessions,
          expectedResult: getFixedAmount(firstMonthAmount + secondMonthAmount, 2),
        });
      });
    });
  });

  describe('createLease', () => {
    let leaseService;

    const checkCreateLeaseStatus = async () => {
      try {
        await leaseService.createLease({ tenantId: getUUID() }, getUUID(), []);
      } catch (e) {
        expect(e.status).to.equal(412);
        expect(e.token).to.equal('NO_LEASE_TEMPLATE_AVAILABLE');
      }
    };

    const defaultMocks = (leaseTemplate = []) => ({
      loadQuotePromotion: jest.fn(() => ({ partyId: getUUID(), quoteId: getUUID(), leaseTermId: getUUID() })),
      isCorporateLeaseType: jest.fn(() => true),
      getPartyLeases: jest.fn(() => []),
      getPropertyLeaseTemplates: jest.fn(() => leaseTemplate),
      getQuoteById: jest.fn(() => ({ inventoryId: getUUID(), publishedQuoteData: { leaseTerms: [] } })),
      getInventoryById: jest.fn(() => ({})),
      validateActionOnInventory: jest.fn(() => null),
    });

    const setupMocks = mocks => {
      jest.resetModules();
      mockModules({
        '../../dal/partyRepo': {
          loadQuotePromotion: mocks.loadQuotePromotion,
        },
        '../../services/party': {
          isCorporateLeaseType: mocks.isCorporateLeaseType,
        },
        '../../dal/leaseRepo': {
          getPartyLeases: mocks.getPartyLeases,
          getPropertyLeaseTemplates: mocks.getPropertyLeaseTemplates,
        },
        '../quotes': {
          getQuoteById: mocks.getQuoteById,
        },
        '../../dal/inventoryRepo': {
          getInventoryById: mocks.getInventoryById,
        },
        '../inventories': {
          validateActionOnInventory: mocks.validateActionOnInventory,
        },
      });

      leaseService = require('../leases/leaseService'); // eslint-disable-line global-require
    };

    describe('When there are no lease templates defined', () => {
      it('should return an 412 error', async () => {
        const mocks = defaultMocks();
        setupMocks(mocks);
        await checkCreateLeaseStatus();
      });
    });

    describe('When there are no lease templates documents defined', () => {
      it('should return an 412 error', async () => {
        const mocks = defaultMocks([{ templateData: {} }]);
        setupMocks(mocks);
        await checkCreateLeaseStatus();
      });
    });
  });
});
