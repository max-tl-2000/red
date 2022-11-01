/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action, toJS, ObservableMap } from 'mobx';
import { logger } from 'client/logger';
import ApplicationFeesViewModel from '../../models/application-fees-view-model';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { isNegativeFee } from '../../helpers/utils';
import Request from '../../../../common/client/request';

export class ApplicationFees {
  @observable
  itemsMap;

  constructor({ apiClient, parent }) {
    this.apiClient = apiClient;
    this.itemsMap = new ObservableMap();
    this.parent = parent;

    this.feesRequestor = Request.create({
      call: () => {
        logger.debug('Fetching fees from server');
        return apiClient.get(`/personApplications/${this.personApplicationId}/fees`);
      },
      onResponse: args => {
        const { response } = args;
        logger.debug({ fees: response }, 'Got fees');
        this.fillItems(response);
      },
      onError: error => logger.error({ error }, 'Error fetching fees'),
    });
  }

  @computed
  get loading() {
    return this.feesRequestor.loading;
  }

  @computed
  get personApplicationId() {
    return this.parent.personApplicationId;
  }

  @computed
  get error() {
    return this.feesRequestor.error;
  }

  @computed
  get partyApplicationId() {
    return this.parent.partyApplicationId;
  }

  @action
  async fetchFees(reloadFees = false) {
    if (!this.personApplicationId) return;
    if (this.itemsMap.size && !reloadFees) return;

    this.waiverApplicationFees.forEach(fee => this.itemsMap.delete(fee.feeId));
    await this.feesRequestor.execCall();
  }

  @action
  async fillItems(fees) {
    if (fees) {
      fees.forEach(fee => this.itemsMap.set(fee.feeId, new ApplicationFeesViewModel(fee)));
    }
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
  get hasFees() {
    const { items } = this;
    return items && items.length > 0;
  }

  @computed
  get loaded() {
    return this.hasFees;
  }

  @action
  updateSelection(feeId, value) {
    const existingAddress = this.itemsMap.get(feeId);
    existingAddress.select(value);
  }

  @computed
  get holdDepositFees() {
    return toJS(this.items.filter(fee => fee.selected && fee.feeType === DALTypes.FeeType.HOLD_DEPOSIT));
  }

  @computed
  get applicationFees() {
    return toJS(this.items.filter(fee => fee.selected && fee.feeType === DALTypes.FeeType.APPLICATION));
  }

  @computed
  get waiverApplicationFees() {
    return toJS(this.items.filter(fee => fee.selected && fee.feeType === DALTypes.FeeType.WAIVER_APPLICATION));
  }

  @computed
  get totalAmount() {
    return this.items.reduce((result, fee) => {
      if (fee.amount && fee.selected) {
        const amount = isNegativeFee(fee.feeType) ? fee.amount * -1 : fee.amount;
        result += amount;
      }
      return result;
    }, 0);
  }
}
