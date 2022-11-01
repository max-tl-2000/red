/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import { now } from '../../../common/helpers/moment-utils';

const NonUpdatableProps = ['id', 'createdAt'];
export default class IncomeSourceCardModel {
  @observable
  id;

  @observable
  incomeSourceType;

  @observable
  sourceDescription;

  @observable
  employerName;

  @observable
  jobTitle;

  @observable
  startDate;

  @observable
  managerName;

  @observable
  managerPhone;

  @observable
  grossIncome;

  @observable
  grossIncomeFrequency;

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

  updateFields(incomeSourceItem) {
    Object.keys(this).forEach(key => {
      if (NonUpdatableProps.includes(key)) return;
      this[key] = incomeSourceItem[key];
    });
  }

  constructor({ id, createdAt, ...incomeSourceItem }) {
    this.id = id;
    this.createdAt = createdAt || now();
    this.updateFields(incomeSourceItem);
  }

  @action
  update(incomeSourceItem) {
    this.updateFields(incomeSourceItem);
  }
}
