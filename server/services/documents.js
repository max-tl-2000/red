/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import omit from 'lodash/omit';
import * as dal from '../dal/documentsRepo';
import { APP_EXCHANGE, UPLOAD_MESSAGE_TYPE } from '../helpers/message-constants';
import { DALTypes } from '../../common/enums/DALTypes';
import { stat } from '../../common/helpers/xfs';
import { sendMessage } from './pubsub';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'fileUpload' });

const USER_KEYS_METADATA_TO_OMIT = ['associatedProperties', 'avatarUrl', 'teams', 'zendeskPrivateContentToken', 'zendeskCookieValue', 'sisenseCookieValue'];

export const updateDocumentMetadata = (ctx, documentId, data) => dal.updateDocumentMetadata(ctx, documentId, data);

export const getDocumentMetadata = (ctx, documentId) => dal.getDocumentMetadata(ctx, documentId);

export const uploadDocuments = async (ctx, body, accessType = DALTypes.DocumentAccessType.PRIVATE) => {
  const files = ctx.files.map(file => ({
    id: getUUID(),
    ...file,
  }));
  const uploadingUser = omit(ctx.authUser || {}, USER_KEYS_METADATA_TO_OMIT);

  await Promise.all(
    files.map(async file => {
      try {
        logger.trace({ ctx, filePath: file.path }, 'Checking if file is available on EFS');
        await stat(file.path, { bigint: true });
      } catch (error) {
        if (error.code === 'ENOENT') logger.error({ ctx, filePath: file.path }, 'File is not available on EFS');
      }
    }),
  );

  const uploadedFilesInfo = files.map(file => ({
    uploadedFileId: file.id,
    uploadedFilePath: file.path,
  }));

  logger.trace({ ctx, uploadedFilesInfo }, 'uploadDocuments service');

  const payload = {
    tenantId: ctx.tenantId,
    files,
    metadata: {
      uploadingUser,
      ...omit(body, ['keepUploadedFiles']),
    },
    accessType,
    context: body.context,
    keepUploadedFiles: body.keepUploadedFiles,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: UPLOAD_MESSAGE_TYPE.UPLOAD_DOCUMENTS,
    message: payload,
    ctx,
  });
  return files;
};

export const deleteDocuments = async (ctx, documentIds) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: UPLOAD_MESSAGE_TYPE.DELETE_DOCUMENTS,
    message: {
      tenantId: ctx.tenantId,
      documentIds,
    },
    ctx,
  });
