/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createFinChargesMapper } from '../yardi/mappers/finCharges';

const createTestData = ({ leaseStartDate, postMonth }) => {
  const property = {
    name: 'property1',
    postMonth,
    externalId: 'property1',
  };
  return {
    inventory: {
      property,
      externalId: 'unit',
    },
    property,
    externalInfo: {
      externalId: 1,
    },
    finCharges: [
      {
        date: leaseStartDate,
        isAppFee: true,
        amount: 10,
      },
    ],
  };
};

describe('when lease start date is later than post month', () => {
  it('mapper should return lease start month as postMonth', () => {
    const leaseStartDate = '1/1/2018';
    const postMonth = '12/1/2017';
    const data = createTestData({ leaseStartDate, postMonth });
    const [result] = createFinChargesMapper(data);
    expect(result.POSTMONTH).to.deep.equal(leaseStartDate);
  });
});

describe('when lease start date is earlier than post month', () => {
  it('mapper should return use property postMonth as postMonth', () => {
    const leaseStartDate = '11/29/2017';
    const postMonth = '12/1/2017';
    const data = createTestData({ leaseStartDate, postMonth });
    const [result] = createFinChargesMapper(data);
    expect(result.POSTMONTH).to.deep.equal(postMonth);
  });
});
