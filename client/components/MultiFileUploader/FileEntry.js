/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, autorun, ObservableMap } from 'mobx';
import typeOf from '../../../common/helpers/type-of';
import { getIconName } from '../../../common/helpers/file-icon';
import { FileMetadata } from './FileMetadata';

const unitsHash = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

const _uploadErrorTypeDefs = {
  SIZE: 'size',
  SIZE_ZERO: 'sizeZero',
  TYPE: 'type',
  SERVER: 'server',
};
const uploadErrorTypes = Object.values(_uploadErrorTypeDefs);

export class FileEntry {
  @observable
  name;

  @observable
  type;

  @observable
  size;

  @observable
  uploadComplete;

  @observable
  uploadRemoved;

  @observable
  inQueue;

  @observable
  metadata;

  @observable
  errorsMap;

  @observable
  categoryId;

  /**
   * @param {File} file: Javascript file object from DropZone
   * @param {Object} validations: an object mapping fieldnames to validations functions
   * @param {FileUploadState} uploadState
   * @param {Object} serverErrors: map of error types to messages for this file, based on TODO
   */
  constructor({ file, validations, uploadState, serverErrorMessages, apiClient, basePath }) {
    this.clientId = file.clientId;
    this.validations = validations;
    this.uploadState = uploadState;
    // the component could be initialized with preloaded files and in this case the uploadstate is not defined and it means the file is uploaded
    this.uploadComplete = typeOf(uploadState) === 'undefined';
    this.uploadRemoved = false;
    this.inQueue = !this.uploadComplete;
    this.serverErrorMessages = serverErrorMessages;
    this.update(file);
    this.validationErrorsMap = new ObservableMap({});
    this.client = apiClient;
    this.basePath = basePath;
    this.id = file.clientId;

    autorun(() => {
      if (this.uploadState && this.percentLoaded === 100) {
        this.onUploaded();
      }

      if (this.inQueue) {
        this.validate();
      }
    });
  }

  @computed
  get isValid() {
    return !this.hasError;
  }

  @computed
  get iconName() {
    return getIconName(this.name);
  }

  @computed
  get fileSizeStr() {
    let fileSize = this.size;
    const ceil = 1000; // binary: 1024 or decimal: 1000 convention

    let i = 0;
    while (fileSize > ceil) {
      fileSize /= ceil;
      i++;
    }

    return `${fileSize.toFixed(1)} ${unitsHash[i]}`;
  }

  @computed
  get percentLoaded() {
    if (!this.uploadState) {
      return 0;
    }

    if (this.uploadComplete) {
      return 100;
    }

    return this.uploadState.getPercentLoaded(this.clientId);
  }

  @computed
  get uploading() {
    const pct = this.percentLoaded;
    return pct > 0 && pct < 100;
  }

  @computed
  get hasError() {
    return !!Object.keys(this.errors).length;
  }

  @computed
  get errors() {
    const errors = {};
    if (this.uploadState && !this.uploadState.isFileSizeValid(this.clientId)) {
      errors.size = this.serverErrorMessages.size;
    }

    if (this.uploadState && this.uploadState.isServerError(this.clientId)) {
      errors.server = this.serverErrorMessages.generic;
    }

    Object.assign(errors, this.validationErrorsMap.toJS());
    return errors;
  }

  // list of validation keys, excluding those marked as metadata
  validationKeys() {
    return Object.entries(this.validations || {}).reduce((acc, [valKey, valValue]) => {
      if (!valValue.isMetadata) {
        acc.push(valKey);
      }
      return acc;
    }, []);
  }

  @computed
  get errorMessage() {
    const valKeys = this.validationKeys();
    const errorEntries = Object.entries(this.errors).filter(([key]) => valKeys.includes(key) || uploadErrorTypes.includes(key));
    return errorEntries.length ? errorEntries : null;
  }

  @computed
  get metadataErrorMessage() {
    const valKeys = this.validationKeys();
    const metadataErrorEntries = Object.entries(this.errors).filter(([key]) => !valKeys.includes(key) && !uploadErrorTypes.includes(key));
    return metadataErrorEntries.length ? metadataErrorEntries[0][1] : null;
  }

  @computed
  get uploadErrorMessage() {
    const uploadErrorEntry = Object.entries(this.errors).find(([key]) => uploadErrorTypes.includes(key));
    return (uploadErrorEntry && uploadErrorEntry[1]) /* msg */ || null;
  }

  @action
  onUploaded() {
    this.uploadComplete = true;
    this.inQueue = false;
    this.uploadState.deleteCall(this.clientId);
  }

  @action
  removeUpload(inProgress = true) {
    if (this.uploadRemoved) return;

    this.uploadRemoved = true;
    if (inProgress && this.uploading) {
      this.client.abortUpload(this.clientId);
      this.uploadState.deleteCall(this.clientId);
    }
  }

  @action
  validate(includeMetadata = false) {
    if (!this.validations) return;

    // TODO: pretty sure that we have this pattern elsewhere in the codebsae
    Object.keys(this.validations || {}).forEach(key => {
      const { validator, message, isMetadata = false } = this.validations[key];
      if (!isMetadata || (isMetadata && includeMetadata)) {
        if (!validator) {
          throw new Error(`Must provide validator function for ${key}`);
        }
        if (!message) throw new Error(`Must provide message for ${key}`);
        const value = this[key];
        if (!validator(value)) {
          this.validationErrorsMap.set(key, message);
        } else {
          this.validationErrorsMap.delete(key);
        }
      }
    });
  }

  @action
  update(file) {
    this.name = file.name;
    this.type = file.type;
    this.size = file.size;
    this.sizeZero = file.size === 0;

    if (file.metadata) {
      this.categoryId = file.metadata.categoryId;
    }

    this.updateMetadata(file.metadata);
    this.file = file;
  }

  @action
  updateMetadata(metadata) {
    if (!this.metadata) {
      this.metadata = new FileMetadata({ metadata });
    } else {
      this.metadata.update({ metadata });
      this.client.patch(`${this.basePath}/${this.id}/metadata`, {
        data: metadata,
      });
    }
  }
}
