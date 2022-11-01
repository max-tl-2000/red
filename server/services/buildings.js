/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getBuildings as getBuildingsFromDB, getBuildingsByPropertyId } from '../dal/buildingRepo';
import { ServiceError } from '../common/errors';
import { validateIfElementsExist } from '../helpers/importUtils.js';
import logger from '../../common/helpers/logger';

export const BUILDINGS_FIELD = 'buildings';
export const INVALID_BUILDINGS = 'INVALID_BUILDING_ASSOCIATED';

export async function getBuildings(ctx) {
  try {
    const buildings = await getBuildingsFromDB(ctx);
    return buildings;
  } catch (error) {
    logger.error({ ctx, error }, 'Error loading buildings');
    throw new ServiceError('ERROR_LOADING_BUILDINGS');
  }
}

export const validateBuildings = async (ctx, entityObj) => {
  const storedBuildings = await getBuildingsByPropertyId(ctx, entityObj.propertyId);
  const validateObj = {
    elementsStr: entityObj.buildings,
    storedElements: storedBuildings,
    columnName: BUILDINGS_FIELD,
    errorMessage: INVALID_BUILDINGS,
  };

  return await validateIfElementsExist(validateObj);
};
