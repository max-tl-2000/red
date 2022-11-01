/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { LA_TIMEZONE } from '../../../../common/date-constants';

const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

chai.use(chaiAsPromised);
chai.config.truncateThreshold = 0;

const tenantInfo = {
  metadata: { backendIntegration: { name: 'MRI' } },
};

const insertAmenities = {
  '80SF': {
    propertyId: 'YYY',
    name: '80SF',
    displayName: '80 Square Feet',
    absolutePrice: '321',
    externalId: '80SF',
    category: 'inventory',
    description: '',
    hidden: true,
    highValue: false,
    infographicName: null,
    order: 0,
    relativePrice: null,
    subCategory: 'import',
    targetUnit: false,
  },
  '80SF_15': {
    propertyId: 'YYY',
    name: '80SF_15',
    displayName: '80 Square Feet',
    absolutePrice: '15',
    externalId: '80SF',
    category: 'inventory',
    description: '',
    hidden: true,
    highValue: false,
    infographicName: null,
    order: 0,
    relativePrice: null,
    subCategory: 'import',
    targetUnit: false,
  },
  '80SF_321': {
    propertyId: 'YYY',
    name: '80SF_321',
    displayName: '80 Square Feet',
    absolutePrice: '321',
    externalId: '80SF',
    category: 'inventory',
    description: '',
    hidden: true,
    highValue: false,
    infographicName: null,
    order: 0,
    relativePrice: null,
    subCategory: 'import',
    targetUnit: false,
  },
  DW: {
    propertyId: 'YYY',
    name: 'DW',
    displayName: 'Diswasher',
    absolutePrice: '88',
    externalId: 'DW',
    category: 'inventory',
    description: '',
    hidden: true,
    highValue: false,
    infographicName: null,
    order: 0,
    relativePrice: null,
    subCategory: 'import',
    targetUnit: false,
  },
};

const DBinventories = [
  {
    created_at: '2021-01-21T21:22:30Z',
    updated_at: '2021-01-21T21:22:30Z',
    id: newId(),
    name: '101',
    propertyId: 'YYY',
    multipleItemTotal: null,
    description: 'Garage',
    type: 'parking',
    floor: null,
    layoutId: null,
    inventoryGroupId: '7e0be3a9-4396-4178-b4c0-fdd5a3f1d0d6',
    BuildingId: null,
    parentInventory: null,
    state: 'vacantReady',
    stateStartDate: '2021-01-21T06:00:00Z',
    externalId: 'GAR-580-011',
    address: '',
    rmsExternalId: '',
    availabilityDate: null,
    inactive: false,
  },
  {
    created_at: '2021-01-21T21:22:30Z',
    updated_at: '2021-01-21T21:22:30Z',
    id: newId(),
    name: '102',
    propertyId: 'YYY',
    multipleItemTotal: null,
    description: 'Garage',
    type: 'parking',
    floor: null,
    layoutId: null,
    inventoryGroupId: '7e0be3a9-4396-4178-b4c0-fdd5a3f1d0d6',
    BuildingId: null,
    parentInventory: null,
    state: 'vacantReady',
    stateStartDate: '2021-01-21T06:00:00Z',
    externalId: 'GAR-580-011',
    address: '',
    rmsExternalId: '',
    availabilityDate: null,
    inactive: false,
  },
];

const DBamenity = [
  {
    created_at: '2021-01-22T15:26:06Z',
    updated_at: '2021-01-22T15:26:06Z',
    id: 'aab25b9d-449a-4f78-9108-6b8c5922d977',
    name: '80SF_321',
    category: 'inventory',
    subCategory: 'import',
    description: '',
    hidden: true,
    propertyId: 'YYY',
    displayName: '80 Square Feet',
    highValue: false,
    relativePrice: null,
    absolutePrice: 321.0,
    targetUnit: false,
    infographicName: null,
    order: 0,
    externalId: '80SF',
    endDate: null,
  },
  {
    created_at: '2021-01-22T15:26:06Z',
    updated_at: '2021-01-22T15:26:06Z',
    id: 'aab25b9d-449a-4f78-9108-6b8c5922d977',
    name: '80SF_15',
    category: 'inventory',
    subCategory: 'import',
    description: '',
    hidden: true,
    propertyId: 'YYY',
    displayName: '80 Square Feet',
    highValue: false,
    relativePrice: null,
    absolutePrice: 15.0,
    targetUnit: false,
    infographicName: null,
    order: 0,
    externalId: '80SF',
    endDate: null,
  },
  {
    created_at: '2021-01-22T15:26:06Z',
    updated_at: '2021-01-22T15:26:06Z',
    id: 'aab25b9d-449a-4f78-9108-6b8c5922d977',
    name: '80SF',
    category: 'inventory',
    subCategory: 'import',
    description: '',
    hidden: true,
    propertyId: 'YYY',
    displayName: '80 Square Feet',
    highValue: false,
    relativePrice: null,
    absolutePrice: 321.0,
    targetUnit: false,
    infographicName: null,
    order: 0,
    externalId: '80SF',
    endDate: null,
  },
  {
    created_at: '2021-01-22T15:26:06Z',
    updated_at: '2021-01-22T15:26:06Z',
    id: 'aab25b9d-449a-4f78-9108-6b8c5922d977',
    name: 'DW',
    category: 'inventory',
    subCategory: 'import',
    description: '',
    hidden: true,
    propertyId: 'YYY',
    displayName: 'Diswasher',
    highValue: false,
    relativePrice: null,
    absolutePrice: 321.0,
    targetUnit: false,
    infographicName: null,
    order: 0,
    externalId: 'DW',
    endDate: null,
  },
  {
    created_at: '2021-01-22T15:26:06Z',
    updated_at: '2021-01-22T15:26:06Z',
    id: 'aab25b9d-449a-4f78-9108-6b8c5922d977',
    name: 'PAT',
    category: 'inventory',
    subCategory: 'import',
    description: '',
    hidden: true,
    propertyId: 'YYY',
    displayName: 'Patio',
    highValue: false,
    relativePrice: null,
    absolutePrice: 25.0,
    targetUnit: false,
    infographicName: null,
    order: 0,
    externalId: 'PAT',
    endDate: '2021-01-22T15:26:06Z',
  },
];

const { expect } = chai;
const property = [
  {
    id: 'YYY',
    timezone: LA_TIMEZONE,
    settings: { integration: { import: { amenities: true } } },
  },
];
describe('updateAmenityAndInventoryAmenity', () => {
  const tenantId = newId();
  let updateAmenityAndInventoryAmenity;

  const updateAmenities = {
    '80SF': {
      created_at: '2021-01-22T15:26:06Z',
      updated_at: '2021-01-22T15:26:06Z',
      id: 'aab25b9d-449a-4f78-9108-6b8c5922d977',
      name: '80SF',
      category: 'inventory',
      subCategory: 'import',
      description: '',
      hidden: true,
      propertyId: 'YYY',
      displayName: '80 Square Feet',
      highValue: false,
      relativePrice: null,
      absolutePrice: '321',
      targetUnit: false,
      infographicName: null,
      order: 0,
      externalId: '80SF',
      endDate: null,
    },
    PAT: {
      created_at: '2021-01-22T15:26:06Z',
      updated_at: '2021-01-22T15:26:06Z',
      id: 'aab25b9d-449a-4f78-9108-6b8c5922d977',
      name: 'PAT',
      category: 'inventory',
      subCategory: 'import',
      description: '',
      hidden: true,
      propertyId: 'YYY',
      displayName: 'Patio',
      highValue: false,
      relativePrice: null,
      absolutePrice: '25',
      targetUnit: false,
      infographicName: null,
      order: 0,
      externalId: 'PAT',
      endDate: null,
    },
  };

  const actual = [
    ['11500', '1', '101', '80SF', '80 Square Feet', '321', '04/30/2015', '11500-01-101', '80SF'],
    ['11500', '1', '102', '80SF', '80 Square Feet', '321', '04/30/2015', '11500-01-102', '80SF'],
  ];
  const actualV2 = [
    ['11500', '1', '101', '80SF', '80 Square Feet', '321', '04/30/2015', '11500-01-101', '80SF'],
    ['11500', '1', '102', '80SF', '80 Square Feet', '15', '04/30/2015', '11500-01-102', '80SF'],
  ];
  const fileV3 = [
    ['11500', '1', '101', 'DW', 'Diswasher', '88', '04/30/2015', '11500-01-101', 'DW'],
    ['11500', '1', '102', '80SF', '80 Square Feet', '321', '04/30/2015', '11500-01-102', '80SF'],
  ];

  const fileV4 = [['11500', '1', '101', 'PAT', 'Patio', '25', '04/30/2015', '11500-01-101', 'PAT']];

  const headers = ['propertyExternalId', 'building', 'unitId', 'amenityName', 'description', 'amount', 'changeDate', 'externalId', 'amenityExternalId'];

  const defaultMocks = () => ({
    getInventoryByExternalId: jest.fn(),
    getPropertyByInventoryAmenity: jest.fn(),
    updateAmenitiesEndDate: jest.fn(),
    getPropertyByName: jest.fn(() => property[0]),
    getProperties: jest.fn(() => property),
    getAllInventoryAmenities: jest.fn().mockReturnValueOnce([]).mockReturnValueOnce(DBamenity),
    bulkUpsertAmenityFromUpdate: jest.fn(() => []),
    saveAmenity: jest.fn(),
    getAllActiveInventoryAmenities: jest.fn(() => []),
    getInventoryByInventoryNamePropertyIdAndBuildingName: jest.fn().mockReturnValueOnce(DBinventories[0]).mockReturnValueOnce(DBinventories[1]),
    saveInventoryAmenity: jest.fn(),
    updateInventory: jest.fn(),
    bulkUpsertInventories: jest.fn(),
    getTenantData: jest.fn(() => tenantInfo),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../../dal/amenityRepo': {
        getAllActiveInventoryAmenities: mocks.getAllActiveInventoryAmenities,
        getAllInventoryAmenities: mocks.getAllInventoryAmenities,
        bulkUpsertAmenityFromUpdate: mocks.bulkUpsertAmenityFromUpdate,
        saveAmenity: mocks.saveAmenity,
        getPropertyByInventoryAmenity: mocks.getPropertyByInventoryAmenity,
        saveInventoryAmenity: mocks.saveInventoryAmenity,
        updateAmenitiesEndDate: mocks.updateAmenitiesEndDate,
      },
      '../../../dal/inventoryRepo': {
        getInventoryByInventoryNamePropertyIdAndBuildingName: mocks.getInventoryByInventoryNamePropertyIdAndBuildingName,
        getInventoryByExternalId: mocks.getInventoryByExternalId,
        updateInventory: mocks.updateInventory,
        getInventoriesByExternalId: mocks.getInventoriesByExternalId,
        getInventoriesByComputedExternalId: mocks.getInventoriesByComputedExternalId,
        bulkUpsertInventories: mocks.bulkUpsertInventories,
      },
      '../../../dal/propertyRepo': {
        getPropertyByName: mocks.getPropertyByName,
        getProperties: mocks.getProperties,
      },
      '../../../dal/tenantsRepo': {
        getTenantData: mocks.getTenantData,
      },
    });
    const updatesHandler = require('../updateAmenityAndInventoryAmenity'); // eslint-disable-line global-require
    updateAmenityAndInventoryAmenity = updatesHandler.updateAmenityAndInventoryAmenity;
  };

  let mocks;

  it('should call saveAmenity one time and saveInventoryAmenity two times when passing the same amenity to two inventories', async () => {
    mocks = defaultMocks();
    setupMocks(mocks);

    await updateAmenityAndInventoryAmenity({ tenantId }, actual, null, headers);
    expect(mocks.saveAmenity.mock.calls.length).to.equal(1);
    expect(mocks.saveAmenity.mock.calls[0][1]).to.eql({
      ...insertAmenities['80SF'],
    });
    expect(mocks.saveInventoryAmenity.mock.calls.length).to.equal(2);
  });

  it('should call saveAmenity two time and saveInventoryAmenity two times when passing different amenities to inventories', async () => {
    mocks = defaultMocks();
    setupMocks(mocks);

    await updateAmenityAndInventoryAmenity({ tenantId }, fileV3, null, headers);
    expect(mocks.saveAmenity.mock.calls.length).to.equal(2);
    expect(mocks.saveAmenity.mock.calls[0][1]).to.eql({
      ...insertAmenities.DW,
    });
    expect(mocks.saveAmenity.mock.calls[1][1]).to.eql({
      ...insertAmenities['80SF'],
    });
    expect(mocks.saveInventoryAmenity.mock.calls.length).to.equal(2);
  });

  it('should call saveAmenity two times and saveInventoryAmenity two times when passing the same amenity with different amounts to two inventories', async () => {
    mocks = defaultMocks();
    setupMocks(mocks);

    await updateAmenityAndInventoryAmenity({ tenantId }, actualV2, null, headers);
    expect(mocks.saveAmenity.mock.calls.length).to.equal(2);
    expect(mocks.saveAmenity.mock.calls[0][1]).to.eql({
      ...insertAmenities['80SF_321'],
    });
    expect(mocks.saveAmenity.mock.calls[1][1]).to.eql({
      ...insertAmenities['80SF_15'],
    });
    expect(mocks.saveInventoryAmenity.mock.calls.length).to.equal(2);
  });
  it('should call bulkUpsertAmenityFromUpdate one time when updating one amenity', async () => {
    mocks = defaultMocks();
    mocks.getAllInventoryAmenities = jest.fn().mockReturnValueOnce(DBamenity).mockReturnValueOnce(DBamenity);
    setupMocks(mocks);
    await updateAmenityAndInventoryAmenity({ tenantId }, actual, null, headers);
    expect(mocks.bulkUpsertAmenityFromUpdate.mock.calls.length).to.equal(1);
    expect(mocks.bulkUpsertAmenityFromUpdate.mock.calls[0][1][0]).to.eql({
      ...updateAmenities['80SF'],
    });
    expect(mocks.saveInventoryAmenity.mock.calls.length).to.equal(2);
  });

  it('should call updateAmenitiesEndDate two times when updating one amenity that was disable', async () => {
    mocks = defaultMocks();
    mocks.getAllInventoryAmenities = jest.fn().mockReturnValueOnce(DBamenity).mockReturnValueOnce(DBamenity);
    setupMocks(mocks);
    await updateAmenityAndInventoryAmenity({ tenantId }, fileV4, null, headers);
    expect(mocks.updateAmenitiesEndDate.mock.calls.length).to.equal(2);
    expect(mocks.bulkUpsertAmenityFromUpdate.mock.calls[0][1][0]).to.eql({
      ...updateAmenities.PAT,
    });
  });
});
