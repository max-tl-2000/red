/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { DALTypes } from '../../../common/enums/DALTypes.js';

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('amenity import', () => {
  let validateHighValueConstraint;
  let validateSubCategoryConstraint;

  beforeEach(() => {
    mockModules({
      '../../dal/amenityRepo.js': {
        getHighValueAmenitiesPerProperty: sinon.stub().returns([
          { name: 'Access to Excellent Schools', category: 'property' },
          { name: 'Access to Restaurants', category: 'property' },
          { name: 'Access to Shopping', category: 'property' },
          { name: 'Access to Transit', category: 'property' },
          { name: 'Fitness Center', category: 'property' },
          { name: 'Pet Friendly', category: 'property' },
        ]),
      },
    });

    const amenity = require('../inventory/amenity'); // eslint-disable-line global-require

    validateSubCategoryConstraint = amenity.validateSubCategoryConstraint;
    validateHighValueConstraint = amenity.validateHighValueConstraint;
  });

  it('should return error when the max number of amenities with highValue has been reached', async () => {
    const amenity = {
      name: 'Fitness Center Test',
      category: DALTypes.AmenityCategory.PROPERTY,
      highValue: true,
      propertyId: 'e8e580af-6038-4f6b-91a1-faeac6bf1d71',
    };

    const result = await validateHighValueConstraint('tenantId', amenity, amenity.propertyId, undefined);
    expect(result.length).to.equal(1);
    expect(result[0].name).equal('highValueFlag');
    expect(result[0].message).equal('HIGH_VALUE_LIMIT_REACH_PER_CATEGORY_AND_PROPERTY');
  });

  it('should return error when subCategory associated to category different to property and building', async () => {
    const amenity = {
      category: DALTypes.AmenityCategory.INVENTORY,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
    };

    const resultTest1 = await validateSubCategoryConstraint(amenity);
    expect(resultTest1.length).to.equal(1);
    expect(resultTest1[0].name).equal('subCategory');
    expect(resultTest1[0].message).equal('INVALID_SUBCATEGORY_FOR_GIVEN_CATEGORY');
  });

  it('should return empty array when subCategory associated to category property or building', async () => {
    const amenity1 = {
      category: DALTypes.AmenityCategory.BUILDING,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
    };

    const amenity2 = {
      category: DALTypes.AmenityCategory.PROPERTY,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
    };

    const resultTest1 = await validateSubCategoryConstraint(amenity1);
    expect(resultTest1.length).to.equal(0);

    const resultTest2 = await validateSubCategoryConstraint(amenity2);
    expect(resultTest2.length).to.equal(0);
  });
});
