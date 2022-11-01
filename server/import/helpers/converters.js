/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Buffer } from '@redisrupt/datapumps';

export const createBufferFromArr = setting => {
  // this is not the node's Buffer constructor but the one from data-pumps
  const buffer = new Buffer(); // eslint-disable-line no-buffer-constructor
  setting.data.forEach(row => {
    buffer.append(row);
  });
  buffer.seal();
  return buffer;
};
