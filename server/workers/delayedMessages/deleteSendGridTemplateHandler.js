/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { deleteSendGridTemplate } from '../../services/bulkEmails/sendGridUtils';

const logger = loggerModule.child({ subType: 'delayedMessages' });

export const processDeleteSendGridTemplate = async req => {
  const { msgCtx, templateId } = req;
  logger.trace({ ctx: msgCtx, templateId }, 'Deleting sendGrid template');

  try {
    await deleteSendGridTemplate(msgCtx, templateId);
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'Deleting sendGrid template failed');
    return { processed: false };
  }

  return { processed: true };
};
