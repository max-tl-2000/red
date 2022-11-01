/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { mapSeries } from 'bluebird';
import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import {
  createAProperty,
  createAnInventory,
  createAnAsset,
  refreshUnitSearch,
  createALayout,
  createAMarketingLayoutGroup,
  createAMarketingLayout,
  createAParty,
  createAnInventoryOnHold,
  createAUser,
  saveUnitsRevaPricing,
} from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { generateTokenForDomain } from '../../../services/tenantService';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { updateProperty } from '../../../dal/propertyRepo';
import { now } from '../../../../common/helpers/moment-utils';

describe('API/marketing/properties/{propertyName}/layoutGroup/{marketingLayoutGroupName}/layouts?limit=4', () => {
  describe('GET', () => {
    const marketingLayoutGroupKeys = [
      'marketingLayoutId',
      'name',
      'displayName',
      'description',
      'numBedrooms',
      'numBathrooms',
      'propertyId',
      'imageUrl',
      'surfaceArea',
      'inventory',
    ];

    const createHeader = async () => {
      const token = await generateTokenForDomain({
        tenantId: tenant.id,
        domain: 'www.woodchaseforexample.com',
        expiresIn: '1m',
        allowedEndpoints: ['marketing/properties/'],
      });
      return {
        Authorization: `Bearer ${token}`,
        referer: 'http://www.woodchaseforexample.com',
      };
    };

    let property;
    let marketingLayoutGroup;
    let firstMarketingLayout;
    let secondMarketingLayout;
    let firstLayout;
    let secondLayout;
    let thirdLayout;
    let firstInventory;
    let secondInventory;

    beforeEach(async () => {
      const propertySettings = { integration: { import: { unitPricing: false } } };
      const propertyData = { name: 'cove' };
      property = await createAProperty(propertySettings, propertyData);
      marketingLayoutGroup = await createAMarketingLayoutGroup();

      firstMarketingLayout = await createAMarketingLayout({
        name: 'firstMarketingLayout',
        propertyId: property.id,
        marketingLayoutGroupId: marketingLayoutGroup.id,
        numBedrooms: 2,
        numBathrooms: 1,
        order: 1,
      });
      firstLayout = await createALayout({
        name: 'Abbot',
        displayName: 'Abbot',
        propertyId: property.id,
        marketingLayoutId: firstMarketingLayout.id,
        surfaceArea: 300,
        numBedrooms: 1,
        numBathrooms: 1,
      });
      secondLayout = await createALayout({
        name: 'Ballantine',
        displayName: 'Ballantine',
        propertyId: property.id,
        marketingLayoutId: firstMarketingLayout.id,
        surfaceArea: 1000,
        numBedrooms: 1,
        numBathrooms: 1.5,
      });
      firstInventory = await createAnInventory({
        name: 'firstInventoryForFirstML',
        description: 'test-description',
        propertyId: property.id,
        layoutId: firstLayout.id,
        availabilityDate: '2019-02-11 10:00:00',
      });
      secondInventory = await createAnInventory({
        name: 'secondInventoryForFirstML',
        description: 'test-description',
        propertyId: property.id,
        layoutId: secondLayout.id,
        availabilityDate: '2019-02-12 10:00:00',
      });
      await saveUnitsRevaPricing([firstInventory, secondInventory]);
      await createAnAsset({
        type: DALTypes.AssetType.MARKETING_LAYOUT,
        propertyName: 'cove',
        name: firstMarketingLayout.name,
        rank: 1,
      });

      secondMarketingLayout = await createAMarketingLayout({
        name: 'secondMarketingLayout',
        propertyId: property.id,
        marketingLayoutGroupId: marketingLayoutGroup.id,
        order: 2,
      });
      thirdLayout = await createALayout({
        name: 'Abbot1',
        displayName: 'Abbot1',
        propertyId: property.id,
        marketingLayoutId: secondMarketingLayout.id,
      });
      await createAnInventory({
        name: 'firstInventoryForSecondML',
        description: 'test-description',
        propertyId: property.id,
        layoutId: thirdLayout.id,
      });
      await createAnAsset({
        type: DALTypes.AssetType.MARKETING_LAYOUT,
        propertyName: 'cove',
        name: secondMarketingLayout.name,
        rank: 1,
      });

      await refreshUnitSearch();
    });

    it('should be a protected route', async () => {
      const res = await request(app).get('/v1/marketing/session');

      expect(res.status).to.equal(401);
    });

    describe('when the property with the given propertyId does not exist', () => {
      it('should respond with 404 PROPERTY_NOT_FOUND', async () => {
        const header = await createHeader();

        const { status, body } = await request(app)
          .get(`/v1/marketing/properties/${newId()}/layoutGroup/INEXISTENT_MARKETING_GROUP/layouts?limit=4`)
          .set(header);

        expect(status).to.equal(404);
        expect(body.token).to.equal('PROPERTY_NOT_FOUND');
      });
    });

    describe('when the group with given marketingLayoutGroupId does not exist', () => {
      it('should respond with 404 MARKETING_LAYOUT_GROUP_NOT_FOUND', async () => {
        const header = await createHeader();
        const { id: propertyId } = await createAProperty();
        const marketingLayoutGroupId = newId();

        const { status, body } = await request(app)
          .get(`/v1/marketing/properties/${propertyId}/layoutGroup/${marketingLayoutGroupId}/layouts?limit=4`)
          .set(header);

        expect(status).to.equal(404);
        expect(body.token).to.equal('MARKETING_LAYOUT_GROUP_NOT_FOUND');
      });
    });
    describe('when the propertyId is invalid', () => {
      it('should respond with 400 INCORRECT_PROPERTY_ID', async () => {
        const header = await createHeader();
        const marketingLayoutGroupId = newId();

        const { status, body } = await request(app).get(`/v1/marketing/properties/12345/layoutGroup/${marketingLayoutGroupId}/layouts?limit=4`).set(header);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INCORRECT_PROPERTY_ID');
      });
    });
    describe('when the marketingLayoutId is invalid', () => {
      it('should respond with 400 INCORRECT_MARKETING_LAYOUT_GROUP_ID', async () => {
        const header = await createHeader();
        const { id: propertyId } = await createAProperty();

        const { status, body } = await request(app).get(`/v1/marketing/properties/${propertyId}/layoutGroup/12345/layouts?limit=4`).set(header);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INCORRECT_MARKETING_LAYOUT_GROUP_ID');
      });
    });
    describe('when a valid request is made', () => {
      it('should respond with 200 status and the relevant marketing layout group information', async () => {
        const header = await createHeader();
        const { status, body } = await request(app)
          .get(`/v1/marketing/properties/${property.id}/layoutGroup/${marketingLayoutGroup.id}/layouts?limit=4`)
          .set(header);

        const layouts = [firstLayout, secondLayout];
        const layoutsBathrooms = [...new Set(layouts.map(l => Number(l.numBathrooms)))];
        const layoutsBedrooms = [...new Set(layouts.map(l => Number(l.numBedrooms)))];

        expect(status).to.equal(200);
        expect(body.length).to.equal(2);
        expect(body[0].marketingLayoutId).to.equal(firstMarketingLayout.id);
        expect(body[0]).to.have.all.keys(marketingLayoutGroupKeys);
        expect(body[0].name).to.equal(firstMarketingLayout.name);
        expect(body[0].displayName).to.equal(firstMarketingLayout.displayName);
        expect(body[0].description).to.equal(firstMarketingLayout.description);
        expect(body[0].numBathrooms).to.eql(layoutsBathrooms);
        expect(body[0].numBedrooms).to.eql(layoutsBedrooms);
        expect(body[0].surfaceArea.min).to.equal('300.00');
        expect(body[0].surfaceArea.max).to.equal('1000.00');
        expect(body[0].inventory.length).to.equal(2);
      });
      it('should filter inventories on hold out and order the list by availability date', async () => {
        const header = await createHeader();
        const { id: partyId } = await createAParty();
        const { id: userId } = await createAUser();
        const { id: inventoryId } = await createAnInventory({
          name: 'thirdInventoryForFirstML',
          propertyId: property.id,
          layoutId: secondLayout.id,
        });
        await refreshUnitSearch();
        await createAnInventoryOnHold(inventoryId, partyId, userId);

        const { status, body } = await request(app)
          .get(`/v1/marketing/properties/${property.id}/layoutGroup/${marketingLayoutGroup.id}/layouts?limit=4`)
          .set(header);

        expect(status).to.equal(200);
        expect(body.length).to.equal(2);
        expect(body[0].inventory.length).to.equal(2);
        expect(body[0].inventory[0].inventoryId).to.equal(firstInventory.id);
      });
      it('should restrict the number of inventories per layout by limit from query', async () => {
        const header = await createHeader();
        const { status, body } = await request(app)
          .get(`/v1/marketing/properties/${property.id}/layoutGroup/${marketingLayoutGroup.id}/layouts?limit=1`)
          .set(header);

        expect(status).to.equal(200);
        expect(body[0].inventory.length).to.equal(1);
      });

      describe('and exists limits per marketingLayout (maxUnitsInLayout: 8, maxVacantReadyUnits: 4)', () => {
        let layoutGroupId;
        let layoutId;
        beforeEach(async () => {
          await updateProperty(
            { tenantId: tenant.id },
            { id: property.id },
            { settings: { ...property.settings, marketing: { ...property.settings.marketing, maxUnitsInLayout: 8, maxVacantReadyUnits: 4 } } },
          );
          const { id } = await createAMarketingLayoutGroup();
          layoutGroupId = id;

          const { id: marketingLayoutId } = await createAMarketingLayout({
            name: `marketing-layout_${Math.floor(Math.random() * 999)}`,
            propertyId: property.id,
            marketingLayoutGroupId: layoutGroupId,
            numBedrooms: 2,
            numBathrooms: 1,
          });
          const layout = await createALayout({
            name: `layout_${Math.floor(Math.random() * 999)}`,
            displayName: 'layout-test',
            propertyId: property.id,
            marketingLayoutId,
            surfaceArea: 300,
          });
          layoutId = layout.id;
        });

        const generateInventories = async (length, vacantReadyLength) => {
          const inventories = [];
          await mapSeries(
            Array.from(Array(length), (_, x) => x),
            async index => {
              const state = index < vacantReadyLength ? DALTypes.InventoryState.VACANT_READY : DALTypes.InventoryState.VACANT_MAKE_READY;
              const inventory = await createAnInventory({
                propertyId: property.id,
                layoutId,
                state,
                availabilityDate: state === DALTypes.InventoryState.VACANT_READY ? now({ timezone: property.timezone }).format('YYYY-MM-DD') : null,
              });
              inventories.push({ ...inventory });
            },
          );

          await saveUnitsRevaPricing(inventories);
          await refreshUnitSearch();
        };

        const sendRequestAndAssertRecords = async (itemsLength, vacantReadyLength, limit) => {
          const header = await createHeader();
          const { status, body } = await request(app)
            .get(`/v1/marketing/properties/${property.id}/layoutGroup/${layoutGroupId}/layouts${limit ? `?limit=${limit}` : ''}`)
            .set(header);

          expect(status).to.equal(200);
          expect(body[0].inventory.length).to.equal(itemsLength);
          expect(body[0].inventory.filter(({ isAvailableNow }) => isAvailableNow)).to.have.lengthOf(vacantReadyLength);
        };

        it('should restrict the number of inventories per layout to 8 if limit is greater or not specified', async () => {
          await generateInventories(10, 5);

          await sendRequestAndAssertRecords(8, 4, 10);
          await sendRequestAndAssertRecords(8, 4);
        });

        it('should restrict the number of inventories per layout to the lowest limit specified', async () => {
          await generateInventories(10, 3);

          await sendRequestAndAssertRecords(5, 3, 5);
        });

        it('should return only 3 inventories with vacant ready state', async () => {
          await generateInventories(3, 4);

          await sendRequestAndAssertRecords(3, 3);
        });

        it('should return only 3 inventories with vacant ready state and 7 with other states', async () => {
          await generateInventories(10, 3);

          await sendRequestAndAssertRecords(8, 3);
        });
      });
    });
  });
});
