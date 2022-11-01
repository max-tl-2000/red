/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isDatabaseHealthy, isWebSocketHealthy, isMessageQueueHealthy } from '../../services/health';
import { InternalServerError } from '../../common/errors';

export const checkDatabase = async () => {
  if (!(await isDatabaseHealthy())) {
    throw new InternalServerError('Database is down');
  }
};

export const checkWebSocket = async () => {
  if (!(await isWebSocketHealthy())) {
    throw new InternalServerError('WebSocket is down');
  }
};

export const checkMessageQueue = async () => {
  if (!(await isMessageQueueHealthy())) {
    throw new InternalServerError('Message queue is down');
  }
};
