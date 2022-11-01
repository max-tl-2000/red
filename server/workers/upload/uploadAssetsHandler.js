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
import { clearAssets, cleanupOrphanedPhysicalAssets } from '../../dal/assetsRepo';
import config from '../../config';
import { extractAllowedFilesFromArchive, getUploadedFiles } from '../../../common/helpers/uploadUtils';
import { getRelativeUploadPath, getKeyPrefixForAssets } from './uploadUtil';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { createJob, updateJob } from '../../services/jobs';
import thenify from '../../../common/helpers/thenify';
import { admin } from '../../common/schemaConstants';
import { getTenants } from '../../dal/tenantsRepo';
import { knex } from '../../database/factory';

const logger = loggerModule.child({ subType: 'fileUpload' });

const getNewUploadAssetsFolder = tenantId => path.join(path.resolve(config.aws.efsRootFolder), tenantId, 'assets', getUUID());

const mapToAssetKeys = (ctx, assetIds) => {
  const keyPrefix = getKeyPrefixForAssets(ctx.tenantId);
  return assetIds.map(assetId => `${keyPrefix}/${assetId}`);
};

const deleteUploadedAssets = async (ctx, assetIds) => {
  logger.info({ ctx, ...(ctx.jobDetails ? { jobDetails: ctx.jobDetails } : {}) }, 'Deleting uploaded assets from S3');
  const assetKeys = mapToAssetKeys(ctx, assetIds);
  await getS3Provider().deleteAssetsByKeys(ctx, assetKeys);
};

const preCleanup = async (ctx, assetBasePaths) =>
  await Promise.mapSeries(assetBasePaths, async basePath => {
    const assets = await clearAssets(ctx, basePath);
    if (!assets || !assets.length) return;

    // The following code is just to support tenants with assets before CPM-14530
    // once that ticket is deployed we can remove the next two lines
    const assetsToDelete = assets.filter(asset => !asset.physicalAssetId);

    logger.debug({ ctx, assetsToDelete }, 'assets to delete after clearing the db');

    // shouldn't this be assetsToDelete.map instead of assets?
    assetsToDelete.length &&
      (await deleteUploadedAssets(
        ctx,
        assets.map(it => it.uuid),
      ));
  });

const readDir = thenify(fse.readdir);
const readStats = thenify(fse.stat);

const hasAssetsRootDirectory = async uploadFolder => {
  const uploadedRootDirectories = await readDir(uploadFolder);
  if (uploadedRootDirectories.length !== 1) return false;

  if ((await readStats(path.join(uploadFolder, uploadedRootDirectories[0]))).isFile()) {
    return false;
  }

  return !['Employees', 'Properties'].some(key => key === uploadedRootDirectories[0]);
};

const getFolderNames = (ctx, filePath) => {
  const parsedPath = path.parse(getRelativeUploadPath(ctx, filePath));
  return parsedPath.dir.split(path.sep).filter(folder => folder.length > 0);
};

const processImages = async (ctx, images) => {
  const total = images.length;
  let current = 1;
  const errors = [];

  logger.debug({ ctx, total }, 'processImages start');

  await Promise.map(
    images,
    async filePath => {
      const folders = getFolderNames(ctx, filePath);
      logger.debug({ ctx, folders, file: filePath }, 'processImage start');
      const result = await getS3Provider().processAsset(ctx, filePath, folders);

      logger.debug({ ctx, result, file: filePath }, 'processImage result');

      if (result?.errors) {
        const relativeUploadPath = getRelativeUploadPath(ctx, filePath);
        logger.error({ ctx, relativeUploadPath, file: filePath, errors: result.errors }, 'processImage result error');
        errors.push({ filePath: relativeUploadPath, errors: result.errors });
      }

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

  const result = { total, errors };

  logger.debug({ result }, 'processImages return value');

  return result;
};

export const processIncomingAssets = async (ctx, filePath) => {
  logger.info({ ctx, file: filePath }, '[ASSETS] Processing assets...');
  const imageSize = config.isDevelopment ? 650 : config.resizeImageOnUploadTo;

  logger.debug({ ctx, file: filePath }, '[ASSETS] extracting files start');
  const { emptyDirectories } = await extractAllowedFilesFromArchive(ctx, filePath, ctx.uploadFolder, {
    isImageContent: true,
    imageSize,
    allowedExtensions: config.import.allowedImageExtensions,
  });

  logger.debug({ ctx, file: filePath }, '[ASSETS] extracting files done');

  if (!(await hasAssetsRootDirectory(ctx.uploadFolder))) {
    logger.error({ ctx, file: filePath, uploadFolder: ctx.uploadFolder }, 'NO_ASSETS_ROOT_FOLDER');
    return {
      total: 0,
      errors: ['NO_ASSETS_ROOT_FOLDER'],
    };
  }

  const images = await getUploadedFiles(ctx.uploadFolder);

  logger.debug({ ctx }, '[ASSETS] images uploaded');

  const assetBasePaths = Array.from(
    images.reduce((acc, imagePath) => {
      const [, entityType, entityName] = getFolderNames(ctx, imagePath);
      const entry = entityName ? `/${entityType}/${entityName}/` : `/${entityType}/${path.basename(imagePath)}`;
      acc.add(entry);
      return acc;
    }, new Set(emptyDirectories.map(d => d.substring(d.indexOf('/'))))),
  );

  logger.debug({ ctx, assetBasePathsCount: assetBasePaths.length }, '[ASSETS] preCleanup start');

  await preCleanup(ctx, assetBasePaths);

  logger.debug({ ctx }, '[ASSETS] preCleanup done');

  return await processImages(ctx, images);
};

export const uploadBase64Image = (ctx, data) => getS3Provider().uploadBase64Image(ctx, data);

export const uploadAssets = async data => {
  const { msgCtx, tenantId, authUser, filePath, metadata } = data;
  let errors = [];
  const jobDetails = {
    name: DALTypes.Jobs.ImportDataFiles,
    step: DALTypes.ImportDataFilesSteps.ImportAssets,
    category: DALTypes.JobCategory.MigrateData,
  };
  const ctx = { ...msgCtx, jobDetails };

  try {
    const job = await createJob({ tenantId, authUser }, metadata.files, jobDetails);
    jobDetails.id = job.id;
    jobDetails.metadata = metadata;
    jobDetails.createdBy = job.createdBy;
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.IN_PROGRESS);

    logger.info({ ctx: msgCtx, jobDetails, filePath }, '[ASSETS] Starting assets upload.');

    ctx.uploadFolder = getNewUploadAssetsFolder(ctx.tenantId);

    logger.debug({ ctx: msgCtx, uploadFolder: ctx.uploadFolder }, '[ASSETS] upload folder');

    const jobResult = await processIncomingAssets(ctx, filePath);
    const fileCount = jobResult.total;
    errors = jobResult.errors;
    logger.info({ ctx: msgCtx, jobDetails, errors }, `[ASSETS] Processed and uploaded to S3: ${fileCount} asset files.`);
  } catch (error) {
    logger.error({ ctx: msgCtx, error, jobDetails }, '[ASSETS] uploadAssets error');
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED, '', [error]);
    throw error;
  } finally {
    ctx.uploadFolder && (await fse.remove(ctx.uploadFolder));
  }

  logger.info({ ctx: msgCtx, jobDetails }, '[ASSETS] Assets upload finished.');
  await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED, '', errors.length ? errors : undefined);

  return { processed: true };
};

export const cleanupPhysicalAssets = async payload => {
  const { msgCtx: ctx } = payload;
  logger.time({ ctx, payload }, 'Recurring Jobs - [ASSETS] Clean up physical assets duration');

  try {
    const adminCtx = { ...ctx, tenantId: admin.id };
    const tenants = await getTenants(knex, adminCtx);

    await Promise.mapSeries(tenants, async ({ id: tenantId, name: tenantName }) => {
      const tenantCtx = { ...ctx, tenantId };
      const orphanedPhysicalAssets = (await cleanupOrphanedPhysicalAssets(tenantCtx)) || [];
      const cleanupFilesCount = orphanedPhysicalAssets.length;
      cleanupFilesCount &&
        (await deleteUploadedAssets(
          tenantCtx,
          orphanedPhysicalAssets.map(it => it.physicalAssetId),
        ));
      logger.info({ ctx: tenantCtx, tenantName, cleanupFilesCount }, '[ASSETS] Processed and deleted assets from S3');
    });
  } catch (error) {
    logger.error({ ctx, error, msgPayload: payload }, '[ASSETS] cleanupPhysicalAssets error');
    return { processed: false, retry: false };
  }

  logger.timeEnd({ ctx, payload }, 'Recurring Jobs - [ASSETS] Clean up physical assets duration');

  return { processed: true };
};
