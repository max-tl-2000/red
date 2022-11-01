/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import typeOf from 'helpers/type-of';
import trim from 'helpers/trim';

export class Entry {
  @computed
  get valid() {
    if (!this.validation) {
      return true;
    }
    const typeOfValidation = typeOf(this.validation);
    if (typeOfValidation === 'function') {
      return this.validation(this.text);
    }
    if (typeOfValidation === 'regexp') {
      return this.validation.test(this.text);
    }
    return true;
  }

  @observable
  text;

  @observable
  originalItem;

  constructor({ item, validation }) {
    this.validation = validation;
    this.update(item);
  }

  @action
  update(item) {
    this.id = item.id;
    this.text = trim(item.text);
    this.originalItem = item;
    this.visited = true;
  }
}
