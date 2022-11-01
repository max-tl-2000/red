/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { Promise, mapSeries } from 'bluebird';
import chunk from 'lodash/chunk';
import get from 'lodash/get';
import { UTC_TIMEZONE } from '../../../common/date-constants';
import { now } from '../../../common/helpers/moment-utils';

import {
  getInventoriesByFilters,
  bulkUpsertInventoriesFromImport,
  updateInventoriesWithParents,
  clearParentInventories,
  getInventoriesStateAndStateStartDate,
} from '../../dal/inventoryRepo';
import { getBuildings } from '../../dal/buildingRepo';
import {
  getAmenitiesByEachProperty,
  bulkUpsertInventoriesAmenitiesFromImport,
  updateInventoryAmenitiesEndDate,
  getAllActiveInventoryAmenitiesHashMapGroupedByInventoryId,
} from '../../dal/amenityRepo';
import { getProperties, getPropertiesWithAmenityImportEnabled } from '../../dal/propertyRepo';
import { getLayouts } from '../../dal/layoutRepo';
import { getInventoryGroups } from '../../dal/inventoryGroupRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { validate, Validation, splitBySymbol, getValueFromEnum, getValueToPersist, checkEmptyAmenities } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { validateAmenitiesForInventories } from '../../services/amenities';
import { SheetImportError } from '../../common/errors';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { getStateStartDate, prepareDataToInsert, validInventoriesWithIdSaved } from '../helpers/inventory';
import logger from '../../../common/helpers/logger';
import nullish from '../../../common/helpers/nullish';

export const PARENT_NAME = 'parentInventory';
export const INVENTORY_NAME = 'name';
export const INVALID_PARENT_NAME = 'INVALID_PARENT_NAME_FOR_INVENTORY';
export const FLOOR_NUMBER = 'floorNumber';
export const INVALID_FLOOR_NUMBER = 'INVALID_FLOOR_NUMBER_FOR_INVENTORY';
export const AMBIGUOUS_NAME_PARENT_INVENTORY = 'AMBIGUOUS_INVENTORY_NAME_ADD_BUILDING_NAME';

const INVENTORY_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.INVENTORY_NAME],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'building',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'multipleItemTotal',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'type',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.InventoryType,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'parentInventory',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'floor',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'layout',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inventoryGroup',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'externalId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'rmsExternalId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
];

export const numberOfMatchingInventories = (inventoryName, propertyName, inventories) => {
  const propertyLc = propertyName ? propertyName.toLowerCase() : '';

  const matchingInventories = inventories.filter(
    inventory => inventory.data.name.toString() === inventoryName.toString() && inventory.data.property.toString().toLowerCase() === propertyLc,
  );
  return matchingInventories.length;
};

const isValidBuildingInProperty = (buildingName, propertyId, buildings) => {
  const building = buildings.find(b => b.name === buildingName && b.propertyId === propertyId);
  return !!building;
};

export const validateParentInventory = async (ctx, inventory, inventories, buildings) => {
  if (inventory.parentInventory === '') return [];

  const { parentInventory } = inventory;
  const parentInventoryNameArray = splitBySymbol(parentInventory, '-');

  const invalidMsg = [
    {
      name: PARENT_NAME,
      message: INVALID_PARENT_NAME,
    },
  ];

  if (parentInventoryNameArray.length > 2) {
    logger.warn({ ctx, inventory, parentInventoryNameArray }, 'INVALID found more than 2 parents');
    return invalidMsg;
  }

  if (parentInventoryNameArray.length === 2) {
    const isValidBuilding = isValidBuildingInProperty(parentInventoryNameArray[0], inventory.propertyId, buildings);
    const nameMatches = numberOfMatchingInventories(parentInventoryNameArray[1], inventory.property, inventories);

    if (!isValidBuilding || !nameMatches) {
      logger.warn({ ctx, inventory, parentInventoryNameArray }, 'INVALID parent building or property');
      return invalidMsg;
    }
  }

  if (parentInventoryNameArray.length === 1) {
    const nameMatches = numberOfMatchingInventories(parentInventoryNameArray[0], inventory.property, inventories);

    if (nameMatches > 1) {
      logger.warn({ ctx, inventory, parentInventoryNameArray }, 'Ambiguous name for inventory');
      return [{ name: PARENT_NAME, message: AMBIGUOUS_NAME_PARENT_INVENTORY }];
    }

    if (!nameMatches) {
      return invalidMsg;
    }
  }

  return [];
};

const hasBackEndSet = tenant => get(tenant, 'metadata.backendIntegration.name');
// If inventoryState is set it means it gets the state from MRI/YARDI backend instead
const skipInventoryState = (tenant, integrationSettings = {}) => {
  const inventoryStateFlag = integrationSettings.import?.inventoryState;
  return hasBackEndSet(tenant) && (inventoryStateFlag || nullish(inventoryStateFlag));
};

/**
 *  Errors throw in this function mean that an inventory matching the filters
 *  was inserted after the full validation was done in a different process.
 */
const parentInventoryHasBuildingAndInventoryName = parentInventoryNameArray => parentInventoryNameArray.length === 2;
const parentInventoryOnlyHasInventoryName = parentInventoryNameArray => parentInventoryNameArray.length === 1;

const getParentInventories = async (ctx, inventory, inventoryNameFromParent, dbInventories, building) => {
  const filters = {
    propertyId: inventory.propertyId,
    name: inventoryNameFromParent,
  };
  if (building) filters.buildingId = building.id;

  const parentInventories = dbInventories.filter(
    i => i.propertyId === inventory.propertyId && i.name === inventoryNameFromParent && (!building || i.buildingId === building.id),
  );

  if (parentInventories.length === 0) {
    const buildingMessage = building ? `from building '${building.name}'` : '';
    const message = `The parent inventory '${inventory.name}' ${buildingMessage} does not exist`;

    logger.warn({ ctx, inventory, filters }, message);
    throw new SheetImportError({ message });
  } else if (parentInventories.length > 1) {
    const buildingMessage = building ? `from building '${building.name}'` : '';
    const message = `There are ${parentInventories.length} records for the parent inventory '${inventory.name}' ${buildingMessage}`;

    logger.warn({ ctx, inventory, filters }, message);
    throw new SheetImportError({ message });
  }

  return parentInventories[0];
};

const getValidParentInventory = async (ctx, inventory, buildings, dbInventories) => {
  let validParentInventory;

  const parentInventoryNameArray = splitBySymbol(inventory.parentInventory, '-');

  if (parentInventoryHasBuildingAndInventoryName(parentInventoryNameArray)) {
    const [buildingName, parentInventoryName] = parentInventoryNameArray;
    const buildingFromParentInventory = buildings.find(b => b.name === buildingName && b.propertyId === inventory.propertyId);

    validParentInventory = await getParentInventories(ctx, inventory, parentInventoryName, dbInventories, buildingFromParentInventory);
  }

  if (parentInventoryOnlyHasInventoryName(parentInventoryNameArray)) {
    const [parentInventoryName] = parentInventoryNameArray;
    validParentInventory = await getParentInventories(ctx, inventory, parentInventoryName, dbInventories);
  }

  return validParentInventory;
};

const setParentInventories = async (ctx, allInventories) => {
  const inventories = allInventories.filter(({ data: inventory }) => inventory.parentInventory);
  if (inventories.length === 0) return [];

  const buildings = await getBuildings(ctx);
  const dbInventories = await getInventoriesByFilters(ctx, {});

  const { inventoriesToUpdate, invalidParentInventories } = await Promise.reduce(
    inventories,
    async (acc, { index, data: inventory }) => {
      const invalidParentInventory = await validateParentInventory(ctx, inventory, allInventories, buildings);
      if (invalidParentInventory.length) {
        acc.invalidParentInventories.push({
          index,
          invalidFields: invalidParentInventory,
        });
        return acc;
      }

      const validParentInventory = await getValidParentInventory(ctx, inventory, buildings, dbInventories);

      acc.inventoriesToUpdate.push({
        id: inventory.id,
        parentInventory: validParentInventory.id,
      });

      return acc;
    },
    { inventoriesToUpdate: [], invalidParentInventories: [] },
  );

  await updateInventoriesWithParents(ctx, inventoriesToUpdate);

  return invalidParentInventories;
};

const buildAmenitiesWithNameProperty = amenities =>
  amenities.map(amenity => {
    const [id, name] = amenity.split(',');
    return {
      id,
      name,
    };
  });

const buildPropertyObjectWithAmenities = async ctx => {
  const amenitiesByProperty = await getAmenitiesByEachProperty(ctx);
  return amenitiesByProperty.reduce((acc, item) => {
    acc[item.propertyId] = buildAmenitiesWithNameProperty(item.amenities);
    return acc;
  }, {});
};

const getMissingDBInventoryAmenities = (DBinventoryAmenities, inventoryId, amenitiesId = []) =>
  DBinventoryAmenities?.[inventoryId]?.filter(x => !amenitiesId?.length || !amenitiesId.includes(x.amenityId)) || [];

const updateInventoriesWithValidAmenities = async (ctx, validInventories) => {
  const amenitiesByProperty = await buildPropertyObjectWithAmenities(ctx);
  const DBinventoryAmenities = await getAllActiveInventoryAmenitiesHashMapGroupedByInventoryId(ctx);
  const propertiesWithImportSettingValue = await getPropertiesWithAmenityImportEnabled(ctx, true);

  const inventoriesWithAmenities = mapSeries(validInventories, async ({ index, data: inventory }) => {
    const result = validateAmenitiesForInventories(inventory, amenitiesByProperty);
    let validAmenities = result?.elements;
    let invalidFields = result?.error;
    let missingInventoryAmenities = [];
    const emptyAmenitiesValidationError = checkEmptyAmenities(inventory, propertiesWithImportSettingValue);
    if (emptyAmenitiesValidationError) {
      validAmenities = [];
      invalidFields = emptyAmenitiesValidationError;
    }

    if (!result?.invalidElements?.length) {
      missingInventoryAmenities = getMissingDBInventoryAmenities(DBinventoryAmenities, inventory.id, result.elements)?.map(ia => ia.inventoryAmenityId) || [];
    }

    return {
      inventory: {
        ...inventory,
        validAmenities,
      },
      missingInventoryAmenities,
      error: {
        index,
        invalidFields,
      },
    };
  });

  return inventoriesWithAmenities.reduce(
    (acc, inventory) => {
      if (inventory.missingInventoryAmenities.length) {
        inventory.missingInventoryAmenities.forEach(missingInventoryAmenityId => acc.missingInventoryAmenities.push(missingInventoryAmenityId));
      }
      if (inventory.inventory.validAmenities) acc.inventories.push({ id: inventory.inventory.id, validAmenities: inventory.inventory.validAmenities });
      if (inventory.error.invalidFields.length > 0) acc.errors.push(inventory.error);
      return acc;
    },
    { inventories: [], errors: [], missingInventoryAmenities: [] },
  );
};

const inventoryAmenityBulkInsertSize = 1000;

const updateInventoryAmenitiesEndDateByInventoryAmenityId = async (ctx, inventoriesAmenities) => {
  if (!inventoriesAmenities?.length) return;
  const inventoryAmenityBatches = chunk(inventoriesAmenities, inventoryAmenityBulkInsertSize);

  logger.trace({ ctx, inventoryAmenityBulkInsertSize, numBatches: inventoryAmenityBatches.length }, 'Bulk inserting inventory amenities end date');

  for (const inventoriesAmenitiesBatch of inventoryAmenityBatches) {
    await updateInventoryAmenitiesEndDate(ctx, inventoriesAmenitiesBatch, now(UTC_TIMEZONE));
  }

  logger.trace({ ctx, inventoryAmenityBulkInsertSize, numBatches: inventoryAmenityBatches.length }, 'Done bulk inserting inventory amenities end date');
};

const insertInventoryAmenities = async (ctx, inventoriesAmenities) => {
  if (!inventoriesAmenities?.length) return;
  const inventoryAmenitybatches = chunk(inventoriesAmenities, inventoryAmenityBulkInsertSize);

  logger.trace({ ctx, inventoryAmenityBulkInsertSize, numBatches: inventoryAmenitybatches.length }, 'Bulk inserting inventory amenities');

  for (const inventoryAmenityBatch of inventoryAmenitybatches) {
    await bulkUpsertInventoriesAmenitiesFromImport(ctx, inventoryAmenityBatch);
  }

  logger.trace({ ctx, inventoryAmenityBulkInsertSize, numBatches: inventoryAmenitybatches.length }, 'Done bulk inserting inventory amenities');
};

const processInventoryAmenities = async (ctx, validInventories) => {
  logger.trace({ ctx }, 'Start processing inventory amenities');
  const { missingInventoryAmenities, inventories: justInventoriesWithAmenities, errors: amenitiesValidation } = await updateInventoriesWithValidAmenities(
    ctx,
    validInventories,
  );

  logger.trace(
    {
      ctx,
      justInventoriesWithAmenities: justInventoriesWithAmenities?.length,
      missingInventoryAmenities: missingInventoryAmenities?.length,
    },
    'Done getting inventories with valid amenities',
  );

  const inventoriesAmenities = prepareDataToInsert(justInventoriesWithAmenities);
  await updateInventoryAmenitiesEndDateByInventoryAmenityId(ctx, missingInventoryAmenities);
  await insertInventoryAmenities(ctx, inventoriesAmenities);

  return amenitiesValidation;
};

export const additionalInventoryProcess = async (ctx, validInventories) => {
  const amenitiesValidation = await processInventoryAmenities(ctx, validInventories);
  await clearParentInventories(ctx);
  const invalidParentInventories = await setParentInventories(ctx, validInventories);
  return [...amenitiesValidation, ...invalidParentInventories];
};

const generateKeyForMappedInventory = (buildingId, propertyId, name) => [buildingId, propertyId, name].filter(x => x).join('.');

const getMappedInventoriesStateAndStateStartDate = async (ctx, inventories) => {
  const currentInventories = await getInventoriesStateAndStateStartDate(ctx, inventories);
  return new Map(currentInventories.map(i => [generateKeyForMappedInventory(i.buildingId, i.propertyId, i.name), i]));
};

const buildInventoriesObjectToSave = async (ctx, inventories) => {
  const mappedCurrentInventories = await getMappedInventoriesStateAndStateStartDate(ctx, inventories);
  return await mapSeries(inventories, async ({ data }) => {
    const inventory = {
      id: newId(),
      name: data.name.toString().trim(),
      propertyId: data.propertyId,
      buildingId: data.buildingId,
      multipleItemTotal: data.multipleItemTotal,
      description: data.description,
      type: getValueFromEnum(DALTypes.InventoryType, data.type),
      floor: getValueToPersist(data.floor, null),
      inventoryGroupId: data.inventoryGroupId,
      layoutId: data.layoutId,
      externalId: data.externalId,
      address: data.address,
      rmsExternalId: data.rmsExternalId,
      inactive: data.inactiveFlag,
    };

    const integration = data.integration;

    if (!skipInventoryState(ctx.tenant, integration)) {
      const newInventoryState = getValueFromEnum(DALTypes.InventoryState, data.state);
      const mappedInventoryKey = generateKeyForMappedInventory(inventory.buildingId, inventory.propertyId, inventory.name);
      const { state, stateStartDate } = mappedCurrentInventories.get(mappedInventoryKey) || {};
      inventory.state = newInventoryState;
      inventory.stateStartDate = newInventoryState && state !== newInventoryState ? await getStateStartDate(ctx, inventory) : stateStartDate;
    }

    return inventory;
  });
};

const splitInventoriesByState = validInventories =>
  validInventories.reduce(
    (acc, inventory) => {
      if (inventory.state) {
        acc.inventoriesWithState.push(inventory);
        return acc;
      }

      acc.inventoriesWithoutState.push(inventory);
      return acc;
    },
    { inventoriesWithState: [], inventoriesWithoutState: [] },
  );

const saveInventories = async (ctx, validInventoriesFromSheet) => {
  const inventoriesToSave = await buildInventoriesObjectToSave(ctx, validInventoriesFromSheet);
  const { inventoriesWithState, inventoriesWithoutState } = splitInventoriesByState(inventoriesToSave);
  const { rows: inventoriesWithStateSaved = [] } = (await bulkUpsertInventoriesFromImport(ctx, inventoriesWithState)) || {};
  const { rows: inventoriesWithoutStateSaved = [] } = (await bulkUpsertInventoriesFromImport(ctx, inventoriesWithoutState)) || {};
  return validInventoriesWithIdSaved(validInventoriesFromSheet, inventoriesWithStateSaved.concat(inventoriesWithoutStateSaved));
};

const enhanceInventories = async (ctx, excelInventories, properties) => {
  const buildings = await getBuildings(ctx);
  const layouts = await getLayouts(ctx);
  const inventoryGroups = await getInventoryGroups(ctx);

  return await mapSeries(excelInventories, async row => {
    const inventoryData = row.data;
    const property = properties.find(p => p.name === inventoryData.property) || {};
    const propertyId = property.id;
    const building = buildings.find(b => b.name === inventoryData.building && b.propertyId === propertyId) || {};
    const layout = layouts.find(l => l.name === inventoryData.layout && l.propertyId === propertyId) || {};
    const inventoryGroup = inventoryGroups.find(i => i.name === inventoryData.inventoryGroup && i.propertyId === propertyId) || {};
    const buildingId = building.id || null;
    const { integration } = (property || {}).settings || {};
    const inventoryGroupInactive = inventoryGroup.inactive;

    return {
      ...row,
      data: {
        ...row.data,
        propertyId,
        buildingId,
        layoutId: layout.id || null,
        inventoryGroupId: inventoryGroup.id,
        inventoryGroupInactive,
        integration,
      },
    };
  });
};

const customInventoryValidations = inventory => {
  const validation = [];
  const errorMessageMissingFields = data => `Invalid or missing ${data} for inventory`;

  if (inventory.property && !inventory.propertyId) {
    validation.push({
      name: INVENTORY_NAME,
      message: errorMessageMissingFields('property'),
    });
  }

  if (inventory.inventoryGroup && !inventory.inventoryGroupId) {
    validation.push({
      name: INVENTORY_NAME,
      message: errorMessageMissingFields('inventoryGroup'),
    });
  }

  if (inventory.layout && !inventory.layoutId) {
    validation.push({
      name: INVENTORY_NAME,
      message: errorMessageMissingFields('layout'),
    });
  }

  if (inventory.building && !inventory.buildingId) {
    validation.push({
      name: INVENTORY_NAME,
      message: errorMessageMissingFields('building'),
    });
  }

  if (!inventory.inactiveFlag && inventory.inventoryGroupInactive) {
    validation.push({
      name: INVENTORY_NAME,
      message: 'The inventory group associated is inactive',
    });
  }

  return validation;
};

export const importInventories = async (ctx, inventories) => {
  const validInventories = [];

  const properties = await getProperties(ctx);
  const enhancedInventories = await enhanceInventories(ctx, inventories, properties);

  logger.trace({ ctx }, `validating ${inventories.length} inventories`);
  const invalidInventories = await validate(
    enhancedInventories,
    {
      requiredFields: INVENTORY_REQUIRED_FIELDS,
      async onValidEntity(inventory, index) {
        validInventories.push({
          index,
          data: inventory,
        });
      },
      customCheck(inventory) {
        return customInventoryValidations(inventory);
      },
    },
    ctx,
    spreadsheet.Inventory.columns,
  );

  const inventoriesSaved = await saveInventories(ctx, validInventories);

  logger.trace({ ctx }, `found ${invalidInventories.length} invalid inventories... relating parents for ${validInventories.length} valid inventories`);

  return {
    invalidFields: invalidInventories,
    validFields: inventoriesSaved,
  };
};
