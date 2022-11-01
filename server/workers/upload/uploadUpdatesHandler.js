/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import flattenDeep from 'lodash/flattenDeep';
import split from 'lodash/split';
import orderBy from 'lodash/orderBy';
import intersection from 'lodash/intersection';
import { updateJob, createJob } from '../../services/jobs';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { del } from '../../../common/helpers/xfs';
import { getS3Provider } from './s3Provider';
import { IMPORT_UPDATES_MESSAGE_TYPE } from '../../helpers/message-constants';
import { isRmsJob, handleRmsFilesReceived, isRmsImportError, handleInventoryUpdateReceived } from '../rms/rmsHandler';
import { handleMigrateDataFilesReceived, isUpdateDataJob } from './migrateDataHandler';
import { RmsImportError, YardiResidentImportFiles, YardiUnitsImportFiles } from '../../../common/enums/enums';
import { MISSING_HANDLERS } from '../../import/updates/csvImportUpdates';
import { getFileChecksum } from './uploadUtil';
import { getAlreadyImportedFiles, storeFileWithChecksum, getLastProcessedFiles } from '../../dal/jobsRepo';
import { getTenant } from '../../services/tenantService';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import { createBulkEmailsMessages } from '../../services/bulkEmails/bulkEmails';
import { notifyPersons, markPostAsSent, getPostById } from '../../services/cohortCommsService';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import { runInTransaction } from '../../database/factory';

const NO_HANDLER_FOUND_ERROR = 'NO_HANDLER_FOUND_ERROR';

const logger = loggerModule.child({ subType: 'importUpdates' });

const removeFiles = (ctx, files) => {
  const filepaths = files.map(file => file.filePath);
  logger.trace({ ctx, filepaths }, 'Removing files');

  return del(filepaths, { force: true });
};

const getFilesByType = (files, fileType) => files.filter(file => split(file.originalName, /(-|_|\.)/i, 1)[0] === fileType);
const getVersionSuffix = originalFileName => split(originalFileName, '_', 2)[1];
const getFileByNameAndVersion = (files, fileName, versionSuffix) => files.find(file => file.originalName === [fileName, versionSuffix].join('_'));

const getPairForReceivedFile = (receivedFile, receivedFileType, prevReceivedFiles) => {
  const versionSuffix = getVersionSuffix(receivedFile.originalName);
  const pairFileType = receivedFileType === YardiResidentImportFiles.ResTenants ? YardiResidentImportFiles.ResRoommates : YardiResidentImportFiles.ResTenants;
  return getFileByNameAndVersion(prevReceivedFiles, pairFileType, versionSuffix);
};

const getFilesToProcessIfOnlyResTenantsFileWasReceived = async (ctx, { files, resTenantsFile, prevProcessedFiles }) => {
  const tenantsFileAlreadyProcessed = prevProcessedFiles.some(file => file.originalName === resTenantsFile.originalName);

  if (tenantsFileAlreadyProcessed) {
    logger.trace({ ctx }, 'getFilesToProcess - only ResTenants file was received but it was already processed');
    return files;
  }

  logger.trace({ ctx }, 'getFilesToProcess - only ResTenants file was received');

  const prevRoommateFile = getPairForReceivedFile(resTenantsFile, YardiResidentImportFiles.ResTenants, prevProcessedFiles);
  return prevRoommateFile ? [...files, resTenantsFile, prevRoommateFile] : files;
};

const getFilesToProcessIfOnlyResRoommatesFileWasReceived = async (ctx, { files, resRoommatesFile, prevProcessedFiles }) => {
  const roommatesFileAlreadyProcessed = resRoommatesFile && prevProcessedFiles.some(file => file.originalName === resRoommatesFile.originalName);

  if (roommatesFileAlreadyProcessed) {
    logger.trace({ ctx }, 'getFilesToProcess - only ResRoommates file was received but it was already processed');

    return files;
  }

  logger.trace({ ctx }, 'getFilesToProcess - only ResRoommates file was received');

  const prevTenantFile = getPairForReceivedFile(resRoommatesFile, YardiResidentImportFiles.ResRoommates, prevProcessedFiles);
  return prevTenantFile ? [...files, resRoommatesFile, prevTenantFile] : files;
};

const filesWithConditionsToImport = [YardiResidentImportFiles.ResRoommates, YardiResidentImportFiles.ResTenants, YardiUnitsImportFiles.CommUnits];

const getAllFilesWithoutConditionsToImport = files => files.filter(file => !filesWithConditionsToImport.includes(split(file.originalName, '_', 1)[0]));

const getLastCommonVersionForTenantsAndRoommates = (resRoommatesFiles, resTenantsFiles) => {
  const resRoommatesSufixes = resRoommatesFiles.map(file => getVersionSuffix(file.originalName));
  const resTenantsFilesSufixes = resTenantsFiles.map(file => getVersionSuffix(file.originalName));

  return intersection(resRoommatesSufixes, resTenantsFilesSufixes)[0];
};

const shouldSkipCommUnitFiles = async ctx => {
  const tenant = await getTenant(ctx);
  return tenant?.settings?.customImport?.lossLeaderUnitColumn === 'false';
};

const getFilesToProcess = async (ctx, files) => {
  const orderedFiles = orderBy(files, ['originalName'], ['desc']);

  let filesWithoutConditionsToImport = getAllFilesWithoutConditionsToImport(orderedFiles);

  const resRoommatesFiles = getFilesByType(orderedFiles, YardiResidentImportFiles.ResRoommates);
  const resTenantsFiles = getFilesByType(orderedFiles, YardiResidentImportFiles.ResTenants);
  const commUnitsFiles = getFilesByType(orderedFiles, YardiUnitsImportFiles.CommUnits);

  if (!(await shouldSkipCommUnitFiles(ctx))) {
    filesWithoutConditionsToImport = [...filesWithoutConditionsToImport, ...commUnitsFiles];
  }

  if (!resTenantsFiles.length && !resRoommatesFiles.length) {
    logger.trace({ ctx }, 'getFilesToProcess - none of ResTenants and ResRoommates files were received');
    return files;
  }

  if (resTenantsFiles.length && resRoommatesFiles.length) {
    const lastCommonVersionForTenantsAndRoommates = getLastCommonVersionForTenantsAndRoommates(resRoommatesFiles, resTenantsFiles);

    if (!lastCommonVersionForTenantsAndRoommates) {
      logger.trace({ ctx }, 'getFilesToProcess - the ResTenants and ResRoommates files had different versions');
      return filesWithoutConditionsToImport;
    }
    logger.trace({ ctx }, 'getFilesToProcess - both ResTenants and ResRoommates files were received');

    const resTenantsFile = getFileByNameAndVersion(files, YardiResidentImportFiles.ResTenants, lastCommonVersionForTenantsAndRoommates);
    const resRoommatesFile = getFileByNameAndVersion(files, YardiResidentImportFiles.ResRoommates, lastCommonVersionForTenantsAndRoommates);
    return [...filesWithoutConditionsToImport, resTenantsFile, resRoommatesFile];
  }

  const prevProcessedFiles = (await getLastProcessedFiles(ctx)) || [];

  if (resTenantsFiles.length && !resRoommatesFiles.length) {
    return await getFilesToProcessIfOnlyResTenantsFileWasReceived(ctx, {
      files: filesWithoutConditionsToImport,
      resTenantsFile: resTenantsFiles[0],
      prevProcessedFiles,
    });
  }

  return await getFilesToProcessIfOnlyResRoommatesFileWasReceived(ctx, {
    files: filesWithoutConditionsToImport,
    resRoommatesFile: resRoommatesFiles[0],
    prevProcessedFiles,
  });
};

const uploadOriginalFilesToS3 = async (ctx, files, isRms) => {
  try {
    logger.info({ ctx, files, isRms }, 'upload original files started');
    const now = Date.now();
    /* upload zipped file to date prefixed dir */

    const s3Provider = getS3Provider();
    // these uploads may occur currently, because each file will have a distinct name
    await Promise.all(files.map(file => s3Provider.uploadOriginalFile(ctx, `${now}-${file.originalName}`, file.filePath)));
    /* upload unzipped file to "latest" dir */

    logger.info({ ctx, files, isRms }, 'upload original files about to update latest');
    // these uploads must occur in series to ensure the actual latest one is the last one to be uploaded
    await mapSeries(files, file => s3Provider.uploadOriginalFile(ctx, file.originalName, file.filePath, { zip: false }, true /* updateLatest */));
    logger.info({ ctx }, 'upload original files finished');
  } catch (error) {
    logger.error({ ctx, error }, 'upload original files failed');

    const customError = isRms ? { ...error, rmsErrorType: RmsImportError.S3_UPLOAD_FAILED_ERROR } : error;
    throw customError;
  }
};

const createJobDetails = async (ctx, files, jobDetails) => {
  const jobFiles = files.map(f => ({
    originalName: f.originalName,
    filePath: f.filePath,
  }));
  const metadata = {
    ...jobDetails,
    messageKey: IMPORT_UPDATES_MESSAGE_TYPE.IMPORT_FILES,
    category: DALTypes.JobCategory.MigrateData,
  };

  return await createJob(ctx, jobFiles, metadata);
};

const areFtpFiles = jobDetails => !jobDetails;

const filterRmsFiles = files => files.filter(isRmsJob);
const filterMigrateDataFiles = files => files.filter(isUpdateDataJob);
const filterNotRecognizedFiles = files => files.filter(file => !isRmsJob(file) && !isUpdateDataJob(file));

const validateFileChecksums = async (ctx, files, tenant) => {
  if (!files.length) {
    return {
      filesToProcess: [],
      skippedFiles: [],
    };
  }
  const filesWithChecksums = await mapSeries(files, async file => ({
    ...file,
    checksum: await getFileChecksum(file.filePath),
  }));

  if (tenant.metadata && tenant.metadata.duplicateDetectionEnabled) {
    const alreadyImportedFiles = await getAlreadyImportedFiles(
      ctx,
      filesWithChecksums.map(file => file.checksum),
    );
    const alreadyImportedFilesChecksums = alreadyImportedFiles.map(importedFile => importedFile.checksum);

    return {
      filesToProcess: filesWithChecksums.filter(file => !alreadyImportedFilesChecksums.includes(file.checksum)),
      skippedFiles: filesWithChecksums.filter(file => alreadyImportedFilesChecksums.includes(file.checksum)),
    };
  }

  return {
    filesToProcess: filesWithChecksums,
    skippedFiles: [],
  };
};

const groupFtpFilesByJobNameAndCreateJobs = async (ctx, files, skippedFiles) => {
  const jobsDetails = [];
  const rmsFiles = filterRmsFiles(files);
  const skippedRmsFiles = filterRmsFiles(skippedFiles);
  const migrateDataFiles = filterMigrateDataFiles(files);
  const skippedMigrateDataFiles = filterMigrateDataFiles(skippedFiles);
  const notRecognizedFiles = filterNotRecognizedFiles(files);

  if (rmsFiles.length) {
    const rmsJob = await createJobDetails(ctx, rmsFiles.concat(skippedFiles || []), {
      name: DALTypes.Jobs.ImportRmsFiles,
      step: DALTypes.ImportRmsFilesSteps.RmsUpdates,
    });

    jobsDetails.push(rmsJob);
  }

  if (migrateDataFiles.length) {
    const migrateDataJob = await createJobDetails(ctx, migrateDataFiles.concat(skippedFiles || []), {
      name: DALTypes.Jobs.ImportUpdateDataFiles,
      step: DALTypes.ImportUpdateDataFilesSteps.ImportUpdates,
    });
    jobsDetails.push(migrateDataJob);
  }

  if (skippedRmsFiles.length && !rmsFiles.length) {
    const rmsJob = await createJobDetails(ctx, skippedRmsFiles, {
      name: DALTypes.Jobs.ImportRmsFiles,
      step: DALTypes.ImportRmsFilesSteps.RmsUpdates,
    });
    jobsDetails.push(rmsJob);
  }

  if (skippedMigrateDataFiles.length && !migrateDataFiles.length) {
    const migrateDataJob = await createJobDetails(ctx, skippedMigrateDataFiles, {
      name: DALTypes.Jobs.ImportUpdateDataFiles,
      step: DALTypes.ImportUpdateDataFilesSteps.ImportUpdates,
    });
    jobsDetails.push(migrateDataJob);
  }

  if (notRecognizedFiles.length) {
    logger.error({ ctx, notRecognizedFiles }, 'Not recognized files, check the SFTP tenant config');
    await uploadOriginalFilesToS3(ctx, notRecognizedFiles);
  }

  return { rmsFiles, migrateDataFiles, skippedFiles, jobsDetails };
};

const groupAdminFilesByJobNameAndUpdateJob = async (ctx, files, skippedFiles, jobDetails) => {
  await updateJob(ctx.tenantId, jobDetails, DALTypes.JobStatus.IN_PROGRESS);
  const jobsDetails = [jobDetails];
  return isRmsJob(jobDetails) ? { jobsDetails, rmsFiles: files, skippedFiles } : { jobsDetails, migrateDataFiles: files, skippedFiles };
};

const groupFilesAndUpsertJobs = async (ctx, files, jobDetails, tenant) => {
  const { filesToProcess, skippedFiles } = await validateFileChecksums(ctx, files, tenant);
  skippedFiles && skippedFiles.length && logger.info({ ctx, skippedFiles }, 'These files were already imported. They will be skipped');
  filesToProcess && filesToProcess.length && logger.info({ ctx, filesToProcess }, 'Files that will be imported');

  if (areFtpFiles(jobDetails)) {
    return await groupFtpFilesByJobNameAndCreateJobs(ctx, filesToProcess, skippedFiles);
  }

  return await groupAdminFilesByJobNameAndUpdateJob(ctx, filesToProcess, skippedFiles, jobDetails);
};

const processFilesByJobName = async (ctx, files, jobDetails) => {
  const jobsResults = [];

  logger.info({ ctx, files, jobDetails }, 'processFilesByJobName');

  const tenant = await getTenant(ctx);
  const { rmsFiles, migrateDataFiles, jobsDetails, skippedFiles = [] } = await groupFilesAndUpsertJobs(ctx, files, jobDetails, tenant);

  if (rmsFiles && rmsFiles.length) {
    logger.info({ ctx, rmsFiles }, 'processFilesByJobName uploading original rmsFiles');
    await uploadOriginalFilesToS3(ctx, rmsFiles, true);

    const rmsJob = jobsDetails.find(isRmsJob);
    const rmsResults = await handleRmsFilesReceived(ctx, rmsFiles);
    jobsResults.push({ ...rmsJob, results: { ...rmsResults, skippedFiles } });
  }

  if (migrateDataFiles && migrateDataFiles.length) {
    logger.info({ ctx, migrateDataFiles }, 'processFilesByJobName uploading original migrateDataFiles');
    await uploadOriginalFilesToS3(ctx, migrateDataFiles);

    const migrateDataJob = jobsDetails.find(isUpdateDataJob);
    let migrateDataResults = await handleMigrateDataFilesReceived(ctx, migrateDataFiles);
    // we should check for resUnitStatus and MRIUnits to not run the query everytime
    const rmsResults = await handleInventoryUpdateReceived(ctx);
    migrateDataResults = { ...migrateDataResults, errors: [...migrateDataResults.errors, ...rmsResults.errors] };

    jobsResults.push({
      ...migrateDataJob,
      results: { ...migrateDataResults, skippedFiles: [...skippedFiles, ...(migrateDataResults.skippedFiles || [])] },
    });
  }

  if (skippedFiles && skippedFiles.length && !(rmsFiles && rmsFiles.length) && !(migrateDataFiles && migrateDataFiles.length)) {
    logger.info({ ctx, skippedFiles }, 'processFilesByJobName skipping unrecognized files');
    const migrateDataJob = jobsDetails.find(isUpdateDataJob);
    const rmsJob = jobsDetails.find(isRmsJob);

    jobsResults.push({ ...(migrateDataJob || rmsJob), results: { skippedFiles, errors: [] } });
  }

  return {
    jobsResults,
    importedFiles: (rmsFiles || []).concat(migrateDataFiles || []),
  };
};

const updateJobsWithError = async (ctx, { error, jobDetails, jobsResults }) => {
  const { tenantId } = ctx;
  if (jobsResults && jobsResults.length) {
    await execConcurrent(jobsResults, async job => await updateJob(tenantId, job, DALTypes.JobStatus.FAILED, '', [error]));
  } else {
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.FAILED, '', [error]);
  }
};

const updateProcessedJobs = async (ctx, { jobsResults, jobDetails, customError, filesToProcess }) => {
  const getJobStatus = (errors = []) => (errors.every(err => err.error === MISSING_HANDLERS) ? DALTypes.JobStatus.PROCESSED : DALTypes.JobStatus.FAILED);

  const { tenantId } = ctx;

  if (!jobsResults.length) {
    return filesToProcess.length
      ? await updateJobsWithError(ctx, { error: customError || NO_HANDLER_FOUND_ERROR, jobDetails })
      : await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED);
  }

  return await execConcurrent(jobsResults, async job => {
    const details = {
      id: job.id,
      step: job.step || Object.keys(job.steps)[0],
      metadata: job.metadata,
      createdBy: jobDetails && jobDetails.createdBy,
    };
    const { errors } = job.results || {};
    const status = getJobStatus(errors);
    return updateJob(tenantId, details, status, job.results, errors);
  });
};

const checkForRmsErrors = (ctx, jobsResults) =>
  jobsResults.find(job => {
    const { errors, file } = job.results;
    if (!errors.length || !isRmsImportError(errors[0])) return false;

    logger.error({ ctx, ...job.metadata, file }, `RMS IMPORT ERROR: ${JSON.stringify(errors[0])}`);
    return true;
  });

const saveImportedFiles = async (ctx, files, results) => {
  const NO_HANDLERS_ADDED = 'NO_HANDLERS_ADDED';

  const jobResults = results.map(result => result.results);
  const jobErrors = flattenDeep(jobResults.map(res => res.errors));
  const erroredOutFiles = flattenDeep(jobErrors.map(error => error.files && error.error !== NO_HANDLERS_ADDED));
  const filesToSave = files.filter(file => !erroredOutFiles.includes(file.originalName));

  logger.info({ filesToSave, ctx }, 'Files to save checksum for');

  await mapSeries(filesToSave, async file => await storeFileWithChecksum(ctx, file));
};

export const importUpdates = async data => {
  const { tenantId, files, isTestMode, isUIImport, msgCtx } = data;
  const ctx = { tenantId, isUIImport, ...msgCtx };
  const { jobDetails } = data;
  let jobsResults = [];
  let importedFiles = [];
  let filesToProcess = files;

  try {
    logger.info({ jobDetails, files, ctx }, 'importUpdates Starting to process files.');
    filesToProcess = await getFilesToProcess(ctx, files);
    ({ jobsResults, importedFiles } = await processFilesByJobName(ctx, filesToProcess, jobDetails));
    logger.info({ ctx, jobsResults }, 'Imported files');

    await saveImportedFiles(ctx, importedFiles, jobsResults);
  } catch (error) {
    logger.error({ ctx, jobDetails, error, jobsResults }, 'importUpdates error');

    const rmsErrorType = error.rmsErrorType;
    if (rmsErrorType === RmsImportError.S3_UPLOAD_FAILED_ERROR) {
      logger.error({ ctx, files }, `RMS IMPORT ERROR: ${JSON.stringify(rmsErrorType)}`);
    }

    await updateJobsWithError(ctx, { error, jobDetails, jobsResults });

    throw error;
  } finally {
    logger.info({ jobDetails, jobsResults, ctx }, 'Import files finished.');

    const rmsError = checkForRmsErrors(ctx, jobsResults);
    await updateProcessedJobs(ctx, { jobsResults, jobDetails, customError: rmsError, filesToProcess });

    if (!isTestMode) {
      filesToProcess.length && (await removeFiles(ctx, filesToProcess));
    }
  }

  return { processed: true };
};

const sendPost = async (ctx, postId) => {
  await markPostAsSent(ctx, postId);
  await notifyPersons(ctx, postId);
};

const notifyClient = async (ctx, postId, userId) => {
  logger.trace({ ctx, postId }, 'notifyClient - start');
  const { message, messageDetails, rawMessage, rawMessageDetails, ...restPost } = await getPostById(ctx, postId);
  await notify({
    ctx,
    event: eventTypes.POST_SENT,
    data: {
      post: restPost,
    },
    routing: { users: [userId] },
  });
  logger.trace({ ctx, postId }, 'notifyClient - done');
};

export const importCohortFile = async data => {
  const { tenantId, msgCtx, jobDetails } = data;
  const { postId, fileId, createdBy } = jobDetails;
  const ctx = { tenantId, authUser: { id: createdBy }, ...msgCtx };
  logger.trace({ ctx, postId, fileId }, 'importCohortFile - start');

  try {
    await runInTransaction(async innerTrx => {
      const innerCtx = { ...ctx, trx: innerTrx };
      await sendPost(innerCtx, postId);
      await createBulkEmailsMessages(innerCtx, postId);
      await notifyClient(innerCtx, postId, createdBy);
    });
  } catch (error) {
    logger.error({ ctx, error, postId, fileId }, 'Error during the import of the cohort file');
    await notify({
      ctx: msgCtx,
      event: eventTypes.POST_SENT_FAILURE,
      data: {
        postId,
        errorMessage: error.token || '',
      },
      routing: { users: [createdBy] },
    });

    return { processed: false };
  }

  await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED, {
    processed: 1,
  });

  logger.trace({ ctx, postId, fileId }, 'importCohortFile - done');

  return { processed: true };
};
