/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import { now } from '../../../../common/helpers/moment-utils';

export class PetCardModel {
  @observable
  id;

  @observable
  type;

  @observable
  breed;

  @observable
  size;

  @observable
  name;

  updateFields(pet) {
    this.type = pet.type;
    this.breed = pet.breed;
    this.size = pet.size;
    this.name = pet.name;
    this.sex = pet.sex;
    this.isServiceAnimal = pet.isServiceAnimal;
    this.createdAt = pet.createdAt || now();
  }

  constructor(pet) {
    this.id = pet.id;
    this.updateFields(pet);
  }

  @action
  update(pet) {
    this.updateFields(pet);
  }
}
