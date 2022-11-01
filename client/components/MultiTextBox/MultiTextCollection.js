/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import v4 from 'uuid/v4';
import clsc from 'helpers/coalescy';
import trim from 'helpers/trim';
import MultiTextModel from './MultiTextModel';

export default class MultiTextCollection {
  constructor({ items = [], itemValidation, defaultError } = {}) {
    this.itemValidation = itemValidation;
    this.defaultError = defaultError;

    const firstItem = new MultiTextModel({ id: v4(), value: '' });

    firstItem.isFirst = true;

    this._firstEmptyItem = [firstItem];

    this.loadItems(items);
  }

  destroy() {
    this._items = null;
  }

  @observable
  _items = [];

  @observable
  validating = false;

  @computed
  get valid() {
    return !this._items.some(item => !item.valid);
  }

  @computed
  get serialized() {
    return this._items.map(item => item.serialized);
  }

  @computed
  get nonEmptySerialized() {
    return this.nonEmptyItems.map(item => item.serialized);
  }

  @computed
  get nonEmptyItems() {
    return this._items.filter(item => !!trim(item.value));
  }

  @computed
  get items() {
    if (this._items.length === 0) {
      return this._firstEmptyItem;
    }
    return this._items;
  }

  @action
  async validate() {
    this.validating = true;

    await Promise.all(this._items.map(item => Promise.resolve(item.validate(this._items))));
    this.validating = false;
  }

  loadItems(items) {
    items.forEach(item =>
      this._items.push(
        new MultiTextModel({
          id: clsc(item.id, v4()),
          value: item.value,
          error: item.error,
          validateFn: this.itemValidation,
          defaultError: this.defaultError,
        }),
      ),
    );
  }

  @action
  addFirst(value) {
    this.add(value);
    this._firstEmptyItem[0].updateValue('');
  }

  @action
  add(value) {
    const item = new MultiTextModel({
      value,
      id: v4(),
      validateFn: this.itemValidation,
      defaultError: this.defaultError,
    });

    this._items.push(item);
    return item;
  }

  @action
  clear() {
    this._items = [];
  }

  @action
  replaceItems(items) {
    this._items = [];
    this.loadItems(items);
  }

  @action
  remove(item) {
    const index = this._items.indexOf(item);
    if (index > -1) {
      this._items.splice(index, 1);
      item = null; // make sure memory is claimed
    }
  }
}
