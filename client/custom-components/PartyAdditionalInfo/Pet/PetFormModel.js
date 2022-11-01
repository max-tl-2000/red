/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { computed, action } from 'mobx';
import { t } from 'i18next';
import { FormModel } from '../../../helpers/Form/FormModel';

class PetFormModel extends FormModel {
  @computed
  get type() {
    return this.valueOf('type');
  }

  @computed
  get breed() {
    return this.valueOf('breed');
  }

  @computed
  get size() {
    return this.valueOf('size');
  }

  @computed
  get name() {
    return this.valueOf('name');
  }

  @computed
  get isServiceAnimal() {
    return this.valueOf('isServiceAnimal');
  }

  constructor({ initialState, validators, id } = {}) {
    super(initialState, validators);
    this.id = id;
  }

  @action
  updateFrom({ id, ...item }) {
    this.id = id;
    super.updateFrom(item);
  }
}

export const createPetFormModel = ({ id, type, breed, size, name, sex, createdAt, isServiceAnimal } = {}) => {
  const initialState = {
    type,
    breed,
    size,
    name,
    sex,
    createdAt,
    isServiceAnimal,
  };
  const validators = {
    name: {
      required: t('PET_NAME_REQUIRED'),
    },
    type: {
      required: t('PET_TYPE_REQUIRED'),
    },
    breed: {
      required: t('PET_BREED_REQUIRED'),
    },
    size: {
      required: t('PET_SIZE_REQUIRED'),
    },
  };

  return new PetFormModel({ initialState, validators, id });
};
