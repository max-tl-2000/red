/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import proxyquire from 'proxyquire';
import { LA_TIMEZONE } from '../../../common/date-constants';

xdescribe('Apply filters to concessions', () => {
  let getConcessionsByFilters;

  const concessions = [
    {
      displayName: '2 months free',
      startDate: '2016-08-01 00:00:00+00',
      matchingCriteria: `{ "minLeaseLength": 24,
        "maxLeaseLength": 24,
        "layouts": ["eb346ee6-aa4f-4b55-946a-5f35a4235200", "631aeb9d-b696-401d-883f-5208cce33b07"],
        "buildings": ["931aeb9d-b696-401d-883f-5208cce33b07"] }`,
    },
    {
      displayName: 'Rentable item Concession',
      matchingCriteria: `{
        "leaseNames": ["a912130a-4738-4898-a60f-d5bad5ea66af", "631aeb9d-b696-401d-883f-5208cce33b07"],
        "maxLeaseLength": 12 }`,
    },
    {
      displayName: 'Lease Incentive - Monthly Discount',
      matchingCriteria: `{ "leaseNames": ["a912130a-4738-4898-a60f-d5bad5ea66af", "21fde807-f1eb-40e0-a3e4-8c7bf3fb019c"],
        "minLeaseLength": 6,
        "maxLeaseLength": 10,
        "layouts": ["631aeb9d-b696-401d-883f-5208cce33b07"],
        "amenities": ["456aeb9d-b696-401d-883f-5208cce33b07"] }`,
    },
    {
      displayName: 'Lease Incentive - 2 month free',
      matchingCriteria: '{ "amenities": ["8j6aeb9d-b696-401d-883f-5208cce33b07"] }',
    },
    {
      displayName: 'Lease Incentive - 3 month free',
      matchingCriteria: `{ "minLeaseLength": 9,
        "maxLeaseLength": 10,
        "buildings": ["931aeb9d-b696-401d-883f-5208cce33b07"] }`,
      excludeFromRentFlag: true,
    },
    {
      displayName: 'Employee Rent Credit',
      matchingCriteria: `{ "leaseNames": ["a912130a-4738-4898-a60f-d5bad5ea66af"],
        "layouts": ["eb346ee6-aa4f-4b55-946a-5f35a4235200", "631aeb9d-b696-401d-883f-5208cce33b07"] }`,
    },
  ];

  const inventory = {
    layoutId: '631aeb9d-b696-401d-883f-5208cce33b07',
    buildingId: '931aeb9d-b696-401d-883f-5208cce33b07',
  };

  const inventoryAmenities = [
    {
      id: '456aeb9d-b696-401d-883f-5208cce33b07',
    },
    {
      id: '789aeb9d-b696-401d-883f-5208cce33b07',
    },
  ];

  const quote = {
    created_at: '2016-07-05 00:00:00+00',
    id: '789aeb9d-b696-401d-883f-5208cce33b07',
  };

  beforeEach(() => {
    getConcessionsByFilters = proxyquire('../concessions.js', {
      '../database/factory': {
        getOne: sinon.stub().returns(inventory),
      },
      '../dal/concessionRepo': {
        getConcessions: sinon.stub().returns(concessions),
      },
      '../dal/inventoryRepo': {
        getInventoryAmenities: sinon.stub().returns(inventoryAmenities),
      },
      '../dal/propertyRepo': {
        getPropertyTimezone: sinon.stub().returns(LA_TIMEZONE),
      },
    }).getConcessionsByFilters;
  });

  it('should return applicable concessions for 24 months length term', async () => {
    const leaseTerm = {
      leaseNameId: 'a912130a-4738-4898-a60f-d5bad5ea66af',
      termLength: 24,
    };
    const validResult = 'Employee Rent Credit';

    const results = await getConcessionsByFilters('tenantId', leaseTerm, '2372130a-4738-4898-a60f-d5bad5ea667jg', quote.created_at);
    expect(results.length).to.equal(1);
    expect(results[0].displayName).to.equal(validResult);
  });

  it('should return applicable concessions for 6 months length term', async () => {
    const leaseTerm = {
      leaseNameId: 'a912130a-4738-4898-a60f-d5bad5ea66af',
      termLength: 6,
    };
    const validResults = ['Rentable item Concession', 'Lease Incentive - Monthly Discount', 'Employee Rent Credit'];

    const results = await getConcessionsByFilters('tenantId', leaseTerm, '2372130a-4738-4898-a60f-d5bad5ea667jg', quote.created_at);
    expect(results.length).to.equal(3);
    expect(results[0].displayName).to.equal(validResults[0]);
    expect(results[1].displayName).to.equal(validResults[1]);
    expect(results[2].displayName).to.equal(validResults[2]);
  });

  it('should return applicable concessions for 9 months length term', async () => {
    const leaseTerm = {
      leaseNameId: 'a912130a-4738-4898-a60f-d5bad5ea66af',
      termLength: 9,
    };
    const validResults = ['Rentable item Concession', 'Lease Incentive - Monthly Discount', 'Lease Incentive - 3 month free', 'Employee Rent Credit'];

    const results = await getConcessionsByFilters('tenantId', leaseTerm, '2372130a-4738-4898-a60f-d5bad5ea667jg', quote.created_at);
    expect(results.length).to.equal(4);
    expect(results[0].displayName).to.equal(validResults[0]);
    expect(results[1].displayName).to.equal(validResults[1]);
    expect(results[2].displayName).to.equal(validResults[2]);
    expect(results[3].displayName).to.equal(validResults[3]);
    expect(results[2].excludeFromRentFlag).to.equal(true);
  });
});
