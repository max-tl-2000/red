/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getInventoryItem } from '../../../../server/services/inventories';
import { getPropertyById } from '../../../../server/services/properties';
import { getPropertyPolicies } from '../../../common/helpers/properties';

const getPropertyItem = property => ({
  propertyName: property.displayName,
  propertyId: property.id,
  propertyPolicies: getPropertyPolicies(property),
});

export const getPropertyInfo = async (ctx, { propertyId, inventoryId }) => {
  if (inventoryId) {
    const inventory = await getInventoryItem(ctx, inventoryId);
    propertyId = inventory?.propertyId;
  }
  if (!propertyId) {
    throw new Error('propertyId unexpectedly null');
  }
  const property = await getPropertyById(ctx, propertyId);
  return getPropertyItem(property);
};
