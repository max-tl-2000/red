/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import loggerModule from '../../../../common/helpers/logger';
import { getAllObjects, deleteObjects, saveFile } from '../s3';
import { getKeyPrefixForVoiceMessages, getAssetsBucket, getRelativeUploadPath } from '../uploadUtil';

const logger = loggerModule.child({ subType: 'aws' });
const bucket = getAssetsBucket();

const uploadVoiceMessage = async (ctx, message, filePath) => {
  const keyPrefix = getKeyPrefixForVoiceMessages(ctx.tenantId);
  const relativePath = message.path;
  const uploadPath = `${keyPrefix}${relativePath}`;
  return saveFile(ctx, bucket, uploadPath, filePath, {
    acl: 'public-read',
  });
};

export const deleteAllVoiceMessages = async ctx => {
  const voiceMessages = await getAllObjects(bucket, getKeyPrefixForVoiceMessages(ctx.tenantId));
  logger.info({ ctx }, `Deleting ${voiceMessages.length} voice messages from S3 bucket ${bucket}`);
  await deleteObjects(ctx, bucket, voiceMessages);
};

export const processMp3 = async (ctx, filePath, entity) => {
  const now = new Date();
  const asset = {
    uuid: getUUID(),
    path: getRelativeUploadPath(ctx, filePath),
    entity,
    created_at: now,
    updated_at: now,
  };

  await uploadVoiceMessage(ctx, asset, filePath);
};
