/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import thenify from '../../../common/helpers/thenify';
import { getS3Provider } from './s3Provider';
import { getExportsKeyPrefix, getPrivateBucket, getEncryptionKeyId } from './uploadUtil';
import loggerModule from '../../../common/helpers/logger';
import { zipFile } from '../../../common/server/zip-utils';
import { updateExportLogMetadata } from '../../services/export';

const logger = loggerModule.child({ subType: 'export' });
const deleteFile = thenify(fs.unlink);

const deleteExportFiles = async filePaths => await Promise.all(filePaths.map(async file => await deleteFile(file)));

export const handleUploadExportFile = async payload => {
  const { msgCtx, tenantId, filePath, exportLogIds } = payload;

  try {
    logger.info({ ctx: msgCtx, uploadExportFilePayload: payload }, 'Uploading export file to S3');

    const { zipFilePath, zipFileName } = await zipFile(filePath);
    const bucket = getPrivateBucket();
    const keyPrefix = getExportsKeyPrefix(tenantId);
    const key = `${keyPrefix}/${zipFileName}`;

    logger.info({ ctx: msgCtx }, 'Uploading export file to S3');
    const options = {
      encryptionType: 'aws:kms',
      keyId: getEncryptionKeyId(),
    };
    await getS3Provider().saveFile(msgCtx, bucket, key, zipFilePath, options);

    if (exportLogIds && exportLogIds.length) {
      await updateExportLogMetadata(msgCtx, exportLogIds, { filePath, s3Key: key });
    }

    logger.info({ ctx: msgCtx, uploadS3Payload: payload }, 'Uploaded export file to S3 successfully');

    await deleteExportFiles([filePath, zipFilePath]);
  } catch (error) {
    logger.error({ ctx: msgCtx, error, payload }, 'Failed to upload export file to S3');
    throw error;
  }

  return { processed: true };
};
