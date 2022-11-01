/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getToken } from '../../../auth/server/dal/common-tokens-repo';
import { ServiceError } from '../../../server/common/errors';

export const validateToken = async (ctx, token) => {
  const dbToken = await getToken(ctx, token);

  if (!dbToken || !dbToken.valid) {
    throw new ServiceError({
      token: 'INVALID_TOKEN',
      status: 498,
    });
  }

  if (dbToken.expiryDate < new Date()) {
    return { isExpired: true };
  }

  return { isValid: true };
};
