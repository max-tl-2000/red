/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { getS3Provider } from '../upload/s3Provider';
import { removeFiles as removeTempFiles } from '../upload/migrateDataHandler';

const logger = loggerModule.child({ subType: 'delayedMessages' });

export const processDeletePostRecipientResultFile = async req => {
  const { msgCtx, file } = req;
  logger.trace({ ctx: msgCtx, file }, 'Deleting post recipient result file');

  try {
    await removeTempFiles([file]);
    await getS3Provider().deleteDocuments(req, [file.fileName]);
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'Deleting post recipient result file failed');
    return { processed: false };
  }

  return { processed: true };
};
