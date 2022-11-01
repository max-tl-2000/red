/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getAmenities as getAmenitiesFromDB, getAmenitiesByPropertyId, addAmenityToTarget, getAmenitiesByPropertyAndCategory } from '../dal/amenityRepo';
import { ServiceError } from '../common/errors';
import { validateIfElementsExist } from '../helpers/importUtils';
import logger from '../../common/helpers/logger';

const AMENITIES_FIELD = 'amenities';
const INVALID_AMENITIES = 'INVALID_AMENITY_ASSOCIATED';

export async function getAmenities(ctx) {
  try {
    const amenities = await getAmenitiesFromDB(ctx);
    return amenities;
  } catch (error) {
    logger.error({ ctx, error }, 'Error loading amenities');
    throw new ServiceError('ERROR_LOADING_AMENITIES');
  }
}

export async function getAmenitiesProperty(ctx, propertyId) {
  try {
    const amenities = await getAmenitiesByPropertyId(ctx, propertyId);
    return amenities;
  } catch (error) {
    logger.error({ ctx, error }, 'Error loading property amenities');
    throw new ServiceError('ERROR_LOADING_AMENITIES_PROPERTY');
  }
}

export const relateAmenities = async (ctx, entityObj, targetType) => {
  for (let index = 0; index < entityObj.validAmenities.length; index++) {
    try {
      await addAmenityToTarget(ctx, entityObj.validAmenities[index], entityObj.id, targetType);
    } catch (error) {
      logger.error({ ctx, error }, `Error while saving amenity: ${entityObj.validAmenities[index]}`);
    }
  }
};

export const validateAmenities = async (ctx, entityObj, category) => {
  const storedAmenities = await getAmenitiesByPropertyAndCategory(ctx, entityObj.property, category);
  const validateObj = {
    elementsStr: entityObj.amenities,
    storedElements: storedAmenities,
    columnName: AMENITIES_FIELD,
    errorMessage: INVALID_AMENITIES,
  };

  return await validateIfElementsExist(validateObj);
};

export const validateAmenitiesForInventories = (inventory, amenitiesByProperty) =>
  validateIfElementsExist({
    elementsStr: inventory.amenities,
    storedElements: amenitiesByProperty[inventory.propertyId],
    columnName: AMENITIES_FIELD,
    errorMessage: INVALID_AMENITIES,
  });
