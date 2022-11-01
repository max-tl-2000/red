/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable } from 'mobx';
import getFieldValue from '../../../common/helpers/get-field-value';

export default class Item {
  id = null;

  text = '';

  @observable
  disabled = false;

  items = null;

  constructor(originalItem, textField = 'text', valueField = 'id', disabledField = 'disabled') {
    const { items } = originalItem;

    this.id = getFieldValue(originalItem, valueField);
    this.text = getFieldValue(originalItem, textField);
    this.disabled = getFieldValue(originalItem, disabledField);

    this.originalItem = originalItem;

    if (items) {
      this.items = items.map(item => new Item(item, textField, valueField, disabledField));
    }
  }
}
