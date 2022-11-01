/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as validators from '../helpers/validators';
import * as service from '../../services/inventories';
import { FIND_BLANK_SPACES } from '../../../common/regex';
import { DALTypes } from '../../../common/enums/DALTypes';
import config from '../../config';

const keysToHide = ['inventoryGroup'];

export async function getInventoryItem(req) {
  const { inventoryId } = req.params;
  await validators.inventory(req, inventoryId);
  const inventory = await service.getInventoryItem(req, inventoryId);
  keysToHide.forEach(key => delete inventory[key]);
  return inventory;
}

const getInventoriesToInclude = inventoryToInclude => {
  if (!inventoryToInclude) return [];
  return !Array.isArray(inventoryToInclude) ? [inventoryToInclude] : inventoryToInclude;
};

export async function getInventoryItems(req) {
  const { inventoryGroupId, inventoryToInclude, query } = req.query;
  const formattedQuery = query ? decodeURIComponent(query.toLowerCase()).replace(FIND_BLANK_SPACES, '') : '';

  if (inventoryGroupId) {
    await validators.inventoryGroup(req, inventoryGroupId);
  }
  const inventoriesToInclude = getInventoriesToInclude(inventoryToInclude);
  return service.getInventoryItems(req, formattedQuery, inventoryGroupId, inventoriesToInclude);
}

export async function getInventoryItemDetails(req) {
  const { inventoryId } = req.params;
  const { partyId } = req.query;

  const readOnlyServer = config.useReadOnlyServer;
  const ctx = { ...req, readOnlyServer };

  await validators.inventory(ctx, inventoryId);
  const inventory = await service.getInventoryItemWithDetails(ctx, inventoryId, { partyId });
  keysToHide.forEach(key => delete inventory[key]);
  return inventory;
}

export async function getAmenitiesFromInventory(req) {
  const { inventoryId } = req.params;
  await validators.inventory(req, inventoryId);
  return await service.getAmenitiesFromInventoryById(req, inventoryId);
}

export const setInventoryOnHold = async req => {
  const { inventoryId } = req.params;
  await validators.inventory(req, inventoryId);
  return await service.holdInventory(req, { ...req.body, inventoryId });
};

export const releaseManuallyHeldInventory = async req => {
  const { inventoryId } = req.params;
  await validators.inventory(req, inventoryId);
  return await service.releaseInventory(req, {
    inventoryId,
    reasons: [DALTypes.InventoryOnHoldReason.MANUAL, DALTypes.InventoryOnHoldReason.AUTOMATIC],
    ...req.body,
  });
};
