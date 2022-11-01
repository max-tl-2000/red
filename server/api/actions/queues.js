/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../common/errors';
import config from '../../config';
import { clean } from '../../workers/consumer';
import { createRabbitMQConnection } from '../../common/pubsubConn';

const { apiToken } = config;

export const clearQueues = async req => {
  const reqApiToken = req.query.apiToken;

  if (!reqApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_REQUIRED',
      status: 403,
    });
  }

  if (reqApiToken !== apiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_INVALID',
      status: 403,
    });
  }

  const { chan } = await createRabbitMQConnection();
  return await clean(chan);
};
