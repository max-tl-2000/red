/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import newId from 'uuid/v4';
import del from 'del';
import { importInventory } from '../../import/excelInventory.js';
import { highlight, writeToFile } from '../../helpers/workbook.js';
import { APP_EXCHANGE, SYNC_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import nullish from '../../../common/helpers/nullish';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { createJob, updateJob } from '../../services/jobs';
import { getKeyPrefixForInventory, formatImportResultsFileUrl, getAssetsBucket, getOriginalImportFilesKeyPrefix } from './uploadUtil';
import { getS3Provider } from './s3Provider';
import { getInvalidOutCommSetup, validateAndUpdateNewEndedPrograms } from '../../import/helpers/dataSanityCheck';
import { getAllTeamPropertyCombinations } from '../../dal/teamsRepo';
import { getOutPrograms } from '../../dal/programsRepo';
import { handleRevaImportFilesReceived } from '../rms/rmsHandler';

const logger = loggerModule.child({ subType: 'uploadInventoryHandler' });

const DIRECTORY = './.temp/';
const PREFIX = 'import';
const SUFFIX = 'xlsx';
const bucket = getAssetsBucket();

const getWorkbookName = () => `${PREFIX}-${newId()}.${SUFFIX}`;
const getWorkbookPath = workbookName => path.join(DIRECTORY, workbookName);

const uploadResultsFileToS3 = (ctx, workbookName) => {
  const keyPrefix = getKeyPrefixForInventory(ctx.tenantId);
  return getS3Provider().saveFile(ctx, bucket, `${keyPrefix}/${workbookName}`, getWorkbookPath(workbookName), { acl: 'public-read' });
};

const uploadWorkbookFileToS3 = async (ctx, workbookFilePath, originalWorkbookName) => {
  originalWorkbookName = path.basename(originalWorkbookName); // if no metadata is set we get a path here

  const zipName = `${path.basename(workbookFilePath)}-${originalWorkbookName}.zip`;

  return await getS3Provider().uploadResultsFile(ctx, '', workbookFilePath, getOriginalImportFilesKeyPrefix, {
    zip: true,
    zipName,
    archivedFileName: originalWorkbookName,
  });
};

const createJobEntry = async (tenantId, authUser, metadata) => {
  const jobDetails = {
    name: DALTypes.Jobs.ImportDataFiles,
    step: DALTypes.ImportDataFilesSteps.ImportInventory,
    category: DALTypes.JobCategory.MigrateData,
  };

  const job = await createJob({ tenantId, authUser }, metadata.files, jobDetails);
  jobDetails.id = job.id;
  jobDetails.metadata = metadata;
  jobDetails.createdBy = job.createdBy;
  await updateJob(tenantId, jobDetails, DALTypes.JobStatus.IN_PROGRESS);

  return jobDetails;
};

const setJobAsFinished = async (ctx, uploadResults, workbookName) => {
  const { invalidCells, importError, jobDetails, entityCounts, rmsErrors } = uploadResults;
  const { tenantId } = ctx;

  const teamsPropertiesCombinations = await getAllTeamPropertyCombinations(ctx);
  const outPrograms = await getOutPrograms(ctx);
  const outProgramsSanityErrors = getInvalidOutCommSetup(teamsPropertiesCombinations, outPrograms);

  const newEndedProgramErrors = await validateAndUpdateNewEndedPrograms(ctx, outPrograms);
  logger.trace({ ctx, newEndedProgramErrors }, 'setJobAsFinished - newEndedProgramErrors');

  const errors = [
    ...invalidCells.map(({ row, column, ...rest }) => ({
      row: row + 1,
      column: column + 1,
      ...rest,
    })),
    ...newEndedProgramErrors,
    ...outProgramsSanityErrors,
    ...([importError] || []),
    ...(rmsErrors || []),
  ];

  const resultUrl = formatImportResultsFileUrl(tenantId, workbookName);
  jobDetails.metadata = {
    resultUrl,
    entityCounts,
  };

  await updateJob(
    tenantId,
    jobDetails,
    DALTypes.JobStatus.PROCESSED,
    {
      uploaded: 1,
      processed: 1,
    },
    errors,
  );
};

const getOriginalFileName = (inputWorkbookPath, metadata) => {
  if (!metadata || !metadata.files) return inputWorkbookPath;

  const file = metadata.files.find(f => f.path === inputWorkbookPath) || {};
  return file.originalName || inputWorkbookPath;
};

/**
 * @param {string} tenantId
 * @param {string} inputWorkbookPath
 * @param {boolean} removeInputFile Default false
 * @param {boolean} notifyDataChanged Default false
 *
 * TODO: there's a bug with babel and this syntax, we can't set default values
 * without an eslint error
 */
export const importTenantData = async ctx => {
  const { tenantId, authUser, inputWorkbookPath, removeInputFile, notifyDataChanged, metadata = {} } = ctx;
  logger.info({ ctx, inputWorkbookPath }, 'importing tenant data');
  logger.time({ ctx }, 'Import inventory');

  const jobDetails = await createJobEntry(tenantId, authUser, metadata);

  const originalWorkbookName = getOriginalFileName(inputWorkbookPath, metadata);

  await uploadWorkbookFileToS3(ctx, inputWorkbookPath, originalWorkbookName);

  const { invalidCells, error: importError, entityCounts } = await importInventory(ctx, inputWorkbookPath, originalWorkbookName, authUser);

  const workbookName = getWorkbookName();
  logger.info({ ctx, inputWorkbookPath, workbookName }, 'About to handle reva pricing');
  const { errors } = await handleRevaImportFilesReceived(ctx, workbookName);

  logger.timeEnd({ ctx }, 'Import inventory');
  const newWorkbook = await highlight(inputWorkbookPath, invalidCells);
  if (removeInputFile) {
    await del([inputWorkbookPath], { force: true }); // we need force to remove files that are outside of cwd
  }
  // only if nullish or true
  if (nullish(notifyDataChanged) || notifyDataChanged) {
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: SYNC_MESSAGE_TYPE.TENANT_DATA_CHANGED,
      message: { tenantId },
      ctx: { tenantId },
    });
  }

  const result = await writeToFile(newWorkbook, getWorkbookPath(workbookName));
  await uploadResultsFileToS3(ctx, workbookName);

  const uploadResults = {
    invalidCells,
    importError,
    jobDetails,
    entityCounts,
    rmsErrors: errors,
  };
  await setJobAsFinished(ctx, uploadResults, workbookName);

  return { processed: true, result, invalidCells };
};
