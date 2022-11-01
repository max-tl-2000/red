/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';

export default class ApplicationFeesViewModel {
  @observable
  selected;

  constructor({ feeId, feeType, feeName, amount, unitInfo, holdDurationInHours, payerName, isRequired, isHeld }) {
    this.feeId = feeId;
    this.feeType = feeType;
    this.feeName = feeName;
    this.amount = amount;
    this.unitInfo = unitInfo;
    this.holdDurationInHours = holdDurationInHours;
    this.isRequired = isRequired;
    this.payerName = payerName;
    this.selected = isRequired || false;
    this.isHeld = isHeld || false;
  }

  @action
  select(selected) {
    this.selected = selected;
  }
}
