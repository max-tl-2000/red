/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import get from 'lodash/get';
import { processFiles } from '../../import/updates/csvImportUpdates';
import { csvResultPrefixes } from '../../import/updates/mappingFileHandlers';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { del } from '../../../common/helpers/xfs';
import { getS3Provider } from './s3Provider';
import { getTenant } from '../../services/tenantService';
import { getKeyPrefixForImportUpdates } from './uploadUtil';
import { extractZipFile } from '../../../common/server/zip-utils';
import { isDateInThePast } from '../../../common/helpers/date-utils';

const logger = loggerModule.child({ subType: 'importUpdates' });

export const removeFiles = files =>
  del(
    files.map(file => file.filePath),
    { force: true },
  );

const DIRECTORY = './.temp/';

// TODO: CPM-11259 - Clean-up the optimization code for the import of unit status
export const getLastUpdatedOptimizationFiles = async (ctx, options = {}) => {
  const filePaths = [];
  const lastUploads = {};
  const { isForYardiResidentSync } = options;

  try {
    const { tenantId } = ctx;
    const tenant = await getTenant(ctx);
    const { disableImportUpdateOptimization = false, ignoreImportUpdateOptimizationUntil } = tenant.metadata || {};
    const shouldTemporarilyDisableOptimization =
      ignoreImportUpdateOptimizationUntil && !isDateInThePast(ignoreImportUpdateOptimizationUntil, { timeUnit: 'minutes' });
    const shouldIgnoreOptimization = (disableImportUpdateOptimization || shouldTemporarilyDisableOptimization) && !isForYardiResidentSync;
    if (shouldIgnoreOptimization) return { filePaths, lastUploads };

    logger.info({ ctx }, 'start reading the last uploaded files');

    for (const prefix of csvResultPrefixes) {
      const lastUploadedFile = await getS3Provider().getLastUploadedFile(tenantId, prefix);
      if (lastUploadedFile && lastUploadedFile.name) {
        logger.info({ tenantId, lastUploadedFile }, 'handleMigrateDataFilesReceived lastFile');

        const lastFilePath = path.join(DIRECTORY, lastUploadedFile.name);
        await getS3Provider().getFile(ctx, lastUploadedFile.filePath, lastFilePath);
        filePaths.push({ filePath: lastFilePath });

        await extractZipFile(lastFilePath, DIRECTORY);
        const csvFilePath = lastFilePath.split('.zip')[0];
        lastUploads[prefix] = csvFilePath;
        filePaths.push({ filePath: csvFilePath });
      }
    }
    logger.info({ ctx }, 'last uploaded files read');
  } catch (error) {
    logger.error({ ctx, error }, 'getLastUpdatedOptimizationFiles');
  }

  return { filePaths, lastUploads };
};

export const isUpdateDataJob = job => job.name === DALTypes.Jobs.ImportUpdateDataFiles;

const shouldSkipMigration = async ctx => {
  const { isUIImport } = ctx;
  if (isUIImport) return false;

  const tenant = await getTenant(ctx);

  const backendMode = get(tenant, 'metadata.backendIntegration.name', DALTypes.BackendMode.NONE);
  return backendMode === DALTypes.BackendMode.NONE;
};

export const handleMigrateDataFilesReceived = async (ctx, files) => {
  if (await shouldSkipMigration(ctx)) {
    logger.warn({ ctx, files }, 'FTP files skipped because back-end mode is set to NONE');
    return {
      uploaded: files.length,
      skippedFiles: files,
      processed: 0,
      errors: [],
    };
  }

  const { filePaths: temporalFiles, lastUploads } = await getLastUpdatedOptimizationFiles(ctx);

  let result = {
    errors: [],
    processed: 0,
  };
  try {
    logger.info({ ctx, files }, 'handleMigrateDataFilesReceived processFiles');
    result = await processFiles(ctx, files, lastUploads, {
      tempFolder: DIRECTORY,
    });

    logger.info({ ctx, files }, 'handleMigrateDataFilesReceived processFiles completed');
  } catch (error) {
    logger.error({ ctx, files, error }, 'handleMigrateDataFilesReceived => processFiles');
  }

  try {
    if (result && result.resultFiles) {
      for (const prefix of Object.keys(result.resultFiles)) {
        const csvName = path.basename(result.resultFiles[prefix], '.csv');
        await getS3Provider().uploadResultsFile(ctx, csvName, result.resultFiles[prefix], getKeyPrefixForImportUpdates);
        temporalFiles.push({ filePath: result.resultFiles[prefix] });
      }
    }
  } catch (error) {
    logger.error({ ctx, files, error }, 'handleMigrateDataFilesReceived => uploadResultsFile');
  }

  try {
    logger.info({ ctx, files, temporalFiles }, 'Removing import updates files ');
    await removeFiles(temporalFiles);
  } catch (error) {
    logger.error({ ctx, files, error }, 'remove temporalFiles error');
  }

  return {
    uploaded: files.length,
    processed: result.processed,
    errors: result.errors,
  };
};
