/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { hasOwnProp } from '../../../common/helpers/objUtils';
import loggerModule from '../../../common/helpers/logger';
import { updateOrInsertAmenities, updateOrInsertInventoryAmenities, isMriIntegration } from './updatesHandler';
import { DIFF_ACTION_TAG, getDifferences, createDaffFlags, mapDifferences, getUpdatedDiffValue } from './daff-helpers';
import { getPropertyByName, getProperties } from '../../dal/propertyRepo';
import { getTenantData } from '../../dal/tenantsRepo';
import { getInventoryByInventoryNamePropertyIdAndBuildingName } from '../../dal/inventoryRepo.js';
const logger = loggerModule.child({ subType: 'updateAmenityAndInventoryAmenityhandler' });

export const mapAmenityEntity = (keys, values, mapValue, isUnchanged = false) =>
  keys.reduce((acc, key, index) => {
    const value = getUpdatedDiffValue(values[index]);
    const tupple = mapValue(key, value, acc);
    acc[tupple[0]] = tupple[1];
    acc.isUnchanged = isUnchanged;
    return acc;
  }, {});

const reduceUpdateAmenityDiffHandler = (headers, action = DIFF_ACTION_TAG.insert) => (acc, row) => {
  switch (action) {
    case DIFF_ACTION_TAG.unchanged: {
      const data = mapAmenityEntity(headers, row, (key, value) => [key, value], true);
      acc.push(data);
      break;
    }
    case DIFF_ACTION_TAG.update:
    case DIFF_ACTION_TAG.insert: {
      const data = mapAmenityEntity(headers, row, (key, value) => [key, value]);
      acc.push(data);
      break;
    }
    default:
      break;
  }
  return acc;
};

const getUpdateAmenities = (headers, previous, actual) => {
  const customFlags = createDaffFlags();
  /* eslint-disable camelcase */
  customFlags.show_unchanged = true;
  customFlags.show_unchanged_columns = true;
  customFlags.show_unchanged_meta = true;
  /* eslint-enable camelcase */
  const diff = getDifferences(headers, previous, actual, customFlags);
  logger.debug({ diff }, 'amenities - diff');
  if (!diff?.data?.length) return {};
  return mapDifferences(diff.data, action => reduceUpdateAmenityDiffHandler(headers, action));
};

export const getUpdatedAmenitiesInformation = async (tenantId, { actual, previous, headers }) => {
  logger.debug({ tenantId, rows: actual?.length }, 'getUpdatedAmenitiesInformation');
  if (!previous?.length) {
    return actual.reduce(reduceUpdateAmenityDiffHandler(headers), []);
  }
  return getUpdateAmenities(headers, previous, actual);
};

// the amenity will be renamed based on its price
// if we have multiple SAME amenities with different prices names will look like NAME_PRICE
// if the price is the same for all amenities or we have just one row for that amenity name will be just name
const renameAmenitiesWithPrice = amenities => {
  const arrayOfAmenityNames = amenities.reduce((acc, amenity) => {
    const name = amenity.amenityName;
    if (!hasOwnProp(acc, name)) {
      acc[name] = [];
    }
    amenity.amenityName = amenity.amount === '0' ? amenity.amenityName : `${amenity.amenityName}_${amenity.amount}`;
    acc[name].push(amenity);
    return acc;
  }, {});

  return Object.keys(arrayOfAmenityNames).reduce((acc, keyName) => {
    let areNameEqual = true;
    let name = '';
    arrayOfAmenityNames[keyName].forEach(amenity => {
      if (name === '') {
        name = amenity.amenityName;
      }
      if (name !== amenity.amenityName) {
        areNameEqual = false;
      }
    });
    if (areNameEqual) {
      arrayOfAmenityNames[keyName].forEach(amenity => {
        amenity.amenityName = keyName;
        acc.push(amenity);
      });
    } else {
      arrayOfAmenityNames[keyName].forEach(amenity => {
        acc.push(amenity);
      });
    }
    return acc;
  }, []);
};

const populateAmenitiesExternalIdAsName = amenities =>
  amenities.map(amenity => {
    amenity.amenityExternalId = amenity.amenityName;
    return amenity;
  });

const getOnlyAmenitiesWithImportPropertySettingEnabled = async (ctx, sanitizedAmenities) => {
  const properties = await getProperties(ctx);
  const validAmenities = sanitizedAmenities.filter(amenity => !amenity.invalid);
  const propertySettingsByPropertyId = properties.reduce((acc, property) => {
    acc[property.id] = { settings: property.settings };
    return acc;
  }, {});

  return validAmenities.filter(amenity => {
    const {
      settings: { integration },
    } = propertySettingsByPropertyId[amenity.propertyExternalId];

    return integration.import.amenities;
  });
};

const getAmenitiesWithPropertyIdAndPropertiesWithNames = async (ctx, unitAmenities) => {
  const errors = [];
  const propertiesWithName = {};
  const amenities = await mapSeries(unitAmenities, async unitAmenity => {
    // unitAmenity.propertyId refers to propertyName but for mapping purposes it is call propertyId
    const property = (await getPropertyByName(ctx, unitAmenity.propertyExternalId)) || null;
    if (!property) {
      logger.error(`No property found for property name: ${unitAmenity.propertyExternalId}`);
      errors.push(`No property found for property name: ${unitAmenity.propertyExternalId}`);
      unitAmenity.invalid = true;
    } else {
      propertiesWithName[property.id] = property.name;
      unitAmenity.propertyExternalId = property.id;
    }

    return unitAmenity;
  });
  return { amenities, propertiesWithName, errors };
};

const getAmenitiesWithExistingInventory = async (ctx, amenities) => {
  const amenitiesWithInventoryInfo = [];
  await mapSeries(amenities, async amenity => {
    // here we don't want to return an invalid amenity becuase this means the propertyId was not found and we will need it later
    if (amenity.invalid) return;
    const { propertyExternalId, building, unitId } = amenity;
    let parsedBuilding = building;
    const parsedBuildingNumber = parseInt(building, 10);
    if (!isNaN(parsedBuildingNumber) && building?.length === 1) {
      parsedBuilding = `0${parsedBuildingNumber}`;
    }
    const inventory = await getInventoryByInventoryNamePropertyIdAndBuildingName(ctx, unitId, propertyExternalId, parsedBuilding);
    if (inventory) {
      amenity.inventoryId = inventory.id;
    } else {
      amenity.invalid = true;
    }
    amenitiesWithInventoryInfo.push(amenity);
  });
  return amenitiesWithInventoryInfo;
};

const getInvalidAmenitiesByPropertyId = (invalidAmenities, propertiesWithName) => {
  const invalidAmenitiesBypropertyId = invalidAmenities.reduce((acc, invalidAmenity) => {
    const { propertyExternalId, building, unitId, amount, amenityName } = invalidAmenity;
    acc[propertyExternalId] = acc[propertyExternalId] || [];
    acc[propertyExternalId].push(`building: ${building}, unit: ${unitId}, name: ${amenityName}, amount: ${amount}`);
    return acc;
  }, {});
  const invalidProperties = Object.keys(invalidAmenitiesBypropertyId);
  return invalidProperties.reduce((acc, propertyId) => {
    acc.push(`invalid amenities found for property ${propertiesWithName[propertyId]}: ${invalidAmenitiesBypropertyId[propertyId].join(', ')}`);

    return acc;
  }, []);
};

const getValidAmenitiesAndPropertiesWithNames = async (ctx, amenities) => {
  const amenitiesWithExternalId = populateAmenitiesExternalIdAsName(amenities);
  const renamedAmenities = renameAmenitiesWithPrice(amenitiesWithExternalId);
  const { amenities: amentiesWithPropertyId, errors: replacementErrors, propertiesWithName } = await getAmenitiesWithPropertyIdAndPropertiesWithNames(
    ctx,
    renamedAmenities,
  );
  const amenitiesWithSettingsEnable = await getOnlyAmenitiesWithImportPropertySettingEnabled(ctx, amentiesWithPropertyId);
  const amenitiesWithInventoryInfo = await getAmenitiesWithExistingInventory(ctx, amenitiesWithSettingsEnable);
  const { validAmenities, invalidAmenities } = amenitiesWithInventoryInfo.reduce(
    (acc, amenity) => {
      if (amenity.invalid) {
        acc.invalidAmenities.push(amenity);
        return acc;
      }
      acc.validAmenities.push(amenity);
      return acc;
    },
    { validAmenities: [], invalidAmenities: [] },
  );
  const invalidAmenitiesGroupByPropertyErrors = getInvalidAmenitiesByPropertyId(invalidAmenities, propertiesWithName);
  const errors = [...replacementErrors, ...invalidAmenitiesGroupByPropertyErrors];
  return { validAmenities, propertiesWithName, errors };
};

export const updateAmenityAndInventoryAmenity = async (ctx, actual, previous, headers, entityType, thirdPartySystem) => {
  const { metadata } = await getTenantData(ctx);
  if (!isMriIntegration(metadata?.backendIntegration?.name)) {
    logger.warn({ ctx }, 'skipping MriUnitAmenity file as MRI integration not ON');
    return ['skipping MriUnitAmenity file as MRI integration not ON'];
  }
  const changedAmenities = await getUpdatedAmenitiesInformation(ctx.tenantId, { actual, previous, headers, entityType });
  logger.debug({ ctx, rows: changedAmenities?.length, thirdPartySystem }, 'updated unit amenities returned');
  if (!changedAmenities?.length) return [];
  const { validAmenities, propertiesWithName, errors: errorsFromValidation } = await getValidAmenitiesAndPropertiesWithNames(ctx, changedAmenities);

  const amenityErrors = await updateOrInsertAmenities(ctx, validAmenities, propertiesWithName);
  const inventoryAmenityErrors = await updateOrInsertInventoryAmenities(ctx, validAmenities);
  return [{ file: 'MriUnitAmenities', errors: [...errorsFromValidation, ...amenityErrors, ...inventoryAmenityErrors] }];
};
