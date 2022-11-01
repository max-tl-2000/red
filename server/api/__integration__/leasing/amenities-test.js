/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';
import { insertInto } from '../../../database/factory';

import app from '../../api';
import { createAmenity } from '../../../dal/amenityRepo';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { testCtx as ctx, createAnInventory, createABuilding, addAmenityToInventory, createAProperty, createAnAmenity } from '../../../testUtils/repoHelper';
import '../../../testUtils/setupTestGlobalContext';

describe('Amenities', () => {
  context('GET api/amenities/ with propertyId specified in query', () => {
    describe('given some created amenities related to a given propertyId when loading amenities', () => {
      it('has the created amenities', async () => {
        const property = await createAProperty();

        const amenity1 = await createAmenity(ctx, {
          id: newId(),
          name: 'AmenityTest1',
          category: DALTypes.AmenityCategory.INVENTORY,
          subCategory: DALTypes.AmenitySubCategory.ACCESSIBILITY,
          displayName: 'AmenityDisplayTest1',
          highValue: false,
          hidden: true,
          targetUnit: true,
          description: 'Amenity for tests',
          propertyId: property.id,
        });

        const amenity2 = await createAmenity(ctx, {
          id: newId(),
          name: 'AmenityTest2',
          category: DALTypes.AmenityCategory.INVENTORY,
          subCategory: DALTypes.AmenitySubCategory.ACCESSIBILITY,
          displayName: 'AmenityDisplayTest2',
          highValue: false,
          hidden: true,
          targetUnit: true,
          description: 'Amenity for tests',
          propertyId: property.id,
        });

        await request(app)
          .get(`/amenities/?propertyId=${property.id}`)
          .set(getAuthHeader())
          .expect(200)
          .expect(res => {
            expect(res.body.map(x => x.id)).to.include.members([amenity1.id, amenity2.id]);
          });
      });
    });
  });

  // api/inventories/:inventoryId/amenities
  context('GET api/inventories/:inventoryId/amenities', () => {
    let property;
    let building;
    let buildingAmenity;

    function _request(inventory) {
      return request(app).get(`/inventories/${inventory.id}/amenities`).set(getAuthHeader());
    }

    beforeEach(async () => {
      property = await createAProperty();

      building = await createABuilding({ propertyId: property.id });
      buildingAmenity = await createAnAmenity({
        category: DALTypes.AmenityCategory.BUILDING,
      });
      await insertInto(ctx.tenantId, 'Building_Amenity', {
        buildingId: building.id,
        amenityId: buildingAmenity.id,
      });
    });

    it('should return 200 if the given inventory exists', async () => {
      const inventory = await createAnInventory({
        buildingId: building.id,
        propertyId: property.id,
      });

      const amenity = await createAnAmenity({
        name: 'AmenityTest2',
        category: DALTypes.AmenityCategory.INVENTORY,
        subCategory: DALTypes.AmenitySubCategory.ACCESSIBILITY,
        displayName: 'AmenityTest2',
        highValue: false,
        hidden: true,
        targetUnit: true,
      });

      await addAmenityToInventory(ctx, inventory.id, amenity.id);

      await _request({ ...inventory, building })
        .expect(200)
        .expect(res => {
          expect(res.body.length).to.equal(2);

          expect(res.body.map(x => x.id)).to.have.members([amenity.id, buildingAmenity.id]);
        });
    });

    context('Inventory w/o building nor layout', () => {
      it('should not fail if the inventory does not have a building', async () => {
        const inventory = await createAnInventory({ buildingId: null });
        const amenity = await createAnAmenity({
          type: DALTypes.AmenityCategory.INVENTORY,
        });

        await addAmenityToInventory(ctx, inventory.id, amenity.id);

        await _request(inventory)
          .expect(200)
          .expect(res => {
            expect(res.body.length).to.equal(1);
            expect(res.body[0].id).to.equal(amenity.id);
          });
      });

      it('should not fail if the inventory does not have a layout', async () => {
        const inventory = await createAnInventory({ layoutId: null });
        const amenity = await createAnAmenity({
          category: DALTypes.AmenityCategory.INVENTORY,
          subCategory: DALTypes.AmenitySubCategory.ACCESSIBILITY,
        });
        await addAmenityToInventory(ctx, inventory.id, amenity.id);

        await _request(inventory)
          .expect(200)
          .expect(res => {
            expect(res.body.length).to.equal(1);
            expect(res.body[0].id).to.equal(amenity.id);
          });
      });
    });

    it('should return 404 if the given inventory does not exist', async () => {
      await _request({ id: newId() }).expect(404);
    });
  });

  context('GET api/amenities/ with category and subCategory specified in query', () => {
    describe('when retrieving amenities related to a given category & subCategory', () => {
      it('has all distinct amenities for that subCategory', async () => {
        const category = DALTypes.AmenityCategory.PROPERTY;
        const subCategory = DALTypes.AmenitySubCategory.LIFESTYLE;

        const lifeStyle1Name = 'Access to Restaurants';
        const lifeStyle1Icon = 'am-restaurant';
        const lifeStyle2Name = 'Access to Excellent Schools';
        const lifeStyle2Icon = 'am-school';

        const property1 = await createAProperty();

        await createAmenity(ctx, {
          id: newId(),
          name: lifeStyle1Name,
          category,
          subCategory,
          displayName: lifeStyle1Name,
          highValue: false,
          infographicName: lifeStyle1Icon,
          propertyId: property1.id,
        });
        await createAmenity(ctx, {
          id: newId(),
          name: lifeStyle2Name,
          category,
          subCategory,
          displayName: lifeStyle2Name,
          highValue: false,
          infographicName: lifeStyle2Icon,
          propertyId: property1.id,
        });

        const property2 = await createAProperty();

        await createAmenity(ctx, {
          id: newId(),
          name: lifeStyle2Name,
          category,
          subCategory,
          displayName: lifeStyle2Name,
          highValue: false,
          infographicName: lifeStyle2Icon,
          propertyId: property2.id,
        });

        await request(app)
          .get(`/amenities/?category=${category}&subCategory=${subCategory}`)
          .set(getAuthHeader())
          .expect(200)
          .expect(res => {
            expect(res.body.length).to.equal(2);
            expect(res.body.map(x => x.displayName)).to.include.members([lifeStyle1Name, lifeStyle2Name]);
          });
      });
    });
  });
});
