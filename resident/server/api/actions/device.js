/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as service from '../../services/device';
import logger from '../../../../common/helpers/logger';

export const createDevice = async req => {
  const { pushToken, details, userId } = req.body;
  logger.debug({ ctx: req }, 'createDevice', { details, pushToken, userId });

  const device = await service.createDevice(req, { pushToken, details, userId });
  return { type: 'json', content: device };
};

export const updateDevice = async req => {
  const { tenantId, ...delta } = req.body;
  const { deviceId } = req.params;
  logger.debug({ ctx: req }, 'updateDevice', { deviceId, ...delta });

  const device = await service.updateDevice(req, deviceId, delta);

  return { type: 'json', content: device };
};
