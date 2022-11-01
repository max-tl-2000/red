/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';
import { parsePhone } from '../../../common/helpers/phone/phone-helper';

export default class PhoneModel {
  @observable
  value = '';

  static create(value) {
    const model = new PhoneModel();
    model.setValue(value);
    return model;
  }

  @computed
  get formattedValues() {
    const phone = this.value;

    const { normalized, valid, national, international, country } = parsePhone(phone);

    let displayValue = phone;
    let value = phone;

    if (valid) {
      displayValue = country === 'US' ? national : international;
      value = normalized;
    }

    return { value, displayValue };
  }

  @computed
  get displayValue() {
    return this.formattedValues.displayValue;
  }

  @computed
  get qualifiedValue() {
    return this.formattedValues.value;
  }

  @action
  setValue(value) {
    this.value = value;
  }

  isEqual(model) {
    if (!model) return false;
    return model.displayValue === this.displayValue && model.qualifiedValue === this.qualifiedValue;
  }
}
