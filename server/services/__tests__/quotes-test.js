/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { selectQuoteData } from '../quotes';
import { replacePeriodInConcessions, filterSelectedConcessions } from '../concessions';
import { filterSelectedLeaseTerms } from '../leaseTerms';
import { calculatePartialAdjustedMarketRentWithNonVariableBakedFees } from '../../../common/helpers/quotes';
import { DALTypes } from '../../../common/enums/DALTypes';

const { mock } = require('test-helpers/mocker').default(jest);

describe('Replace period in concessions', () => {
  it('should replace %PERIOD% with the least term period', () => {
    const validLeaseTerm = {
      period: 'month',
    };

    const concessions = [
      {
        displayName: 'Special lease incentive - %PERIOD%',
      },
      {
        displayName: 'Special lease incentive - one time',
      },
    ];

    const validResult = replacePeriodInConcessions(validLeaseTerm.period, concessions);
    expect(validResult.length).to.equal(concessions.length);
    expect(validResult[0].displayName).to.equal(`Special lease incentive - ${validLeaseTerm.period}`);
    expect(validResult[1].displayName).to.equal('Special lease incentive - one time');
  });
});

describe('Filter Selected Lease Terms', () => {
  it('should filter just the selected lease terms', () => {
    const leaseTerms = [
      {
        id: '568551eb-a593-4f49-87ff-d35da1dd7560',
      },
      {
        id: 'c922f464-6e2e-49a2-b113-aba33087a822',
      },
      {
        id: 'a60c9322-937e-4872-b496-ce6cf6590658',
      },
      {
        id: 'c8a21351-e325-45a8-8662-831b27c308db',
      },
      {
        id: '72ad8c61-6c24-41d0-b747-72c587906570',
      },
      {
        id: '69c54e5f-2262-4248-bf92-0d76fb2fcd88',
      },
    ];

    const selectedLeaseTerms = [
      {
        id: 'c922f464-6e2e-49a2-b113-aba33087a822',
        paymentSchedule: [
          {
            amount: 1000,
            timeframe: 'Aug 2016',
          },
        ],
      },
      {
        id: 'c8a21351-e325-45a8-8662-831b27c308db',
        paymentSchedule: [
          {
            amount: 1000,
            timeframe: 'Aug 2016 - Jan 2017',
          },
        ],
      },
      {
        id: '69c54e5f-2262-4248-bf92-0d76fb2fcd88',
        paymentSchedule: [
          {
            amount: 1000,
            timeframe: 'Aug 2016 - Jul 2017',
          },
        ],
      },
    ];

    const validResult = filterSelectedLeaseTerms(leaseTerms, selectedLeaseTerms);
    expect(validResult).to.deep.equal(selectedLeaseTerms);
  });
});

describe('Filter Selected Concessions', () => {
  it('should filter just the selected concessions', () => {
    const leaseTerms = [
      {
        id: 'c922f464-6e2e-49a2-b113-aba33087a822',
        concessions: [
          {
            id: '9607431a-0b7a-4ccd-afa0-2a0276760b81',
          },
        ],
      },
      {
        id: 'c8a21351-e325-45a8-8662-831b27c308db',
        concessions: [
          {
            id: '5e569293-10e9-49f8-a115-da610836a959',
          },
          {
            id: 'ef2209e8-7ba0-4acd-85a2-8374b920188c',
          },
          {
            id: '016ccb66-f39a-485e-9116-e18011340663',
          },
          {
            id: '9607431a-0b7a-4ccd-afa0-2a0276760b81',
          },
        ],
      },
      {
        id: '69c54e5f-2262-4248-bf92-0d76fb2fcd88',
        concessions: [
          {
            id: '0b375aab-b9a8-4728-9056-be24df075c0a',
          },
        ],
      },
    ];

    const selectedLeaseTerms = [
      {
        id: 'c922f464-6e2e-49a2-b113-aba33087a822',
        concessions: [
          {
            id: '9607431a-0b7a-4ccd-afa0-2a0276760b81',
          },
        ],
      },
      {
        id: 'c8a21351-e325-45a8-8662-831b27c308db',
        concessions: [],
      },
      {
        id: '69c54e5f-2262-4248-bf92-0d76fb2fcd88',
        concessions: [],
      },
    ];

    filterSelectedConcessions(leaseTerms, selectedLeaseTerms);
    leaseTerms[0].concessions.length;
    expect(leaseTerms[0].concessions.length).to.equal(selectedLeaseTerms[0].concessions.length);
    expect(leaseTerms[1].concessions.length).to.equal(selectedLeaseTerms[1].concessions.length);
    expect(leaseTerms[2].concessions.length).to.equal(selectedLeaseTerms[2].concessions.length);
  });
});

describe('Select just data that we need from quotes and concessions', () => {
  it('select data from quotes and concessions', () => {
    const quote = {
      id: '687187f8-92d1-476d-8b11-be55bd2bf14e',
      inventoryId: 'fc801145-e150-416d-be46-1890bc3a5a59',
      partyId: '0011b70c-1320-4bd3-b2c6-22d39efd3196',
      publishDate: '2016-08-12T18:04:40.758Z',
      expirationDate: '2016-08-14T18:04:40.758Z',
      leaseStartDate: '2016-08-22T00:00:00.000Z',
      created_at: '2016-08-12T18:04:28.980Z',
      updated_at: '2016-08-12T18:04:28.980Z',
      leaseState: DALTypes.LeaseState.NEW,
      selections: {
        selectedLeaseTerms: [
          {
            id: 'a60c9322-937e-4872-b496-ce6cf6590658',
            concessions: [
              {
                id: '863bf8c3-d23c-451d-9c57-e00000a4e3a2',
              },
            ],
          },
          {
            id: '72ad8c61-6c24-41d0-b747-72c587906570',
            concessions: [
              {
                id: '863bf8c3-d23c-451d-9c57-e00000a4e3a2',
              },
            ],
          },
          {
            id: '3c8e9807-8990-4a6c-a4ac-daea3e764952',
            amount: '10.00',
            quantity: 1,
          },
        ],
      },
      confirmationNumber: 'ed057912-9a62-48a5-b180-4d5f6d1a65e7',
      leaseTerms: [
        {
          id: '568551eb-a593-4f49-87ff-d35da1dd7560',
          leaseNameId: '485d02df-a04b-4f81-9d69-07427c8b4e07',
          concessions: [
            {
              id: '863bf8c3-d23c-451d-9c57-e00000a4e3a2',
              displayName: 'Lease Incentive - Monthly Discount',
              variableAdjustment: false,
              relativeAdjustment: '-1.00',
              absoluteAdjustment: '0.00',
              recurring: true,
              recurringCount: 0,
              nonRecurringAppliedAt: '',
              optional: true,
              hideInSelfService: false,
              startDate: null,
              endDate: null,
              computedValue: 12341,
              amountVariableAdjustment: 0,
              relativeAmount: 12,
            },
          ],
        },
      ],
    };

    const allKeysFromQuote = [
      'leaseTerms',
      'created_at',
      'updated_at',
      'publishDate',
      'inventoryId',
      'expirationDate',
      'leaseStartDate',
      'confirmationNumber',
      'id',
      'partyId',
      'leaseState',
    ];
    const validResult = selectQuoteData(quote);
    expect(validResult).to.have.all.keys(allKeysFromQuote);
  });
});

describe('Add BakedIntoAppliedFee concessions to adjustedMarketRent', () => {
  const getMockConcessionData = (delta = {}) => {
    const base = {
      id: newId(),
      displayName: 'Upshift in market rent',
      variableAdjustment: true,
      bakedIntoAppliedFeeFlag: true,
      relativeAdjustment: '0.00',
      absoluteAdjustment: '10.00',
    };

    return { ...base, ...delta };
  };
  const marketRent = 3000;
  const variableAdjustment = false;
  const absoluteAdjustment = '0.00';
  const ctx = { tenantId: newId() };
  let getUpdatedLeaseTermsWithMarketRent;
  let leaseTermToUpdate;
  const defaultMocks = leaseTerm => {
    const rentWithAdjustments = calculatePartialAdjustedMarketRentWithNonVariableBakedFees(leaseTerm, marketRent);
    return {
      rmsPricing: { standardRent: rentWithAdjustments },
    };
  };

  const setupMocks = mocks => {
    jest.resetModules();
    mock('../../database/factory.js', () => ({
      getOneWhere: sinon.stub().returns(mocks.rmsPricing),
    }));

    const leaseTerms = require('../leaseTerms'); // eslint-disable-line global-require
    getUpdatedLeaseTermsWithMarketRent = leaseTerms.getUpdatedLeaseTermsWithMarketRent;
  };

  beforeEach(async () => {
    leaseTermToUpdate = {
      id: newId,
      relativeAdjustment: '10.00',
      absoluteAdjustment: '0.00',
      period: 'month',
    };

    const mocks = defaultMocks(leaseTermToUpdate);

    jest.resetModules();
    mock('../../database/factory.js', () => ({
      getOneWhere: sinon.stub().returns(mocks.rmsPricing),
    }));

    const leaseTerms = require('../leaseTerms'); // eslint-disable-line global-require

    getUpdatedLeaseTermsWithMarketRent = leaseTerms.getUpdatedLeaseTermsWithMarketRent;
  });

  describe('Having multiple Non variable BakedIntoAppliedFee with relative adjustment concessions', () => {
    it('should sums all the concessions value to the adjustedMarketRent', async () => {
      leaseTermToUpdate.concessions = [
        getMockConcessionData({
          variableAdjustment,
          relativeAdjustment: '-2.00',
          absoluteAdjustment,
        }),
        getMockConcessionData({
          variableAdjustment,
          relativeAdjustment: '-1.00',
          absoluteAdjustment,
        }),
      ];
      const mocks = defaultMocks(leaseTermToUpdate);
      setupMocks(mocks);

      const expectedResult = [
        {
          ...leaseTermToUpdate,
          adjustedMarketRent: 3202,
          overwrittenBaseRent: 0,
          originalBaseRent: 3202,
          allowBaseRentAdjustment: false,
          minBakedFeesAdjustment: '',
          maxBakedFeesAdjustment: '',
        },
      ];

      const result = await getUpdatedLeaseTermsWithMarketRent(ctx, newId(), [leaseTermToUpdate], []);
      expect(result).to.eql(expectedResult);
    });
  });

  describe('Having multiple Non variable BakedIntoAppliedFee with absolute adjustment concessions', () => {
    it('should sums all the concessions value to the adjustedMarketRent', async () => {
      leaseTermToUpdate.concessions = [
        getMockConcessionData({ variableAdjustment }),
        getMockConcessionData({
          variableAdjustment,
          absoluteAdjustment: '5.00',
        }),
      ];

      const mocks = defaultMocks(leaseTermToUpdate);
      setupMocks(mocks);

      const expectedResult = [
        {
          ...leaseTermToUpdate,
          adjustedMarketRent: 3315,
          overwrittenBaseRent: 0,
          originalBaseRent: 3315,
          allowBaseRentAdjustment: false,
          minBakedFeesAdjustment: '',
          maxBakedFeesAdjustment: '',
        },
      ];

      const result = await getUpdatedLeaseTermsWithMarketRent(ctx, newId(), [leaseTermToUpdate], []);
      expect(result).to.eql(expectedResult);
    });
  });

  describe('Having multiple variable BakedIntoAppliedFee with  positive relative adjustment concessions', () => {
    it('should add up the concession with the hightest value to the adjustedMarketRent and return it as the max limit for the rent', async () => {
      leaseTermToUpdate.concessions = [
        getMockConcessionData({
          relativeAdjustment: '3.00',
          absoluteAdjustment,
        }),
        getMockConcessionData({
          relativeAdjustment: '2.5',
          absoluteAdjustment,
        }),
      ];

      const expectedResult = [
        {
          ...leaseTermToUpdate,
          adjustedMarketRent: 3300,
          overwrittenBaseRent: 0,
          originalBaseRent: 3300,
          allowBaseRentAdjustment: true,
          minBakedFeesAdjustment: '',
          maxBakedFeesAdjustment: 3399,
        },
      ];

      const result = await getUpdatedLeaseTermsWithMarketRent(ctx, newId(), [leaseTermToUpdate], []);
      expect(result).to.eql(expectedResult);
    });
  });

  describe('Having multiple variable BakedIntoAppliedFee with  negative absolut adjustment concessions', () => {
    it('should substract the concession with to the hightest value to the adjustedMarketRent and return it as the min limit for the rent', async () => {
      leaseTermToUpdate.concessions = [getMockConcessionData({ absoluteAdjustment: '-10.00' }), getMockConcessionData({ absoluteAdjustment: '-5.00' })];

      const expectedResult = [
        {
          ...leaseTermToUpdate,
          adjustedMarketRent: 3300,
          overwrittenBaseRent: 0,
          originalBaseRent: 3300,
          allowBaseRentAdjustment: true,
          minBakedFeesAdjustment: 3290,
          maxBakedFeesAdjustment: '',
        },
      ];

      const result = await getUpdatedLeaseTermsWithMarketRent(ctx, newId(), [leaseTermToUpdate], []);
      expect(result).to.eql(expectedResult);
    });
  });

  describe('Having multiple variable BakedIntoAppliedFee with  negative relative adjustment and positive relative adjustment concessions', () => {
    it(`should add up the concession with the hightest value to the adjustedMarketRent and substract the concession with to the hightest value to the adjustedMarketRent
      and return the results as max and min limits for the rent`, async () => {
      leaseTermToUpdate.concessions = [
        getMockConcessionData(),
        getMockConcessionData({ absoluteAdjustment: '5.00' }),
        getMockConcessionData({
          relativeAdjustment: '-3.00',
          absoluteAdjustment,
        }),
        getMockConcessionData({
          relativeAdjustment: '-2.00',
          absoluteAdjustment,
        }),
      ];

      const expectedResult = [
        {
          ...leaseTermToUpdate,
          adjustedMarketRent: 3300,
          overwrittenBaseRent: 0,
          originalBaseRent: 3300,
          allowBaseRentAdjustment: true,
          minBakedFeesAdjustment: 3201,
          maxBakedFeesAdjustment: 3310,
        },
      ];

      const result = await getUpdatedLeaseTermsWithMarketRent(ctx, newId(), [leaseTermToUpdate], []);
      expect(result).to.eql(expectedResult);
    });
  });

  describe('Having multiple non variable BakedIntoAppliedFee with  positive absolut adjustment concessions and a variable BakedIntoAppliedFee with negative absolute adjustment concession', () => {
    it(`should add up the non variable concession to the adjustedMarketRent. And substract the variable concession to the that resulting adjustedMarketRent and return it as
      the min limit for the rent`, async () => {
      leaseTermToUpdate.concessions = [
        getMockConcessionData({ variableAdjustment }),
        getMockConcessionData({
          variableAdjustment,
          absoluteAdjustment: '5.00',
        }),
        getMockConcessionData({ absoluteAdjustment: '-10.00' }),
        getMockConcessionData({ absoluteAdjustment: '-20.00' }),
      ];

      const mocks = defaultMocks(leaseTermToUpdate);
      setupMocks(mocks);

      const expectedResult = [
        {
          ...leaseTermToUpdate,
          adjustedMarketRent: 3315,
          overwrittenBaseRent: 0,
          originalBaseRent: 3315,
          allowBaseRentAdjustment: true,
          minBakedFeesAdjustment: 3295,
          maxBakedFeesAdjustment: '',
        },
      ];

      const result = await getUpdatedLeaseTermsWithMarketRent(ctx, newId(), [leaseTermToUpdate], []);
      expect(result).to.eql(expectedResult);
    });
  });

  describe('leaseTerm without concessions', () => {
    it('should return with data unchanged', async () => {
      const expectedResult = [
        {
          ...leaseTermToUpdate,
          adjustedMarketRent: 3300,
          overwrittenBaseRent: 0,
          originalBaseRent: 3300,
          allowBaseRentAdjustment: false,
          minBakedFeesAdjustment: '',
          maxBakedFeesAdjustment: '',
        },
      ];

      const result = await getUpdatedLeaseTermsWithMarketRent(ctx, newId(), [leaseTermToUpdate], []);
      expect(result).to.eql(expectedResult);
    });
  });
});
