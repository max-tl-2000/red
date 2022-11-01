/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';

export class PartyAdditionalInfo {
  @observable
  additionalInfoError;

  @observable
  additionalInfo;

  @observable
  additionalInfoPerType;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  @computed
  get isValid() {
    return !this.additionalInfoError;
  }

  @computed
  get additionalInfoId() {
    return this.additionalInfo && this.additionalInfo.id;
  }

  @action
  async fetchAdditionalInfo({ partyId, type }) {
    try {
      this.additionalInfoError = '';
      this.additionalInfoPerType = await this.apiClient.get(`/parties/${partyId}/additionalInfo`, { params: { type } });
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  async addPartyAdditionalInfo(partyAdditionalInfo) {
    try {
      this.additionalInfoError = '';
      const { partyId } = partyAdditionalInfo;
      const resp = await this.apiClient.post(`/parties/${partyId}/additionalInfo`, { data: partyAdditionalInfo });
      this._handleSuccess(resp);
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  async updatePartyAdditionalInfo(partyAdditionalInfo) {
    try {
      this.additionalInfoError = '';
      const { partyId, id: additionalInfoId } = partyAdditionalInfo;
      const resp = await this.apiClient.patch(`/parties/${partyId}/additionalInfo/${additionalInfoId}`, { data: partyAdditionalInfo });
      this._handleSuccess(resp);
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  async deletePartyAdditionalInfo({ partyId, additionalInfoId }) {
    try {
      this.additionalInfoError = '';
      const resp = await this.apiClient.del(`/parties/${partyId}/additionalInfo/${additionalInfoId}`);
      this._handleSuccess(resp);
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  _handleSuccess(result) {
    this.additionalInfo = result;
  }

  @action
  _handleError(err) {
    this.additionalInfoError = err.token || err.message;
  }
}
