/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getInventoriesQualifiedNamesByIds } from '../dal/inventoryRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { toMoment } from '../../common/helpers/moment-utils';

export const inventoryStateFutureDate = inventoryData => {
  const { propertyTimezone } = inventoryData;
  const futureDate = inventoryData.availabilityDate || inventoryData.stateStartDate;
  return toMoment(futureDate, { timezone: propertyTimezone });
};

export const getShortFormatRentableItem = async (ctx, inventoryId) => {
  const result = await getInventoriesQualifiedNamesByIds(ctx, [inventoryId]);
  return result && result.length && result[0].fullQualifiedName;
};

export const getFullQualifiedNamesForInventories = async (ctx, inventoryIds) => await getInventoriesQualifiedNamesByIds(ctx, inventoryIds);

export const inventoryStateTransitionOnLeaseExecuted = {
  [DALTypes.InventoryState.VACANT_READY]: DALTypes.InventoryState.VACANT_READY_RESERVED,
  [DALTypes.InventoryState.VACANT_MAKE_READY]: DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
  [DALTypes.InventoryState.OCCUPIED_NOTICE]: DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
};

export const inventoryStateTransitionOnLeaseVoided = {
  [DALTypes.InventoryState.VACANT_READY_RESERVED]: DALTypes.InventoryState.VACANT_READY,
  [DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED]: DALTypes.InventoryState.VACANT_MAKE_READY,
  [DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED]: DALTypes.InventoryState.OCCUPIED_NOTICE,
};
