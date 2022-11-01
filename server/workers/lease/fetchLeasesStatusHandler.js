/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { getDataForFetchLeaseStatus } from '../../dal/leaseRepo';
import { updateLeaseStatusByEnvelopeId, fixLeaseStatusIfNeeded } from '../../services/leases/leaseService';

const logger = loggerModule.child({ subType: 'leaseStatusHandler' });

const updateLeaseStatus = async (ctx, leaseId, envelopeId) => {
  try {
    await updateLeaseStatusByEnvelopeId(ctx, leaseId, envelopeId);
  } catch (err) {
    logger.error({ ctx, err, leaseId, envelopeId }, 'Failed to update lease status');
  }
};

export const fetchLeasesStatus = async ({ msgCtx: ctx }) => {
  try {
    logger.time({ ctx }, 'Recurring Jobs - Fetch leases status');

    await fixLeaseStatusIfNeeded(ctx);
    const leaseAndEnvelopeIds = await getDataForFetchLeaseStatus(ctx);
    await mapSeries(leaseAndEnvelopeIds, async ({ leaseId, envelopeId }) => await updateLeaseStatus(ctx, leaseId, envelopeId));

    logger.timeEnd({ ctx, leaseCount: leaseAndEnvelopeIds.length, leaseAndEnvelopeIds }, 'Recurring Jobs - Fetch leases status');
  } catch (err) {
    logger.error({ ctx, err }, 'Failed to fetch leases status');
  }

  // the message was added to the queue by a recurring job,
  // so even if there was an error during the message processing,
  // it's not needed to move the current message to a retry queue,
  // because it will be added again by the recurring job after x minutes (value from config file)
  return { processed: true };
};
