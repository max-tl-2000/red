/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { getLayouts } from '../../services/layouts';
import config from '../../config';

const logger = loggerModule.child({ subType: 'api/layouts' });

export const loadLayouts = async req => {
  logger.trace({ ctx: req }, 'About to load layouts');

  const readOnlyServer = config.useReadOnlyServer;
  return await getLayouts({ ...req, readOnlyServer });
};
