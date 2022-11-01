/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uuid from 'uuid/v4';
import { observable, ObservableMap, action, computed } from 'mobx';
import { createUploadTracker } from './upload-tracker';

class UploadModel {
  @observable
  _clearQueueBeforeAdd;

  @observable
  _multiple;

  @observable
  queueMap;

  @observable
  _isDirty;

  @computed
  get multiple() {
    return this._multiple;
  }

  @computed
  get clearQueueBeforeAdd() {
    return this._clearQueueBeforeAdd;
  }

  @computed
  get isDirty() {
    return this._isDirty;
  }

  @action
  setDirty() {
    this._isDirty = true;
  }

  constructor({
    multiple,
    clearQueueBeforeAdd,
    uploadFunction,
    onUploadResponse,
    deleteFunction,
    validationFunction,
    beforeAddToQueue,
    initialFile,
    initialFileValidation,
  } = {}) {
    this._multiple = multiple;
    this._clearQueueBeforeAdd = clearQueueBeforeAdd;
    this.uploadFunction = uploadFunction;
    this.deleteFunction = deleteFunction;
    this.onUploadResponse = onUploadResponse;
    this.beforeAddToQueue = beforeAddToQueue;
    this.validationFunction = validationFunction;
    this.queueMap = new ObservableMap();

    if (initialFile) {
      const tracker = this.addFileToQueue(
        {
          id: initialFile.id,
          file: initialFile,
        },
        { shouldUploadFile: false },
      );
      initialFileValidation?.(tracker);
    }
  }

  @action
  addFileToQueue = (args, { shouldUploadFile = true }) => {
    const { uploadFunction, onUploadResponse, deleteFunction, validationFunction } = this;
    const tracker = createUploadTracker({
      ...args,
      uploadFunction,
      onUploadResponse,
      deleteFunction,
      validationFunction,
      uploadNeeded: shouldUploadFile,
      clearQueue: this.clearQueue,
    });

    if (shouldUploadFile) {
      tracker.upload();
      this.setDirty();
    }

    this.queueMap.set(args.id || args.clientFileId, tracker);

    return tracker;
  };

  @computed
  get currentTracker() {
    return Array.from(this.queueMap.values())[0];
  }

  @action
  addFilesToQueue = files => {
    const promises = files.map(async file => {
      const id = uuid();
      // TODO: we should only require the clientFileId not the id at creation time
      const tracker = this.addFileToQueue({ file, id, clientFileId: id }, { shouldUploadFile: false });
      await tracker.upload();

      if (tracker.success) {
        return { success: true, fileId: tracker.id, s3Url: tracker.s3Url };
      }
      return { success: false, error: tracker.error };
    });

    return Promise.all(promises);
  };

  @action
  raiseBeforeAddToQueue(args) {
    return this.beforeAddToQueue?.(args);
  }

  @computed
  get queue() {
    return [...this.queueMap.values()];
  }

  @computed
  get isUploading() {
    return this.queue.some(entry => !entry.ready);
  }

  @computed
  get allFilesInQueueAreDeleted() {
    return this.queue.every(entry => entry.deleted);
  }

  @computed
  get isQueueEmpty() {
    return !this.queue.length;
  }

  @action
  clearQueue = () => {
    this.queue.filter(entry => !entry.deleted).forEach(entry => (entry.ready ? entry.delete() : entry.cancel()));
    this.queueMap.clear();
  };

  @computed
  get valid() {
    return !this.isQueueEmpty && this.queue.every(fileEntry => fileEntry.valid);
  }

  @computed
  get uploaded() {
    return this.queue.every(fileEntry => fileEntry.uploaded);
  }

  @computed
  get filesReady() {
    return this.queue.every(fileEntry => fileEntry.ready);
  }

  @computed
  get filesUploaded() {
    return this.queue.every(entry => entry.uploadNotificationReceived);
  }

  @action
  notifyFileUploaded(files) {
    this.queue.forEach(entry => {
      const fileInQueue = files.find(file => file.clientFileId === entry.clientFileId);
      if (fileInQueue) {
        entry.markAsUploaded();
        entry.setFileId(fileInQueue.id);
      }
    });
  }
}

export const createUploadModel = args => new UploadModel(args);
