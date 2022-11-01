/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { DALTypes } from '../../../common/enums/DALTypes';
import { testCtx as ctx, createAnAmenity, createAProperty } from '../../testUtils/repoHelper';
import {
  getAmenities,
  getAmenitiesByPropertyId,
  getAmenitiesByPropertyAndCategory,
  getHighValueAmenitiesPerProperty,
  getAmenitiesByCategory,
  getLifestylesByPropertyId,
} from '../amenityRepo';
import '../../testUtils/setupTestGlobalContext';

describe('dal/amenityRepo', () => {
  let property;
  let lifestyle1;
  let lifestyle2;

  beforeEach(async () => {
    property = await createAProperty({});

    await createAnAmenity({
      id: getUUID(),
      name: 'ADAAccessible',
      displayName: 'ADA Accessible',
      category: DALTypes.AmenityCategory.INVENTORY,
      propertyId: property.id,
      highValueFlag: true,
    });

    await createAnAmenity({
      id: getUUID(),
      name: 'WineLocker',
      displayName: 'Wine Locker',
      category: DALTypes.AmenityCategory.PROPERTY,
      propertyId: property.id,
      highValueFlag: true,
    });

    lifestyle1 = await createAnAmenity({
      id: getUUID(),
      name: 'Rentcontrolled',
      displayName: 'Rent controlled',
      category: DALTypes.AmenityCategory.PROPERTY,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      propertyId: property.id,
      highValueFlag: true,
    });

    lifestyle2 = await createAnAmenity({
      id: getUUID(),
      name: 'Studentfriendly',
      displayName: 'Student friendly',
      category: DALTypes.AmenityCategory.PROPERTY,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      propertyId: property.id,
      highValueFlag: true,
    });
  });

  describe('getAmenities', () => {
    it('should get all the amenities that are not lifestyle subCategory', async () => {
      const result = await getAmenities(ctx);
      expect(result.length).to.equal(2);
    });
  });

  describe('getAmenitiesByPropertyId', () => {
    it('should get the amenities by propertyId that are not lifestyle subCategory', async () => {
      const result = await getAmenitiesByPropertyId(ctx, property.id);
      expect(result.length).to.equal(2);
    });
  });

  describe('getAmenitiesByPropertyAndCategory', () => {
    it('should get the amenities by property and category that are not lifestyle subCategory', async () => {
      const result = await getAmenitiesByPropertyAndCategory(ctx, property.name, DALTypes.AmenityCategory.PROPERTY);
      expect(result.length).to.equal(1);
    });
  });

  describe('getAmenitiesByCategory', () => {
    it('should get the distinct amenities that have the category and subCategory specified', async () => {
      const secondProperty = await createAProperty({});
      await createAnAmenity({
        id: getUUID(),
        name: 'Studentfriendly',
        displayName: 'Student friendly',
        category: DALTypes.AmenityCategory.PROPERTY,
        subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
        propertyId: secondProperty.id,
      });
      const result = await getAmenitiesByCategory(ctx, DALTypes.AmenityCategory.PROPERTY, DALTypes.AmenitySubCategory.LIFESTYLE);
      expect(result.length).to.equal(2);
    });
  });

  describe('getHighValueAmenitiesPerProperty', () => {
    it('should get the amenities that are highValue, that have the specified category and that are not lifestyle subCategory', async () => {
      const result = await getHighValueAmenitiesPerProperty(ctx, property.id, DALTypes.AmenityCategory.PROPERTY, true, 'undefined');
      expect(result.length).to.equal(1);
      expect(result[0].highValue).to.equal(true);
      expect(result[0].propertyId).to.equal(property.id);
    });
  });

  describe('getLifestylesByPropertyId', () => {
    it('should get the lifestyles from amenities table', async () => {
      const result = await getLifestylesByPropertyId(ctx, property.id);
      expect(result.length).to.equal(2);
      expect(result[0].name).to.equal(lifestyle1.name);
      expect(result[1].name).to.equal(lifestyle2.name);
    });
  });
});
