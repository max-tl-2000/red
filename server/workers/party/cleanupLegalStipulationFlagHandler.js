/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { NoRetryError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';
import { resetLegalStipulationFlag } from '../../dal/partyRepo';

const logger = loggerModule.child({ subType: 'cleanupLegalStipulationFlag' });

export const cleanupResidentLegalStipulationFlag = async payload => {
  const { tenantId, authUser, msgCtx } = payload;
  logger.info({ ctx: msgCtx, payload }, 'Cleaning up LegalStipulationFlag.');

  const ctx = { tenantId, authUser };

  try {
    await resetLegalStipulationFlag(ctx);

    logger.info({ ctx: msgCtx, ...payload }, 'Cleaning up LegalStipulationFlag: complete');
  } catch (error) {
    const msg = 'Error while cleaning up LegalStipulationFlag.';
    logger.error({ ctx: msgCtx, error, payload }, msg);

    throw new NoRetryError(msg);
  }

  return { processed: true };
};
