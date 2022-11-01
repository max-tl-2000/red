/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { createAProperty, createAInventoryGroup, createABuilding } from '../../testUtils/repoHelper';
import { saveUnitsPricingUsingPropertyExternalId, getUnitsPricingByPropertyId } from '../rmsPricingRepo';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import logger from '../../../common/helpers/logger';
import { insertInto } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now } from '../../../common/helpers/moment-utils';
import { RmsPricingEvents } from '../../../common/enums/enums';

const LOREM_IPSUM_JSON = [
  {
    _id: '5a94288a55a29567cda3c7ec',
    index: 0,
    guid: '2af16251-8538-4a22-979f-edd5ce3c17c3',
    isActive: true,
    balance: '$3,070.09',
    picture: 'http://placehold.it/32x32',
    age: 37,
    eyeColor: 'brown',
    name: 'Randolph Butler',
    gender: 'male',
    company: 'STROZEN',
    email: 'randolphbutler@strozen.com',
    phone: '+1 (857) 534-3551',
    address: '251 Bay Street, Kirk, Minnesota, 7566',
    about:
      'Velit eu in aliqua et. Pariatur nostrud dolore ut minim dolore incididunt reprehenderit dolore. Laborum ad occaecat labore dolore ut ullamco irure Lorem irure nisi duis incididunt mollit non. Sunt esse velit quis reprehenderit elit mollit veniam consectetur id eiusmod tempor excepteur nostrud cupidatat.\r\n',
    registered: '2016-02-21T09:19:04 +06:00',
    latitude: -42.163833,
    longitude: 42.844786,
    tags: ['cupidatat', 'qui', 'qui', 'irure', 'nisi', 'consequat', 'id'],
    friends: [
      {
        id: 0,
        name: 'Castillo Yates',
      },
      {
        id: 1,
        name: 'Ronda Potter',
      },
      {
        id: 2,
        name: 'Karin Osborne',
      },
    ],
    greeting: 'Hello, Randolph Butler! You have 4 unread messages.',
    favoriteFruit: 'strawberry',
  },
  {
    _id: '5a94288a3d5463e18854ce18',
    index: 1,
    guid: 'e5138818-b792-41a9-8943-fbd816b5a947',
    isActive: true,
    balance: '$2,960.75',
    picture: 'http://placehold.it/32x32',
    age: 22,
    eyeColor: 'blue',
    name: 'Doris Burris',
    gender: 'female',
    company: 'LIQUICOM',
    email: 'dorisburris@liquicom.com',
    phone: '+1 (811) 476-3485',
    address: '356 Bond Street, Haena, Oklahoma, 8467',
    about:
      'Occaecat eiusmod do ex ullamco nisi qui est pariatur. Nulla esse nostrud adipisicing dolore. Aliqua ullamco sint culpa elit est consectetur ut officia dolore minim tempor ipsum. Nulla et sunt occaecat commodo magna.\r\n',
    registered: '2015-08-11T09:36:10 +06:00',
    latitude: 89.863378,
    longitude: 141.775806,
    tags: ['magna', 'nisi', 'commodo', 'id', 'sint', 'aliquip', 'in'],
    friends: [
      {
        id: 0,
        name: 'Verna Calderon',
      },
      {
        id: 1,
        name: 'Brennan Guthrie',
      },
      {
        id: 2,
        name: 'Ivy Tyson',
      },
    ],
    greeting: 'Hello, Doris Burris! You have 3 unread messages.',
    favoriteFruit: 'apple',
  },
  {
    _id: '5a94288a92bc8ed9bf95f2f2',
    index: 2,
    guid: '985feafc-74ac-4624-a2bf-03226800eeec',
    isActive: true,
    balance: '$1,752.00',
    picture: 'http://placehold.it/32x32',
    age: 23,
    eyeColor: 'brown',
    name: 'Lynn Welch',
    gender: 'male',
    company: 'MAXIMIND',
    email: 'lynnwelch@maximind.com',
    phone: '+1 (866) 502-2546',
    address: '862 Herkimer Street, Wells, Nevada, 443',
    about:
      'Fugiat culpa commodo minim quis ipsum occaecat in labore proident. Laboris aute nisi ad minim elit exercitation. Aliquip quis duis esse proident reprehenderit exercitation. Cillum duis sunt adipisicing excepteur culpa eu amet cupidatat id.\r\n',
    registered: '2015-12-01T03:05:01 +06:00',
    latitude: -61.044467,
    longitude: 139.098124,
    tags: ['do', 'sint', 'sunt', 'fugiat', 'nisi', 'voluptate', 'mollit'],
    friends: [
      {
        id: 0,
        name: 'Harrison Baker',
      },
      {
        id: 1,
        name: 'Bates Garza',
      },
      {
        id: 2,
        name: 'Theresa Underwood',
      },
    ],
    greeting: 'Hello, Lynn Welch! You have 5 unread messages.',
    favoriteFruit: 'strawberry',
  },
  {
    _id: '5a94288a92e4cd697c8dd9e8',
    index: 3,
    guid: '216a4a37-2314-4dac-b3e2-827531630fdc',
    isActive: false,
    balance: '$2,503.00',
    picture: 'http://placehold.it/32x32',
    age: 22,
    eyeColor: 'brown',
    name: 'Tammi Nielsen',
    gender: 'female',
    company: 'PLASTO',
    email: 'tamminielsen@plasto.com',
    phone: '+1 (897) 409-2055',
    address: '608 Allen Avenue, Chical, Connecticut, 2109',
    about:
      'Proident culpa ipsum adipisicing Lorem adipisicing cillum laborum nulla mollit. Incididunt cillum id pariatur qui officia id excepteur sint. Esse fugiat dolore nulla occaecat ad adipisicing aute incididunt ullamco officia ea ex enim. Aute incididunt excepteur Lorem ipsum eiusmod.\r\n',
    registered: '2015-05-23T04:15:29 +06:00',
    latitude: -27.593059,
    longitude: 4.443433,
    tags: ['consectetur', 'non', 'est', 'pariatur', 'cupidatat', 'irure', 'proident'],
    friends: [
      {
        id: 0,
        name: 'Glass Colon',
      },
      {
        id: 1,
        name: 'Payne Peck',
      },
      {
        id: 2,
        name: 'Clayton Delacruz',
      },
    ],
    greeting: 'Hello, Tammi Nielsen! You have 1 unread messages.',
    favoriteFruit: 'apple',
  },
  {
    _id: '5a94288a4809ef800d2d8f8d',
    index: 4,
    guid: '9c0e1f98-7ee6-4841-b1a0-11553d2efdc5',
    isActive: true,
    balance: '$2,817.06',
    picture: 'http://placehold.it/32x32',
    age: 32,
    eyeColor: 'brown',
    name: 'Kim Weaver',
    gender: 'male',
    company: 'ZILIDIUM',
    email: 'kimweaver@zilidium.com',
    phone: '+1 (933) 573-2355',
    address: '209 Vista Place, Dragoon, Marshall Islands, 2028',
    about:
      'Mollit aliqua sunt proident cupidatat occaecat ullamco et aliqua fugiat. Laborum ex commodo consectetur et deserunt exercitation aliquip excepteur labore tempor adipisicing. Qui adipisicing officia laboris laboris occaecat sint esse. Incididunt fugiat adipisicing fugiat ipsum ullamco consectetur ea duis esse. Aliquip eu elit ea enim mollit velit qui anim ad excepteur laboris reprehenderit laborum. Mollit eiusmod nulla ullamco ullamco labore occaecat esse.\r\n',
    registered: '2014-01-04T04:58:45 +06:00',
    latitude: 63.349222,
    longitude: -70.956809,
    tags: ['non', 'eiusmod', 'enim', 'ut', 'Lorem', 'sunt', 'quis'],
    friends: [
      {
        id: 0,
        name: 'Ashley Hawkins',
      },
      {
        id: 1,
        name: 'Shaw Jimenez',
      },
      {
        id: 2,
        name: 'Deanna Mcclain',
      },
    ],
    greeting: 'Hello, Kim Weaver! You have 3 unread messages.',
    favoriteFruit: 'strawberry',
  },
];

const INVENTORY_TABLE = 'Inventory';

describe('calling saveUnitsPricing', () => {
  const ctx = { tenantId: tenant.id };
  const tenSeconds = 10000;
  const unitsLength = 1000;
  let unitsPricing;
  let propertyId;
  let testCount = 0;
  const propertyExternalId = 'COVE';

  const createUnit = ({ building, externalId, rmsExternalId, inventoryGroupId }) => ({
    propertyId: building.propertyId,
    buildingId: building.id,
    inventoryGroupId,
    type: DALTypes.InventoryType.UNIT,
    name: `test inventory ${newId()}`,
    state: DALTypes.InventoryState.VACANT_READY,
    externalId,
    rmsExternalId,
  });

  const createUnits = async (building, length = 1000) => {
    const unitsToInsert = [];
    const { id: inventoryGroupId } = await createAInventoryGroup({});

    for (let i = 0; i < length; i++) {
      unitsToInsert.push(createUnit({ building, externalId: i.toString(), rmsExternalId: i.toString(), inventoryGroupId }));
    }

    return await insertInto(ctx, INVENTORY_TABLE, unitsToInsert);
  };

  const createUnitsPricing = units =>
    units.map(unit => ({
      externalId: unit.externalId,
      availDate: now(),
      status: '',
      amenityValue: 0,
      rmsProvider: 'LRO',
      fileName: 'LRO.xml',
      rentMatrix: LOREM_IPSUM_JSON,
      standardLeaseLength: 12,
      standardRent: 4000,
      minRentLeaseLength: 12,
      minRentStartDate: now(),
      minRentEndDate: now(),
      minRent: 4000,
    }));

  beforeEach(async () => {
    testCount++;
    const property = await createAProperty({ integration: { import: { unitPricing: true } } }, { rmsExternalId: `${propertyExternalId}_${testCount}` });
    propertyId = property.id;
    const building = await createABuilding({ propertyId });
    const units = await createUnits(building, unitsLength);
    unitsPricing = createUnitsPricing(units);
  });

  describe('given one thousand units to insert', () => {
    describe('having an empty RmsPricing table', () => {
      it('should insert one thousand rows in less than ten seconds', async () => {
        const startTime = now();
        logger.info(`saveUnitsPricing startTime: ${startTime}`);

        await saveUnitsPricingUsingPropertyExternalId(ctx, {
          unitsPricing,
          propertyExternalId: `${propertyExternalId}_${testCount}`,
          rmsPricingEvent: RmsPricingEvents.EXTERNAL_RMS_IMPORT,
        });

        const endTime = now();
        logger.info(`saveUnitsPricing endTime: ${endTime}`);
        logger.info(`The saveUnitsPricing function took: ${endTime - startTime} milliseconds`);

        const propertyUnitsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);

        expect(propertyUnitsPricing.length).to.equal(unitsLength);

        expect(endTime - startTime).to.be.below(tenSeconds);
      });
    });

    describe('having one thousand units pricing of the same property in the RmsPricing table', () => {
      it('should delete and insert one thousand rows in less than ten seconds', async () => {
        await saveUnitsPricingUsingPropertyExternalId(ctx, {
          unitsPricing,
          propertyExternalId: `${propertyExternalId}_${testCount}`,
          rmsPricingEvent: RmsPricingEvents.EXTERNAL_RMS_IMPORT,
        });

        const existingUnitsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);
        expect(existingUnitsPricing.length).to.equal(unitsLength);

        const startTime = now();
        logger.info(`saveUnitsPricing startTime: ${startTime}`);

        await saveUnitsPricingUsingPropertyExternalId(ctx, {
          unitsPricing,
          propertyExternalId: `${propertyExternalId}_${testCount}`,
          rmsPricingEvent: RmsPricingEvents.EXTERNAL_RMS_IMPORT,
        });

        const endTime = now();
        logger.info(`saveUnitsPricing endTime: ${endTime}`);
        logger.info(`The saveUnitsPricing function took: ${endTime - startTime} milliseconds`);

        const newUnitsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);

        expect(newUnitsPricing.length).to.equal(unitsLength);

        expect(endTime - startTime).to.be.below(tenSeconds);
      });
    });
  });
});
