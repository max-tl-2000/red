/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, autorun, ObservableMap, computed } from 'mobx';
import { Entry } from './Entry';

export class ListModel {
  @observable
  map;

  noFireChange = false;

  constructor({ items = [], validation } = {}) {
    this.map = new ObservableMap();
    this.validation = validation;
    this.update(items);
    this.firstTime = true;

    this.dispose = autorun(() => {
      const values = this.values;
      // autorun is executed also the first time
      // so we need to make sure this fires only
      // when the data had changed because of
      // changes done after construction time
      if (this.firstTime) {
        this.firstTime = false;
        return;
      }

      if (this.noFireChange) {
        // prevent firing change if we specifically asked not to do it
        return;
      }

      if (this.onChange) {
        this.onChange(values);
      }
    });
  }

  silentUpdate(items) {
    this.noFireChange = true;
    this.update(items);
    this.noFireChange = false;
  }

  @action
  update(items) {
    this.map.values().forEach(entry => (entry.visited = false));

    items.forEach(item => {
      this.add(item);
    });

    this.map.values().forEach(entry => {
      if (!entry.visited) {
        this.map.delete(entry.id);
      }
    });
  }

  @computed
  get values() {
    return this.map.values();
  }

  @computed
  get length() {
    return this.map.values().length;
  }

  @action
  add(item) {
    if (!this.map.has(item.id)) {
      const validation = this.validation;
      this.map.set(item.id, new Entry({ item, validation }));
    } else {
      // we don't reset the object, we assume the object is the same
      // if the ids match
      const storedEntry = this.map.get(item.id);
      storedEntry.update(item);
    }
  }

  @action
  remove(item) {
    this.map.delete(item.id);
  }

  @action
  removeNotValidItems() {
    this.map.values().forEach(entry => {
      if (!entry.valid) {
        this.map.delete(entry.id);
      }
    });
  }

  @action
  destroy() {
    this.dispose && this.dispose();
    this.map.clear();
    this.map = null;
  }

  @computed
  get value() {
    return this.map.values().map(entry => ({ id: entry.id, text: entry.text }));
  }
}
