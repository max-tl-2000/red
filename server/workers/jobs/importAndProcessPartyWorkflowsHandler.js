/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { importActiveLeases } from '../importActiveLeases/importActiveLeasesHandler.js';
import { workflowCycleProcessor } from '../party/workflowCycleHandler';
import loggerModule from '../../../common/helpers/logger';
import { transitionPartiesToResidentState } from './transitionPartiesToResidentStateHandler';
import { DALTypes } from '../../../common/enums/DALTypes.js';
import { addOrUpdateJobStep, updateJobStatus } from '../../services/jobs.js';
import config from '../config';

const logger = loggerModule.child({ subType: 'importAndProcessWorkflowsHandler' });

const shouldMarkJobAsFailed = retryCount => retryCount === config.noOfFastRetries;

export const importAndProcessPartyWorkflows = async ctx => {
  const {
    tenantId,
    skipImport = false,
    skipProcess = false,
    isInitialImport = false,
    jobIdToUpdate,
    forceSyncLeaseData = false,
    triggeredManually = false,
    msgCtx,
  } = ctx;
  const retryCount = msgCtx.retryCount;

  logger.trace(
    { ctx, skipImport, skipProcess, isInitialImport, jobIdToUpdate, forceSyncLeaseData, triggeredManually, retryCount },
    'importAndProcessPartyWorkflows - start',
  );

  await updateJobStatus(tenantId, jobIdToUpdate, DALTypes.JobStatus.IN_PROGRESS);

  await addOrUpdateJobStep(
    tenantId,
    jobIdToUpdate,
    DALTypes.ImportAndProcessPartyWorkflowsSteps.ImportResidentData,
    skipImport ? DALTypes.JobStatus.SKIPPED : DALTypes.JobStatus.IN_PROGRESS,
  );
  const importResult = !skipImport ? await importActiveLeases(ctx) : { processed: true };
  !skipImport &&
    (await addOrUpdateJobStep(
      tenantId,
      jobIdToUpdate,
      DALTypes.ImportAndProcessPartyWorkflowsSteps.ImportResidentData,
      importResult.processed ? DALTypes.JobStatus.PROCESSED : DALTypes.JobStatus.FAILED,
    ));

  await addOrUpdateJobStep(
    tenantId,
    jobIdToUpdate,
    DALTypes.ImportAndProcessPartyWorkflowsSteps.ProcessWorkflows,
    skipProcess ? DALTypes.JobStatus.SKIPPED : DALTypes.JobStatus.IN_PROGRESS,
  );
  const partyWorkflowsProcessResult = !skipProcess ? await workflowCycleProcessor(ctx) : { processed: true };
  await transitionPartiesToResidentState(ctx);
  !skipProcess &&
    (await addOrUpdateJobStep(
      tenantId,
      jobIdToUpdate,
      DALTypes.ImportAndProcessPartyWorkflowsSteps.ProcessWorkflows,
      partyWorkflowsProcessResult.processed ? DALTypes.JobStatus.PROCESSED : DALTypes.JobStatus.FAILED,
    ));

  if (!importResult?.processed || !partyWorkflowsProcessResult?.processed) {
    logger.trace({ ctx, importResult, partyWorkflowsProcessResult }, 'importAndProcessPartyWorkflows - failed');
    shouldMarkJobAsFailed(retryCount) && (await updateJobStatus(tenantId, jobIdToUpdate, DALTypes.JobStatus.FAILED));
    return { processed: false };
  }
  logger.trace({ ctx }, 'importAndProcessPartyWorkflows - done');
  await updateJobStatus(tenantId, jobIdToUpdate, DALTypes.JobStatus.PROCESSED);
  return { processed: true };
};
