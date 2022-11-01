/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';

export default class AddressCardModel {
  @observable
  id;

  @observable
  ownOrRent;

  @observable
  ownerName;

  @observable
  ownerPhone;

  @observable
  moveInDate;

  @observable
  monthlyPayment;

  @observable
  hasInternationalAddress;

  @observable
  addressLine;

  @observable
  addressLine1;

  @observable
  addressLine2;

  @observable
  city;

  @observable
  state;

  @observable
  zip;

  updateFields(addressItem) {
    this.ownOrRent = addressItem.ownOrRent;
    this.ownerName = addressItem.ownerName;
    this.ownerPhone = addressItem.ownerPhone;
    this.moveInDate = addressItem.moveInDate;
    this.monthlyPayment = addressItem.monthlyPayment;
    this.hasInternationalAddress = addressItem.hasInternationalAddress;
    this.addressLine = addressItem.addressLine;
    this.addressLine1 = addressItem.addressLine1;
    this.addressLine2 = addressItem.addressLine2;
    this.city = addressItem.city;
    this.state = addressItem.state;
    this.zip = addressItem.zip;
  }

  constructor({ id, createdAt, ...addressItem }) {
    this.id = id;
    this.createdAt = createdAt;
    this.updateFields(addressItem);
  }

  @action
  update(addressItem) {
    this.updateFields(addressItem);
  }
}
