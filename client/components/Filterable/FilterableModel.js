/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import trim from 'helpers/trim';

const defaultGetIdAndText = item => ({
  id: item.id,
  text: item.text,
});

const defaultItemIsDisabled = item => item.disabled;

export default class FilterableModel {
  @observable.shallow
  items = [];

  @observable
  query;

  @observable
  fitlerFn;

  @observable
  multiple;

  @observable.shallow
  selectedKeys = [];

  @observable.shallow
  selectedValues = [];

  @action
  setQuery(query) {
    this.query = query;
  }

  defaultFilterFn = (item, query) => {
    const { text } = this.getIdAndText(item);
    return trim(text).toLowerCase().indexOf(query) > -1;
  };

  constructor({ items, filterFn, getIdAndText = defaultGetIdAndText, itemIsDisabled = defaultItemIsDisabled, multiple }) {
    this.items = items || [];
    this.filterFn = filterFn || this.defaultFilterFn;
    this.selection = observable.shallowMap({});
    this.getIdAndText = getIdAndText;
    this.multiple = multiple;
    this.itemIsDisabled = itemIsDisabled;
  }

  @computed
  get selected() {
    const { selectionKeys = [], selectionValues = [] } = this;
    const ids = selectionKeys;
    const items = selectionValues;

    return {
      ids,
      items,
    };
  }

  itemIsSelected(item) {
    const { id } = this.getIdAndText(item);
    return this.selection.has(id);
  }

  @action
  _unselect(item) {
    const disabled = this.itemIsDisabled(item);

    if (disabled) return false;

    if (this.isSelected(item)) {
      const { id } = this.getIdAndText(item);
      this.selection.delete(id);
      return true;
    }
    return false;
  }

  @action
  setSelectedIds(selectedIds) {
    if (!Array.isArray(selectedIds)) {
      selectedIds = [];
    }
    this.selection.clear();
    selectedIds.forEach(id => this.selectById(id));
  }

  @action
  setItems(items) {
    this.items = items;
    // Check: consider clearing the selected values that are not part of the list anymore
  }

  @action
  setFilterFn(filterFn) {
    this.filterFn = filterFn;
    // Check: consider clearing the selected values that are not part of the list anymore
  }

  @action
  selectById(itemId) {
    if (!itemId) {
      throw new Error('Cannot select an item without the identifier');
    }

    const { items } = this;
    const item = items.find(entry => {
      const { id } = this.getIdAndText(entry);
      return id === itemId;
    });

    if (item) {
      this.select(item);
    }
  }

  @action
  _select(item) {
    const { selection, multiple } = this;
    const { id } = this.getIdAndText(item);
    const disabled = this.itemIsDisabled(item);

    if (disabled) return false;

    if (multiple) {
      if (!selection.has(id)) {
        selection.set(id, item);
        return true;
      }
      return false;
    }

    if (selection.has(id)) {
      return false;
    }

    selection.clear();
    selection.set(id, item);

    return true;
  }

  @action
  computeSelection() {
    const { selection } = this;
    this.selectionKeys = selection.keys();
    this.selectionValues = selection.values();
  }

  @action
  unselect(item) {
    const retVal = this._unselect(item);

    if (retVal) {
      this.computeSelection();
    }

    return retVal;
  }

  @action
  select(item) {
    const retVal = this._select(item);

    if (retVal) {
      this.computeSelection();
    }

    return retVal;
  }

  @computed
  get filteredElements() {
    const { query, items, filterFn } = this;
    const q = trim(query);
    if (!q) return items;
    return items.filter(item => filterFn(item, q.toLowerCase()));
  }

  static create(...args) {
    return new FilterableModel(...args);
  }
}
