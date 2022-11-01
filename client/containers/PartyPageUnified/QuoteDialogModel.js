/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import DialogModel from './DialogModel';

export default class QuoteDialogModel extends DialogModel {
  @observable.shallow
  selectedInventory;

  @observable
  isRenewalQuote;

  @observable
  selectedQuote;

  @action
  setSelectedQuote(quote) {
    this.selectedQuote = quote;
  }

  @action
  openOrCreateQuote = ({ inventory, isRenewalQuote } = {}) => {
    this.selectedInventory = inventory;
    this.isRenewalQuote = isRenewalQuote;
    this.open();
  };

  @action
  openExistingQuote = ({ quote, isRenewalQuote } = {}) => {
    this.selectedQuote = quote;
    this.isRenewalQuote = isRenewalQuote;
    this.open();
  };

  @action
  closeQuote = () => {
    this.selectedQuote = null;
    this.selectedInventory = null;
    this.close();
  };
}
