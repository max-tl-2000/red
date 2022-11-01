/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getInventoryById, getInventoryByExternalId } from '../../dal/inventoryRepo';

export const parsePriceChangesForMail = (ctx, priceChanges) =>
  priceChanges.reduce(async (acc, priceChange) => {
    const { id } = (await getInventoryByExternalId(ctx, priceChange.externalId)) || {};
    if (!id) return await acc;

    const resolvedAcc = await acc;
    const inventory = await getInventoryById(ctx, {
      id,
      expand: true,
    });

    const { currentChargeDate, currentCharge, amenityName } = priceChange;
    resolvedAcc.push({
      currentChargeDate,
      currentCharge,
      amenityName,
      inventory,
    });
    return resolvedAcc;
  }, Promise.resolve([]));
