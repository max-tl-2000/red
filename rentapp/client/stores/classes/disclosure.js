/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { computed, action, toJS } from 'mobx';
import isEqual from 'lodash/isEqual';
import DisclosureModel from '../../models/disclosure-model';
import { AdditionalData } from './additional-data';
export class Disclosure extends AdditionalData {
  constructor({ apiClient }) {
    super({ apiClient });
    this.currentState = {};
  }

  @computed
  get items() {
    return this.itemsMap.values();
  }

  @computed
  get selected() {
    return toJS(this.items.filter(item => item.selected));
  }

  @computed
  get formattedDisclosuresRequest() {
    return this.selected.reduce((acc, { id: key, description = '' }) => {
      acc[key] = description;
      return acc;
    }, {});
  }

  @computed
  get valid() {
    return !this.selected.some(item => !item.description);
  }

  @computed
  get isDirty() {
    return !isEqual(this.formattedDisclosuresRequest, this.currentState);
  }

  @computed
  get isInteracted() {
    return !this.selected.some(item => !item.interacted);
  }

  @action
  updateInteracted(disclosures) {
    disclosures.items.forEach(item => {
      if (!item.description) return item.updateInteracted(item.description);
      return item.updateInteracted(item.description);
    });
  }

  @action
  async fillItems(disclosures, onlySelected) {
    if (this.isValid && disclosures) {
      this.loaded = true;
      disclosures.filter(disclosure => disclosure.showInApplication).forEach(disclosure => this.itemsMap.set(disclosure.id, new DisclosureModel(disclosure)));

      if (onlySelected) {
        await this.loadPersonApplicationDisclosures();
      }
    }

    this.storeState();
  }

  @action
  storeState() {
    this._originalState = this.serialized;
  }

  @action
  restoreState() {
    const { _originalState, itemsMap } = this;
    if (!this._originalState) return;
    itemsMap.clear();
    _originalState.forEach(disclosure => itemsMap.set(disclosure.id, new DisclosureModel(disclosure)));
  }

  @computed
  get serialized() {
    return this.items.map(disclosure => disclosure.serialized);
  }

  @action
  selectDisclosures(disclosures) {
    if (this.isValid && disclosures) {
      Object.keys(disclosures).forEach(key => {
        const disclosure = this.itemsMap.get(key);
        if (disclosure) {
          disclosure.select(true);
          disclosure.updateDescription(disclosures[key]);
        }
      });
    }
  }

  @action
  async loadPersonApplicationDisclosures() {
    await this.fetchAdditionalData();
    this.currentState = (this.additionalData && this.additionalData.disclosures) || {};
    this.selectDisclosures(this.currentState);
  }

  @action
  async loadDisclosures(onlySelected = true) {
    try {
      this.additionalDataError = '';
      const disclosures = await this.apiClient.get('/disclosures');
      await this.fillItems(disclosures, onlySelected);
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  async submitDisclosures() {
    const payload = {
      additionalData: {
        disclosures: this.formattedDisclosuresRequest,
      },
    };

    await this.updateAdditionalData(payload);
    if (this.isValid) {
      this.storeState();
      this.currentState = this.formattedDisclosuresRequest;
    }
  }
}
