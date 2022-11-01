/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { getUnprocessedDocuments } from '../../dal/partyDocumentRepo';

const logger = loggerModule.child({ subType: 'jobs' });

const logAlert = (ctx, documents, maxDocuments = 10) => {
  const unprocessedDocuments = documents.map(({ id, partyId, created_at }) => ({
    id,
    partyId,
    created_at,
  }));

  logger.warn(
    {
      ctx,
      totalResults: unprocessedDocuments.length,
      hasMoreResults: unprocessedDocuments.length > maxDocuments,
      unprocessedDocuments: unprocessedDocuments.slice(0, maxDocuments),
    },
    'Tenant has unprocessed party documents',
  );
};

export const checkPartyDocuments = async payload => {
  const { msgCtx: ctx } = payload;
  const processedMsg = { processed: true };

  logger.time({ ctx }, 'Recurring Jobs - checkPartyDocuments duration');

  const betweenOneAndTwelveHours = { minTime: 1, maxTime: 12, timeFrame: 'hours' };
  const unprocessedDocuments = await getUnprocessedDocuments(ctx, betweenOneAndTwelveHours);

  if (!unprocessedDocuments.length) {
    logger.trace({ ctx }, 'Tenant has no unprocessed party documents');
    logger.timeEnd({ ctx }, 'Recurring Jobs - checkPartyDocuments duration');
    return processedMsg;
  }

  logAlert(ctx, unprocessedDocuments);
  logger.timeEnd({ ctx }, 'Recurring Jobs - checkPartyDocuments duration');

  return processedMsg;
};
