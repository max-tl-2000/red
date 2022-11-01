/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise } from 'bluebird';
import fs from 'fs';
import getUUID from 'uuid/v4';
import path from 'path';
import mime from 'mime-types';
import FileType from 'file-type';
import { createPublicDocument, getPhysicalPublicDocumentByChecksum } from '../../dal/publicDocumentRepo';
import { updatePostHeroImageIdByPostId } from '../../dal/cohortCommsRepo';
import { getS3Provider } from './s3Provider';
import { stat } from '../../../common/helpers/xfs';
import { attempt } from '../../../common/helpers/attempt';
import loggerModule from '../../../common/helpers/logger';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import { getFileChecksum } from './uploadUtil';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getS3URLForPublicDocumentById } from './publicDocuments/publicDocumentS3Upload';

const logger = loggerModule.child({ subType: 'fileUpload' });

const waitForNonZeroFile = async (ctx, filePath) => {
  const checkFile = async () => {
    const stats = await stat(filePath);
    if (stats.size === 0) {
      const msg = `Upload document: zero sized file detected on file ${filePath}`;
      throw new Error(msg);
    }
  };

  try {
    await attempt({
      func: checkFile,
      attempts: 3,
      autoExec: true,
      onAttemptFail: ({ error }) => logger.warn({ ctx, error }),
      delay: 5000,
    });
  } catch (error) {
    throw new Error(`Upload document: error while waiting for non-zero sized file. ${error}`);
  }
};

const processPublicDocument = async (ctx, context, postId, fileId) => {
  if (!postId || !fileId) {
    throw new Error(`Process public document failed, expected postId and fileId but received postId:${postId} and fileId:${fileId}`);
  }
  switch (context) {
    case DALTypes.PostPublicDocumentContext.POST_HERO_IMAGE: {
      logger.trace({ ctx, documentId: fileId, postId }, 'updating hero image id Posts');
      await updatePostHeroImageIdByPostId(ctx, postId, fileId);
      break;
    }
    default:
      break;
  }
};

const uploadPublicDocument = async (ctx, { file, metadata, context }) => {
  logger.trace({ ctx, file, metadata, context }, 'uploading public document');

  await waitForNonZeroFile(ctx, file.path);

  const now = new Date();
  const checksum = await getFileChecksum(file.path, 'sha512');
  const physicalPublicDocumentId = await getPhysicalPublicDocumentByChecksum(ctx, checksum);
  const publicDocumentObject = {
    uuid: file.id,
    physicalPublicDocumentId: physicalPublicDocumentId || getUUID(),
    metadata: {
      file: {
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
      },
      ...metadata,
    },
    context,
    created_at: now,
    updated_at: now,
  };

  const shouldCreatePhysicalPublicDocument = !physicalPublicDocumentId;

  try {
    logger.trace({ ctx, fileData: file }, 'uploading to s3');

    if (shouldCreatePhysicalPublicDocument) {
      const contentType = mime.contentType(path.extname(file.path)) || (await FileType.fromFile(file.path)).mime;
      await getS3Provider().uploadPublicDocument(ctx, publicDocumentObject, file.path, { contentType });
    }

    logger.trace({ ctx, fileData: file }, 'uploaded to s3');
  } catch (e) {
    logger.error({ ctx, publicDocumentObject }, 'error on uploading public document to s3');
    throw e;
  }

  try {
    const publicDocument = await createPublicDocument(ctx, publicDocumentObject, { shouldCreatePhysicalPublicDocument, checksum });
    logger.trace({ ctx, documentId: publicDocument?.uuid }, 'public document inserted to db ');
    await processPublicDocument(ctx, context, metadata?.body?.postId, file.id);
    return publicDocument;
  } catch (error) {
    logger.error({ ctx, publicDocumentObject }, 'error on inserted to db public document');
    throw error;
  }
};

export const uploadPublicDocuments = async ({ files, metadata, context, keepUploadedFiles = true, msgCtx }) => {
  logger.info({ ctx: msgCtx, files, metadata, keepUploadedFiles }, 'Starting public document upload');

  const theFiles = [];

  try {
    const extraData = {};

    await Promise.all(
      files.map(async file => {
        const { physicalPublicDocumentId } = await uploadPublicDocument(msgCtx, { file, metadata, context });
        theFiles.push({
          id: file.id,
          clientFileId: file.clientFileId,
          name: file.originalName,
          size: file.size,
          s3Url: getS3URLForPublicDocumentById(msgCtx, physicalPublicDocumentId),
        });
        return file;
      }),
    );

    await notify({
      ctx: msgCtx,
      event: eventTypes.DOCUMENTS_UPLOADED,
      data: {
        files: theFiles,
        ...extraData,
      },
    });
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'error on uploadPublicDocuments');
    await notify({
      ctx: msgCtx,
      event: eventTypes.DOCUMENTS_UPLOADED_FAILURE,
      data: {
        postId: metadata.postId,
        files: theFiles,
        errorMessage: error.token || '',
      },
    });
    throw error;
  } finally {
    if (!keepUploadedFiles) {
      const unlink = Promise.promisify(fs.unlink);
      await Promise.all(files.map(async f => await unlink(f.path)));
    }
  }

  return { processed: true };
};

// TODO: work on delete orphaned public documents
