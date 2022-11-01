/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../../config';
import { deleteAllAssets, deleteAssetsByKeys } from './assets/assetsS3Upload';
import { processAsset } from './assets/assetProcessor';
import { processMp3, deleteAllVoiceMessages } from './voiceMessages/voiceMessageProcessor';

import { uploadDocument, deleteDocuments, downloadSignedLease, downloadExportedDatabase } from './documents/documentsS3Upload';

import { uploadPublicDocument } from './publicDocuments/publicDocumentS3Upload';

import { getLastUploadedFile, uploadResultsFile, getFile, uploadOriginalFile } from './updates/updatesS3Upload';

import { saveFile, saveBuffer, getObject, getObjectStream, uploadBase64Image } from './s3';

import {
  saveFile as fakeSaveFile,
  uploadDocument as fakeUploadDocument,
  saveBuffer as fakeSaveBuffer,
  getObject as fakeGetObject,
  getObjectStream as fakeGetObjectStream,
  getStreamFromString,
  uploadBase64Image as fakeUploadBase64Image,
} from './fakeS3';

import { deleteAll } from './s3Utils';

export const getS3Provider = () => {
  if (config.isIntegration) {
    return {
      deleteAssetsByKeys: () => {},
      deleteAllAssets: () => {},
      deleteAllVoiceMessages: () => {},
      processAsset: () => {},
      processMp3: () => {},
      uploadDocument: (ctx, documentObject) => fakeUploadDocument(ctx, documentObject?.metadata?.file),
      uploadPublicDocument: (ctx, documentObject) => fakeUploadDocument(ctx, documentObject?.metadata?.file),
      deleteDocuments: () => {},
      deleteAll: () => {},
      saveFile: (ctx, bucket, key, filePath) => fakeSaveFile(ctx, bucket, key, filePath),
      saveBuffer: (_ctx, bucket, key, docBuffer) => fakeSaveBuffer(bucket, key, docBuffer),
      getObject: (_ctx, bucket, key) => fakeGetObject(bucket, key),
      getObjectStream: (_ctx, bucket, key) => fakeGetObjectStream(bucket, key),
      getLastUploadedFile: () => {},
      uploadResultsFile: () => {},
      getFile: () => {},
      uploadOriginalFile, // this is shared between real and fake
      downloadSignedLease: () => getStreamFromString(''),
      downloadExportedDatabase: () => getStreamFromString(''),
      uploadBase64Image: fakeUploadBase64Image,
    };
  }

  return {
    deleteAssetsByKeys,
    deleteAllAssets,
    deleteAllVoiceMessages,
    processAsset,
    processMp3,
    uploadDocument,
    deleteDocuments,
    deleteAll,
    saveFile,
    saveBuffer,
    getObject,
    getObjectStream,
    getLastUploadedFile,
    uploadResultsFile,
    getFile,
    uploadOriginalFile,
    downloadSignedLease,
    downloadExportedDatabase,
    fakeUploadBase64Image,
    uploadBase64Image,
    uploadPublicDocument,
  };
};
