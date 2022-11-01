/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';
import some from 'lodash/some';
import isEmpty from 'lodash/isEmpty';
import { FileEntry } from './FileEntry';

export class FileQueueModel {
  @observable
  filesMap;

  constructor({ files = [], validations, uploadState, apiClient, uploadPath, serverErrorMessages, context, metadata, keepUploadedFiles } = {}) {
    this.filesMap = new ObservableMap();
    this.validations = validations;
    this.serverErrorMessages = serverErrorMessages;
    this.uploadState = uploadState;
    this.client = apiClient;
    this.uploadPath = uploadPath;
    this.update(files);
    this.context = context;
    this.metadata = metadata;
    this.keepUploadedFiles = keepUploadedFiles || false;
  }

  @action
  update(files) {
    files.forEach(file => {
      file.clientId = file.id;
      this.add(file, true);
    });
  }

  @computed
  get values() {
    return this.filesMap.values();
  }

  @computed
  get length() {
    return this.filesMap.values().length;
  }

  @computed
  get errors() {
    return this.values
      .filter(file => !isEmpty(file.errors))
      .map(file => ({
        name: file.name,
        errors: file.errors,
      }));
  }

  getFileById(id) {
    return this.values.find(file => file.id === id);
  }

  @action
  remove(id) {
    if (!this.filesMap.has(id)) return;
    this.filesMap.delete(id);
  }

  @action
  cancelUploadingFile(id) {
    const fileEntry = this.getFileById(id);
    fileEntry && fileEntry.removeUpload();
  }

  @action
  async deleteUploadedFile(id) {
    const fileEntry = this.getFileById(id);
    if (!(fileEntry && fileEntry.uploadComplete)) return;

    await this.client.del(this.uploadPath, { data: { documentIds: [id] } });
    fileEntry && fileEntry.removeUpload(false);
  }

  @action
  add(file, uploadComplete = false) {
    if (!this.filesMap.has(file.clientId)) {
      const validations = this.validations;
      const serverErrorMessages = this.serverErrorMessages;

      const uploadState = !uploadComplete ? this.uploadState : undefined;
      this.filesMap.set(
        file.clientId,
        new FileEntry({
          file,
          validations,
          uploadState,
          serverErrorMessages,
          apiClient: this.client,
          basePath: this.uploadPath,
        }),
      );
    } else {
      // we don't reset the object, we assume the object is the same
      // if the ids match
      const storedEntry = this.filesMap.get(file.clientId);
      storedEntry.update(file);
    }
  }

  @action
  upload(onUploadResponseReceived) {
    // the pending upload files are inQueue=true, when they are uploading the inqueue property is false.
    const filesToUpload = this.values.filter(fileEntry => fileEntry.isValid && fileEntry.inQueue);
    Promise.all(
      filesToUpload.map(async fileEntry => {
        const formData = new FormData();
        const settings = {
          reportProgress: true,
          requestId: fileEntry.clientId,
        };

        fileEntry.inQueue = false;
        formData.append('files', fileEntry.file);
        if (this.context) {
          formData.append('context', this.context);
          if (this.metadata.partyApplicationId) {
            formData.append('partyApplicationId', this.metadata.partyApplicationId);
          }
        }
        formData.append('keepUploadedFiles', this.keepUploadedFiles);
        const resp = await this.client.upload(this.uploadPath, formData, settings);
        fileEntry.id = resp[0].id;

        if (onUploadResponseReceived) {
          onUploadResponseReceived({
            id: resp[0].id,
            originalName: resp[0].originalName,
            path: resp[0].path,
            size: resp[0].size,
          });
        }

        return resp;
      }),
    ).catch(() => {
      console.warn('upload caught error - will be handled in FileUploadState');
    });
  }

  @action
  validate() {
    const uploadCompleteFiles = this.values.filter(fileEntry => fileEntry.uploadComplete);
    if (uploadCompleteFiles && uploadCompleteFiles.length) {
      uploadCompleteFiles.forEach(fileEntry => fileEntry.validate(true));
    }
  }

  @computed
  get isDirty() {
    const pendingFiles = some(this.values, fileEntry => fileEntry.isValid && fileEntry.uploading);
    if (pendingFiles) {
      return pendingFiles.length > 0;
    }
    return false;
  }

  @computed
  get pendingUploads() {
    return this.values.filter(fileEntry => fileEntry.isValid && fileEntry.uploading);
  }

  @computed
  get completedUploads() {
    return this.values.filter(fileEntry => fileEntry.isValid && !fileEntry.uploading);
  }

  @computed
  get isValid() {
    const uploadCompleteFiles = this.values.filter(fileEntry => fileEntry.uploadComplete);
    return uploadCompleteFiles.every(fileEntry => fileEntry.isValid);
  }
}
