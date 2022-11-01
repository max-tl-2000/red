/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import path from 'path';
import mime from 'mime-types';
import FileType from 'file-type';
import loggerModule from '../../../../common/helpers/logger';
import { getAllObjects, deleteObjects, saveFile } from '../s3';
import { getKeyPrefixForAssets, getAssetsBucket, getRelativeUploadPath, getFileChecksum } from '../uploadUtil';
import { createAsset, getPhysicalAssetIdByChecksum } from '../../../dal/assetsRepo';

const logger = loggerModule.child({ subType: 'aws' });
const bucket = getAssetsBucket();

const uploadAsset = async (ctx, asset, filePath, options = {}) => {
  const keyPrefix = getKeyPrefixForAssets(ctx.tenantId);
  return saveFile(ctx, bucket, `${keyPrefix}/${asset.physicalAssetId}`, filePath, {
    acl: 'public-read',
    ...options,
  });
};

const getUploadedAssets = ctx => getAllObjects(bucket, getKeyPrefixForAssets(ctx.tenantId));

export const deleteAssetsByKeys = async (ctx, assetKeys) => {
  logger.info({ ctx, bucket }, `Deleting ${assetKeys.length} assets from S3 bucket ${bucket} by keys`);
  await deleteObjects(ctx, bucket, assetKeys);
};

export const deleteAllAssets = async ctx => {
  const assets = await getUploadedAssets(ctx);
  logger.info({ ctx, bucket }, `Deleting ${assets.length} assets from S3 bucket ${bucket}`);

  await deleteObjects(ctx, bucket, assets);
};

export const saveAsset = async (ctx, filePath, entity, rootDirectory) => {
  const now = new Date();
  const checksum = await getFileChecksum(filePath, 'sha512');
  const physicalAssetId = await getPhysicalAssetIdByChecksum(ctx, checksum);
  const asset = {
    uuid: getUUID(),
    physicalAssetId: physicalAssetId || getUUID(),
    path: getRelativeUploadPath(ctx, filePath).replace(`/${rootDirectory}`, ''),
    entity,
    created_at: now,
    updated_at: now,
  };

  const shouldCreatePhysicalAsset = !physicalAssetId;
  if (shouldCreatePhysicalAsset) {
    const contentType = mime.contentType(path.extname(filePath)) || (await FileType.fromFile(filePath)).mime;
    await uploadAsset(ctx, asset, filePath, { contentType });
  }

  await createAsset(ctx, asset, { shouldCreatePhysicalAsset, checksum });
};
