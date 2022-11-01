/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertiesWithAmenityImportEnabled } from '../dal/propertyRepo';
import logger from '../../common/helpers/logger';
import { exportAmenities } from '../export/database/exportSheet/amenity';
import { getColumnsBySheet } from '../helpers/importUtils';
import { importAmenities } from '../import/inventory/amenity';
import { convertEntitiesInAnExpectedType } from '../import/inventory/util';
import { ServiceError } from '../common/errors';
import { getProtectedColumns } from './helpers/sheets';

export const getSheetData = async (ctx, sheetName) => {
  logger.debug({ ctx, sheetName }, 'Get sheet data');

  const columnHeaders = [{ header: 'id' }, ...getColumnsBySheet(sheetName)];

  const propertyinfo = await getPropertiesWithAmenityImportEnabled(ctx);
  const propertyIds = propertyinfo.map(property => property.id);
  const amenities = await exportAmenities(
    ctx,
    { propertyIdsToExport: propertyIds, columnHeaders: columnHeaders.map(({ header }) => header) },
    { includeId: true, includeInventoryOnly: true },
  );
  return {
    columnHeaders,
    sheetInfo: amenities,
  };
};

export const updateDBFromSheets = async (ctx, sheetInfo) => {
  const { amenities } = sheetInfo;

  logger.debug({ ctx, amenityIds: amenities.map(amenity => amenity.data.id).join(',') }, 'updateDBFromSheets');

  const sheetName = Object.keys(sheetInfo)[0];
  if (!sheetName) {
    throw new ServiceError({
      token: 'SHEET_NAME_NOT_FOUND',
      status: 404,
    });
  }
  const columns = getColumnsBySheet(sheetName);

  const protectedColumns = getProtectedColumns(columns);

  const enhanceAmenities = convertEntitiesInAnExpectedType(amenities, columns);

  return await importAmenities(ctx, enhanceAmenities, { appScript: true, protectedColumns }); // only amenities for now
};
