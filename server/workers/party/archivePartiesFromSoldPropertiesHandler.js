/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { archiveParty } from '../../services/party';
import * as partyRepo from '../../dal/partyRepo';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { updateJob } from '../../services/jobs';

const logger = loggerModule.child({ subType: 'archivePartiesFromSoldProperties' });

export const archivePartiesFromSoldProperties = async payload => {
  let archivedParties = 0;
  const { propertyIds, msgCtx, authUser, tenantId, job } = payload;

  const ctx = { tenantId, authUser };
  logger.trace({ ctx: msgCtx, propertyIds }, 'archivePartiesFromSoldProperties - start');

  job.step = DALTypes.ImportUpdateDataFilesSteps.ArchivePartiesFromSoldProperties;

  try {
    const partyIdsFromSoldProperties = await partyRepo.getActivePartiesFromSoldProperties(ctx, propertyIds);

    logger.trace(
      { ctx: msgCtx, numberOfActiveLeasesToArchive: partyIdsFromSoldProperties.length },
      'archivePartiesFromSoldProperties - number of parties to archive',
    );
    await mapSeries(partyIdsFromSoldProperties, async (partyId, index) => {
      await archiveParty(ctx, {
        partyId,
        archiveReasonId: DALTypes.ArchivePartyReasons.PROPERTY_SOLD,
        options: { skipNotify: true, shouldCancelActiveTasks: false },
      });
      archivedParties++;
      logger.trace({ msgCtx, partyId, numberOfArchivedActiveLeases: index + 1 }, 'number of archived parties from sold properties');
    });

    await partyRepo.cancelTasksForArchivedParties(msgCtx);
    logger.trace({ ctx: msgCtx, propertyIds }, 'archivePartiesFromSoldProperties - done');
  } catch (error) {
    const msg = 'Error while archiving parties.';
    logger.error({ ctx: msgCtx, error, payload }, msg);
    await updateJob(
      tenantId,
      { ...job, metadata: { archivedParties } },
      DALTypes.JobStatus.FAILED,
      {
        archivedParties,
      },
      [error],
    );
    return { processed: false, retry: false };
  }

  await updateJob(tenantId, { ...job, metadata: { archivedParties } }, DALTypes.JobStatus.PROCESSED, {
    archivedParties,
  });

  logger.trace({ ctx, propertyIds }, 'archivePartiesFromSoldProperties finished');
  return { processed: true };
};
