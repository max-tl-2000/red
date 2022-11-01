/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fs from 'fs';
import split from 'lodash/split';
import { promisify } from 'bluebird';
import { getObject, getAllObjects, saveFile } from '../s3';
import {
  getKeyPrefixForImportUpdates,
  getPrivateBucket,
  getEncryptionKeyId,
  getOriginalImportFilesLatestKeyPrefix,
  getOriginalImportFilesKeyPrefix,
} from '../uploadUtil';
import loggerModule from '../../../../common/helpers/logger';
import { zipFile } from '../../../../common/server/zip-utils';
import { attempt } from '../../../../common/helpers/attempt';

const deleteFile = promisify(fs.unlink);

const logger = loggerModule.child({ subType: 'aws' });

const FILE_EXTENSION = '.zip';
const bucket = getPrivateBucket();
const encryptionKeyId = getEncryptionKeyId();
const doNotIncludeDatedPrefix = false;

const getUploadedDocuments = tenantId => getAllObjects(bucket, getKeyPrefixForImportUpdates(tenantId, doNotIncludeDatedPrefix));

export const getLastUploadedFile = async (tenantId, prefix) => {
  logger.info('getLastUploadedFile tenantId: ', tenantId);
  const uploadedFiles = await getUploadedDocuments(tenantId);
  logger.info('uploadedFiles ', uploadedFiles);

  return uploadedFiles.reduce(
    (acc, item) => {
      const fileName = path.basename(item, FILE_EXTENSION);
      if (fileName.indexOf(prefix) === -1) return acc;

      const date = fileName.split('-')[1];
      const accFileName = acc.name && acc.name.split('.')[0];
      const accDate = accFileName && accFileName.split('-')[1];
      return !accDate || date > accDate ? { name: path.basename(item), filePath: item } : acc;
    },
    { name: '', filePath: '' },
  );
};

const uploadFile = async (ctx, keyPrefix, name, filePath) =>
  await saveFile(ctx, bucket, `${keyPrefix}/${name}`, filePath, {
    metadata: {},
    encryptionType: 'aws:kms',
    keyId: encryptionKeyId,
  });

const zipAndUploadToS3 = async (ctx, fileName, filePath, getPrefixFn, { zip, zipName, archivedFileName }) => {
  const keyPrefix = getPrefixFn(ctx.tenantId);
  logger.info({ ctx, fileName, filePath, zip, zipName, archivedFileName, keyPrefix }, 'zipAndUploadToS3');
  if (!zip) return await uploadFile(ctx, keyPrefix, fileName, filePath);

  if (!zipName) {
    zipName = new RegExp(fileName).test(/\.zip$/) ? fileName : `${fileName}.zip`;
  }

  if (!archivedFileName) {
    archivedFileName = fileName;
  }

  const { zipFilePath, zipFileName } = await zipFile(filePath, zipName, archivedFileName);

  const s3Upload = await uploadFile(ctx, keyPrefix, zipFileName, zipFilePath);
  await deleteFile(zipFilePath);
  return s3Upload;
};

export const uploadResultsFile = async (ctx, fileName, filePath, getPrefixFn, zipInfo = { zip: true }) =>
  await zipAndUploadToS3(ctx, fileName, filePath, getPrefixFn, zipInfo);

const FILENAMES_TO_COPY_TO_LATEST = [
  'CommUnits',
  'MaintWorkOrders',
  'ResPropertyAmenities',
  'ResRoommates',
  'ResTenants',
  'ResUnitAmenities',
  'ResUnitStatus',
  'ResUnitTypes',
  'MriProperties',
  'MriRentableItems',
  'MriUnits',
  'MriAmenities',
  'MriUnitAmenities',
].map(f => f.toLowerCase());

export const uploadOriginalFile = async (ctx, fileName, filePath, zipInfo = { zip: true }, updateLatest = false) => {
  logger.info({ ctx, fileName, zip: zipInfo.zip, updateLatest }, 'uploadOriginalFile');
  const baseName = split(fileName, /(-|_|\.)/i, 1)[0];
  const suffix = fileName.split('.').pop();

  // This variable does not apply when not updating the "latest" dir
  const updateLatestFilename = updateLatest ? `${baseName}.${suffix}`.toLowerCase() : '';

  // TODO: for now, only updateLatest for specific baseNames
  if (updateLatest && !FILENAMES_TO_COPY_TO_LATEST.includes(baseName.toLowerCase())) {
    logger.info(
      { ctx, fileName, zip: zipInfo.zip, baseName, updateLatest },
      'uploadOriginalFile skipping update of latest because baseName is not to be uploaded',
    );
    return undefined;
  }

  logger.info({ ctx, updateLatestFilename, updateLatest }, 'uploadOriginalFile updateLatestFilename');

  const zipAndUpload = async () => {
    const uploadDestinationPathFn = updateLatest ? getOriginalImportFilesLatestKeyPrefix : getOriginalImportFilesKeyPrefix;
    logger.info({ ctx, fileName, baseName, zip: zipInfo.zip, updateLatest }, 'uploadOriginalFile zipAndUpload');
    await zipAndUploadToS3(ctx, updateLatest ? updateLatestFilename : fileName, filePath, uploadDestinationPathFn, zipInfo);
  };

  return await attempt({
    func: zipAndUpload,
    attempts: 3,
    autoExec: true,
    onAttemptFail: ({ error, attemptNumber }) => logger.warn({ ctx, error, fileName, attemptNumber }, 'uploadOriginalFile attempt fail'),
    delay: 1000,
    onFail: ({ error }) => {
      logger.error({ ctx, error }, 'uploadOriginalFile no more attempts left');
      throw error;
    },
  });
};

export const getFile = (ctx, sourceFilePath, targetFilePath) => getObject(ctx, bucket, sourceFilePath, targetFilePath);
