/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import * as service from '../../services/externalCalendars/cronofyEnterpriseService';

const logger = loggerModule.child({ subType: 'requestDelegatedAccessHandler' });

export const requestDelegatedAccess = async payload => {
  const { msgCtx } = payload;
  logger.info({ ctx: msgCtx, payload }, 'requestDelegatedAccess');

  try {
    await service.requestDelegatedAccess(msgCtx);
  } catch (error) {
    logger.error({ ctx: msgCtx, payload, error }, 'error while requesting the delegated access');
    return { processed: false };
  }

  return { processed: true };
};
