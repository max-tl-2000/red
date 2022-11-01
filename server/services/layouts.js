/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLayoutsForUnits, getLayoutByName, getLayoutsByPropertyId } from '../dal/layoutRepo';
import { ServiceError } from '../common/errors';
import { validateIfElementsExist } from '../helpers/importUtils.js';
import logger from '../../common/helpers/logger';

export const LAYOUTS_FIELD = 'layouts';
export const INVALID_LAYOUTS = 'INVALID_LAYOUT_ASSOCIATED';

export async function getLayouts(ctx) {
  try {
    return await getLayoutsForUnits(ctx);
  } catch (error) {
    logger.error({ error }, 'Error loading layouts');
    throw new ServiceError('ERROR_LOADING_LAYOUTS');
  }
}

export async function getLayoutId(ctx, layoutName) {
  const layout = await getLayoutByName(ctx, layoutName);
  return layout ? layout.id : null;
}

export const validateLayouts = async (ctx, entityObj) => {
  const storedLayouts = await getLayoutsByPropertyId(ctx, entityObj.propertyId);
  const validateObj = {
    elementsStr: entityObj.layouts,
    storedElements: storedLayouts,
    columnName: LAYOUTS_FIELD,
    errorMessage: INVALID_LAYOUTS,
  };

  return await validateIfElementsExist(validateObj);
};
