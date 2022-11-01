/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
const { mock } = require('../../../common/test-helpers/mocker').default(jest);

describe('amenities service', () => {
  let amenities;

  beforeEach(() => {
    mock('../../dal/amenityRepo', () => ({
      getAmenitiesByPropertyAndCategory: sinon.stub().returns([{ name: 'ADA Accessible' }, { name: 'Private community' }]),
    }));

    mock('../../helpers/importUtils', () => ({
      validateIfElementsExist: sinon.stub().returns({
        error: [],
        elements: ['e8e580af-6038-4f6b-91a1-faeac6bf1d71', 'cbe580af-6038-4f6b-91a1-faeac6bf1d71'],
      }),
    }));

    amenities = require('../amenities.js'); // eslint-disable-line global-require
  });

  it('should return valid amenities associated', async () => {
    const entityObj = {
      amenities: ['ADA Accessible', 'Private community'],
      property: { id: '1dd7f65b-520e-40d9-bb78-ecc207d74b85' },
    };

    const result = await amenities.validateAmenities('tenantId', entityObj, 'inventory');
    expect(result.error).to.be.empty;
    expect(result.elements.length).to.equal(2);
  });
});
