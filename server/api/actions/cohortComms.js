/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as validators from '../helpers/validators';
import loggerModule from '../../../common/helpers/logger';
import * as cohortCommsService from '../../services/cohortCommsService';
import { ServiceError } from '../../common/errors';
import { uploadDocuments, deleteDocuments } from '../../services/documents';
import { deletePostRecipientByFileId } from '../../dal/cohortCommsRepo';
import { getDocuments } from '../../dal/documentsRepo';
import { sanitizeFilename } from '../../../common/helpers/strings';
import { downloadDocument as downloadDocumentFromS3 } from '../../workers/upload/documents/documentsS3Upload';

const logger = loggerModule.child({ subType: 'cohortComms' });

export const getPosts = async req => {
  const { authUser, query } = req;
  const { teamIds = [] } = authUser;
  logger.trace({ ctx: req, teamIds, filters: query }, 'getPosts');

  return cohortCommsService.getPosts(req, { userTeamIds: teamIds, filters: { ...query, includeMessageDetails: query.includeMessageDetails === 'true' } });
};

export const getPostById = async req => {
  const { postId } = req.params;

  if (!postId) {
    logger.error({ ctx: req }, 'No postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 404 });
  }
  validators.uuid(postId, 'INVALID_POST_ID');

  return await cohortCommsService.getPostById(req, postId);
};

export const createPost = async req => {
  const { category } = req.body;

  if (!category) {
    logger.error({ ctx: req }, 'Error creating post, no category found');
    throw new ServiceError({ token: 'CATEGORY_REQUIRED', status: 400 });
  }

  return cohortCommsService.createPost(req, req.body);
};

export const deletePost = async req => {
  const { postId } = req.body;

  if (!postId) {
    logger.error({ ctx: req }, 'Error deleting post no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  return await cohortCommsService.deletePost(req, postId);
};

export const retractPost = async req => {
  const { postId, retractedReason } = req.body;

  if (!postId) {
    logger.error({ ctx: req }, 'Error retracting post, no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  return await cohortCommsService.markPostAsRetracted(req, { postId, retractedReason });
};

export const uploadRecipientFile = async req => {
  logger.trace({ ctx: req, body: req.body }, 'uploadRecipientFile');
  const { postId, clientFileId } = req.body;
  if (!req.files || !req.files.length) {
    throw new ServiceError({
      token: 'NO_FILES',
      status: 400,
    });
  }

  if (!postId) {
    logger.error({ ctx: req }, 'Error uploading recipient file no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }
  validators.uuid(postId, 'INVALID_POST_ID');

  req.files.forEach(file => {
    file.clientFileId = clientFileId;
  });

  await uploadDocuments(req, { ...req.body, keepUploadedFiles: true });
};

export const deleteRecipientFile = async req => {
  const { fileId } = req.body;
  validators.uuid(fileId, 'INVALID_DOCUMENT_ID');

  const [doc] = await getDocuments(req, [fileId]);

  if (!doc) {
    throw new ServiceError({
      token: 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  }

  await deletePostRecipientByFileId(req, fileId);
  await deleteDocuments(req, [fileId]);
};

export const downloadRecipientFile = async req => {
  const { recipientFileId } = req.params;
  logger.debug({ ctx: req, recipientFileId }, 'Download recipient file');
  validators.uuid(recipientFileId, 'INVALID_DOCUMENT_ID');

  const [doc] = await getDocuments(req, [recipientFileId]);
  if (!doc) {
    throw new ServiceError({
      token: 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  }

  return {
    type: 'stream',
    filename: sanitizeFilename(doc.metadata.file.originalName, { replaceUnicode: true }),
    stream: downloadDocumentFromS3(req, recipientFileId),
  };
};

export const updatePost = async req => {
  const { postId } = req.body;
  if (!postId) {
    logger.error({ ctx: req }, 'Error updating post, no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  validators.uuid(postId, 'INVALID_POST_ID');

  return cohortCommsService.updatePost(req, req.body);
};

export const sendPost = async req => {
  logger.trace({ ctx: req, body: req.body }, 'sendPost');
  const { postId } = req.body;

  if (!postId) {
    logger.error({ ctx: req }, 'Error updating post, no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  validators.uuid(postId, 'INVALID_POST_ID');

  return cohortCommsService.sendPost(req, req.body);
};

export const getDraftPosts = async req => {
  logger.trace({ ctx: req }, 'getDraftPosts');
  return cohortCommsService.getDraftPosts(req);
};

export const downloadPostRecipientFile = async req => {
  logger.trace({ ctx: req, params: req.params }, 'downloadPostRecipientFile');
  const { postId } = req.params;

  if (!postId) {
    logger.error({ ctx: req }, 'Error downloading post, no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  validators.uuid(postId, 'INVALID_POST_ID');

  return await cohortCommsService.downloadPostRecipientFile(req, postId);
};
