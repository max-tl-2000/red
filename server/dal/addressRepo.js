/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertInto, initQuery } from '../database/factory';

export const saveAddress = (ctx, address) => insertInto(ctx.tenantId, 'Address', address);

export const removeUnassignedAddress = async ctx => {
  const addressIdsFromProperties = initQuery(ctx).select('addressId').from('Property');
  const addressIdsFromBusinessEntities = initQuery(ctx).select('addressId').from('BusinessEntity');
  const allAddressIds = initQuery(ctx).select('addressId').from('Building').union(addressIdsFromProperties).union(addressIdsFromBusinessEntities);
  await initQuery(ctx).from('Address').whereNotIn('id', allAddressIds).del();
};
