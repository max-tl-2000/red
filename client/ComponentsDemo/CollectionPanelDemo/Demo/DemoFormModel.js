/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FormModel } from 'helpers/Form/FormModel';
import { computed, action } from 'mobx';
import { VALIDATION_TYPES } from '../../../helpers/Form/Validation';

export default class DemoFormModel extends FormModel {
  @computed
  get firstName() {
    return this.valueOf('firstName');
  }

  @computed
  get lastName() {
    return this.valueOf('lastName');
  }

  constructor({ initialState, validators, id } = {}) {
    super(initialState, validators);

    this.id = id;
  }

  @action
  updateFrom(item) {
    this.id = item.id;

    this.updateField('firstName', item.firstName, true);
    this.updateField('lastName', item.lastName, true);
  }
}

export const createDemoFormModel = ({ id, firstName, lastName } = {}) => {
  const initialState = {
    firstName,
    lastName,
  };

  const validators = {
    // translations are not needed here since this is a demo only!!!
    firstName: {
      errorMessage: 'FirstName is required',
      validationType: VALIDATION_TYPES.REQUIRED,
    },
    lastName: {
      errorMessage: 'LastName is required',
      validationType: VALIDATION_TYPES.REQUIRED,
    },
  };

  return new DemoFormModel({ initialState, validators, id });
};
