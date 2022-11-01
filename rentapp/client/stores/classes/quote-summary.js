/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, toJS, computed } from 'mobx';
import { callPromise } from 'helpers/call-promise';
import { getPropertyPolicies } from '../../../common/helpers/properties';

export class QuoteSummary {
  @observable
  quote;

  @observable
  inventory;

  @observable
  quoteError;

  @observable
  loadingQuote = false;

  @observable
  quoteFetchFailed = false;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  @computed
  get propertyPolicies() {
    if (!(this.inventory && this.inventory.id)) return [];

    const propertyPolicies = getPropertyPolicies(this.inventory.property);

    return toJS(propertyPolicies);
  }

  @computed
  get hasQuote() {
    if (this.loadingQuote || this.quoteFetchFailed) return false;

    return !!this.quote;
  }

  @action
  async fetchQuoteAndInventory(quoteId) {
    this.quoteFetchFailed = false;
    callPromise(
      async () => {
        await this._fetchQuote(quoteId);
        if (!this.quoteFetchFailed) {
          await this._fetchInventoryDetails(this.quote.inventoryId);
        }
        // TODO: handle error?
      },
      'loadingQuote',
      this,
    );
  }

  @action
  _handleError(err) {
    this.quoteError = err.token || '';
    this.quoteFetchFailed = true;
  }

  @action
  async _fetchQuote(quoteId) {
    try {
      this.quote = await this.apiClient.get(`/quotes/published/${quoteId}`);
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  async _fetchInventoryDetails(inventoryId) {
    try {
      this.inventory = await this.apiClient.get(`/inventories/${inventoryId}/details`);
    } catch (err) {
      this._handleError(err);
    }
  }
}
