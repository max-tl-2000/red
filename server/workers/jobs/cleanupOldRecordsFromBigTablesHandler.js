/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { cleanupPublicApiRequestTracking } from '../../dal/publicApiRequestTrackingRepo';
import { cleanupLeaseSubmissions } from '../../dal/leaseRepo';
import { cleanupPartyDocuments } from '../../dal/partyDocumentRepo';

const logger = loggerModule.child({ subType: 'cleanupOldRecordsFromBigTables' });

const cleanupLeaseSubmissionTracking = async payload => {
  const { metadata, msgCtx: ctx } = payload;
  logger.time({ ctx, msgPayload: payload }, 'Recurring Jobs - Cleaning up the lease submission tracking duration');

  const { batchSize, versionsToKeep, daysToKeep } = metadata;

  try {
    await cleanupLeaseSubmissions(ctx, batchSize, versionsToKeep, daysToKeep);
  } catch (error) {
    logger.error({ ctx, error, msgPayload: payload }, 'Cleaning up of the lease submission tracking has failed.');
    return { processed: false };
  }

  logger.timeEnd({ ctx, msgPayload: payload }, 'Recurring Jobs - Cleaning up the lease submission tracking duration');

  return { processed: true };
};

const cleanupPartyDocumentHistory = async payload => {
  const { metadata, msgCtx: ctx } = payload;
  logger.time({ ctx, msgPayload: payload }, 'Recurring Jobs - Cleaning up the party document history duration');

  const { batchSize, versionsToKeep, daysToKeep } = metadata;

  try {
    await cleanupPartyDocuments(ctx, batchSize, versionsToKeep, daysToKeep);
  } catch (error) {
    logger.error({ ctx, error, msgPayload: payload }, 'Cleaning up of the party document history has failed.');
    return { processed: false };
  }

  logger.timeEnd({ ctx, msgPayload: payload }, 'Recurring Jobs - Cleaning up the party document history duration');

  return { processed: true };
};

export const cleanupPublicApiRequestTrackingData = async payload => {
  const { msgCtx: ctx } = payload;
  logger.time({ ctx }, 'Recurring Jobs - Cleaning up the public api request tracking duration');

  try {
    const daysToKeep = 1;
    await cleanupPublicApiRequestTracking(ctx, daysToKeep);
  } catch (error) {
    logger.error({ ctx, error, msgPayload: payload }, 'Cleaning up the public api request tracking has failed.');
    return { processed: false };
  }

  logger.timeEnd({ ctx, msgPayload: payload }, 'Recurring Jobs - Cleaning up the public api request tracking duration');

  return { processed: true };
};

const hasCleanupFailed = (lstCleanupResult, pdhCleanupResult, partCleanupResult) =>
  !lstCleanupResult?.processed || !pdhCleanupResult?.processed || !partCleanupResult?.processed;

export const cleanupOldRecordsFromBigTables = async ctx => {
  const lstCleanupResult = await cleanupLeaseSubmissionTracking(ctx);
  const pdhCleanupResult = await cleanupPartyDocumentHistory(ctx);
  const partCleanupResult = await cleanupPublicApiRequestTrackingData(ctx);

  if (hasCleanupFailed(lstCleanupResult, pdhCleanupResult, partCleanupResult)) {
    logger.trace({ ctx, lstCleanupResult, pdhCleanupResult, partCleanupResult }, 'CleanupOldRecordsFromBigTables - failed');
    return { processed: false };
  }
  logger.trace({ ctx }, 'CleanupOldRecordsFromBigTables - done');
  return { processed: true };
};
