/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveAddress } from '../dal/addressRepo.js';

export async function saveAddressRow(ctx, row) {
  const record = await saveAddress(ctx, {
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
  });

  return {
    addressId: record.id,
    addressLine: record.addressLine1,
    postalCode: record.postalCode,
    city: record.city,
    state: record.state,
  };
}
