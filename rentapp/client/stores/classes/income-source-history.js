/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';
import newUUID from 'uuid/v4';
import pick from 'lodash/pick';
import IncomeSourceCardModel from '../../models/income-source-card-model';

const incomeSourceProps = [
  'id',
  'incomeSourceType',
  'sourceDescription',
  'employerName',
  'jobTitle',
  'startDate',
  'managerName',
  'managerPhone',
  'grossIncome',
  'grossIncomeFrequency',
];
const addressDetailsProps = ['hasInternationalAddress', 'addressLine', 'addressLine1', 'addressLine2', 'city', 'state', 'zip'];

export class IncomeSourceHistory {
  @observable
  incomeSourceError;

  @observable
  incomeSource;

  @observable
  incomeSourceList;

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
  get items() {
    return this.itemsMap.values();
  }

  @computed
  get hasItems() {
    return this.itemsMap.values() && this.itemsMap.values().length;
  }

  get isValid() {
    return !this.incomeSourceError;
  }

  _dbToModel(data) {
    const incomeSource = {
      ...pick(data, incomeSourceProps),
      ...pick(data.address, addressDetailsProps),
    };
    return incomeSource;
  }

  _modelToDb(data) {
    const incomeSource = pick(data, incomeSourceProps);
    incomeSource.address = pick(data, addressDetailsProps);
    return incomeSource;
  }

  _formattedIncomeSourceRequest(data) {
    return { additionalData: { incomeSourceHistory: data } };
  }

  @action
  async loadItems() {
    await this.fetchAdditionalData();
    const incomeSources = this.incomeSourceList;
    await this.populateIncomeSource(incomeSources);
  }

  @action
  populateIncomeSource(incomeSources) {
    if (incomeSources) {
      this.loaded = true;
      incomeSources.forEach(incomeSource => {
        const _incomeSource = this._dbToModel(incomeSource);
        this.itemsMap.set(_incomeSource.id, new IncomeSourceCardModel(_incomeSource));
      });
    }
  }

  @action
  async add(incomeSource) {
    incomeSource.id = newUUID();
    let incomeSourceData = this.items.map(_item => this._modelToDb(_item));
    incomeSourceData = [...incomeSourceData, this._modelToDb(incomeSource)];
    const additionalDataRequest = this._formattedIncomeSourceRequest(incomeSourceData);
    await this.updateAdditionalData(additionalDataRequest);
    if (this.isValid) {
      this.itemsMap.set(incomeSource.id, new IncomeSourceCardModel(incomeSource));
    }
  }

  @action
  async update(incomeSource, id) {
    const existingIncomeSource = this.itemsMap.get(id);
    const incomeSourceData = this.items.map(_item => this._modelToDb(_item.id === id ? { ...incomeSource, id } : _item));
    const additionalDataRequest = this._formattedIncomeSourceRequest(incomeSourceData);
    await this.updateAdditionalData(additionalDataRequest);
    if (this.isValid) {
      existingIncomeSource.update(incomeSource);
    }
  }

  @action
  async remove(incomeSource) {
    const incomeSourceData = this.items.filter(_item => _item.id !== incomeSource.id).map(_item => this._modelToDb(_item));
    const additionalDataRequest = this._formattedIncomeSourceRequest(incomeSourceData);
    await this.updateAdditionalData(additionalDataRequest);
    if (this.isValid) {
      this.itemsMap.delete(incomeSource.id);
    }
  }

  @action
  async fetchAdditionalData() {
    try {
      this.incomeSourceError = '';
      const resp = await this.apiClient.get('/personApplications/current/additionalData');
      this.incomeSourceList = (resp.additionalData && resp.additionalData.incomeSourceHistory) || [];
    } catch (err) {
      this._handleError(err);
    }
  }

  async updateAdditionalData(additionalData) {
    try {
      this.incomeSourceError = '';
      const resp = await this.apiClient.patch('/personApplications/current/additionalData', { data: additionalData });
      this._handleSuccess(resp);
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  _handleError(err) {
    this.incomeSourceError = err.token || err.message;
  }

  @action
  _handleSuccess(result) {
    this.incomeSource = result;
  }
}
