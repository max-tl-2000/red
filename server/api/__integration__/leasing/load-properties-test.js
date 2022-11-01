/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';

import app from '../../api';
import { createAmenity } from '../../../dal/amenityRepo';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { testCtx as ctx, createAProperty, createAnInventory } from '../../../testUtils/repoHelper';
import '../../../testUtils/setupTestGlobalContext';

import flatten from 'lodash/flatten';

describe('API/properties', () => {
  describe('given some existing properties, when loading all properties', () => {
    it('has the created properties with corresponding amenities', async () => {
      const category = DALTypes.AmenityCategory.PROPERTY;
      const subCategory = DALTypes.AmenitySubCategory.LIFESTYLE;

      const category2 = DALTypes.AmenityCategory.INVENTORY;
      const subCategory2 = DALTypes.AmenitySubCategory.PARKING;

      const invetoryUnit = DALTypes.InventoryType.UNIT;
      const unit1Name = '1010';
      const unit2Name = '1011';
      const unit3Name = '1012';
      const unit4Name = '1013';

      const lifestyle1Name = 'Access to Restaurants';
      const lifestyle1Icon = 'am-restaurant';
      const lifestyle2Name = 'Access to Excellent Schools';
      const lifestyle2Icon = 'am-school';

      const amenity1Name = 'MotoPark';
      const amenity2Name = 'EVStation';
      const amenity3Name = 'LakeVw';
      const amenity1DisplayName = 'Motorcycle Parking';
      const amenity2DisplayName = 'EV Charging Station';
      const amenity3DisplayName = 'Lake View';

      const property1 = await createAProperty();

      await createAnInventory({
        name: unit1Name,
        type: invetoryUnit,
        propertyId: property1.id,
        floor: 1,
      });
      await createAnInventory({
        name: unit2Name,
        type: invetoryUnit,
        propertyId: property1.id,
        floor: 2,
      });

      await createAmenity(ctx, {
        id: newId(),
        name: amenity1Name,
        category: category2,
        subCategory: subCategory2,
        displayName: amenity1DisplayName,
        highValue: false,
        hidden: true,
        propertyId: property1.id,
      });
      await createAmenity(ctx, {
        id: newId(),
        name: amenity2Name,
        category: category2,
        subCategory: subCategory2,
        displayName: amenity2DisplayName,
        highValue: true,
        hidden: false,
        propertyId: property1.id,
      });

      await createAmenity(ctx, {
        id: newId(),
        name: lifestyle1Name,
        category,
        subCategory,
        displayName: lifestyle1Name,
        highValue: false,
        hidden: false,
        targetUnit: false,
        description: `Lifestyle amenity for ${lifestyle1Name} `,
        infographicName: lifestyle1Icon,
        propertyId: property1.id,
      });
      await createAmenity(ctx, {
        id: newId(),
        name: lifestyle2Name,
        category,
        subCategory,
        displayName: lifestyle2Name,
        highValue: false,
        hidden: false,
        targetUnit: false,
        description: `Lifestyle amenity for ${lifestyle2Name} `,
        infographicName: lifestyle2Icon,
        propertyId: property1.id,
      });

      const property2 = await createAProperty();

      await createAnInventory({
        name: unit3Name,
        type: invetoryUnit,
        propertyId: property2.id,
        floor: 2,
      });
      await createAnInventory({
        name: unit4Name,
        type: invetoryUnit,
        propertyId: property2.id,
        floor: 3,
      });

      await createAmenity(ctx, {
        id: newId(),
        name: amenity2Name,
        category: category2,
        subCategory: subCategory2,
        displayName: amenity2DisplayName,
        highValue: false,
        hidden: false,
        propertyId: property2.id,
      });
      await createAmenity(ctx, {
        id: newId(),
        name: amenity3Name,
        category: category2,
        subCategory: subCategory2,
        displayName: amenity3DisplayName,
        highValue: true,
        hidden: false,
        propertyId: property2.id,
      });

      await createAmenity(ctx, {
        id: newId(),
        name: lifestyle2Name,
        category,
        subCategory,
        displayName: lifestyle2Name,
        highValue: false,
        hidden: false,
        targetUnit: false,
        description: `Lifestyle amenity for ${lifestyle2Name} `,
        infographicName: lifestyle2Icon,
        propertyId: property2.id,
      });

      await request(app)
        .get('/properties')
        .set(getAuthHeader())
        .expect(200)
        .expect(res => {
          expect(res.body.length === 2);
          expect(res.body.map(x => x.id)).to.include.members([property1.id, property2.id]);
          expect(flatten(res.body.map(x => x.lifestyleDisplayNames))).to.include.members([lifestyle1Name, lifestyle2Name]);
          expect(flatten(res.body.map(x => x.floors))).to.include.members([1, 2, 3]);
          expect(flatten(res.body.map(x => x.amenities.map(a => a.name)))).to.include.members([amenity2DisplayName, amenity3DisplayName]);
        });
    });
  });
});
