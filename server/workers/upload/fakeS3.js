/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import { Readable } from 'stream';
import { getPrivateBucket, getDocumentsKeyPrefix } from './uploadUtil';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'fakes3' });

const objects = [];

const fakeS3Request = {
  ETag: 'deadbeefcafebabe',
  ServerSideEncryption: 'aws:kms',
  SSEKMSKeyId: 'arn:aws:kms:us-east-1:865217022307:key/feedface',
};

export const saveFile = (ctx, bucket, key, filePath) => {
  logger.info({ ctx, bucket, s3Key: key, filePath }, 'saveFile');
  objects.push({
    bucket,
    key,
    filePath,
  });
  return fakeS3Request;
};

export const uploadBase64Image = async (ctx, { base64Data }) => `http://fake-upload-to-s3.com/${base64Data}`;

export const uploadDocument = (ctx, file) => {
  const bucket = getPrivateBucket();
  const keyPrefix = getDocumentsKeyPrefix(ctx.tenantId);
  const key = `${keyPrefix}/${file.id}`;

  return saveFile(ctx, bucket, key, file.path);
};

export const saveBuffer = (bucket, key, docBuffer) =>
  objects.push({
    bucket,
    key,
    docBuffer,
  });

export const getObject = (bucket, key) => objects.find(obj => obj.bucket === bucket && obj.key === key);

export const getObjectStream = (bucket, key) => {
  const obj = objects.find(o => o.bucket === bucket && o.key === key);
  return fs.createReadStream(obj.filePath);
};

export const getStreamFromString = text => {
  const stream = new Readable();
  stream.push(text);
  stream.push(null);

  return stream;
};
