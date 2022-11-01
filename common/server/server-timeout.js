/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { commonConfig } from '../server-config';

export const setServerTimeout = server => {
  if (!server || !server.setTimeout) {
    throw new Error('No server instance provided to set the timeout');
  }

  server.keepAliveTimeout = commonConfig.serverKeepAliveTimeout;
  server.headersTimeout = commonConfig.serverHeadersTimeout;

  server.setTimeout(commonConfig.serverDefaultTimeout);

  return server;
};
