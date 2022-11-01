/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from './DALTypes';

export const inventoryItemsStates = [
  DALTypes.InventoryState.ADMIN,
  DALTypes.InventoryState.DOWN,
  DALTypes.InventoryState.EXCLUDED,
  DALTypes.InventoryState.MODEL,
  DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
  DALTypes.InventoryState.OCCUPIED_NOTICE,
  DALTypes.InventoryState.OCCUPIED,
  DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
  DALTypes.InventoryState.VACANT_READY_RESERVED,
  DALTypes.InventoryState.VACANT_MAKE_READY,
  DALTypes.InventoryState.VACANT_READY,
];

export const reservedInventoryItemsStates = [
  DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
  DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
  DALTypes.InventoryState.VACANT_READY_RESERVED,
  DALTypes.InventoryState.OCCUPIED,
];

export const statesTranslationKeys = {
  [DALTypes.InventoryState.ADMIN]: 'INVENTORY_STATE_ADMIN',
  [DALTypes.InventoryState.DOWN]: 'INVENTORY_STATE_DOWN',
  [DALTypes.InventoryState.EXCLUDED]: 'INVENTORY_STATE_EXCLUDED',
  [DALTypes.InventoryState.MODEL]: 'INVENTORY_STATE_MODEL',
  [DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED]: 'INVENTORY_STATE_OCCUPIED_NOTICE_RESERVED',
  [DALTypes.InventoryState.OCCUPIED_NOTICE]: 'INVENTORY_STATE_OCCUPIED_NOTICE',
  [DALTypes.InventoryState.OCCUPIED]: 'INVENTORY_STATE_OCCUPIED',
  [DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED]: 'INVENTORY_STATE_VACANT_MAKE_READY_RESERVED',
  [DALTypes.InventoryState.VACANT_READY_RESERVED]: 'INVENTORY_STATE_VACANT_READY_RESERVED',
  [DALTypes.InventoryState.VACANT_MAKE_READY]: 'INVENTORY_STATE_VACANT_MAKE_READY',
  [DALTypes.InventoryState.VACANT_READY]: 'INVENTORY_STATE_VACANT_READY',
  [DALTypes.InventoryState.VACANT_DOWN]: 'INVENTORY_STATE_DOWN',
  [DALTypes.InventoryState.UNAVAILABLE]: 'INVENTORY_STATE_EXCLUDED',
};
