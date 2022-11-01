/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import eventTypes from '../enums/eventTypes';
import envVal from '../helpers/env-val';

export const getBuildVersion = () => envVal('BUILD_VERSION', 'dev'); // This variable is going to be set after image deployment.

export const notifyVersion = config => req => {
  const { notifyAll } = require('./notificationClient');
  const version = ((config.isIntegration || config.isDevelopment) && req.body.version) || getBuildVersion();
  version && notifyAll({ ctx: req, event: eventTypes.BROADCAST_WEB_UPDATED, data: { version } });
  return version;
};
