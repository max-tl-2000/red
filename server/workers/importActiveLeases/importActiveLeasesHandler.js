/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import get from 'lodash/get';

import { now } from '../../../common/helpers/moment-utils';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { updateRecurringJobMetadata, getRecurringJobByName } from '../../dal/jobsRepo';
import { getProperties } from '../../dal/propertyRepo';
import { LastUpdateInitialDate } from '../../services/importActiveLeases/mri-api-requester';
import { getTenant } from '../../services/tenantService';
import { processData } from '../../services/importActiveLeases/process-data/process-data';
import { retrieveData } from '../../services/importActiveLeases/retrieve-data';
import { YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import sleep from '../../../common/helpers/sleep';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const updateProgress = async (ctx, { jobId, progress, propertyExternalId, updatedValues }) => {
  progress[propertyExternalId] = {
    ...progress[propertyExternalId],
    ...updatedValues,
  };

  logger.trace({ ctx, jobProgress: progress, propertyExternalId }, 'Residents import progress');
  await updateRecurringJobMetadata(ctx, jobId, { progress });
};

export const getPropertiesToImport = async ctx => {
  logger.trace({ ctx }, 'getPropertiesToImport');
  const properties = await getProperties(ctx);
  return properties.filter(p => p.settings?.integration?.import?.residentData && !p.inactive).sort((a, b) => a.name.localeCompare(b.name));
};

const shouldSkipImport = backendMode => backendMode === DALTypes.BackendMode.NONE;

const resetJobProgress = async (ctx, { jobId, jobMetadata, propertyExternalIds, retryCount }) => {
  const { progress = {} } = jobMetadata;

  if (retryCount > 0) {
    logger.trace({ ctx, progress }, 'No need to reset the progress, continue the previous run..');
    return progress;
  }

  logger.trace({ ctx, progress }, 'Resetting the job progress');

  const newProgress = propertyExternalIds.reduce((acc, externalId) => {
    const currentPropertyProgress = progress[externalId];
    acc[externalId] = {
      status: DALTypes.JobStatus.PENDING,
      lastSuccessfulSyncDate: currentPropertyProgress?.lastSuccessfulSyncDate || LastUpdateInitialDate,
    };
    return acc;
  }, {});

  await updateRecurringJobMetadata(ctx, jobId, { progress: newProgress });
  logger.trace({ ctx, progress: newProgress }, 'Job progress after reset');

  return newProgress;
};

const skipImportForProperty = (ctx, retryCount, propertyProgress) => {
  if (
    retryCount > 0 &&
    propertyProgress.status === DALTypes.JobStatus.PROCESSED &&
    propertyProgress.lastSuccessfulSyncDate === now().format(YEAR_MONTH_DAY_FORMAT)
  ) {
    logger.trace({ ctx, retryCount, propertyProgress }, 'Import terminated successfully for this property today');
    return true;
  }

  return false;
};

const importActiveLeasesForProperty = async (
  ctx,
  { jobId, progress, property, throwErrorOnTimeout, isInitialImport, forceSyncLeaseData, backendMode, propertyLastSuccessfulSyncDate },
) => {
  const propertyExternalId = property.externalId;
  logger.trace({ ctx, propertyExternalId, throwErrorOnTimeout, isInitialImport }, 'importActiveLeasesForProperty - start');
  try {
    const entries = await retrieveData(ctx, { propertyExternalId, backendMode, propertyLastSuccessfulSyncDate });
    await processData({ ...ctx, backendMode }, { property, entries, isInitialImport, forceSyncLeaseData });

    await updateProgress(ctx, {
      jobId,
      progress,
      propertyExternalId,
      updatedValues: { status: DALTypes.JobStatus.PROCESSED, lastSuccessfulSyncDate: now().format(YEAR_MONTH_DAY_FORMAT) },
    });
  } catch (error) {
    logger.error({ ctx, error, propertyExternalId }, 'Failed to get/process data for property');

    if (throwErrorOnTimeout && (error.response?.text.includes('timeout') || error.stack?.includes('timeout'))) {
      throw error;
    } else {
      await updateProgress(ctx, {
        jobId,
        progress,
        propertyExternalId,
        updatedValues: { status: DALTypes.JobStatus.FAILED },
      });
    }
  }
};

const jobFinishedSuccessfully = async ctx => {
  const {
    metadata: { progress },
  } = await getRecurringJobByName(ctx, DALTypes.Jobs.ImportAndProcessPartyWorkflows);

  const properties = await getPropertiesToImport(ctx);
  const failures = properties.filter(p => progress[p.externalId].status === DALTypes.JobStatus.FAILED);

  logger.trace(
    {
      ctx,
      job: DALTypes.Jobs.ImportAndProcessPartyWorkflows,
      progress,
      properties: properties.map(p => p.externalId),
      failures: failures.map(p => p.externalId),
    },
    'Check if job finished successfully',
  );

  return failures.length === 0;
};

export const importActiveLeases = async msg => {
  const { msgCtx: ctx, isInitialImport = false, forceSyncLeaseData = false } = msg;
  const retryCount = ctx.retryCount;

  if (ctx.isTrainingTenant) return { processed: true };
  const { id: jobId, metadata: jobMetadata } = await getRecurringJobByName(ctx, DALTypes.Jobs.ImportAndProcessPartyWorkflows);
  logger.trace({ ctx, retryCount, jobId, jobMetadata, isInitialImport, forceSyncLeaseData }, 'Preparing to retrieve Active leases');

  try {
    const tenant = await getTenant(ctx);
    const backendMode = get(tenant, 'metadata.backendIntegration.name', DALTypes.BackendMode.NONE);

    if (shouldSkipImport(backendMode)) {
      logger.trace({ ctx, backendMode }, 'Backend Mode is set to NONE');
      return { processed: true };
    }

    const properties = await getPropertiesToImport(ctx);
    const progress = await resetJobProgress(ctx, { jobId, jobMetadata, propertyExternalIds: properties.map(p => p.externalId), retryCount });

    await mapSeries(properties, async property => {
      const propertyProgress = progress[property.externalId];
      const propertyLastSuccessfulSyncDate = propertyProgress?.lastSuccessfulSyncDate;
      const requestParams = {
        jobId,
        progress,
        property,
        isInitialImport,
        forceSyncLeaseData,
        propertyLastSuccessfulSyncDate,
      };

      try {
        if (skipImportForProperty(ctx, retryCount, propertyProgress)) return;
        await importActiveLeasesForProperty(ctx, {
          ...requestParams,
          throwErrorOnTimeout: true,
          backendMode,
        });
      } catch (error) {
        logger.error({ ctx, error, propertyExternalId: property.externalId }, 'Failed to get/process data for property; waiting 60 seconds and trying again..');

        // retry the request after 60 seconds, but don't throw any error if the request fails again
        // because we want to continue to retrieve data for the next property
        await sleep(60000);
        await importActiveLeasesForProperty(ctx, { ...requestParams, throwErrorOnTimeout: false });
      }
    });
  } catch (e) {
    logger.error({ ctx, e }, 'Retrieving active leases failed');
    return { processed: false };
  }

  if (await jobFinishedSuccessfully(ctx)) {
    logger.trace({ ctx, retryCount }, 'Retrieving active leases completed successfully');
    return { processed: true };
  }

  logger.trace({ ctx, retryCount }, 'Retrieving active leases did not complete successfully');
  return { processed: false };
};
