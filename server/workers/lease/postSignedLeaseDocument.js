/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fse from 'fs-extra';
import ftp from 'basic-ftp';
import { createReadStream } from 'fs';
import { getLeaseById } from '../../dal/leaseRepo';
import config from '../../config';

// This is needed for testing with ftp.box.com
// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

import loggerModule from '../../../common/helpers/logger';
import { getTenantRemoteFtpSettings } from '../../dal/tenantsRepo';
const logger = loggerModule.child({ subType: 'postSignedLeaseDocument' });

const cleanup = async (ctx, leaseId, leaseFolder) => {
  try {
    logger.trace({ ctx, leaseId, leaseFolder }, 'removing temp leases folder');
    await fse.remove(leaseFolder);
    logger.trace({ ctx, leaseId, leaseFolder }, 'removed temp leases folder');
  } catch (error) {
    logger.error({ ctx, error, leaseId, leaseFolder }, 'Error while cleaning up temp leases folder');
  }
};

const uploadFile = async (ctx, { ftpClient, leaseId, filepath, uploadFileName }) => {
  logger.trace({ ctx, leaseId, uploadFileName }, 'uploading file');

  await new Promise(async (resolve, reject) => {
    try {
      const stream = createReadStream(filepath).on('error', error => reject(error));
      await ftpClient.upload(stream, uploadFileName);
    } catch (error) {
      reject(error);
    }

    resolve();
  });

  logger.trace({ ctx, leaseId, uploadFileName }, 'lease uploaded');
};

export const exportSignedLeaseDocument = async ({ msgCtx: ctx, tenantId, leaseId, uploadFileName, filepath, leaseFolder }) => {
  logger.trace({ tenantId, leaseId, uploadFileName, filepath, leaseFolder }, 'exportSignedLeaseDocument');
  const ftpClient = new ftp.Client(30000);
  ftpClient.ftp.verbose = true;

  try {
    const lease = await getLeaseById(ctx, leaseId);
    const propertyName = lease.baselineData.propertyName;
    const tenantContext = {
      tenantId: config.auth.commonSchema,
    };
    const { remoteFTP, name } = await getTenantRemoteFtpSettings(tenantContext, ctx.tenantId);
    if (!remoteFTP) {
      logger.error({ ctx, leaseId }, 'Failed to post signed documents to FTP, RemoteFTP is not configured.');
      return { processed: false };
    }

    logger.trace({ ctx, leaseId }, 'connecting to FTP');
    const connected = await ftpClient.access({ ...remoteFTP, secure: false });
    logger.trace({ ctx, leaseId, connected }, 'connect');

    const cloudPrefix = config.cloudEnv === 'prod' ? '' : `${config.cloudEnv}_`;
    const folderPrefix = `Reva_${cloudPrefix}${name}`;
    const folderName = `${folderPrefix}/Leases/${propertyName}/`;
    await ftpClient.ensureDir(folderName);
    logger.trace({ ctx, leaseId, folderName }, 'changed current working directory');

    await uploadFile(ctx, { ftpClient, leaseId, filepath, uploadFileName });

    const uploadedFileSize = await ftpClient.size(uploadFileName);
    logger.trace({ ctx, leaseId, leaseFolder, uploadedFileSize }, 'uploaded file size to FTP');

    if (uploadedFileSize === 0) {
      logger.trace({ ctx, leaseId, leaseFolder }, 'empty file uploaded to FTP');
      return { processed: false };
    }

    await cleanup(ctx, leaseId, leaseFolder);
  } catch (error) {
    logger.error({ ctx, leaseId, error }, 'Failed to post signed documents to FTP');
    return { processed: false };
  } finally {
    ftpClient.close();
  }

  return { processed: true };
};
