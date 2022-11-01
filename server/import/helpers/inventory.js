/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { now } from '../../../common/helpers/moment-utils';
import { getPropertyTimezone } from '../../services/properties';
import { ServiceError } from '../../common/errors';
import logger from '../../../common/helpers/logger';

export const getStateStartDate = async (ctx, inventory) => {
  const { propertyId } = inventory;
  if (!propertyId) {
    logger.error({ ctx, propertyId }, 'Attempt to insert an inventory without a propertyId');
    throw new ServiceError('`propertyId` is not defined in the inventory to save');
  }

  const timezone = await getPropertyTimezone(ctx, propertyId);
  if (!timezone) {
    logger.warn({ ctx, propertyId }, '`timezone` is null or empty for the provided `propertyId`');
  }

  return inventory.stateStartDate || now({ timezone }).startOf('day').toJSON();
};

export const prepareDataToInsert = inventoriesWithAmenities =>
  inventoriesWithAmenities.reduce((acc, inventory) => {
    acc = acc.concat(
      inventory.validAmenities.map(amenity => ({
        id: newId(),
        inventoryId: inventory.id,
        amenityId: amenity,
      })),
    );
    return acc;
  }, []);

const findInventorySaved = (validInventoryFromSheet, inventorySaved) =>
  inventorySaved.name === validInventoryFromSheet.name &&
  inventorySaved.propertyId === validInventoryFromSheet.propertyId &&
  inventorySaved.buildingId === validInventoryFromSheet.buildingId;

export const validInventoriesWithIdSaved = (validInventoriesFromSheet, inventoriesSaved) =>
  validInventoriesFromSheet.reduce((acc, { data: validInventoryFromSheet, index }) => {
    const inventory = inventoriesSaved.find(inventorySaved => findInventorySaved(validInventoryFromSheet, inventorySaved));
    if (inventory) {
      acc.push({
        index,
        data: {
          id: inventory.id,
          ...validInventoryFromSheet,
        },
      });
    }
    return acc;
  }, []);

export const checkForMissingColumns = (headersFromSheet, expectedHeaders) =>
  expectedHeaders.reduce((acc, expectedHeader) => {
    const headerFound = headersFromSheet.find(headerFromSheet => headerFromSheet.toLowerCase() === expectedHeader.toLowerCase());
    if (!headerFound) acc.push(expectedHeader);

    return acc;
  }, []);

export const getInventoriesIdentifiers = inventories =>
  inventories.reduce(
    (acc, inventory) => {
      const {
        data: { name, propertyId, buildingId },
      } = inventory;

      name && acc.inventoriesNames.push(name);
      propertyId && acc.inventoriesPropertyIds.push(propertyId);
      buildingId && acc.inventoriesBuildingIds.push(buildingId);
      return acc;
    },
    { inventoriesNames: [], inventoriesPropertyIds: [], inventoriesBuildingIds: [] },
  );
