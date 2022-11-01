/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fse from 'fs-extra';
import Promise from 'bluebird';
import getUUID from 'uuid/v4';
import { getS3Provider } from './s3Provider';
import config from '../../config';
import { getRelativeUploadPath } from './uploadUtil';
import { extractAllowedFilesFromArchive, getUploadedFiles } from '../../../common/helpers/uploadUtils';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { createJob, updateJob } from '../../services/jobs';

const logger = loggerModule.child({ subType: 'fileUpload' });

const createVoiceMessagesFolder = tenantId => path.join(path.resolve(config.aws.efsRootFolder), tenantId, 'voicemessages', getUUID());

const deleteUploadedVoiceMessages = async ctx => {
  logger.info('Deleting uploaded voice messages from S3', {
    ctx,
    jobDetails: ctx.jobDetails,
  });
  await getS3Provider().deleteAllVoiceMessages(ctx);
};

const removeExistingVoiceMessages = async ctx => await Promise.all([fse.remove(ctx.uploadFolder), deleteUploadedVoiceMessages(ctx)]);

const processMp3s = async ctx => {
  logger.info({ ctx }, '[VOICE MESSAGES] Processing voice messages...');

  const voiceMessages = await getUploadedFiles(ctx.uploadFolder);

  const total = voiceMessages.length;
  let current = 1;
  await Promise.map(
    voiceMessages,
    async filePath => {
      const parsedPath = path.parse(getRelativeUploadPath(ctx, filePath));
      const folders = parsedPath.dir.split(path.sep).filter(folder => folder.length > 0);
      await getS3Provider().processMp3(ctx, filePath, folders);
      notify({
        ctx,
        event: eventTypes.JOB_PROGRESS,
        data: { jobDetails: ctx.jobDetails, current, total },
      });
      current++;
      return Promise.resolve();
    },
    { concurrency: 5 },
  );

  return { total, errors: [] };
};

export const uploadVoiceMessages = async data => {
  const { msgCtx, tenantId, authUser, metadata } = data;

  const filePath = metadata.files[0].path;
  let errors = [];
  const jobDetails = {
    name: DALTypes.Jobs.UploadVoiceMessages,
    step: DALTypes.ImportDataFilesSteps.ImportVoiceMessages,
    category: DALTypes.JobCategory.MigrateData,
  };
  const ctx = { ...msgCtx, jobDetails };

  try {
    const job = await createJob({ tenantId, authUser }, metadata.files, jobDetails);
    jobDetails.id = job.id;
    jobDetails.metadata = metadata;
    jobDetails.createdBy = job.createdBy;
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.IN_PROGRESS);

    logger.info({ ctx, jobDetails, filePath }, '[VOICE MESSAGES] Starting voice message upload.');

    ctx.uploadFolder = createVoiceMessagesFolder(ctx.tenantId);
    await removeExistingVoiceMessages(ctx);
    await extractAllowedFilesFromArchive(ctx, filePath, ctx.uploadFolder, { allowedExtensions: config.import.allowedVoiceMessageExtensions });

    const jobResult = await processMp3s(ctx);
    const fileCount = jobResult.total;
    errors = jobResult.errors;
    logger.info({ ctx, jobDetails }, `[VOICE MESSAGES] Processed and uploaded to S3: ${fileCount} voice message files.`);
  } catch (error) {
    logger.error({ ctx, error, jobDetails }, '[VOICE MESSAGES] uploadVoiceMessages error');
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED, '', [error]);
    throw error;
  } finally {
    ctx.uploadFolder && (await fse.remove(ctx.uploadFolder));
  }

  logger.info({ ctx, jobDetails }, '[VOICE MESSAGES] Voice message upload finished.');
  await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED, '', errors.length ? errors : undefined);

  return { processed: true };
};
