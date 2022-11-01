/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import path from 'path';
import {
  getConcessionValue,
  isScreeningResultIncomplete,
  doesScreeningResultChangedAfterPromotion,
  getMatchingResultsSorted,
  getMatrixLeaseRentData,
  searchLowestPriceInClosestRanges,
  getFeeAmounts,
} from '../quotes';
import { ScreeningDecision } from '../../enums/applicationTypes';
import { FADV_RESPONSE_STATUS } from '../../../rentapp/common/screening-constants';
import { readJSONFile } from '../file';
import * as m from '../moment-utils';
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('quotes common functions', () => {
  const concession = {
    id: '7468fd1d-d592-4900-bdee-a61240cb42d3',
    displayName: '1 month free',
    variableAdjustment: false,
    relativeAdjustment: '-100.00',
    absoluteAdjustment: '0.00',
    nonRecurringAppliedAt: 'first',
    optional: true,
    hideInSelfService: false,
    excludeFromRentFlag: false,
    matchingCriteria: null,
    startDate: '2016-01-01T00:00:00.000Z',
    endDate: null,
    feeId: '223d2e90-4e34-49e6-81f2-b5bd2e8dde3e',
    selected: true,
  };

  it('should multiply the amount by 1 when concession is not recurring', () => {
    const amount = 100;
    const lengthOfLeaseTerm = 5;
    const recurringCount = 10;
    const myConcession = { ...concession, amount, recurring: false, recurringCount };
    const concessionValue = getConcessionValue(
      myConcession,
      {
        amount,
        length: lengthOfLeaseTerm,
      },
      true,
    );
    expect(concessionValue).toEqual(amount);
  });

  it('should use recurringCount to multiply the amount when the concession in recurring', () => {
    const amount = 100;
    const lengthOfLeaseTerm = 5;
    const recurringCount = 10;
    const myConcession = { ...concession, amount, recurring: true, recurringCount };
    const concessionValue = getConcessionValue(
      myConcession,
      {
        amount,
        length: lengthOfLeaseTerm,
      },
      true,
    );
    expect(concessionValue).toEqual(amount * recurringCount);
  });

  it('should use paramCount to multiply the amount when recurringCount is undefined and the concession in recurring', () => {
    const amount = 100;
    const lengthOfLeaseTerm = 5;
    const recurringCount = undefined;
    const myConcession = { ...concession, amount, recurring: true, recurringCount };
    const concessionValue = getConcessionValue(
      myConcession,
      {
        amount,
        length: lengthOfLeaseTerm,
      },
      true,
    );
    expect(concessionValue).toEqual(amount * lengthOfLeaseTerm);
  });

  describe('doesScreeningResultChangedAfterPromotion and isScreeningResultIncomplete functions', () => {
    const quoteId = newUUID();
    const quotePromotion = { quoteId, updated_at: '2018-07-31 15:15:40.962+00' };
    const leaseTerm = { termLength: 12 };
    const commonResultsData = { rentData: { leaseTermMonths: 12 }, quoteId };
    const testScenarios = [
      {
        screeningResults: [],
        description: 'there are not results',
        result: false,
      },
      {
        screeningResults: [{ ...commonResultsData }],
        description: 'there is just one result',
        result: false,
      },
      {
        screeningResults: [
          { ...commonResultsData, submissionResponseCreatedAt: '2018-07-31 15:15:10.962+00' },
          { ...commonResultsData, submissionResponseCreatedAt: '2018-07-31 15:15:11.962+00' },
        ],
        description: 'there is non results after the quote promotion approval',
        result: false,
      },
      {
        screeningResults: [
          { ...commonResultsData, submissionResponseCreatedAt: '2018-07-31 15:15:10.962+00', applicationDecision: ScreeningDecision.APPROVED },
          { ...commonResultsData, submissionResponseCreatedAt: '2018-07-31 15:16:11.962+00', applicationDecision: ScreeningDecision.APPROVED },
        ],
        description: 'there is one result after quote promotion but it has the same status from result previous promotion',
        result: false,
      },
      {
        screeningResults: [
          { ...commonResultsData, submissionResponseCreatedAt: '2018-07-31 15:15:10.962+00', applicationDecision: ScreeningDecision.GUARANTOR_REQUIRED },
          { ...commonResultsData, submissionResponseCreatedAt: '2018-07-31 15:15:20.962+00', applicationDecision: ScreeningDecision.APPROVED },
          { ...commonResultsData, submissionResponseCreatedAt: '2018-07-31 15:16:11.962+00', applicationDecision: ScreeningDecision.APPROVED_WITH_COND },
        ],
        description: 'there is one result after quote promotion and it has different status from result previous promotion',
        result: true,
      },
    ];

    testScenarios.forEach(scenario => {
      const sortedScreeningResults = getMatchingResultsSorted(quotePromotion, leaseTerm, scenario.screeningResults);

      describe(`When ${scenario.description}`, () => {
        it(`should return ${scenario.result}`, () => {
          const result = doesScreeningResultChangedAfterPromotion(quotePromotion, sortedScreeningResults);
          expect(result).toEqual(scenario.result);
        });
      });
    });

    const incompleteScenarios = [{ applicationDecision: ScreeningDecision.INCOMPLETE }, { status: FADV_RESPONSE_STATUS.INCOMPLETE }];

    incompleteScenarios.forEach(scenario => {
      describe('When calling isScreeningResultIncomplete and there are screening results with an incomplete result', () => {
        it('should return true', () => {
          const result = isScreeningResultIncomplete([scenario]);
          expect(result).toEqual(true);
        });
      });
    });
  });

  describe('getLowestPriceStartDateFromMatrixForDatesRange function', () => {
    const leaseTerms = [
      {
        id: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef',
        termLength: 3,
      },
      {
        id: 'a5933c46-aaa9-4bbf-83a9-934c9fed80bb',
        termLength: 4,
      },
      {
        id: '0ed31cf3-324a-41b3-aa84-85d361843b8f',
        termLength: 5,
      },
      {
        id: 'b651fc66-3697-48c7-aec8-240004ebddae',
        termLength: 6,
      },
      {
        id: '269671c0-3f41-4407-a2b8-e038dd3c899a',
        termLength: 7,
      },
      {
        id: '46bd0ee9-f8d8-4ba0-b75b-b588b1dec60d',
        termLength: 8,
      },
      {
        id: 'b74f0de4-3c2a-41c5-ad0b-37eaec0ebe64',
        termLength: 9,
      },
      {
        id: 'abee1ffa-4839-44cf-8e69-b540ecfb5508',
        termLength: 10,
      },
      {
        id: '6f83b811-41b5-4ded-bbd7-9aa1e73d1bf5',
        termLength: 11,
      },
      {
        id: 'e1fab6ff-ccd3-46a9-8770-11c15cd100b8',
        termLength: 12,
      },
      {
        id: '62575d24-0599-4b2b-9f52-13a1f7da2a6e',
        termLength: 13,
      },
      {
        id: 'f71d659f-c8b1-4871-9c43-868ee784e65c',
        termLength: 14,
      },
    ];
    const rentMatrixFilePath = './fixtures/rent-matrix.json';
    const rentMatrix = (readJSONFile({ filePath: path.join(__dirname, rentMatrixFilePath) }) || {}).rec;
    const timezone = 'America/Los_Angeles';

    let getLowestPriceStartDateFromMatrixForDatesRange;
    beforeEach(() => {
      jest.resetModules();

      mockModules({
        '../moment-utils': {
          ...m,
          now: jest.fn(() => m.toMoment('2018-12-28', { timezone })),
        },
      });

      getLowestPriceStartDateFromMatrixForDatesRange = require('../quotes').getLowestPriceStartDateFromMatrixForDatesRange; // eslint-disable-line
    });

    const executeTest = ({ moveInDateRangePreference, expectations }) => {
      const model = { rentMatrix, leaseTerms, propertyTimezone: timezone };
      const { termId, termLength, adjustedMarketRent } = getLowestPriceStartDateFromMatrixForDatesRange({ model, moveInDateRangePreference });
      const { length, id, price } = expectations;

      expect(termLength).toEqual(length);
      expect(termId).toEqual(id);
      expect(adjustedMarketRent).toEqual(price);
    };

    describe('when sending an start date before the first start date from rent matrix', () => {
      describe('and none end date has been sent', () => {
        it('should return the start date and term id with lowest price within that range', () => {
          const moveInDateRangePreference = { min: '2018-12-02' };
          executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5410.00' } });
        });
      });
      describe('and the end date is before the last end date from rent matrix', () => {
        it('should return the start date and term id with lowest price within that range', () => {
          const moveInDateRangePreference = { min: '2018-12-02', max: '2019-01-01' };
          executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5410.00' } });
        });
      });
      describe('and the end date is after the last end date from rent matrix', () => {
        it('should return the start date and term id with lowest price within that range', () => {
          const moveInDateRangePreference = { min: '2018-12-02', max: '2019-12-01' };
          executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5410.00' } });
        });
      });
    });
    describe('when sending an start date after the first start date from rent matrix', () => {
      describe('and none end date has been sent', () => {
        it('should return the start date and term id with lowest price within that range', () => {
          const moveInDateRangePreference = { min: '2019-01-13' };
          executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5420.00' } });
        });
      });
      describe('and the end date is before the last end date from rent matrix', () => {
        it('should return the start date and term id with lowest price within that range', () => {
          const moveInDateRangePreference = { min: '2019-01-13', max: '2019-01-18' };
          executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5420.00' } });
        });
      });
      describe('and the end date is after the last end date from rent matrix', () => {
        it('should return the start date and term id with lowest price within that range', () => {
          const moveInDateRangePreference = { min: '2019-01-13', max: '2019-12-18' };
          executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5420.00' } });
        });
      });
    });
    describe('when the move in end date is before the rent matrix first start date', () => {
      it('should return first available price in the matrix', () => {
        const moveInDateRangePreference = { min: '2018-12-20', max: '2018-12-27' };
        executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5410.00' } });
      });
    });
    describe('when the move in start date is after the rent matrix last end date', () => {
      it('should return first available price in the matrix', () => {
        const moveInDateRangePreference = { min: '2019-01-26', max: '2019-01-30' };
        executeTest({ moveInDateRangePreference, expectations: { length: 14, id: 'f71d659f-c8b1-4871-9c43-868ee784e65c', price: '5546.00' } });
      });
    });
  });

  describe('searchLowestPriceInClosestRanges function', () => {
    const rentMatrixFilePath = './fixtures/rent-matrix.json';
    const rentMatrix = (readJSONFile({ filePath: path.join(__dirname, rentMatrixFilePath) }) || {}).rec;

    const executeTest = ({ startDate, expectations }) => {
      const leaseTermFromMatrix = rentMatrix[3];
      const result = searchLowestPriceInClosestRanges(Object.keys(leaseTermFromMatrix), leaseTermFromMatrix, startDate);
      expect(result).toEqual(expectations);
    };

    describe('when sending an start date with price higher than the previous', () => {
      describe('and the previous price is lower than the next', () => {
        it('should return the previous price with its end date', () => {
          executeTest({ startDate: '2019-01-12', expectations: { rent: 8800, endDate: '2019-01-11' } });
        });
      });
    });

    describe('when sending an start date with price lower than the previous', () => {
      describe('and the next', () => {
        it('should return the current date price', () => {
          executeTest({ startDate: '2019-01-20', expectations: { rent: 9460, endDate: '2019-01-20' } });
        });
      });
    });

    describe('when sending an start date with price higher than the next', () => {
      describe('and the next price is lower than the previous', () => {
        it('should return the next price with its end date', () => {
          executeTest({ startDate: '2019-01-19', expectations: { rent: 9460, endDate: '2019-01-20' } });
        });
      });
    });
  });
});

const leaseTermFromMatrix = {
  '2019-05-02': {
    rent: '2405.00',
    endDate: '2019-05-09',
  },
  '2019-05-10': {
    rent: '2459.00',
    endDate: '2019-05-10',
  },
  '2019-05-11': {
    rent: '2459.00',
    endDate: '2019-05-11',
  },
  '2019-05-12': {
    rent: '2466.00',
    endDate: '2019-05-12',
  },
  '2019-05-13': {
    rent: '2512.00',
    endDate: '2019-05-13',
  },
  '2019-05-14': {
    rent: '2512.00',
    endDate: '2019-05-14',
  },
  '2019-05-15': {
    rent: '2526.00',
    endDate: '2019-05-15',
  },
  '2019-05-16': {
    rent: '2546.00',
    endDate: '2019-05-16',
  },
  '2019-05-17': {
    rent: '2566.00',
    endDate: '2019-05-17',
  },
};

const executeLeaseRentTest = ({ leaseStartDate, getClosestRange = true, expectedLeaseRent, expectedDate }) => {
  const result = getMatrixLeaseRentData(leaseTermFromMatrix, leaseStartDate, getClosestRange);
  expect(result.leaseRentData).toEqual(expectedLeaseRent);
  expect(result.date).toEqual(expectedDate);
};

describe('when getting the matrix lease rent data', () => {
  describe('and the getClosestRangeFlag is true', () => {
    describe('when the leaseStartDate is before the date ranges', () => {
      it('should return the closest price range and date at the edge of the range', () => {
        const expectedLeaseRent = {
          rent: '2405.00',
          endDate: '2019-05-09',
        };

        executeLeaseRentTest({ leaseStartDate: '2019-05-01', expectedLeaseRent, expectedDate: '2019-05-02' });
      });
    });

    describe('when the leaseStartDate is after the last date range', () => {
      it('should return the closest price range and closest date', () => {
        const expectedLeaseRent = {
          rent: '2566.00',
          endDate: '2019-05-17',
        };

        executeLeaseRentTest({ leaseStartDate: '2019-05-18', expectedLeaseRent, expectedDate: '2019-05-17' });
      });
    });

    describe('when the leaseStartDate is between any date range', () => {
      it('should return the respective date range', () => {
        const expectedLeaseRent = {
          rent: '2405.00',
          endDate: '2019-05-09',
        };

        executeLeaseRentTest({ leaseStartDate: '2019-05-04', expectedLeaseRent });
      });
    });

    describe('when the leaseStartDate is on the first day of the range', () => {
      it('should return the respective date range', () => {
        const expectedLeaseRent = {
          rent: '2405.00',
          endDate: '2019-05-09',
        };

        executeLeaseRentTest({ leaseStartDate: '2019-05-02', expectedLeaseRent });
      });
    });

    describe('when the leaseStartDate is on the last day of the range', () => {
      it('should return the respective date range', () => {
        const expectedLeaseRent = {
          rent: '2566.00',
          endDate: '2019-05-17',
        };

        executeLeaseRentTest({ leaseStartDate: '2019-05-17', expectedLeaseRent });
      });
    });
  });

  describe('and the getClosestRangeFlag is false', () => {
    describe('when the leaseStartDate is before the date ranges', () => {
      it('should return an empty object', () => {
        executeLeaseRentTest({ leaseStartDate: '2019-05-01', getClosestRange: false });
      });
    });

    describe('when the leaseStartDate is after the last date range', () => {
      it('should return an empty object', () => {
        executeLeaseRentTest({ leaseStartDate: '2019-05-18', getClosestRange: false });
      });
    });

    describe('when the leaseStartDate is between any date range', () => {
      it('should return the respective date range', () => {
        const expectedLeaseRent = {
          rent: '2405.00',
          endDate: '2019-05-09',
        };

        executeLeaseRentTest({ leaseStartDate: '2019-05-04', expectedLeaseRent, getClosestRange: false });
      });
    });
  });
});

const executeGetFeeAmountsTest = ({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult }) => {
  const result = getFeeAmounts(fee, selectedLeaseTermIds, isSelfServe, leaseTerms);

  expect(result.amount).toEqual(expectedResult.amount);
  expectedResult.relativeAmountsByLeaseTerm &&
    result.relativeAmountsByLeaseTerm.map(ralt =>
      expect(ralt.amount).toEqual(expectedResult.relativeAmountsByLeaseTerm.find(x => x.leaseTermId === ralt.leaseTermId).amount),
    );
};

describe('when calling getFeeAmounts function', () => {
  const selectedLeaseTermIds = ['9b393c8e-93a8-4af9-ae46-d8a94dab21ef', '9b393c7e-93a8-4af9-ae46-d8a94dab21ef'];
  const leaseTerms = [
    {
      id: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef',
      adjustedMarketRent: 4000,
    },
    {
      id: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef',
      adjustedMarketRent: 4500,
    },
  ];

  describe('and the fee is variable', () => {
    const variableAdjustment = true;

    describe('and is a self-serve quote', () => {
      const isSelfServe = true;

      describe('and absolutePrice is defined', () => {
        const absolutePrice = 2405;

        describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              amount: absolutePrice,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe(', absoluteDefaultPrice and relativeDefaultPrice are defined, and absoluteDefaultPrice is lower than absolutePrice', () => {
          it('should return the absoluteDefaultPrice as the fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              absoluteDefaultPrice: 2000,
              relativeDefaultPrice: 10,
              quantity: 1,
            };

            const expectedResult = {
              amount: 2000,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined and lower than the absolutePrice', () => {
          it('should return the relativeDefaultPrice as the fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              relativeDefaultPrice: 10,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 400, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 450, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined and higher than the absolutePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              relativeDefaultPrice: 100,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: absolutePrice, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: absolutePrice, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and lower than the absolutePrice', () => {
          it('should return the absoluteDefaultPrice as the fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              absoluteDefaultPrice: 1500,
              quantity: 1,
            };

            const expectedResult = {
              amount: 1500,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and higher than the absolutePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              absoluteDefaultPrice: 3000,
              quantity: 1,
            };

            const expectedResult = {
              amount: absolutePrice,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });
      });

      describe('and relativePrice is defined', () => {
        const relativePrice = 50;

        describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined, and parentFeeAmount is defined', () => {
          it('should return the original fee amount', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              parentFeeAmount: 3000,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              amount: 1500,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined, and the parent fee is the base rent', () => {
          it('should return an array of amounts per lease term as zero', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 0, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 0, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined, the parent fee is the base rent and relativePrice is lower than relativeDefaultPrice', () => {
          it('should return an array of amounts per lease term using the relativePrice', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              relativeDefaultPrice: 60,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined, the parent fee is the base rent and relativePrice is higher than relativeDefaultPrice', () => {
          it('should return an array of amounts per lease term using the relativeDefaultPrice', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              relativeDefaultPrice: 10,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 400, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 450, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice and parentFeeAmount are defined and relativeDefaultPrice is lower than the relativePrice', () => {
          it('should return the relativeDefaultPrice as the fee amount', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              relativeDefaultPrice: 10,
              parentFeeAmount: 3000,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              amount: 300,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice and parentFeeAmount are defined and relativeDefaultPrice is higher than the relativePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              relativeDefaultPrice: 60,
              parentFeeAmount: 3000,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              amount: 1500,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and lower than the relativePrice, and parentFeeAmount is not defined', () => {
          it('should return an array of amounts equals to absoluteDefaultPrice', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              absoluteDefaultPrice: 1000,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 1000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 1000, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and higher than the relativePrice, and parentFeeAmount is not defined', () => {
          it('should return an array of amounts per lease term using the relativePrice', () => {
            const fee = {
              relativePrice,
              amount: 1500,
              absoluteDefaultPrice: 3000,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });
      });
    });

    describe('and is not a self-serve quote', () => {
      const isSelfServe = false;

      describe('and absolutePrice is defined', () => {
        const absolutePrice = 2405;

        describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined', () => {
          it('should return the original fee amount', () => {
            const fee = {
              absolutePrice,
              amount: absolutePrice,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              amount: absolutePrice,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe(', absoluteDefaultPrice and relativeDefaultPrice are defined', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              absoluteDefaultPrice: 2000,
              relativeDefaultPrice: 10,
              quantity: 1,
            };

            const expectedResult = {
              amount: absolutePrice,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined and lower than the absolutePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              relativeDefaultPrice: 10,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 400, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 450, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };
            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined and higher than the absolutePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              relativeDefaultPrice: 100,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: absolutePrice, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: absolutePrice, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and lower than the absolutePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              absoluteDefaultPrice: 1000,
              quantity: 1,
            };

            const expectedResult = {
              amount: absolutePrice,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and higher than the absolutePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: absolutePrice,
              absolutePrice,
              variableAdjustment,
              absoluteDefaultPrice: 4000,
              quantity: 1,
            };

            const expectedResult = {
              amount: absolutePrice,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });
      });

      describe('and relativePrice is defined', () => {
        const relativePrice = 50;

        describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined, and parentFeeAmount is defined', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              parentFeeAmount: 3000,
              quantity: 1,
            };

            const expectedResult = {
              amount: 1500,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined, and the parent fee is the base rent', () => {
          it('should return an array of amounts per lease term as zero', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 0, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 0, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined, the parent fee is the base rent and relativePrice is lower than relativeDefaultPrice', () => {
          it('should return an array of amounts per lease term using the relativePrice', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              relativeDefaultPrice: 60,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice is defined, the parent fee is the base rent and relativePrice is higher than relativeDefaultPrice', () => {
          it('should return an array of amounts per lease term using the relativeDefaultPrice', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              relativeDefaultPrice: 20,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 800, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 900, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice and parentFeeAmount are defined and relativeDefaultPrice is lower than the relativePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              relativeDefaultPrice: 20,
              parentFeeAmount: 3000,
              quantity: 1,
            };

            const expectedResult = {
              amount: 1500,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and relativeDefaultPrice and parentFeeAmount are defined and relativeDefaultPrice is higher than the relativePrice', () => {
          it('should return the original fee amount', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              relativeDefaultPrice: 70,
              parentFeeAmount: 3000,
              quantity: 1,
            };

            const expectedResult = {
              amount: 1500,
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and lower than the relativePrice, and parentFeeAmount is not defined', () => {
          it('should return an array of amounts per lease term using the relativePrice', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              absoluteDefaultPrice: 1000,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 1000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 1000, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });

        describe('and absoluteDefaultPrice is defined and higher than the relativePrice, and parentFeeAmount is not defined', () => {
          it('should return an array of amounts per lease term using the relativePrice', () => {
            const fee = {
              amount: 1500,
              relativePrice,
              variableAdjustment,
              absoluteDefaultPrice: 3000,
              quantity: 1,
            };

            const expectedResult = {
              relativeAmountsByLeaseTerm: [
                { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
                { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
              ],
            };

            executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
          });
        });
      });
    });
  });

  describe('and the fee is not variable', () => {
    const variableAdjustment = false;
    const isSelfServe = true;

    describe('and absolutePrice is defined', () => {
      const absolutePrice = 2405;

      describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined', () => {
        it('should return the original fee amount', () => {
          const fee = {
            absolutePrice,
            amount: absolutePrice,
            variableAdjustment,
            quantity: 1,
          };

          const expectedResult = {
            amount: absolutePrice,
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe(', absoluteDefaultPrice and relativeDefaultPrice are defined', () => {
        it('should return the original fee amount', () => {
          const fee = {
            absolutePrice,
            amount: absolutePrice,
            variableAdjustment,
            absoluteDefaultPrice: 1000,
            relativeDefaultPrice: 20,
            quantity: 1,
          };

          const expectedResult = {
            amount: absolutePrice,
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and relativeDefaultPrice is defined and lower than the absolutePrice', () => {
        it('should return the original fee amount', () => {
          const fee = {
            absolutePrice,
            amount: absolutePrice,
            variableAdjustment,
            relativeDefaultPrice: 10,
            quantity: 1,
          };

          const expectedResult = {
            relativeAmountsByLeaseTerm: [
              { amount: absolutePrice, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
              { amount: absolutePrice, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
            ],
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and relativeDefaultPrice is defined and higher than the absolutePrice', () => {
        it('should return the original fee amount', () => {
          const fee = {
            absolutePrice,
            amount: absolutePrice,
            variableAdjustment,
            relativeDefaultPrice: 100,
            quantity: 1,
          };

          const expectedResult = {
            relativeAmountsByLeaseTerm: [
              { amount: absolutePrice, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
              { amount: absolutePrice, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
            ],
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and absoluteDefaultPrice is defined and lower than the absolutePrice', () => {
        it('should return the original fee amount', () => {
          const fee = {
            absolutePrice,
            amount: absolutePrice,
            variableAdjustment,
            absoluteDefaultPrice: 1000,
            quantity: 1,
          };

          const expectedResult = {
            amount: absolutePrice,
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and absoluteDefaultPrice is defined and higher than the absolutePrice', () => {
        it('should return the original fee amount', () => {
          const fee = {
            absolutePrice,
            amount: absolutePrice,
            variableAdjustment,
            absoluteDefaultPrice: 3000,
            quantity: 1,
          };

          const expectedResult = {
            amount: absolutePrice,
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });
    });

    describe('and relativePrice is defined', () => {
      const relativePrice = 50;

      describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined, and parentFeeAmount is defined', () => {
        it('should return the original fee amount', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            parentFeeAmount: 3000,
            quantity: 1,
          };

          const expectedResult = {
            amount: 1500,
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe(', absoluteDefaultPrice and relativeDefaultPrice are not defined, and the parent fee is the base rent', () => {
        it('should return an array of amounts per lease term using the relativePrice', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            quantity: 1,
          };

          const expectedResult = {
            relativeAmountsByLeaseTerm: [
              { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
              { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
            ],
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and relativeDefaultPrice is defined, the parent fee is the base rent and relativePrice is lower than relativeDefaultPrice', () => {
        it('should return an array of amounts per lease term using the relativePrice', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            relativeDefaultPrice: 60,
            quantity: 1,
          };

          const expectedResult = {
            relativeAmountsByLeaseTerm: [
              { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
              { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
            ],
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and relativeDefaultPrice is defined, the parent fee is the base rent and relativePrice is higher than relativeDefaultPrice', () => {
        it('should return an array of amounts per lease term using the relativePrice', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            relativeDefaultPrice: 10,
            quantity: 1,
          };

          const expectedResult = {
            relativeAmountsByLeaseTerm: [
              { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
              { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
            ],
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and relativeDefaultPrice and parentFeeAmount are defined and relativeDefaultPrice is lower than the relativePrice', () => {
        it('should return the original fee amount', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            parentFeeAmount: 3000,
            relativeDefaultPrice: 10,
            quantity: 1,
          };

          const expectedResult = {
            amount: 1500,
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and relativeDefaultPrice and parentFeeAmount are defined and relativeDefaultPrice is higher than the relativePrice', () => {
        it('should return the original fee amount', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            parentFeeAmount: 3000,
            relativeDefaultPrice: 60,
            quantity: 1,
          };

          const expectedResult = {
            amount: 1500,
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and absoluteDefaultPrice is defined and lower than the relativePrice, and parentFeeAmount is not defined', () => {
        it('should return an array of amounts per lease term using the relativePrice', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            absoluteDefaultPrice: 1000,
            quantity: 1,
          };

          const expectedResult = {
            relativeAmountsByLeaseTerm: [
              { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
              { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
            ],
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });

      describe('and absoluteDefaultPrice is defined and higher than the relativePrice, and parentFeeAmount is not defined', () => {
        it('should return an array of amounts per lease term using the relativePrice', () => {
          const fee = {
            relativePrice,
            amount: 1500,
            variableAdjustment,
            absoluteDefaultPrice: 3500,
            quantity: 1,
          };

          const expectedResult = {
            relativeAmountsByLeaseTerm: [
              { amount: 2000, leaseTermId: '9b393c8e-93a8-4af9-ae46-d8a94dab21ef' },
              { amount: 2250, leaseTermId: '9b393c7e-93a8-4af9-ae46-d8a94dab21ef' },
            ],
          };

          executeGetFeeAmountsTest({ fee, selectedLeaseTermIds, isSelfServe, leaseTerms, expectedResult });
        });
      });
    });
  });
});
