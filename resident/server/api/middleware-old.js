/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { decodeJWTToken } from '../../../common/server/jwt-helpers';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'residentMiddleware' });

export const getDeepLinkToken = async (req, res, next) => {
  try {
    const { query } = req;
    const token = query?.token;
    if (!token) {
      logger.error({ ctx: req }, 'Token not found');
      res.send({ error: 'Not found' });
      return;
    }

    const tokenData = await decodeJWTToken(token);
    const { tenantId } = tokenData;

    if (!tenantId) {
      logger.error({ ctx: req }, 'Tenant not found');
      res.send({ error: 'Not found' });
      return;
    }

    req._decodedToken = tokenData;
    req.tenantId = tenantId;
    next();
  } catch (error) {
    logger.error({ ctx: req, error }, 'getDeepLinkTokenData');
    res.send({ error: 'Not found' });
  }
  return;
};
