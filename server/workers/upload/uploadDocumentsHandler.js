/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise } from 'bluebird';
import fs from 'fs';
import csvtojson from 'csvtojson';
import { getDocuments as getDocumentsFromDb, createDocument as insertDocumentIntoDb, deleteDocuments as deleteDocumentsFromDb } from '../../dal/documentsRepo';
import { deletePostRecipientByPostId } from '../../dal/cohortCommsRepo';
import { getS3Provider } from './s3Provider';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE } from '../../helpers/message-constants';
import { rentappContext } from '../../../rentapp/common/application-constants';
import { stat } from '../../../common/helpers/xfs';
import { attempt } from '../../../common/helpers/attempt';
import loggerModule from '../../../common/helpers/logger';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import { addCohortData } from '../../import/updates/cohortUpdatesHandler';
import { now } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'fileUpload' });

const getDocumentObject = (file, metadata, accessType, context) => ({
  uuid: file.id,
  metadata: {
    file,
    document: metadata,
  },
  accessType,
  context,
});

const sendDocumentToModule = async (ctx, document, isDeleteAction = false) => {
  if (document.context) {
    const message = {
      documentId: document.uuid,
      accessType: document.accessType,
      metadata: document.metadata,
    };

    if (isDeleteAction && document.context !== rentappContext) return;

    const queueTopicKey = isDeleteAction ? `delete_${document.context}` : document.context;
    logger.info({ ctx, queueTopicKey }, `Sending document to module ${queueTopicKey}`);

    await sendMessage({ exchange: APP_EXCHANGE, key: queueTopicKey, message });
  }
};

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

const uploadDocument = async (ctx, { file, metadata, accessType, context }) => {
  logger.trace({ ctx, file, metadata, accessType, context }, 'uploading document');

  await waitForNonZeroFile(ctx, file.path);

  const documentObject = getDocumentObject(file, metadata, accessType, context);
  try {
    logger.trace({ ctx, fileData: file }, 'uploading to s3');

    await getS3Provider().uploadDocument(ctx, documentObject, file.path, accessType);

    logger.trace({ ctx, fileData: file }, 'uploaded to s3');
  } catch (e) {
    logger.error({ ctx, documentObject }, 'error on uploading document to s3');
    throw e;
  }

  const document = await insertDocumentIntoDb(ctx, documentObject);
  logger.trace({ ctx, documentId: document?.uuid }, 'document inserted to db ');

  await sendDocumentToModule(ctx, document);

  return document;
};

const uploadCohortFile = async (ctx, files, postId) => {
  logger.info({ ctx, files }, 'uploadCohortFile');

  const file = files?.[0];
  const fileStream = fs.createReadStream(file.path);
  const cohortData = await csvtojson().fromStream(fileStream);
  await deletePostRecipientByPostId(ctx, postId);
  const { numberOfMatchingCodes, hasResidentCode } = await addCohortData(ctx, cohortData, postId, file.id);

  logger.trace({ numberOfMatchingCodes }, 'numberOfMatchingCodes');

  return {
    numberOfMatchingCodes,
    totalNumberOfCodes: cohortData.length,
    hasResidentCode: !!hasResidentCode,
    matchingResidentRunAt: now().toJSON(),
  };
};

const isACohortFile = context => [DALTypes.PostCategory.EMERGENCY, DALTypes.PostCategory.ANNOUNCEMENT].includes(context);

export const uploadDocuments = async data => {
  const { files, metadata, accessType, context, keepUploadedFiles, msgCtx } = data;
  logger.info({ ctx: msgCtx, data }, 'Starting document upload');

  let theFiles = [];

  try {
    theFiles = files.map(file => ({ id: file.id, clientFileId: file.clientFileId, name: file.originalName, size: file.size }));

    const extraData = {};

    if (isACohortFile(context)) {
      metadata.matchingResidentInfo = await uploadCohortFile(msgCtx, files, metadata.postId);
      extraData.matchingResidentInfo = metadata.matchingResidentInfo || {};
      extraData.postId = metadata.postId;
    }
    await Promise.all(files.map(async file => uploadDocument(msgCtx, { file, metadata, accessType, context })));
    await notify({
      ctx: msgCtx,
      event: eventTypes.DOCUMENTS_UPLOADED,
      data: {
        files: theFiles,
        ...extraData,
      },
    });
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'error on uploadDocuments');
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
    if (!keepUploadedFiles || keepUploadedFiles === 'false') {
      const unlink = Promise.promisify(fs.unlink);
      await Promise.all(files.map(async f => await unlink(f.path)));
    }
  }

  return { processed: true };
};

export const deleteDocuments = async data => {
  const { documentIds, msgCtx } = data;
  logger.info({ ctx: msgCtx, data }, 'Deleting documents:');

  try {
    const documents = await getDocumentsFromDb(msgCtx, documentIds);
    if (documents?.length) {
      const unlink = Promise.promisify(fs.unlink);

      await execConcurrent(documents, async doc => {
        try {
          await sendDocumentToModule(msgCtx, doc, true);
          const filePath = doc.metadata.file.path;
          if (fs.existsSync(filePath)) await unlink(filePath);
        } catch (error) {
          logger.warn({ ctx: msgCtx, error }, 'Error while deleting local files.');
        }
      });

      await deleteDocumentsFromDb(msgCtx, documentIds);
      await getS3Provider().deleteDocuments(msgCtx, documentIds);
      await notify({
        ctx: msgCtx,
        event: eventTypes.DOCUMENTS_DELETED,
        data: {
          postId: documents[0].metadata?.document?.postId,
        },
      });
    } else {
      logger.error({ ctx: msgCtx, data }, 'Unable to delete documents, documents not found in DB');
    }
  } catch (error) {
    logger.error({ ctx: msgCtx, error, data }, 'Error while trying to delete documents');
    throw error;
  }

  return { processed: true };
};
