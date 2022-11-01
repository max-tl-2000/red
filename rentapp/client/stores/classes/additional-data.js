/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';

export class AdditionalData {
  @observable
  additionalDataError;

  @observable
  additionalData;

  @observable
  itemsMap;

  @observable
  loaded;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.itemsMap = new ObservableMap();
    this.loaded = false;
  }

  @computed
  get isValid() {
    return !this.additionalDataError;
  }

  @action
  async fetchAdditionalData() {
    try {
      this.additionalDataError = '';
      const response = await this.apiClient.get('/personApplications/current/additionalData');
      this.additionalData = (response && response.additionalData) || {};
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  async updateAdditionalData(additionalData) {
    try {
      this.additionalDataError = '';
      await this.apiClient.patch('/personApplications/current/additionalData', {
        data: additionalData,
      });
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  _handleError(err) {
    this.additionalDataError = err.token || err.message;
  }

  @computed
  get hasItems() {
    const values = this.itemsMap.values();
    return values && values.length;
  }
}
