/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import AWS from 'aws-sdk';
import fs from 'fs';
import Promise from 'bluebird';
import pick from 'lodash/pick';
import omit from 'lodash/omit';

import config from '../../config';
import loggerModule from '../../../common/helpers/logger';
import { iterateOverArray } from '../../../common/helpers/async-iterate';
import { getAssetsBucket } from './uploadUtil';
const logger = loggerModule.child({ subType: 'aws' });

const s3 = new AWS.S3(config.aws);

export const getAllObjects = async (bucket, prefix) => {
  let contents = [];
  let chunk = {};

  do {
    chunk = await s3
      .listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: chunk.NextContinuationToken,
      })
      .promise();
    contents = [...contents, ...chunk.Contents.map(c => c.Key)];
  } while (chunk.IsTruncated);

  return contents;
};

export const deleteObjects = (ctx, bucket, keys) => {
  if (!keys || !keys.length) return Promise.resolve();

  let iterator = null;
  let deleteObjectsResult = {};
  return new Promise((resolve, reject) => {
    iterator = iterateOverArray(keys, {
      chunkSize: 500, // s3.deleteObjects enable you to delete objects up to 1000 keys per request
      onChunk: async ({ arr: chunk }, next) => {
        const result = await s3
          .deleteObjects({
            Bucket: bucket,
            Delete: {
              Objects: chunk.map(k => ({ Key: k })),
            },
          })
          .promise()
          .catch(err => {
            reject(err);
          });
        if (result) {
          deleteObjectsResult = {
            Deleted: (deleteObjectsResult.Deleted || []).concat(result.Deleted),
            Errors: (deleteObjectsResult.Errors || []).concat(result.Errors),
          };
        }
        next && next();
      },
      done: () => {
        logger.trace({ ctx, bucket, keysToDeleteLength: keys.length, objectsDeletedLength: (deleteObjectsResult.Deleted || []).length }, 'Objects deleted');
        resolve(deleteObjectsResult);
      },
    });
  }).catch(error => {
    iterator && iterator();
    logger.error({ ctx, error }, 'Error deleting objects');
    throw error;
  });
};

const sanitizeMetadata = metadata => {
  if (!metadata) return {};
  const result = pick(metadata, ['uuid', 'file']);

  const { uploadingUser } = metadata;
  if (uploadingUser) {
    result.uploadingUser = JSON.stringify({ tenantId: uploadingUser.tenantId, id: uploadingUser.id, fullName: uploadingUser.fullName });
  }

  return result;
};

const putObject = async (ctx, bucket, key, body, options) => {
  const { metadata, acl = 'private', encryptionType, keyId, redirectLocation, contentType } = options;

  logger.trace({ ctx, bucket, s3Key: key, metadata, acl, encryptionType, redirectLocation, contentType }, 'putObject');
  const sanitizedMetadata = sanitizeMetadata(metadata);

  const params = {
    Bucket: bucket,
    Key: key,
    Metadata: sanitizedMetadata,
    ACL: acl,
    ServerSideEncryption: encryptionType,
    SSEKMSKeyId: keyId,
    Body: body,
    WebsiteRedirectLocation: redirectLocation,
    ContentType: contentType,
  };
  logger.trace({ ctx, params: omit(params, ['Body', 'SSEKMSKeyId']) }, 'putObject params');

  const ret = await s3.putObject(params).promise();
  logger.trace({ ctx, ret }, 'putObject result');
  return ret;
};

export const saveFile = async (ctx, bucket, key, filePath, options) => {
  logger.info({ ctx, bucket, s3Key: key, filePath }, 'saveFile');
  return await putObject(ctx, bucket, key, fs.createReadStream(filePath), options);
};

export const saveEmptyObject = async (ctx, bucket, key, options) => await putObject(ctx, bucket, key, '', options);

export const saveBuffer = async (ctx, bucket, key, buffer, options) => await putObject(ctx, bucket, key, buffer, options);

export const headObject = (bucket, key) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  return s3.headObject(params).promise();
};

export const uploadBase64Image = async (ctx, { base64Data, key, metadata }) => {
  const body = Buffer.from(base64Data, 'base64');
  const bucket = getAssetsBucket();

  const params = {
    ACL: 'public-read',
    Body: body,
    Bucket: bucket,
    Key: key,
    ContentType: metadata['Content-Type'],
    Metadata: metadata,
  };

  let rejectUpload;
  let resolveUpload;

  const uploadPromise = new Promise(
    res => {
      resolveUpload = res;
    },
    rej => {
      rejectUpload = rej;
    },
  );

  await s3.upload(params).send((err, data) => {
    if (err) {
      rejectUpload(err);
      return;
    }
    if (data) resolveUpload(data.Location);
  });

  return uploadPromise;
};

export const getObject = (ctx, bucket, key, file) =>
  new Promise((resolve, reject) => {
    const readStream = s3
      .getObject({
        Bucket: bucket,
        Key: key,
      })
      .createReadStream()
      .on('error', error => {
        logger.error({ ctx, error, bucket, awsKey: key }, 'error on read stream aws');
        reject(error);
      });
    const writeStream = fs.createWriteStream(file);
    readStream.pipe(writeStream);
    writeStream.on('error', reject);
    writeStream.on('finish', () => {
      resolve();
    });
  });

export const getObjectStream = (ctx, bucket, key) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };
  return s3
    .getObject(params)
    .createReadStream()
    .on('error', error => {
      logger.error({ ctx, error, bucket, awsKey: key }, 'error on read stream aws');
    });
};

export const updateMetadata = async (ctx, bucket, key, options) => {
  const { metadata, acl = 'private', metadataDirective = 'REPLACE', contentType } = options;

  logger.trace({ ctx, bucket, s3Key: key, metadata, acl, metadataDirective, contentType }, 'updateMetadata');
  const sanitizedMetadata = sanitizeMetadata(metadata);

  const params = {
    Bucket: bucket,
    Key: key,
    CopySource: `${bucket}/${key}`,
    ACL: acl,
    Metadata: sanitizedMetadata,
    ContentType: contentType,
    MetadataDirective: metadataDirective,
  };

  return await s3.copyObject(params).promise();
};
