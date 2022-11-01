/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FormModel } from 'helpers/Form/FormModel';
import { computed, action } from 'mobx';

import { t } from 'i18next';

class ChildrenFormModel extends FormModel {
  @computed
  get fullName() {
    return this.valueOf('fullName');
  }

  @computed
  get preferredName() {
    return this.valueOf('preferredName');
  }

  constructor({ initialState, validators, id } = {}) {
    super(initialState, validators);
    this.id = id;
  }

  @action
  fillPreferredName() {
    const fullName = this.fullName;
    const firstName = fullName.split(' ')[0];
    this.fields.preferredName.setValue(firstName);
  }

  @action
  updateFrom({ id, ...item }) {
    this.id = id;
    super.updateFrom(item);
  }
}

export const createChildrenFormModel = ({ id, fullName = '', preferredName = '', createdAt } = {}) => {
  const initialState = {
    fullName,
    preferredName,
    createdAt,
  };

  const validators = {
    fullName: {
      required: t('FULL_NAME_REQUIRED'),
    },
  };

  return new ChildrenFormModel({ initialState, validators, id });
};
