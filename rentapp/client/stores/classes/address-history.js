/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { action, computed } from 'mobx';
import newUUID from 'uuid/v4';
import pick from 'lodash/pick';
import AddressCardModel from '../../models/address-card-model';
import { AdditionalData } from './additional-data';

const addressProps = ['id', 'ownOrRent', 'ownerName', 'ownerPhone', 'moveInDate', 'monthlyPayment'];
const addressDetailsProps = ['hasInternationalAddress', 'addressLine', 'addressLine1', 'addressLine2', 'city', 'state', 'zip'];

export class AddressHistory extends AdditionalData {
  constructor({ apiClient }) {
    super({ apiClient });
  }

  @computed
  get items() {
    return this.itemsMap.values();
  }

  get isValid() {
    return !this.additionalDataError;
  }

  _dbToModel(data) {
    const addressHistory = {
      ...pick(data, addressProps),
      ...pick(data.address, addressDetailsProps),
    };
    return addressHistory;
  }

  _modelToDb(data) {
    const addressHistory = pick(data, addressProps);
    addressHistory.address = pick(data, addressDetailsProps);
    return addressHistory;
  }

  _formattedAddressHistoryRequest(data) {
    return { additionalData: { addressHistory: data } };
  }

  @action
  createAddressModels(addresses) {
    if (this.isValid && addresses) {
      this.loaded = true;
      addresses.forEach(address => {
        const _address = this._dbToModel(address);
        this.itemsMap.set(_address.id, new AddressCardModel(_address));
      });
    }
  }

  @action
  async loadItems() {
    await this.fetchAdditionalData();
    const addresses = (this.additionalData && this.additionalData.addressHistory) || [];
    this.createAddressModels(addresses);
  }

  @action
  async add(address) {
    address.id = newUUID();
    let addressHistoryData = this.items.map(_item => this._modelToDb(_item));
    addressHistoryData = [...addressHistoryData, this._modelToDb(address)];
    const additionalDataRequest = this._formattedAddressHistoryRequest(addressHistoryData);
    await this.updateAdditionalData(additionalDataRequest);
    if (this.isValid) {
      this.itemsMap.set(address.id, new AddressCardModel(address));
    }
  }

  @action
  async update(address, id) {
    const existingAddress = this.itemsMap.get(id);
    const addressHistoryData = this.items.map(_item => this._modelToDb(_item.id === id ? { ...address, id } : _item));
    const additionalDataRequest = this._formattedAddressHistoryRequest(addressHistoryData);
    await this.updateAdditionalData(additionalDataRequest);
    if (this.isValid) {
      existingAddress.update(address);
    }
  }

  @action
  async remove(address) {
    const addressHistoryData = this.items.filter(_item => _item.id !== address.id).map(_item => this._modelToDb(_item));
    const additionalDataRequest = this._formattedAddressHistoryRequest(addressHistoryData);
    await this.updateAdditionalData(additionalDataRequest);
    if (this.isValid) {
      this.itemsMap.delete(address.id);
    }
  }
}
