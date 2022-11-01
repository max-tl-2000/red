/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uuid from 'uuid/v4';
import * as paymentMethodRepo from '../../dal/payment-method-repo';

export const createAUserPaymentMethod = async ({
  userId,
  tenantId,
  channelType = 'DEBIT',
  lastFour = '1234',
  expirationMonth = '07/2028',
  brand = 'VISA',
  externalId = '12345',
  integrationId = 'intId',
  isDefault = false,
}) => {
  const rawPaymentInfo = {
    id: uuid(),
    userId,
    channelType,
    lastFour,
    isDefault,
    expirationMonth,
    brand,
    externalId,
    tenantId,
    integrationId,
  };

  return await paymentMethodRepo.upsertPaymentMethod({}, rawPaymentInfo);
};
