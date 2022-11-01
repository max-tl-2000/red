/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fse from 'fs-extra';
import Promise from 'bluebird';
import path from 'path';
import { updateJob } from '../../services/jobs';
import { DALTypes } from '../../../common/enums/DALTypes';
import { processFiles } from '../../import/converters/csvInventory';
import { mappingConverters } from '../../import/converters/mappingConverters';
import loggerModule from '../../../common/helpers/logger';
import { getKeyPrefixForConversion, formatConversionResultsFileUrl, getAssetsBucket } from './uploadUtil';
import { now } from '../../../common/helpers/moment-utils';
import { saveWorkbook } from '../../import/helpers/workbook';
import { getS3Provider } from './s3Provider';

const BASEFILE_CONVERSION_PATH = path.join(__dirname, '../../import/resources/InventoryBase.xlsx');
const logger = loggerModule.child({ subType: 'fileConverter' });

const DIRECTORY = 'conversion';
const PREFIX = 'converted';
const SUFFIX = 'xlsx';
const bucket = getAssetsBucket();
const convertedFileName = `${PREFIX}-${now().format('YYYY-MM-DD_HH-mm-ss')}.${SUFFIX}`;

const removeFiles = async files => {
  await Promise.map(files, async file => await fse.remove(file.filePath), {
    concurrency: 5,
  });
};

const convertFiles = async (ctx, files) => {
  const converterSettings = mappingConverters(files);

  logger.info(`Processing files: ${converterSettings}`);
  const output = await processFiles(converterSettings, BASEFILE_CONVERSION_PATH);

  return {
    uploaded: files.length,
    processed: converterSettings.length,
    output,
  };
};

const uploadResultsFileToS3 = (ctx, convertedFilePath) => {
  const keyPrefix = getKeyPrefixForConversion(ctx.tenantId);
  // TODO: restrict access to fetch from API to S3
  return getS3Provider().saveFile(ctx, bucket, `${keyPrefix}/${convertedFileName}`, convertedFilePath, { acl: 'public-read' });
};

export const convertInputData = async data => {
  const { jobDetails, tenantId, files, msgCtx } = data;
  let output;
  let jobResult;

  try {
    logger.info({ ctx: msgCtx, jobDetails, files }, 'Starting to process files.');
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.IN_PROGRESS);

    const result = await convertFiles(msgCtx, files);
    output = result.output;
    delete result.output;
    jobResult = result;

    logger.info({ ctx: msgCtx, jobDetails, jobResult }, 'Converted files.');
  } catch (error) {
    logger.error({ ctx: msgCtx, jobDetails, error }, 'Convert files error');
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.FAILED, '', [error]);
    throw error;
  } finally {
    removeFiles(files);
    logger.info({ ctx: msgCtx, jobDetails }, 'Convert files finished.');
  }

  if (!output) {
    logger.error({ ctx: msgCtx, jobDetails, files }, 'processed files had no output');
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.FAILED, '', [
      {
        message: `No output was created for the given ${files.length === 1 ? 'file' : 'files'}`,
      },
    ]);

    return { processed: true };
  }

  const convertedFilePath = await saveWorkbook(output, DIRECTORY, convertedFileName);
  if (convertedFilePath) {
    await uploadResultsFileToS3(msgCtx, convertedFilePath);

    jobDetails.metadata = {
      ...jobDetails.metadata,
      resultUrl: formatConversionResultsFileUrl(tenantId, convertedFileName),
    };
  }

  await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED, jobResult, []);

  return { processed: true };
};
