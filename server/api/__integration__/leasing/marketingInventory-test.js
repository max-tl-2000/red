/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import {
  testCtx as ctx,
  createAProperty,
  createAnInventory,
  createAnAsset,
  refreshUnitSearch,
  addAmenityToInventory,
  createAnAmenity,
  createALayout,
  createAMarketingAsset,
  createAProgram,
  createAFee,
  createAMarketingQuestion,
  createAInventoryGroup,
  setAssociatedFees,
  createALeaseTerm,
  saveUnitsRevaPricing,
  createATeam,
  createASource,
} from '../../../testUtils/repoHelper';
import { generateTokenForDomain } from '../../../services/tenantService';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { saveUnitsPricingUsingPropertyExternalId } from '../../../dal/rmsPricingRepo';
import { now, parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { RmsPricingEvents } from '../../../../common/enums/enums';
import { updateProperty } from '../../../dal/propertyRepo';
import { convertOfficeHours } from '../../../services/marketingPropertiesService';

const createHeader = async () => {
  const token = await generateTokenForDomain({
    tenantId: tenant.id,
    domain: 'www.woodchaseforexample.com',
    expiresIn: '1m',
    allowedEndpoints: ['marketing/'],
  });
  return {
    Authorization: `Bearer ${token}`,
    referer: 'http://www.woodchaseforexample.com',
  };
};

describe('API/marketing/inventory/:inventoryId', () => {
  describe('GET', () => {
    const inventoryKeys = [
      'inventoryId',
      'name',
      'state',
      'description',
      'imageUrl',
      'imageUrls',
      'fullQualifiedName',
      'buildingQualifiedName',
      'marketRent',
      'lowestMonthlyRent',
      'amenities',
      'availabilityDate',
      'availabilityDateIsEstimated',
      'isAvailableNow',
      'lossLeaderUnit',
      'complimentaryItems',
      '3DUrls',
      'videoUrls',
    ];

    it('should be a protected route', async () => {
      const res = await request(app).get('/v1/marketing/inventory');

      expect(res.status).to.equal(401);
    });

    describe('when there is no inventory matching the inventoryId given', () => {
      it('should respond with 404 INVENTORY_NOT_FOUND', async () => {
        const header = await createHeader();

        const { status, body } = await request(app).get(`/v1/marketing/inventory/${newId()}`).set(header);

        expect(status).to.equal(404);
        expect(body.token).to.equal('INVENTORY_NOT_FOUND');
      });
    });

    describe('when the inventoryId is invalid', () => {
      it('should respond with 400 INCORRECT_INVENTORY_ID', async () => {
        const header = await createHeader();

        const { status, body } = await request(app).get('/v1/marketing/inventory/12345').set(header);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INCORRECT_INVENTORY_ID');
      });
    });

    describe('when valid request is made', () => {
      let header;
      let property;
      let layout;
      let inventoryWithNoPricing;
      let marketing3DAsset;
      let marketingVideoAsset;

      beforeEach(async () => {
        header = await createHeader();
        const propertySettings = { integration: { import: { unitPricing: false } } };
        const propertyData = { name: 'cove' };
        property = await createAProperty(propertySettings, propertyData);
        marketing3DAsset = await createAMarketingAsset({ type: DALTypes.MarketingAssetType.THREE_D });
        marketingVideoAsset = await createAMarketingAsset();
        layout = await createALayout({
          name: 'Abbot',
          displayName: 'Abbot',
          propertyId: property.id,
          marketing3DAssets: [marketing3DAsset.id],
          marketingVideoAssets: [marketingVideoAsset.id],
        });
      });

      it('should respond with 404 INVENTORY_NOT_FOUND if unit details could not be loaded', async () => {
        inventoryWithNoPricing = await createAnInventory({
          name: 'test-inventory',
          description: 'inventoryWithNoPricing',
          propertyId: property.id,
          layoutId: layout.id,
        });
        await refreshUnitSearch();

        const { status, body } = await request(app).get(`/v1/marketing/inventory/${inventoryWithNoPricing.id}`).set(header);

        expect(status).to.equal(404);
        expect(body.token).to.equal('INVENTORY_NOT_FOUND');
      });

      it('should respond with 200 status and the relevant marketing inventory information', async () => {
        const inventory = await createAnInventory({
          name: 'test-name',
          description: 'test-description',
          propertyId: property.id,
          layoutId: layout.id,
        });
        await saveUnitsRevaPricing([inventory]);
        const firstAmenity = await createAnAmenity({
          name: 'AmenityTest1',
          category: DALTypes.AmenityCategory.INVENTORY,
          propertyId: property.id,
        });
        await addAmenityToInventory(ctx, inventory.id, firstAmenity.id);
        const secondAmenity = await createAnAmenity({
          name: 'AmenityTest2',
          category: DALTypes.AmenityCategory.INVENTORY,
          propertyId: property.id,
        });
        await addAmenityToInventory(ctx, inventory.id, secondAmenity.id);
        const hiddenAmenity = await createAnAmenity({
          name: 'hiddenAmenity',
          category: DALTypes.AmenityCategory.INVENTORY,
          propertyId: property.id,
          hidden: true,
        });
        await addAmenityToInventory(ctx, inventory.id, hiddenAmenity.id);
        await createAnAsset({
          type: DALTypes.AssetType.LAYOUT,
          propertyName: 'cove',
          name: layout.name,
          rank: 1,
        });
        await createAnAsset({
          type: DALTypes.AssetType.LAYOUT,
          propertyName: 'cove',
          name: layout.name,
          rank: 2,
        });
        await refreshUnitSearch();

        const res = await request(app).get(`/v1/marketing/inventory/${inventory.id}`).set(header);
        const result = res.body;
        expect(res.status).to.equal(200);
        expect(result['3DUrls'][0].name).to.equal(marketing3DAsset.name);
        expect(result.videoUrls[0].name).to.equal(marketingVideoAsset.name);
        expect(res.body).to.have.all.keys(inventoryKeys);
        expect(result.inventoryId).to.equal(inventory.id);
        expect(result.amenities.length).to.equal(2);
        expect(result.imageUrls.length).to.equal(2);
      });
    });
  });
});

describe('API/marketing/inventory/:inventoryId/pricing', () => {
  describe('GET', () => {
    const leaseTermKeys = ['marketRent', 'period', 'termLength', 'closestLowestRent'];

    const rentMatrix = {
      3: {
        '2019-01-28': { rent: '1510.00', endDate: '2019-02-04' },
        '2019-02-05': { rent: '1873.00', endDate: '2019-02-05' },
        '2019-02-06': { rent: '1873.00', endDate: '2019-02-06' },
        '2019-02-07': { rent: '1873.00', endDate: '2019-02-07' },
      },
      4: {
        '2019-01-28': { rent: '1665.00', endDate: '2019-02-04' },
        '2019-02-05': { rent: '1777.00', endDate: '2019-02-05' },
        '2019-02-06': { rent: '1777.00', endDate: '2019-02-06' },
        '2019-02-07': { rent: '1777.00', endDate: '2019-02-07' },
      },
      6: {
        '2019-01-28': { rent: '1665.00', endDate: '2019-02-04' },
        '2019-02-05': { rent: '1777.00', endDate: '2019-02-05' },
        '2019-02-06': { rent: '1777.00', endDate: '2019-02-06' },
        '2019-02-07': { rent: '1777.00', endDate: '2019-02-07' },
      },
      10: {
        '2019-01-28': { rent: '1665.00', endDate: '2019-02-04' },
        '2019-02-05': { rent: '1777.00', endDate: '2019-02-05' },
        '2019-02-06': { rent: '1077.00', endDate: '2019-02-06' },
        '2019-02-07': { rent: '1777.00', endDate: '2019-02-07' },
      },
    };
    const constructUnitPricing = (unit, minRent, standardRent) => ({
      externalId: unit.externalId,
      availDate: parseAsInTimezone('2019-02-05', { timezone: 'America/Los_Angeles' }).startOf('day').toISOString(),
      status: unit.state || '',
      amenityValue: 0,
      rmsProvider: 'LRO',
      fileName: 'LRO.xml',
      rentMatrix,
      standardLeaseLength: 12,
      standardRent,
      minRentLeaseLength: 12,
      minRentStartDate: now(),
      minRentEndDate: now(),
      minRent,
      type: unit.type,
    });

    let property1;
    let inventory11;
    let header;
    let rmsInventory;

    beforeEach(async () => {
      const token = await generateTokenForDomain({
        tenantId: tenant.id,
        domain: 'testing.reva.tech',
        expiresIn: '1m',
        allowedEndpoints: ['marketing/'],
      });
      header = {
        Authorization: `Bearer ${token}`,
        referer: 'http://testing.reva.tech',
      };
    });

    it('should be a protected route', async () => {
      const res = await request(app).get(`/v1/marketing/property/${newId()}/pricing`).send({});

      expect(res.status).to.equal(401);
    });

    describe('when there is no inventory matching the inventoryId given', () => {
      it('should respond with 404 INVENTORY_NOT_FOUND', async () => {
        const { status, body } = await request(app).get(`/v1/marketing/inventory/${newId()}/pricing`).set(header);

        expect(status).to.equal(404);
        expect(body.token).to.equal('INVENTORY_NOT_FOUND');
      });
    });

    describe('when the inventoryId is invalid', () => {
      it('should respond with 400 INCORRECT_INVENTORY_ID', async () => {
        const { status, body } = await request(app).get('/v1/marketing/inventory/12345/pricing').set(header);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INCORRECT_INVENTORY_ID');
      });
    });

    describe('when the moveInDate is invalid', () => {
      it('should respond with 400 INCORRECT_DATE', async () => {
        property1 = await createAProperty(
          {
            marketing: {
              selfServeDefaultLeaseLengthsForUnits: [12, 6],
              selfServeAllowExpandLeaseLengthsForUnits: true,
            },
          },
          {
            name: 'property1',
          },
          ctx,
        );

        inventory11 = await createAnInventory({
          propertyId: property1.id,
          externalId: 'unit1',
          rmsExternalId: 'unit1',
        });
        const { status, body } = await request(app).get(`/v1/marketing/inventory/${inventory11.id}/pricing?moveInDate=2019-02-31 22:30`).set(header);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INCORRECT_DATE');
      });
    });

    describe('when valid request is made but no pricing for the inventory', () => {
      it('should respond with 404 status and MISSING_INVENTORY_PRICING', async () => {
        property1 = await createAProperty(
          {
            integration: { import: { unitPricing: false } },
            marketing: {
              selfServeDefaultLeaseLengthsForUnits: [12, 6],
              selfServeAllowExpandLeaseLengthsForUnits: true,
            },
          },
          {
            name: 'property1',
          },
          ctx,
        );

        inventory11 = await createAnInventory({
          propertyId: property1.id,
          externalId: 'unit1',
          rmsExternalId: 'unit1',
        });

        rmsInventory = constructUnitPricing(inventory11, 300, 500);

        await saveUnitsPricingUsingPropertyExternalId(ctx, {
          unitsPricing: [rmsInventory],
          propertyExternalId: property1.rmsExternalId,
          rmsPricingEvent: RmsPricingEvents.REVA_IMPORT,
        });

        const res = await request(app).get(`/v1/marketing/inventory/${inventory11.id}/pricing?moveInDate=2019-02-09`).set(header);

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('MISSING_INVENTORY_PRICING');
      });
    });

    describe('when valid request selfServeAllowExpandLeaseLengthsForUnits is true', () => {
      it('should respond with terms(only NEW state) and additionalTerms pricing for inventory', async () => {
        property1 = await createAProperty(
          {
            integration: { import: { unitPricing: false } },
            marketing: {
              selfServeDefaultLeaseLengthsForUnits: [10, 6],
              selfServeAllowExpandLeaseLengthsForUnits: true,
            },
          },
          {
            name: 'property1',
          },
          ctx,
        );
        const propertyId = property1.id;
        await createAInventoryGroup({ propertyId, shouldCreateLeaseTerm: true, termLength: 3 });
        await createAInventoryGroup({ propertyId, shouldCreateLeaseTerm: true, termLength: 4 });
        await createAInventoryGroup({ propertyId, shouldCreateLeaseTerm: true, termLength: 6 });

        inventory11 = await createAnInventory({
          propertyId: property1.id,
          externalId: 'unit1',
          rmsExternalId: 'unit1',
          shouldCreateLeaseTerm: true,
          termLength: 10,
          state: DALTypes.InventoryState.VACANT_READY,
        });

        rmsInventory = constructUnitPricing(inventory11, 300, 500);

        await saveUnitsPricingUsingPropertyExternalId(ctx, {
          unitsPricing: [rmsInventory],
          propertyExternalId: property1.rmsExternalId,
          rmsPricingEvent: RmsPricingEvents.REVA_IMPORT,
        });

        const res = await request(app).get(`/v1/marketing/inventory/${inventory11.id}/pricing?moveInDate=2019-02-07&validatePastDate=false`).set(header);

        const result = res.body;

        expect(res.status).to.equal(200);
        expect(result).to.have.all.keys(['date', 'terms', 'additionalTerms']);
        expect(result.terms.length).to.equal(2);
        expect(result.terms[0]).to.have.all.keys(leaseTermKeys);
        expect(result.additionalTerms.length).to.equal(2);
        expect(result.additionalTerms[0]).to.have.all.keys(leaseTermKeys);
        expect(result.additionalTerms[1]).to.have.all.keys(leaseTermKeys);

        const expectedClosestLowestRent = { moveInDate: '2019-02-07', marketRent: 1777 };
        expect(JSON.stringify(result.terms[0].closestLowestRent)).to.equal(JSON.stringify(expectedClosestLowestRent));

        const leaseTerms = result.terms.map(m => m.termLength);
        expect(leaseTerms).to.include(10);

        const additionalLeaseTerms = result.additionalTerms.map(m => m.termLength);
        expect(additionalLeaseTerms).to.not.include(6);
        expect(additionalLeaseTerms).to.not.include(10);
      });
    });

    describe('when valid request selfServeAllowExpandLeaseLengthsForUnits is false', () => {
      it('should respond with term(only NEW state) pricing for inventory', async () => {
        property1 = await createAProperty(
          {
            integration: { import: { unitPricing: false } },
            marketing: {
              selfServeDefaultLeaseLengthsForUnits: [10, 6],
              selfServeAllowExpandLeaseLengthsForUnits: false,
            },
          },
          {
            name: 'property1',
          },
          ctx,
        );

        inventory11 = await createAnInventory({
          propertyId: property1.id,
          externalId: 'unit1',
          rmsExternalId: 'unit1',
          shouldCreateLeaseTerm: true,
          termLength: 10,
        });

        rmsInventory = constructUnitPricing(inventory11, 300, 500);

        await saveUnitsPricingUsingPropertyExternalId(ctx, {
          unitsPricing: [rmsInventory],
          propertyExternalId: property1.rmsExternalId,
          rmsPricingEvent: RmsPricingEvents.REVA_IMPORT,
        });

        const res = await request(app).get(`/v1/marketing/inventory/${inventory11.id}/pricing?moveInDate=2019-02-05&validatePastDate=false`).set(header);

        const result = res.body;
        expect(res.status).to.equal(200);
        expect(result).to.have.all.keys(['date', 'terms']);
        expect(result.terms.length).to.equal(1);
        expect(result.terms[0]).to.have.all.keys(leaseTermKeys);
        const leaseTerms = result.terms.map(m => m.termLength);
        expect(leaseTerms).to.not.include(6);
        expect(leaseTerms).to.include(10);
      });
    });

    describe('when the inventories request is made with no source', () => {
      it('should respond with status 400 and token MISSING_SOURCE', async () => {
        const res = await request(app)
          .post('/v1/marketing/inventory')
          .set(await createHeader())
          .send({});

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('MISSING_SOURCE');
      });
    });

    describe('when the inventories request is made with an invalid source', () => {
      it('should respond with status 400 and token INVALID_SOURCE', async () => {
        const res = await request(app)
          .post('/v1/marketing/inventory')
          .set(await createHeader())
          .send({ source: 'invalidSource' });

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INVALID_SOURCE');
      });
    });

    describe('when the inventories request is made with invalid inventoryIds or marketingLayoutIds', () => {
      it('should respond with status 400 and token MISSING_INVENTORY_IDS_OR_LAYOUT_IDS', async () => {
        await createASource('program1Source', 'source for program1', 'desc', 'type');
        const res = await request(app)
          .post('/v1/marketing/inventory')
          .set(await createHeader())
          .send({
            source: 'program1Source',
            inventoryIds: [''],
            marketingLayoutIds: ['invalidGuid', ''],
          });

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('MISSING_INVENTORY_IDS_OR_LAYOUT_IDS');
      });
    });

    describe('when a valid inventories request is made', () => {
      it('should respond with list of inventories', async () => {
        property1 = await createAProperty(
          {
            integration: { import: { unitPricing: false } },
            marketing: {
              city: 'MK New York',
              tags: ['cool', 'upstate', 'spacious'],
              state: 'MK New York',
              region: 'MK East Coast',
              cityAliases: ['Big Apple'],
              neighborhood: '',
              stateAliases: ['NY', 'New York'],
              testimonials: ['i love this place'],
              regionAliases: [],
              neighborhoodAliases: ['central park'],
              propertyAmenities: ['conference'],
              layoutAmenities: ['firePlace'],
              includedInListings: true,
            },
            marketingLocation: {
              addressLine1: 'NewYork AddressLine1',
              addressLine2: '',
              city: 'New York',
              state: 'NY',
              postalCode: '999233',
            },
          },
          {
            name: 'property1',
            addressLine1: 'address property 1',
            city: 'New York',
            postalCode: '10014',
            state: 'NY',
            websiteDomain: 'reva.com',
            website: '/property/south-dakota/sioux-falls/oakwood-estates-apartment-homes',
            geoLocation: { lat: 37.445099, lng: -122.160362 },
          },
          ctx,
        );
        const leasingTeam = await createATeam();
        const source = await createASource('program1Source', 'source for program1', 'desc', 'type');
        const program1 = await createAProgram({
          name: 'p1',
          directEmailIdentifier: 'p1.program',
          directPhoneIdentifier: '14084809989',
          property: property1,
          onSiteLeasingTeam: leasingTeam,
          source,
        });

        await updateProperty(ctx, { id: property1.id }, { settings: { ...property1.settings, comms: { defaultPropertyProgram: program1.id } } });

        await createAnAmenity({
          name: 'petFriendly',
          displayName: 'Pet Friendly',
          category: DALTypes.AmenityCategory.PROPERTY,
          propertyId: property1.id,
        });

        const washerDryerAmenity = await createAnAmenity({
          name: 'washerDryerIncluded',
          displayName: 'Washer/Dryer Included',
          category: DALTypes.AmenityCategory.INVENTORY,
          propertyId: property1.id,
        });

        inventory11 = await createAnInventory({
          name: 'unit1',
          propertyId: property1.id,
          externalId: 'unit1',
          rmsExternalId: 'unit1',
          shouldCreateLeaseTerm: true,
          termLength: 10,
          address: 'some address 1',
        });

        const inventory12 = await createAnInventory({
          name: 'unit2',
          propertyId: property1.id,
          externalId: 'unit2',
          rmsExternalId: 'unit2',
          shouldCreateLeaseTerm: true,
          termLength: 10,
          address: 'some address 2',
        });

        await addAmenityToInventory(ctx, inventory12.id, washerDryerAmenity.id);

        const rmsInventory11 = constructUnitPricing(inventory11, 300, 500);
        const rmsInventory12 = constructUnitPricing(inventory12, 400, 600);

        await saveUnitsPricingUsingPropertyExternalId(ctx, {
          unitsPricing: [rmsInventory11, rmsInventory12],
          propertyExternalId: property1.rmsExternalId,
          rmsPricingEvent: RmsPricingEvents.REVA_IMPORT,
        });

        await refreshUnitSearch();

        const res = await request(app)
          .post('/v1/marketing/inventory')
          .set(await createHeader())
          .send({
            source: source.name,
            inventoryIds: [`${inventory11.id}`, `${inventory12.id}`, 'invalidGuid'],
            marketingLayoutIds: [''],
          });

        const result = res.body;

        const expectedResult = {
          properties: {
            [property1.id]: {
              name: 'property1',
              propertyId: property1.id,
              address: {
                addressLine1: property1.settings.marketingLocation.addressLine1,
                addressLine2: property1.settings.marketingLocation.addressLine2,
                city: property1.settings.marketingLocation.city,
                state: property1.settings.marketingLocation.state,
                postalCode: property1.settings.marketingLocation.postalCode,
              },
              formattedAddress: 'NewYork AddressLine1, New York, NY 999233',
              officeHours: convertOfficeHours(leasingTeam.officeHours),
              timezone: property1.timezone,
              images: [],
              phone: '14084809989',
              displayPhone: '(408) 480-9989',
              url: 'https://reva.com/property/south-dakota/sioux-falls/oakwood-estates-apartment-homes',
              email: program1.displayEmail,
            },
          },
          inventories: {
            [inventory11.id]: {
              unitRentPrice: rmsInventory11.standardRent,
              minRentPrice: rmsInventory11.minRent,
              numBathrooms: 1,
              numBedrooms: 1,
              surfaceArea: 0,
              description: null,
              name: 'unit1',
              images: [],
              amenities: [],
              inventoryId: inventory11.id,
              isAvailable: false,
              externalId: 'unit1',
              address: inventory11.address,
              propertyId: property1.id,
              allowed: ['cats', 'dogs'],
              included: [],
              available: [],
            },
            [inventory12.id]: {
              unitRentPrice: rmsInventory12.standardRent,
              minRentPrice: rmsInventory12.minRent,
              numBathrooms: 1,
              numBedrooms: 1,
              surfaceArea: 0,
              description: null,
              name: 'unit2',
              images: [],
              amenities: ['Washer/Dryer Included'],
              inventoryId: inventory12.id,
              isAvailable: false,
              externalId: 'unit2',
              address: inventory12.address,
              propertyId: property1.id,
              allowed: ['cats', 'dogs'],
              included: ['washer', 'dryer'],
              available: [],
            },
          },
        };

        expect(res.status).to.equal(200);
        expect(result).to.deep.equal(expectedResult);
      });
    });
  });
});

describe('API/marketing/inventory/:inventoryId/quoteQuestions', () => {
  let program1;
  let property1;

  beforeEach(async () => {
    const propertySettings = { integration: { import: { unitPricing: false } } };
    property1 = await createAProperty(
      propertySettings,
      {
        name: 'property1',
      },
      ctx,
    );
    program1 = await createAProgram({
      name: 'p1',
      directEmailIdentifier: 'p1.program',
      directPhoneIdentifier: '12223334444',
      property: property1,
      onSiteLeasingTeam: {},
    });
  });

  describe('GET', () => {
    it('should be a protected route', async () => {
      const res = await request(app).get(`/v1/marketing/inventory/${newId()}/quoteQuestions`).send({});

      expect(res.status).to.equal(401);
    });
  });

  describe('when program email is missing', () => {
    it('responds with status code 400 and MISSING_PROGRAM_EMAIL token', async () => {
      const header = await createHeader();
      const res = await request(app).get('/v1/marketing/inventory/12345/quoteQuestions').set(header);

      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('MISSING_PROGRAM_EMAIL_OR_SESSION_ID');
    });
  });

  describe('when program email does not exist', () => {
    it('responds with status code 404 and PROGRAM_NOT_FOUND token', async () => {
      const header = await createHeader();
      const res = await request(app)
        .get('/v1/marketing/inventory/12345/quoteQuestions')
        .set({ ...header, 'x-reva-program-email': 'wrongemail' });

      expect(res.status).to.equal(404);
      expect(res.body.token).to.equal('PROGRAM_NOT_FOUND');
    });
  });

  describe('when the inventoryId is invalid', () => {
    it('should respond with 400 INCORRECT_INVENTORY_ID', async () => {
      const header = await createHeader();
      header['x-reva-program-email'] = program1.directEmailIdentifier;

      const { status, body } = await request(app).get('/v1/marketing/inventory/12345/quoteQuestions').set(header);

      expect(status).to.equal(400);
      expect(body.token).to.equal('INCORRECT_INVENTORY_ID');
    });
  });

  describe('when the request is valid', () => {
    it('should respond with corresponding marketing questions', async () => {
      const header = await createHeader();
      header['x-reva-program-email'] = program1.directEmailIdentifier;

      const marketingQuestionsKeys = [
        'id',
        'name',
        'displaySectionQuestion',
        'displayPrimaryQuestion',
        'displayPrimaryQuestionDescription',
        'displayFollowupQuestion',
        'inputTypeForFollowupQuestion',
        'feeId',
        'maxQuantity',
        'displayOrder',
      ];

      const question1 = await createAMarketingQuestion({
        name: 'pet',
        displaySectionQuestion: 'defaultDisplayQuestions',
        displayPrimaryQuestion: 'Do you have pets',
        displayPrimaryQuestionDescription: 'pets',
        displayFollowupQuestion: 'How many pets?',
        inputTypeForFollowupQuestion: 'count',
        displayOrder: '1',
      });

      const question2 = await createAMarketingQuestion({
        name: 'storage11x9',
        displaySectionQuestion: 'Do you need additional storage?',
        displayPrimaryQuestion: 'Do you need 11x9 storage?',
        displayPrimaryQuestionDescription: 'storage',
        displayFollowupQuestion: 'How many storage units do you need?',
        inputTypeForFollowupQuestion: 'count',
        displayOrder: '1',
      });

      const question21 = await createAMarketingQuestion({
        name: 'storage12x9',
        displaySectionQuestion: 'Do you need additional storage?',
        displayPrimaryQuestion: 'Do you need 12x9 storage?',
        displayPrimaryQuestionDescription: 'storage',
        displayFollowupQuestion: 'How many storage units do you need?',
        inputTypeForFollowupQuestion: 'count',
        displayOrder: '2',
      });

      const question3 = await createAMarketingQuestion({
        name: 'storage13x9',
        displaySectionQuestion: 'Do you need additional storage?',
        displayPrimaryQuestion: 'Do you need 13x9 storage?',
        displayPrimaryQuestionDescription: 'storage',
        displayFollowupQuestion: 'How many storage units do you need?',
        inputTypeForFollowupQuestion: 'count',
        inactive: true,
        displayOrder: '3',
      });

      const primaryFee = await createAFee({
        propertyId: property1.id,
        absolutePrice: 37,
        feeName: 'MainFee',
        externalChargeCode: 'ADM',
      });

      const relatedFee1 = await createAFee({
        propertyId: property1.id,
        absolutePrice: 37,
        feeName: 'PetFee',
        externalChargeCode: 'ADM',
        marketingQuestionId: question1.id,
        servicePeriod: 'month',
        feeType: 'service',
        quoteSectionName: 'pet',
        maxQuantityInQuote: 4,
      });

      const relatedFee2 = await createAFee({
        propertyId: property1.id,
        absolutePrice: 37,
        feeName: 'Storage11x9',
        externalChargeCode: 'ADM',
        servicePeriod: 'month',
        feeType: 'inventoryGroup',
        quoteSectionName: 'storage',
        marketingQuestionId: question2.id,
        maxQuantityInQuote: 4,
      });

      const relatedFee21 = await createAFee({
        propertyId: property1.id,
        absolutePrice: 37,
        feeName: 'Storage12x9',
        externalChargeCode: 'ADM',
        servicePeriod: 'month',
        feeType: 'inventoryGroup',
        quoteSectionName: 'storage',
        marketingQuestionId: question21.id,
        maxQuantityInQuote: 4,
      });

      const relatedFee3 = await createAFee({
        propertyId: property1.id,
        absolutePrice: 37,
        feeName: 'AdditionalFee',
        externalChargeCode: 'ADM',
      });

      const inactiveRelatedFee = await createAFee({
        propertyId: property1.id,
        absolutePrice: 37,
        feeName: 'Storage13x9',
        externalChargeCode: 'ADM',
        marketingQuestionId: question3.id,
      });

      const { leaseNameId } = await createALeaseTerm({
        propertyId: property1.id,
        termLength: 12,
      });

      await setAssociatedFees(primaryFee.id, relatedFee1.id);
      await setAssociatedFees(primaryFee.id, relatedFee2.id);
      await setAssociatedFees(primaryFee.id, relatedFee21.id);
      await setAssociatedFees(primaryFee.id, inactiveRelatedFee.id);
      await setAssociatedFees(primaryFee.id, relatedFee3.id, true);

      const layout = await createALayout({
        name: 'Abbot',
        displayName: 'Abbot',
        propertyId: property1.id,
      });

      const inventoryGroup = await createAInventoryGroup({
        propertyId: property1.id,
        feeId: primaryFee.id,
        leaseNameId,
      });

      const inventoryGroupForStorage = await createAInventoryGroup({
        propertyId: property1.id,
        feeId: relatedFee2.id,
        leaseNameId,
      });

      const inventory = await createAnInventory({
        name: 'test-name',
        description: 'test-description',
        propertyId: property1.id,
        layoutId: layout.id,
        inventoryGroupId: inventoryGroup.id,
      });

      const storage = await createAnInventory({
        name: 'test-storage',
        description: 'test-storage',
        propertyId: property1.id,
        layoutId: layout.id,
        inventoryGroupId: inventoryGroupForStorage.id,
      });

      await saveUnitsRevaPricing([inventory]);
      await saveUnitsRevaPricing([storage]);

      const { status, body: marketingQuestions } = await request(app).get(`/v1/marketing/inventory/${inventory.id}/quoteQuestions`).set(header);

      expect(status).to.equal(200);
      expect(marketingQuestions.length).to.equal(2);
      const marketingQuestionsIds = marketingQuestions.map(mq => mq.id);
      expect(marketingQuestionsIds).to.include(question1.id);
      expect(marketingQuestionsIds).to.include(question2.id);
      expect(marketingQuestionsIds).to.not.include(question21.id);
      marketingQuestions.forEach(question => expect(question).to.have.all.keys(marketingQuestionsKeys));
      const petQuestion = marketingQuestions.find(mq => mq.name === question1.name);
      expect(petQuestion.feeId).to.equal(relatedFee1.id);
    });
  });
});
