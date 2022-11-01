/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { computed, action, observable } from 'mobx';
import { t } from 'i18next';
import isEmpty from 'lodash/isEmpty';
import { readFileAsTextAsync } from '../helpers/file-reader.js';
import { createUploadModel } from '../components/SimpleUploader/create-upload-model';
import { MobxRequest } from '../mobx/helpers/mobx-request';
import { CohortConstants } from '../../common/enums/cohortConstants.js';
import { performSendPost, uploadFileToDocumentsUsingQueue } from './helpers/post';
import { stripFirstAndLastQuotesFromString } from '../helpers/strings.js';
import { isValidImageMimeType } from '../../common/image-types';
import { isValidCsvMimeType } from '../../common/csv-types';
import { downloadDocument } from '../helpers/download-document';
import { DALTypes } from '../../common/enums/DALTypes.js';

class PostEditorModel {
  @observable
  _postId;

  @observable
  _readOnly;

  @observable
  _currentPost;

  @observable
  _isOperationInProgress;

  @observable
  _wasOperationCompleted;

  @observable
  _sentByNotification;

  @computed
  get postId() {
    return this._currentPost?.id || this._postId;
  }

  @computed
  get sentByNotification() {
    return this._sentByNotification;
  }

  @action
  sentPostNotificationReceived(sentBy) {
    this._sentByNotification = sentBy;
  }

  @computed
  get currentPost() {
    return this._currentPost;
  }

  @action
  setCurrentPost(post) {
    this._currentPost = post;
  }

  @action
  setIsOperationInProgressAndStatus(isOpreationInProgress, wasOperationCompleted) {
    this._isOperationInProgress = isOpreationInProgress;
    this._wasOperationCompleted = wasOperationCompleted;
  }

  @computed
  get isSavedPost() {
    return !!this.postId;
  }

  @computed
  get isReadOnly() {
    return !!this._currentPost?.sentAt;
  }

  @computed
  get category() {
    return this.formModel.fields.category.value;
  }

  @computed
  get savePostError() {
    return this.savePostRq.error;
  }

  @computed
  get sendPostError() {
    return this.sendPostRq.error;
  }

  @computed
  get isSendingPost() {
    return this.sendPostRq.loading;
  }

  @computed
  get formFieldValues() {
    return this.formModel.getValidFieldValues;
  }

  constructor(service) {
    this.service = service;
    this._wasOperationCompleted = false;
    this.savePostRq = new MobxRequest({
      call: async post => {
        this._isOperationInProgress = true;
        const payload = isEmpty(post) ? this.formModel?.getValidFieldValues : post;
        if (!this.isSavedPost) {
          return await service.createPost(payload);
        }
        return await service.updatePost({ ...payload, postId: this.postId });
      },
      onResponse: ({ error, response }) => {
        if (error) return;
        if (!this.isSavedPost) {
          this._postId = response.id;
        }
      },
    });

    this.sendPostRq = new MobxRequest({
      call: async () =>
        await performSendPost({
          sendPost: (...args) => service.sendPost(...args),
          postData: { ...this.formModel.getValidFieldValues, postId: this.postId, fileId: this.uploadModel.currentTracker.id },
        }),
      onResponse: ({ error }) => {
        if (error) return;
      },
    });

    this.deletePostRq = new MobxRequest({
      call: async () => await service.deletePost({ postId: this.postId }),
      onResponse: ({ error }) => {
        if (error) return;
      },
    });
  }

  validateCohortFileHeaders(fileContent) {
    const rows = fileContent.split(/\r?\n/);
    const firstRow = rows?.[0];
    const headers = firstRow && firstRow.split(',');

    if (!headers) return false;

    const quotelessHeaders = headers && headers.map(header => stripFirstAndLastQuotesFromString(header));
    const isValidResidentCodesFile = this.validateResidentCodesHeaders(quotelessHeaders);

    if (isValidResidentCodesFile) return true;

    const isValidUnitCodesFile = this.validateUnitCodesHeaders(quotelessHeaders);

    if (isValidUnitCodesFile) return true;

    return false;
  }

  isCohortFileEmpty(fileContent) {
    const csvFileRows = fileContent.split(/\r?\n/);
    const dataRows = csvFileRows.slice(1, csvFileRows.length);

    return !dataRows.length || dataRows.every(row => !stripFirstAndLastQuotesFromString(row));
  }

  validateResidentCodesHeaders(headers) {
    return headers && headers.filter(header => header.toLowerCase() === CohortConstants.FileColumns.ResidentCode).length === 1;
  }

  validateUnitCodesHeaders(headers) {
    return headers && headers.filter(header => header.toLowerCase() === CohortConstants.FileColumns.UnitCode).length === 1;
  }

  @action
  clearSendPostErrors() {
    this.sendPostRq.error = null;
  }

  @action
  clearSavePostErrors() {
    this.savePostRq.error = null;
  }

  @action
  async savePost(post) {
    await this.savePostRq.execCall(post);
    return this.savePostRq.success;
  }

  @action
  async sendPost() {
    await this.sendPostRq.execCall();
    return this.sendPostRq.success;
  }

  @action
  async deletePost() {
    if (!this.isSavedPost) return;

    await this.deletePostRq.execCall();
  }

  @computed
  get canSendPost() {
    return (
      this.formModel.requiredAreFilled &&
      this.formModel.valid &&
      !this.uploadModel.isUploading &&
      !this.uploadModel.isQueueEmpty &&
      !this.uploadModel.allFilesInQueueAreDeleted &&
      this.uploadModel.filesUploaded &&
      this.uploadModel.valid
    );
  }

  @computed
  get atLeastOneFieldValid() {
    return this.formModel.atLeastOneRequiredFieldValid || this.uploadModel.valid;
  }

  @action
  clearModels() {
    this.formModel = null;
    this.uploadModel = null;
    this._postId = null;
    this._wasOperationCompleted = false;
    this._isOperationInProgress = false;
    this._sentByNotification = null;
    this.clearSendPostErrors();
    this.clearSavePostErrors();
  }

  @computed
  get isDirty() {
    return this.formModel.isDirty || this.uploadModel.isDirty;
  }

  @computed
  get isExistingPostWithEmptyData() {
    return this.allFieldsAreEmpty && this.isSavedPost;
  }

  @computed
  get allFieldsAreEmpty() {
    return (
      this.formModel.allRequiredFieldsAreEmpty &&
      (this.uploadModel.isQueueEmpty || this.uploadModel.allFilesInQueueAreDeleted) &&
      (this.uploadHeroModel.isQueueEmpty || this.uploadHeroModel.allFilesInQueueAreDeleted)
    );
  }

  @action
  requestDocumentDownload = (entry, userToken) => {
    if (!userToken) throw new Error('missing userToken');
    if (!entry?.fileId) throw new Error('missing entry.fileId');

    const fileId = entry.fileId;
    const baseUrl = window.location.origin;
    const token = userToken;
    const downloadUrl = `${baseUrl}/api/cohortComms/post/${fileId}/download?token=${token}`;

    return downloadDocument(downloadUrl);
  };

  @action
  requestPostRecipientDownload = userToken => {
    if (!userToken) throw new Error('missing userToken');
    const postId = this.postId;
    if (!postId) throw new Error('missing postId');

    const baseUrl = window.location.origin;
    const downloadUrl = `${baseUrl}/api/cohortComms/post/${postId}/downloadResult?token=${userToken}`;
    return downloadDocument(downloadUrl);
  };

  @action
  requestHeroImageDownload = (entry, userToken) => {
    // TODO: Don't require the userToken to download the hero image
    if (!userToken) throw new Error('missing userToken');
    if (!entry?.fileId) throw new Error('missing entry.fileId');

    const fileId = entry.fileId;
    const baseUrl = window.location.origin;
    const token = userToken;

    const downloadUrl = `${baseUrl}/api/documents/public/images/${fileId}/download?token=${token}`;
    return downloadDocument(downloadUrl);
  };

  @action
  initializeModels(formModel, currentPost) {
    this.setCurrentPost(currentPost);
    const initialFile = currentPost?.documentMetadata;
    const initialFilePublicDocument = currentPost?.heroImageMetada;
    const setFileErrorIfNeeded = (tracker, matchingResidentInfo) => {
      if (matchingResidentInfo.numberOfMatchingCodes === 0) {
        tracker.setValidationError(t('NO_MATCH_FOR_POST_RECIPIENTS'));
      }
    };

    this.formModel = formModel;

    // IMPORTANT:
    // this uploadModel is used to upload/remove the hero images
    // Please keep it generic so it can be reused for all other
    // cases where we want to do an upload.
    //
    // If we don't do that we will keep duplicating code for an upload
    // that should be as generic as possible
    this.uploadHeroModel = createUploadModel({
      initialFile: initialFilePublicDocument,
      multiple: false,
      clearQueueBeforeAdd: true,
      // initialFileValidation: tracker => {
      //   // perform initial validation if any
      // },
      beforeAddToQueue: async args => {
        if (this.isSavedPost) return;

        await this.savePost();
        // this is required to save the post before uploading the hero image
        args.addToQueue = this.isSavedPost;
      },
      deleteFunction: (...args) => this.service.deleteHeroImage(...args),
      uploadFunction: ({ files, clientFileId }) =>
        uploadFileToDocumentsUsingQueue({
          uploadFile: (...args) => this.service.uploadHeroImage(...args),
          uploadFileInfo: { files, clientFileId, context: DALTypes.PostPublicDocumentContext.POST_HERO_IMAGE, postId: this.postId },
        }),
      validationFunction: async file => {
        if (!isValidImageMimeType(file.type)) {
          throw new Error(t('INVALID_FILE_TYPE'));
        }
      },
    });

    this.uploadModel = createUploadModel({
      initialFile,
      multiple: false,
      clearQueueBeforeAdd: true,
      initialFileValidation: tracker => {
        const { matchingResidentInfo } = initialFile;
        setFileErrorIfNeeded(tracker, matchingResidentInfo);
      },
      beforeAddToQueue: async args => {
        if (this.isSavedPost) return;

        await this.savePost();
        args.addToQueue = this.isSavedPost;
      },
      deleteFunction: this.service.deleteFile,
      uploadFunction: ({ files, clientFileId }) =>
        uploadFileToDocumentsUsingQueue({
          uploadFile: (...args) => this.service.uploadFile(...args),
          uploadFileInfo: { files, clientFileId, postId: this.postId, context: this.category },
        }),
      onUploadResponse: (tracker, response) => {
        const { matchingResidentInfo } = response;
        this.onFileUpload?.(tracker, matchingResidentInfo);
      },
      validationFunction: async file => {
        if (!isValidCsvMimeType(file.type)) {
          throw new Error(t('INVALID_FILE_TYPE'));
        }

        const fileContent = await readFileAsTextAsync(file);

        const isFileEmpty = this.isCohortFileEmpty(fileContent);

        if (isFileEmpty) throw new Error(t('FILE_IS_EMPTY'));

        const containsHeaders = this.validateCohortFileHeaders(fileContent);

        if (!containsHeaders) throw new Error(t('INVALID_FILE_CONTENT'));
      },
    });

    this.postsImagesUploadModel = createUploadModel({
      initialFile: null,
      multiple: true,
      clearQueueBeforeAdd: false,
      uploadFunction: ({ files, clientFileId }) =>
        uploadFileToDocumentsUsingQueue({
          uploadFile: (...args) => this.service.uploadPostImages(...args),
          uploadFileInfo: { files, clientFileId, context: DALTypes.PostPublicDocumentContext.POST_MESSAGE_IMAGE, postId: this.postId },
        }),
      validationFunction: async file => {
        if (!isValidImageMimeType(file.type)) {
          throw new Error(t('INVALID_FILE_TYPE'));
        }
      },
    });
  }
}

export const createPostEditorModel = service => new PostEditorModel(service);
