/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { computed, action, observable } from 'mobx';
import { MobxRequest } from '../../mobx/helpers/mobx-request';

const unitsHash = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

class UploadTracker {
  @observable
  file;

  @observable
  isAborted;

  @observable
  validationError;

  @observable
  uploadNotificationReceived;

  @observable
  _uploadNeeded;

  @action
  markAsUploaded() {
    this.uploadNotificationReceived = true;
  }

  @computed
  get name() {
    return this._name || this.file?.name;
  }

  @computed
  get uploadNeeded() {
    return this._uploadNeeded;
  }

  @computed
  get fileId() {
    return this.response?.id || this.id;
  }

  constructor({
    id,
    clientFileId,
    file,
    urlToFile,
    name,
    uploadFunction,
    onUploadResponse,
    deleteFunction,
    validationFunction,
    uploadNeeded,
    clearQueue,
  } = {}) {
    this.file = file;
    this.id = id;
    this.clientFileId = clientFileId;
    this._name = name;
    this._urlToFile = urlToFile;
    this.req = new MobxRequest({
      call: uploadFunction,
      onResponse: ({ response }) => onUploadResponse?.(this, response),
    });
    this.deleteRq = new MobxRequest({ call: (...args) => deleteFunction?.(...args) });
    this.validationFunction = validationFunction;
    this._uploadNeeded = uploadNeeded;
    this.clearQueue = clearQueue;

    !uploadNeeded && this.markAsUploaded();
  }

  @computed
  get uploadComplete() {
    if (!this.uploadNeeded) return true;

    return this.req.uploadProgress === 100;
  }

  @computed
  get loading() {
    if (!this.uploadNeeded) return false;

    return this.req.loading;
  }

  @computed
  get success() {
    if (!this.uploadNeeded) return true;

    return this.req.success;
  }

  @computed
  get errorProcessingfile() {
    return this.req.error;
  }

  @computed
  get error() {
    return this.req.error || this.validationError;
  }

  @computed
  get uploadProgress() {
    return this.req.uploadProgress;
  }

  @computed
  get response() {
    return this.req.response;
  }

  @computed
  get ready() {
    return this.success && this.uploadComplete;
  }

  @computed
  get aborted() {
    return this.isAborted;
  }

  @computed
  get deleted() {
    return this.deleteRq.success;
  }

  @computed
  get friendlyFileSize() {
    let { size } = this.file;

    const ceil = 1000; // binary: 1024 or decimal: 1000 convention

    let i = 0;
    while (size > ceil) {
      size /= ceil;
      i++;
    }
    return `${size.toFixed(1)} ${unitsHash[i]}`;
  }

  @action
  updateFileWithResponse = () => {
    const { response } = this;
    if (!response) {
      return;
    }

    this._urlToFile = response.filename;
    this._name = response.originalName;
    const { id, s3Url } = response?.files?.[0] || {};
    this.id = id;
    this.s3Url = s3Url;

    if (this.id) {
      this.markAsUploaded();
    }
  };

  @action
  setFileId(fileId) {
    this.id = fileId;
  }

  @action
  delete = async () => {
    await this.deleteRq.execCall({ fileId: this.fileId });
  };

  @action
  upload = async () => {
    await this.validate();
    if (this.validationError || !this.file) {
      return;
    }
    await this.req.execCall({ files: [this.file], clientFileId: this.clientFileId });

    if (!this.req.success) return;

    this.updateFileWithResponse();
  };

  @action
  setValidationError = message => {
    this.validationError = message;
  };

  @action
  validate = async () => {
    this.validationError = null;
    if (this.validationFunction) {
      try {
        await this.validationFunction(this.file);
      } catch (err) {
        this.setValidationError(err.message);
      }
    }
  };

  @computed
  get valid() {
    return !this.validationError;
  }

  @action
  cancel = () => {
    if (!this.loading) return;
    this.req.abort();
    this.isAborted = true;
  };
}

export const createUploadTracker = args => new UploadTracker(args);
