/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';
import newUUID from 'uuid/v4';
import DemoViewModel from './DemoViewModel';
export default class DemoCollectionViewModel {
  @observable
  itemsMap;

  constructor(items) {
    this.itemsMap = new ObservableMap();
    this.loadItems(items);
  }

  @computed
  get items() {
    return this.itemsMap.values();
  }

  @action
  loadItems(items = []) {
    items.forEach(item => this.itemsMap.set(item.id, new DemoViewModel(item)));
  }

  @action
  add(item) {
    item.id = newUUID();
    this.itemsMap.set(item.id, new DemoViewModel(item));
  }

  @action
  update(entity, id) {
    const item = this.itemsMap.get(id);
    item.update(entity);
  }

  @action
  remove(item) {
    this.itemsMap.delete(item.id);
  }
}
