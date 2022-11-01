/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'AMQP/testing' });
import sleep from '../../common/helpers/sleep';

export const loadTestingHandler = async msg => {
  logger.trace({ msg }, 'loadTestingHandler');

  await sleep(msg.sleep);
  logger.trace({ msg }, 'loadTestingHandler message processed');

  return { processed: true };
};
