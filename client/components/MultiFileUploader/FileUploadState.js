/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, ObservableMap } from 'mobx';

export class FileUploadState {
  @observable
  serviceCalls;

  constructor() {
    this.serviceCalls = new ObservableMap();
  }

  getPercentLoaded(id) {
    const storedEntry = this.serviceCalls.get(id);
    return (storedEntry && storedEntry.percent) || 0;
  }

  isFileSizeValid(id) {
    const storedEntry = this.serviceCalls.get(id);
    if (!storedEntry || !storedEntry.error) {
      return true;
    }

    const { error } = storedEntry;
    return error.code !== 'LIMIT_FILE_SIZE'; // This error is handled by multer and multer not by red
  }

  isServerError(id) {
    const storedEntry = this.serviceCalls.get(id);
    if (!storedEntry || !storedEntry.error) {
      return false;
    }

    const { error } = storedEntry;
    return error.status > 0;
  }

  @action
  deleteCall(id) {
    this.serviceCalls.delete(id);
  }

  @action
  notifyStart(args) {
    this.serviceCalls.set(args.id, args);
  }

  @action
  notifyProgress(args) {
    this.serviceCalls.set(args.id, args);
  }

  @action
  notifyEnd(args) {
    if (args.error) {
      this.serviceCalls.set(args.id, args);
    }
  }
}
