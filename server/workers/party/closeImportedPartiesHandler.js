/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import { closeParty, getImportedPartiesWithoutActivity } from '../../services/party';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { NoRetryError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';
import { createJob, updateJob } from '../../services/jobs';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getAdminUser } from '../../dal/usersRepo';

const logger = loggerModule.child({ subType: 'closeImportedParties' });

const addClosedPartiesToJob = (jobDetails, partyIds, entityCounts) => ({
  ...jobDetails,
  metadata: {
    ...(jobDetails.metadata || {}),
    partyIds,
    entityCounts: [...entityCounts.entries()].map(([property, count]) => ({ property, count })),
  },
});

export const closeImportedParties = async payload => {
  const { tenantId, reqId: requestId, propertyIds, activityDate, authUser, msgCtx } = payload;
  logger.info({ ctx: msgCtx, payload }, 'Closing imported parties.');

  const ctx = { tenantId, authUser };
  let adminUserId = (authUser || {}).id;
  let jobDetails = {};
  let partiesWithoutActivity = 0;
  const processedParties = [];
  const entityCounts = new Map();

  try {
    jobDetails = await createJob(ctx, null, {
      name: DALTypes.Jobs.ImportUpdateDataFiles,
      step: DALTypes.ImportUpdateDataFilesSteps.CloseImportedParties,
      category: DALTypes.JobCategory.MigrateData,
    });
    jobDetails.step = DALTypes.ImportUpdateDataFilesSteps.CloseImportedParties;
    adminUserId = adminUserId || jobDetails.createdBy;
    notify({ ctx, tenantId, event: eventTypes.CLOSE_IMPORTED_PARTIES_COMPLETED, data: { requestId }, routing: { users: [adminUserId] } });

    const parties = (await getImportedPartiesWithoutActivity(ctx, propertyIds, activityDate)) || [];
    partiesWithoutActivity = parties.length;
    jobDetails.metadata = {
      propertyIds,
      activityDate,
    };
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.IN_PROGRESS, {
      partiesWithoutActivity,
    });

    logger.info({ ctx: msgCtx, ...payload, partiesWithoutActivity }, 'closeImportedParties: start');

    for (const party of parties) {
      notify({
        ctx,
        event: eventTypes.JOB_PROGRESS,
        data: {
          jobDetails: pick(jobDetails, ['id', 'name', 'step', 'category']),
          current: processedParties.length + 1,
          total: partiesWithoutActivity,
        },
        routing: { users: [adminUserId] },
      });
      await closeParty(ctx, party.id, 'CLOSED_DURING_IMPORT');
      processedParties.push(party.id);
      entityCounts.set(party.displayName, (entityCounts.get(party.displayName) || 0) + 1);
    }

    logger.info({ ctx: msgCtx, ...payload }, 'closeImportedParties: complete');
  } catch (error) {
    const msg = 'Error while closing imported parties.';
    logger.error({ ctx: msgCtx, error, payload }, msg);
    await updateJob(
      tenantId,
      addClosedPartiesToJob(jobDetails, processedParties, entityCounts),
      DALTypes.JobStatus.PROCESSED,
      {
        partiesWithoutActivity,
        processed: processedParties.length,
      },
      [error],
    );
    adminUserId = adminUserId || ((await getAdminUser(ctx)) || {}).id;
    notify({ ctx, tenantId, event: eventTypes.CLOSE_IMPORTED_PARTIES_COMPLETED, data: { requestId, error } });
    throw new NoRetryError(msg);
  }

  await updateJob(tenantId, addClosedPartiesToJob(jobDetails, processedParties, entityCounts), DALTypes.JobStatus.PROCESSED, {
    partiesWithoutActivity,
    processed: processedParties.length,
  });

  return { processed: true };
};
