/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';
import config from '../../../config';
import app from '../../api';
import {
  testCtx as ctx,
  createAProperty,
  createAnInventory,
  createAMarketingLayout,
  createAMarketingLayoutGroup,
  createAnAmenity,
  createAProgram,
  createATeam,
  addATeamPropertyProgram,
  createALayout,
  createTeamEvent,
  toggleExtCalendarFeature,
} from '../../../testUtils/repoHelper';
import { now, toMoment, isSameDay } from '../../../../common/helpers/moment-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';

import { generateTokenForDomain } from '../../../services/tenantService';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { init as initCloudinary } from '../../../../common/helpers/cloudinary';
import { saveUnitsPricingUsingPropertyExternalId } from '../../../dal/rmsPricingRepo';
import { formatTenantEmailDomain } from '../../../../common/helpers/utils';
import { RmsPricingEvents } from '../../../../common/enums/enums';
import { updateProperty, getPropertyAddress } from '../../../dal/propertyRepo';
import { convertOfficeHours, computeOfficeHoursFromExternalCalendar } from '../../../services/marketingPropertiesService';
import { updateInventories } from '../../../services/inventories';
import { updateTeam } from '../../../dal/teamsRepo';

describe('API/marketing/', () => {
  initCloudinary({ cloudName: 'test' });

  let header;
  const mainResponseKeys = ['marketingLayoutGroups', 'marketRent', 'properties', 'lifestyles', 'marketingSearch'];
  const propertyBaseKeys = [
    'propertyId',
    'name',
    'displayName',
    'geoLocation',
    'city',
    'tags',
    'state',
    'region',
    'address',
    'formattedShortAddress',
    'formattedLongAddress',
    'formattedFullAddress',
    'neighborhood',
    'testimonials',
    'slugUrl',
    'timezone',
  ];

  const propertyKeys = [...propertyBaseKeys, 'cityAliases', 'stateAliases', 'regionAliases', 'neighborhoodAliases'];

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
  };
  const constructUnitPricing = (unit, minRent, standardRent, renewalDate = null) => ({
    externalId: unit.externalId,
    availDate: now(),
    status: '',
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
    renewalDate,
  });

  const lifestyleKeys = ['name', 'description', 'displayName', 'infographicName', 'order'];
  const amenityKeys = ['name', 'description', 'displayName'];
  const marketingLayoutGroupsKeys = ['id', 'name', 'displayName', 'description', 'shortDisplayName', 'imageUrl'];

  let marketingGroup1;
  let marketingGroup2;
  let amenity1;
  let amenity2;
  let property1;
  let property2;
  let property3;
  let program1;
  let program2;
  let theTeam;
  let leasingTeam;

  beforeEach(async () => {
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
        // NOT adding a marketingLocation, to specifically check that
        // propertyAddress is used if marketingLocation is missing
        // marketingLocation: {},
      },
      {
        name: 'property1',
        addressLine1: 'address property 1',
        city: 'New York',
        postalCode: '10014',
        state: 'NY',
        website: 'www.property1.com',
        geoLocation: { lat: 37.445099, lng: -122.160362 },
      },
      ctx,
    );

    const inventory11 = await createAnInventory({
      propertyId: property1.id,
      externalId: 'unit1',
      rmsExternalId: 'unit1',
      // state will default to VacantReady
    });
    const inventory12 = await createAnInventory({
      propertyId: property1.id,
      externalId: 'unit2',
      rmsExternalId: 'unit2',
      state: DALTypes.InventoryState.VACANT_MAKE_READY,
    });
    const inventory13 = await createAnInventory({
      propertyId: property1.id,
      externalId: 'unit3',
      rmsExternalId: 'unit3',
      state: DALTypes.InventoryState.OCCUPIED_NOTICE,
    });
    const rmsInventory11 = constructUnitPricing(inventory11, 300, 500);
    const rmsInventory12 = constructUnitPricing(inventory12, 200, 400);
    // renewalDate set
    const rmsInventory13 = constructUnitPricing(inventory13, 50, 1000, now());

    await saveUnitsPricingUsingPropertyExternalId(ctx, {
      unitsPricing: [rmsInventory11, rmsInventory12, rmsInventory13],
      propertyExternalId: property1.rmsExternalId,
      rmsPricingEvent: RmsPricingEvents.REVA_IMPORT,
    });
    property2 = await createAProperty(
      {
        integration: { import: { unitPricing: false } },
        marketing: {
          city: 'MK San Francisco',
          tags: ['bridge', 'upstate', 'studio'],
          state: 'MK California',
          region: 'MK Bay Area',
          cityAliases: ['San Fran'],
          neighborhood: 'neighborhood2',
          stateAliases: ['CA', 'California'],
          testimonials: ['i love this place 2'],
          regionAliases: [],
          neighborhoodAliases: [],
          propertyAmenities: [],
          layoutAmenities: [],
          includedInListings: true,
        },
        marketingLocation: {
          addressLine1: 'SanFrancisco AddressLine1',
          addressLine2: '',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '999234',
        },
      },
      {
        name: 'property2',
        addressLine1: 'address property 2',
        city: 'San Francisco',
        postalCode: '13314',
        state: 'CA',
        website: 'www.property2.com',
        geoLocation: { lat: 37.90642, lng: -122.503362 },
      },
      ctx,
    );
    const inventory2 = await createAnInventory({
      propertyId: property2.id,
      externalId: 'unit2',
      rmsExternalId: 'unit2',
      state: DALTypes.InventoryState.OCCUPIED_NOTICE,
    });
    const rmsInventory2 = constructUnitPricing(inventory2, 100, 300);

    await saveUnitsPricingUsingPropertyExternalId(ctx, {
      unitsPricing: [rmsInventory2],
      propertyExternalId: property2.rmsExternalId,
      rmsPricingEvent: RmsPricingEvents.REVA_IMPORT,
    });
    property3 = await createAProperty(
      {
        integration: { import: { unitPricing: false } },
        marketing: {
          city: 'MK Chicago',
          tags: ['wind', 'Central', '1bd'],
          state: 'MK Illinois',
          region: 'MK Great Lakes',
          cityAliases: ['windy city'],
          neighborhood: '',
          stateAliases: ['IL', 'Illinois'],
          testimonials: ['i am cold'],
          regionAliases: [],
          neighborhoodAliases: [],
          propertyAmenities: [],
          layoutAmenities: [],
          includedInListings: false,
        },
        marketingLocation: {
          addressLine1: 'Chicago AddressLine1',
          addressLine2: '',
          city: 'Chicago',
          state: 'IL',
          postalCode: '999235',
        },
      },
      {
        name: 'property3',
        addressLine1: 'address property 3',
        city: 'Chicago',
        postalCode: '14414',
        state: 'IL',
        website: 'www.property3.com',
        geoLocation: { lat: 36.90642, lng: -121.503362 },
      },
      ctx,
    );
    const inventory3 = await createAnInventory({
      propertyId: property3.id,
      externalId: 'unit3',
      rmsExternalId: 'unit3',
    });
    const rmsInventory3 = constructUnitPricing(inventory3, 300, 900);

    await saveUnitsPricingUsingPropertyExternalId(ctx, {
      unitsPricing: [rmsInventory3],
      propertyExternalId: property3.rmsExternalId,
      rmsPricingEvent: RmsPricingEvents.REVA_IMPORT,
    });
    await createAMarketingLayoutGroup();
    await createAMarketingLayoutGroup();
    await createAMarketingLayoutGroup();
    marketingGroup1 = await createAMarketingLayoutGroup();
    marketingGroup2 = await createAMarketingLayoutGroup();

    const marketingLayout1 = await createAMarketingLayout({ marketingLayoutGroupId: marketingGroup1.id, propertyId: property1.id });
    const marketingLayout2 = await createAMarketingLayout({ marketingLayoutGroupId: marketingGroup1.id, propertyId: property2.id });
    const marketingLayout3 = await createAMarketingLayout({ marketingLayoutGroupId: marketingGroup2.id, propertyId: property3.id });

    const layout1 = await createALayout({
      name: 'Abbot1',
      displayName: 'Abbot',
      propertyId: property1.id,
      marketingLayoutId: marketingLayout1.id,
      surfaceArea: 300,
    });
    const layout2 = await createALayout({
      name: 'Abbot2',
      displayName: 'Abbot',
      propertyId: property2.id,
      marketingLayoutId: marketingLayout2.id,
      surfaceArea: 1000,
    });
    const layout3 = await createALayout({
      name: 'Abbot3',
      displayName: 'Abbot',
      propertyId: property3.id,
      marketingLayoutId: marketingLayout3.id,
      surfaceArea: 445,
    });

    await updateInventories(ctx, { inventoryIds: [inventory11.id], dataToUpdate: { layoutId: layout1.id } });
    await updateInventories(ctx, { inventoryIds: [inventory12.id], dataToUpdate: { layoutId: layout1.id } });
    await updateInventories(ctx, { inventoryIds: [inventory2.id], dataToUpdate: { layoutId: layout2.id } });
    await updateInventories(ctx, { inventoryIds: [inventory3.id], dataToUpdate: { layoutId: layout3.id } });

    await createAnAmenity({});
    amenity1 = await createAnAmenity({
      displayName: 'DN1',
      category: DALTypes.AmenityCategory.PROPERTY,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      infographicName: 'info-1',
      propertyId: property1.id,
    });
    await createAnAmenity({
      displayName: 'DN1',
      category: DALTypes.AmenityCategory.PROPERTY,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      infographicName: 'info-1',
      propertyId: property2.id,
    });
    await createAnAmenity({});
    amenity2 = await createAnAmenity({
      category: DALTypes.AmenityCategory.PROPERTY,
      subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
      infographicName: 'info-2',
      propertyId: property2.id,
    });
    leasingTeam = await createATeam({ name: 'Leasing Team' });
    theTeam = await createATeam({ name: 'Main Team' });

    program1 = await createAProgram({
      name: 'p1',
      directEmailIdentifier: 'p1.program',
      directPhoneIdentifier: '12223334444',
      property: property1,
      team: theTeam,
      onSiteLeasingTeam: leasingTeam,
    });
    await updateProperty(ctx, { id: property1.id }, { settings: { ...property1.settings, comms: { defaultPropertyProgram: program1.id } } });

    await addATeamPropertyProgram(ctx, { teamId: theTeam.id, propertyId: property1.id, programId: program1.id, commDirection: 'out' });

    program2 = await createAProgram({
      name: 'p2',
      directEmailIdentifier: 'p2.program',
      directPhoneIdentifier: '93323334444',
      property: property2,
      team: theTeam,
      onSiteLeasingTeam: leasingTeam,
    });
    await updateProperty(ctx, { id: property2.id }, { settings: { ...property2.settings, comms: { defaultPropertyProgram: program2.id } } });

    await createAnAmenity({
      name: '24emergencyMantainance',
      displayName: '24 Hour Emergency Maintenance',
      category: DALTypes.AmenityCategory.BUILDING,
      subCategory: DALTypes.AmenitySubCategory.RESIDENT_EXPERIENCE,
      infographicName: 'info-24',
      propertyId: property1.id,
    });

    await createAnAmenity({
      name: 'conference',
      displayName: 'Conference Center',
      category: DALTypes.AmenityCategory.BUILDING,
      subCategory: DALTypes.AmenitySubCategory.RESIDENT_EXPERIENCE,
      infographicName: 'info-conference',
      propertyId: property1.id,
    });
    await createAnAmenity({
      name: 'bayView',
      displayName: 'Bay View',
      category: DALTypes.AmenityCategory.INVENTORY,
      subCategory: DALTypes.AmenitySubCategory.LIVING_SPACE,
      infographicName: 'info-conference',
      propertyId: property1.id,
    });
    await createAnAmenity({
      name: 'firePlace',
      displayName: 'Fire Place',
      category: DALTypes.AmenityCategory.INVENTORY,
      subCategory: DALTypes.AmenitySubCategory.LIVING_SPACE,
      infographicName: 'info-conference',
      propertyId: property1.id,
    });

    const token = await generateTokenForDomain({
      tenantId: tenant.id,
      domain: ['testing.reva.tech', 'test.com'],
      expiresIn: '1m',
      allowedEndpoints: ['marketing/'],
    });
    header = {
      Authorization: `Bearer ${token}`,
      referer: 'http://testing.reva.tech',
    };
  });
  describe('GET', () => {
    describe('when a /marketing/properties request is made', () => {
      it('should be a protected route', async () => {
        const res = await request(app).get('/marketing/properties').send({});

        expect(res.status).to.equal(401);
      });
    });
    describe('when valid /marketing/properties request is made', () => {
      it('should respond with 200 status and the relevant marketing property information', async () => {
        const res = await request(app).get('/v1/marketing/properties').set(header);
        expect(res.status).to.equal(200);
        expect(res.body).to.have.all.keys(mainResponseKeys);

        const { marketingLayoutGroups, properties, marketRent, lifestyles } = res.body;

        expect(properties.length).to.equal(2);
        expect(properties[0]).to.have.all.keys(propertyKeys);
        expect(properties[1]).to.have.all.keys(propertyKeys);

        const property1Address = await getPropertyAddress(ctx, property1.id);
        const expectedAddressForProperty1 = {
          addressLine1: property1Address.addressLine1,
          addressLine2: property1Address.addressLine2,
          city: property1Address.city,
          state: property1Address.state,
          postalCode: property1Address.postalCode,
        };

        expect(properties[0].address).to.deep.equal(expectedAddressForProperty1);
        expect(properties[1].address).to.deep.equal(property2.settings.marketingLocation);

        expect(marketRent.min).to.equal((100).toFixed(2));
        expect(marketRent.max).to.equal((900).toFixed(2));

        expect(marketingLayoutGroups.length).to.equal(2);
        expect(marketingLayoutGroups[0]).to.have.all.keys(marketingLayoutGroupsKeys);
        expect(marketingLayoutGroups[1]).to.have.all.keys(marketingLayoutGroupsKeys);
        const groupNames = marketingLayoutGroups.map(m => m.name);
        expect(groupNames).to.include(marketingGroup1.name);
        expect(groupNames).to.include(marketingGroup2.name);

        expect(lifestyles.length).to.equal(2);
        expect(lifestyles[0]).to.have.all.keys(lifestyleKeys);
        expect(lifestyles[1]).to.have.all.keys(lifestyleKeys);
        const amenityNames = lifestyles.map(m => m.displayName);
        expect(amenityNames).to.include(amenity1.displayName);
        expect(amenityNames).to.include(amenity2.displayName);
      });
    });

    describe('when a /marketing/property/:propertyId request is made', () => {
      it('should be a protected route', async () => {
        const res = await request(app).get(`/v1/marketing/property/${property1.id}`).send({});

        expect(res.status).to.equal(401);
      });
    });
    describe('when valid /marketing/property/:propertyId request is made', () => {
      describe('when program email is missing', () => {
        it('responds with status code 400 and MISSING_PROGRAM_EMAIL token', async () => {
          const res = await request(app).get(`/v1/marketing/property/${property1.id}`).set(header);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('MISSING_PROGRAM_EMAIL_OR_SESSION_ID');
        });
      });

      describe('when program email does not exist', () => {
        it('responds with status code 404 and PROGRAM_NOT_FOUND token', async () => {
          const res = await request(app)
            .get(`/v1/marketing/property/${property1.id}`)
            .set({ ...header, 'x-reva-program-email': 'wrongemail' });

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PROGRAM_NOT_FOUND');
        });
      });

      describe('when program email exists but the property id is invalid', () => {
        it('responds with status code 400 and INCORRECT_PROPERTY_ID token', async () => {
          const res = await request(app)
            .get('/v1/marketing/property/wrongParam}')
            .set({ ...header, 'x-reva-program-email': program1.directEmailIdentifier });

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INCORRECT_PROPERTY_ID');
        });
      });
      describe('when program email exists but the property id does not exist', () => {
        it('responds with status code 404 and PROPERTY_NOT_FOUND token', async () => {
          const res = await request(app)
            .get(`/v1/marketing/property/${newId()}`)
            .set({ ...header, 'x-reva-program-email': program1.directEmailIdentifier });

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PROPERTY_NOT_FOUND');
        });
      });

      describe('when valid /marketing/property/{propertyId} request is made', () => {
        it('should respond with 200 status and the relevant marketing property information', async () => {
          const res = await request(app)
            .get(`/v1/marketing/property/${property1.id}?includePOIs=true&includeAmenities=true`)
            .set({ ...header, 'x-reva-program-email': program2.directEmailIdentifier });

          expect(res.status).to.equal(200);

          const propertyMainKeys = [
            ...propertyBaseKeys,
            'numBedrooms',
            'surfaceArea',
            'marketingLayoutGroups',
            'marketRent',
            'phone',
            'email',
            'lifestyles',
            'layoutAmenities',
            'onSiteLeasingTeam',
            'team',
            'propertyAmenities',
            'propertyPointsOfInterest',
            'logoUrl',
            'smsEnabled',
            'url',
            'images',
            'videoUrls',
            '3DUrls',
          ];
          const teamKeys = ['timeZone', 'hours', 'calendarHours'];
          expect(res.body).to.have.all.keys(propertyMainKeys);

          const {
            propertyId,
            name,
            displayName,
            slugUrl,
            marketingLayoutGroups,
            marketRent,
            lifestyles,
            phone,
            email,
            propertyAmenities,
            layoutAmenities,
            team,
            onSiteLeasingTeam,
            propertyPointsOfInterest,
          } = res.body;
          expect(propertyId).to.equal(property1.id);
          expect(name).to.equal(property1.name);
          expect(displayName).to.equal(property1.displayName);
          expect(slugUrl).to.equal(property1.website);
          expect(phone).to.equal(program1.directPhoneIdentifier);

          const domain = await formatTenantEmailDomain(tenant.name, config.mail.emailDomain);
          expect(email).to.equal(program1.displayEmail || `${program1.directEmailIdentifier}@${domain}`);

          expect(marketRent.min).to.equal((200).toFixed(2));
          expect(marketRent.max).to.equal((500).toFixed(2));

          expect(marketingLayoutGroups.length).to.equal(1);
          expect(marketingLayoutGroups[0]).to.have.all.keys(marketingLayoutGroupsKeys);
          expect(marketingLayoutGroups[0].name).to.equal(marketingGroup1.name);

          expect(lifestyles.length).to.equal(1);
          expect(lifestyles[0]).to.have.all.keys(lifestyleKeys);
          const amenity = lifestyles[0];
          expect(amenity.displayName).to.equal(amenity1.displayName);
          expect(amenity.name).to.equal(amenity1.name);

          expect(propertyAmenities.length).to.equal(1);
          expect(propertyAmenities[0]).to.have.all.keys(amenityKeys);
          expect(propertyAmenities[0].name).to.equal('conference');

          expect(layoutAmenities.length).to.equal(1);
          expect(layoutAmenities[0]).to.have.all.keys(amenityKeys);
          expect(layoutAmenities[0].name).to.equal('firePlace');
          expect(team).to.have.all.keys(teamKeys);
          expect(onSiteLeasingTeam).to.have.all.keys(teamKeys);
          expect(team.timeZone).to.equal(theTeam.timeZone);
          expect(onSiteLeasingTeam.timeZone).to.equal(leasingTeam.timeZone);
          expect(team.hours).to.deep.equal(convertOfficeHours(theTeam.officeHours));
          expect(onSiteLeasingTeam.hours).to.deep.equal(convertOfficeHours(leasingTeam.officeHours));
          expect(propertyPointsOfInterest).to.deep.equal({ poi: {} });
        });

        it('should ignore renewal prices when returning pricing information', async () => {
          const res = await request(app)
            .get(`/v1/marketing/property/${property1.id}`)
            .set({ ...header, 'x-reva-program-email': program2.directEmailIdentifier });

          expect(res.status).to.equal(200);

          const { marketRent } = res.body;
          expect(marketRent.min).to.equal((200).toFixed(2));
          expect(marketRent.max).to.equal((500).toFixed(2));
        });
      });

      describe('when valid /marketing/property/{propertyId} request is made with external calendar information for the team', () => {
        it('should respond with 200 status and the relevant marketing property information', async () => {
          const externalCalendars = { calendarAccount: 'team@externalCalendar.com', teamCalendarId: newId() };
          await updateTeam(ctx, theTeam.id, { externalCalendars });
          await toggleExtCalendarFeature(true);

          const morningHoursEnd = day => day.clone().add(8, 'hours');
          const afternoonStart = day => day.clone().add(17, 'hours');
          const afternoonEnd = day => day.clone().add(23, 'hours').add(59, 'minutes');
          const timezone = theTeam.timeZone;
          const day1 = now({ timezone }).startOf('day');
          const day2 = day1.clone().add(1, 'days');
          const teamLunchEventTime = day2.clone().add(13, 'hours');

          const day3 = day1.clone().add(2, 'days');
          const day4 = day1.clone().add(3, 'days');
          const day5 = day1.clone().add(4, 'days');
          const day6 = day1.clone().add(5, 'days');
          const day7 = day1.clone().add(6, 'days');

          await createTeamEvent({
            teamId: theTeam.id,
            startDate: day1.toISOString(),
            endDate: morningHoursEnd(day1).toISOString(),
          });
          await createTeamEvent({
            teamId: theTeam.id,
            startDate: afternoonStart(day1).toISOString(),
            endDate: afternoonEnd(day1).toISOString(),
          });

          await createTeamEvent({
            teamId: theTeam.id,
            startDate: day2.toISOString(),
            endDate: morningHoursEnd(day2).toISOString(),
          });
          await createTeamEvent({
            teamId: theTeam.id,
            startDate: afternoonStart(day2).toISOString(),
            endDate: afternoonEnd(day2).toISOString(),
          });
          await createTeamEvent({
            teamId: theTeam.id,
            startDate: teamLunchEventTime.toISOString(),
            endDate: teamLunchEventTime.clone().add(1, 'hours').toISOString(),
          });

          await createTeamEvent({
            teamId: theTeam.id,
            startDate: day4.toISOString(),
            endDate: day5.toISOString(),
          });

          await createTeamEvent({
            teamId: theTeam.id,
            startDate: day5.toISOString(),
            endDate: day7.toISOString(),
          });

          await createTeamEvent({
            teamId: theTeam.id,
            startDate: day7.toISOString(),
            endDate: morningHoursEnd(day7).toISOString(),
          });

          const res = await request(app)
            .get(`/v1/marketing/property/${property1.id}?includePOIs=true&includeAmenities=true`)
            .set({ ...header, 'x-reva-program-email': program2.directEmailIdentifier });

          expect(res.status).to.equal(200);

          const propertyMainKeys = [
            ...propertyBaseKeys,
            'numBedrooms',
            'surfaceArea',
            'marketingLayoutGroups',
            'marketRent',
            'phone',
            'email',
            'lifestyles',
            'layoutAmenities',
            'onSiteLeasingTeam',
            'team',
            'propertyAmenities',
            'propertyPointsOfInterest',
            'logoUrl',
            'smsEnabled',
            'officeHours',
            'url',
            'images',
            'videoUrls',
            '3DUrls',
          ];
          const teamKeys = ['timeZone', 'hours', 'calendarHours'];
          expect(res.body).to.have.all.keys(propertyMainKeys);

          const {
            propertyId,
            name,
            displayName,
            slugUrl,
            marketingLayoutGroups,
            marketRent,
            lifestyles,
            phone,
            email,
            propertyAmenities,
            layoutAmenities,
            team,
            onSiteLeasingTeam,
            propertyPointsOfInterest,
            officeHours,
          } = res.body;
          expect(propertyId).to.equal(property1.id);
          expect(name).to.equal(property1.name);
          expect(displayName).to.equal(property1.displayName);
          expect(slugUrl).to.equal(property1.website);
          expect(phone).to.equal(program1.directPhoneIdentifier);
          expect(officeHours).to.equal('');

          const domain = await formatTenantEmailDomain(tenant.name, config.mail.emailDomain);
          expect(email).to.equal(program1.displayEmail || `${program1.directEmailIdentifier}@${domain}`);

          expect(marketRent.min).to.equal((200).toFixed(2));
          expect(marketRent.max).to.equal((500).toFixed(2));

          expect(marketingLayoutGroups.length).to.equal(1);
          expect(marketingLayoutGroups[0]).to.have.all.keys(marketingLayoutGroupsKeys);
          expect(marketingLayoutGroups[0].name).to.equal(marketingGroup1.name);

          expect(lifestyles.length).to.equal(1);
          expect(lifestyles[0]).to.have.all.keys(lifestyleKeys);
          const amenity = lifestyles[0];
          expect(amenity.displayName).to.equal(amenity1.displayName);
          expect(amenity.name).to.equal(amenity1.name);

          expect(propertyAmenities.length).to.equal(1);
          expect(propertyAmenities[0]).to.have.all.keys(amenityKeys);
          expect(propertyAmenities[0].name).to.equal('conference');

          expect(layoutAmenities.length).to.equal(1);
          expect(layoutAmenities[0]).to.have.all.keys(amenityKeys);
          expect(layoutAmenities[0].name).to.equal('firePlace');

          expect(team).to.have.all.keys(teamKeys);
          expect(onSiteLeasingTeam).to.have.all.keys(teamKeys);
          expect(team.timeZone).to.equal(theTeam.timeZone);
          expect(onSiteLeasingTeam.timeZone).to.equal(leasingTeam.timeZone);

          const computedTeamEvents = await computeOfficeHoursFromExternalCalendar(ctx, theTeam);
          expect(Object.keys(team.hours).length).to.equal(7);

          /*
       team.hours { Monday: { endTime: '17:00', startTime: '08:00' },
                   Tuesday: { endTime: '17:00', startTime: '08:00' },
                    Wednesday: { endTime: '23:59', startTime: '00:00' }, office open all day
                     Thursday: { endTime: '00:00', startTime: '00:00' }, office closed
                     Friday: { endTime: '00:00', startTime: '00:00' }, office closed
                       Saturday: { endTime: '00:00', startTime: '00:00' }, office closed
                    Sunday: { endTime: '23:59', startTime: '08:00' } }
         */
          const daylightMar = toMoment('2021-03-14 13:00:00', { timezone });
          const daylightNov = toMoment('2021-11-07 13:00:00', { timezone });

          let day7StartTime = '08:00';
          if (isSameDay(day7, daylightMar, { timezone })) day7StartTime = '09:00';
          if (isSameDay(day7, daylightNov, { timezone })) day7StartTime = '07:00';

          const normalWorkDay = { endTime: '17:00', startTime: '08:00' };
          const allDayOff = { endTime: '00:00', startTime: '00:00' };
          const allDayOpen = { endTime: '23:59', startTime: '00:00' };
          const halfDayOpen = { endTime: '23:59', startTime: day7StartTime };
          expect(team.hours).to.deep.equal(computedTeamEvents);

          const day1Hours = team.hours[day1.format('dddd')];
          const day2Hours = team.hours[day2.format('dddd')];
          const day3Hours = team.hours[day3.format('dddd')];
          const day4Hours = team.hours[day4.format('dddd')];
          const day5Hours = team.hours[day5.format('dddd')];
          const day6Hours = team.hours[day6.format('dddd')];
          const day7Hours = team.hours[day7.format('dddd')];

          expect(onSiteLeasingTeam.hours).to.deep.equal(convertOfficeHours(leasingTeam.officeHours));

          expect(day1Hours).to.deep.equal(normalWorkDay);
          expect(day2Hours).to.deep.equal(normalWorkDay);
          expect(day3Hours).to.deep.equal(allDayOpen);
          expect(day4Hours).to.deep.equal(allDayOff);
          expect(day5Hours).to.deep.equal(allDayOff);
          expect(day6Hours).to.deep.equal(allDayOff);
          expect(day7Hours).to.deep.equal(halfDayOpen);
          expect(propertyPointsOfInterest).to.deep.equal({ poi: {} });
        });
      });
    });
    describe('PUT', () => {
      const propertyMainKeys = [...propertyBaseKeys, 'numBedrooms', 'surfaceArea', 'marketingLayoutGroups', 'marketRent', 'phone', 'email'];

      describe('when a /marketing/properties/search request is made', () => {
        it('should be a protected route', async () => {
          const res = await request(app).post('/v1/marketing/properties/search').send({});

          expect(res.status).to.equal(401);
        });
      });
      describe('when valid /marketing/properties/search request is made', () => {
        describe('when program email is missing', () => {
          it('responds with status code 400 and MISSING_PROGRAM_EMAIL token', async () => {
            const res = await request(app).post('/v1/marketing/properties/search').set(header);

            expect(res.status).to.equal(400);
            expect(res.body.token).to.equal('MISSING_PROGRAM_EMAIL_OR_SESSION_ID');
          });
        });

        describe('when program email does not exist', () => {
          it('responds with status code 404 and PROGRAM_NOT_FOUND token', async () => {
            const res = await request(app)
              .post('/v1/marketing/properties/search')
              .set({ ...header, 'x-reva-program-email': 'wrongemail' });

            expect(res.status).to.equal(404);
            expect(res.body.token).to.equal('PROGRAM_NOT_FOUND');
          });
        });
        describe('when a /marketing/properties/search request is made with filter: city', () => {
          it('should return matching properties', async () => {
            const res = await request(app)
              .post('/v1/marketing/properties/search')
              .set({ ...header, 'x-reva-program-email': program1.directEmailIdentifier })
              .send({ city: property1.settings.marketing.city });

            expect(res.status).to.equal(200);

            const matchingProperties = res.body;
            expect(matchingProperties.length).to.equal(1);
            expect(matchingProperties[0]).to.have.all.keys(propertyMainKeys);

            const { propertyId, name, displayName, slugUrl, marketingLayoutGroups, marketRent, numBedrooms } = matchingProperties[0];
            expect(propertyId).to.equal(property1.id);
            expect(name).to.equal(property1.name);
            expect(displayName).to.equal(property1.displayName);
            expect(slugUrl).to.equal(property1.website);
            expect(numBedrooms).to.deep.equal(['ONE_BED']);

            expect(marketRent.min).to.equal((200).toFixed(2));
            expect(marketRent.max).to.equal((500).toFixed(2));

            expect(marketingLayoutGroups.length).to.equal(1);
            expect(marketingLayoutGroups[0]).to.have.all.keys(marketingLayoutGroupsKeys);
            expect(marketingLayoutGroups[0].name).to.equal(marketingGroup1.name);
          });
        });
        describe('when a /marketing/properties/search request is made with filter: state', () => {
          it('should return matching properties', async () => {
            const res = await request(app)
              .post('/v1/marketing/properties/search')
              .set({ ...header, 'x-reva-program-email': program1.directEmailIdentifier })
              .send({ state: property1.settings.marketing.state });

            expect(res.status).to.equal(200);

            const matchingProperties = res.body;
            expect(matchingProperties.length).to.equal(1);
            expect(matchingProperties[0].propertyId).to.equal(property1.id);
            expect(matchingProperties[0]).to.have.all.keys(propertyMainKeys);
          });
        });
        describe('when a /marketing/properties/search request is made with filter: region', () => {
          it('should return matching properties', async () => {
            const res = await request(app)
              .post('/v1/marketing/properties/search')
              .set({ ...header, 'x-reva-program-email': program1.directEmailIdentifier })
              .send({ region: property1.settings.marketing.region });

            expect(res.status).to.equal(200);

            const matchingProperties = res.body;
            expect(matchingProperties.length).to.equal(1);
            expect(matchingProperties[0].propertyId).to.equal(property1.id);
            expect(matchingProperties[0]).to.have.all.keys(propertyMainKeys);
          });
        });
      });
      describe('when valid /marketing/properties/:propertyId/search request is made', () => {
        it('should return related properties', async () => {
          // creating 4 properties to be used in determining related properties
          // for property2 = neighborhood2, San Francisco, Bay Area, California
          // property4: neighborhood2, SanFrancisco, Bay Area, California - related by neighborhood
          // property5: neighborhood5, SanFrancisco, Bay Area, California - related by city
          // property6: neighborhood6, San Jose , Bay Area, California - related by region
          // property7: neighborhood7, LosAngeles, LalaLand, California - related by state
          const property4 = await createAProperty(
            {
              comms: {},
              integration: { import: { unitPricing: false } },
              marketing: {
                city: 'MK San Francisco',
                tags: ['bridge', 'upstate', 'studio'],
                state: 'MK California',
                region: 'MK Bay Area',
                cityAliases: ['San Fran'],
                neighborhood: 'neighborhood2',
                stateAliases: ['CA', 'California'],
                testimonials: ['i love this place 2'],
                regionAliases: [],
                neighborhoodAliases: [],
                propertyAmenities: [],
                layoutAmenities: [],
                includedInListings: true,
              },
              marketingLocation: {
                addressLine1: 'SanFrancisco AddressLine1',
                addressLine2: '',
                city: 'San Francisco',
                state: 'CA',
                postalCode: '999233',
              },
            },
            {
              name: 'property4',
              addressLine1: 'address property 4',
              city: 'San Francisco',
              postalCode: '13315',
              state: 'CA',
              website: 'www.property4.com',
              geoLocation: { lat: 37.90642, lng: -122.503362 },
            },
            ctx,
          );

          const property5 = await createAProperty(
            {
              comms: {},
              integration: { import: { unitPricing: false } },
              marketing: {
                city: 'MK San Francisco',
                tags: ['bridge', 'upstate', 'studio'],
                state: 'MK California',
                region: 'MK Bay Area',
                cityAliases: ['San Fran'],
                neighborhood: 'neighborhood5',
                stateAliases: ['CA', 'California'],
                testimonials: ['i love this place 2'],
                regionAliases: [],
                neighborhoodAliases: [],
                propertyAmenities: [],
                layoutAmenities: [],
                includedInListings: true,
              },
              marketingLocation: {
                addressLine1: 'SanFrancisco AddressLine1',
                addressLine2: '',
                city: 'San Francisco',
                state: 'CA',
                postalCode: '999233',
              },
            },
            {
              name: 'property5',
              addressLine1: 'address property 5',
              city: 'San Francisco',
              postalCode: '13316',
              state: 'CA',
              website: 'www.property5.com',
              geoLocation: { lat: 37.90642, lng: -122.503362 },
            },
            ctx,
          );

          const property6 = await createAProperty(
            {
              comms: {},
              integration: { import: { unitPricing: false } },
              marketing: {
                city: 'MK San Jose',
                tags: ['bridge', 'upstate', 'studio'],
                state: 'MK California',
                region: 'MK Bay Area',
                cityAliases: ['San Jose'],
                neighborhood: 'neighborhood6',
                stateAliases: ['CA', 'California'],
                testimonials: ['i love this place 2'],
                regionAliases: [],
                neighborhoodAliases: [],
                propertyAmenities: [],
                layoutAmenities: [],
                includedInListings: true,
              },
              marketingLocation: {
                addressLine1: 'SanFrancisco AddressLine1',
                addressLine2: '',
                city: 'San Francisco',
                state: 'CA',
                postalCode: '999233',
              },
            },
            {
              name: 'property6',
              addressLine1: 'address property 6',
              city: 'San Francisco',
              postalCode: '13316',
              state: 'CA',
              website: 'www.property5.com',
              geoLocation: { lat: 37.90642, lng: -122.503362 },
            },
            ctx,
          );

          const property7 = await createAProperty(
            {
              comms: {},
              integration: { import: { unitPricing: false } },
              marketing: {
                city: 'MK Los Angeles',
                tags: ['bridge', 'upstate', 'studio'],
                state: 'MK California',
                region: 'MK LaLaLand',
                address: 'MK address sf',
                cityAliases: ['LA'],
                neighborhood: 'neighborhood7',
                stateAliases: ['CA', 'California'],
                testimonials: ['i love this place 2'],
                regionAliases: [],
                neighborhoodAliases: [],
                propertyAmenities: [],
                layoutAmenities: [],
                includedInListings: true,
              },
              marketingLocation: {
                addressLine1: 'LosAngeles AddressLine1',
                addressLine2: '',
                city: 'LosAngeles',
                state: 'CA',
                postalCode: '999239',
              },
            },
            {
              name: 'property7',
              addressLine1: 'address property 7',
              city: 'Los Angeles',
              postalCode: '13317',
              state: 'CA',
              website: 'www.property7.com',
              geoLocation: { lat: 37.90642, lng: -122.503362 },
            },
            ctx,
          );

          await updateProperty(ctx, { id: property4.id }, { settings: { ...property4.settings, comms: { defaultPropertyProgram: program1.id } } });
          await updateProperty(ctx, { id: property5.id }, { settings: { ...property5.settings, comms: { defaultPropertyProgram: program1.id } } });
          await updateProperty(ctx, { id: property6.id }, { settings: { ...property6.settings, comms: { defaultPropertyProgram: program1.id } } });
          await updateProperty(ctx, { id: property7.id }, { settings: { ...property7.settings, comms: { defaultPropertyProgram: program1.id } } });

          // get properties related to property2
          const res = await request(app)
            .post(`/v1/marketing/properties/${property2.id}/search`)
            .set({ ...header, 'x-reva-program-email': program1.directEmailIdentifier });

          expect(res.status).to.equal(200);
          const relatedProperties = res.body;
          expect(relatedProperties.length).to.equal(3);
          const relatedPropertiesIds = relatedProperties.map(p => p.propertyId);
          expect(relatedPropertiesIds).to.include.members([property4.id, property5.id, property6.id]);

          // get properties related to property7
          const res2 = await request(app)
            .post(`/v1/marketing/properties/${property7.id}/search`)
            .set({ ...header, 'x-reva-program-email': program1.directEmailIdentifier });

          expect(res2.status).to.equal(200);
          const propertiesRelatedToProperty7 = res2.body;
          expect(propertiesRelatedToProperty7.length).to.equal(0);
        });
      });
    });
  });
});
