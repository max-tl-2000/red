/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, reaction, ObservableMap, action, toJS } from 'mobx';
import clsc from 'helpers/coalescy';
import trim from 'helpers/trim';
import fuzzysearch from 'fuzzysearch';
import Item from './Item';

export default class SelectionModel {
  @observable
  multiple;

  @observable
  _selected;

  @observable
  _items;

  @observable
  query;

  @observable
  _matchQuery;

  @observable
  filterResults = true;

  @action
  setQuery(query) {
    this.query = query;
  }

  @action
  replaceData(data = []) {
    this._items = [];
    this.addItems(data, this.textField, this.valueField, this.disabledField);
  }

  filterElements(items, query) {
    return items.reduce((acc, item) => {
      const match = this._matchQuery(query.toLowerCase(), item);

      const childMatches = item.items ? this.filterElements(item.items, query) : [];
      const matchOnItems = childMatches.length > 0;

      if (match) {
        acc.push(item);
      } else if (matchOnItems) {
        acc.push({ ...item, items: childMatches });
      }

      return acc;
    }, []);
  }

  flattenItems(items) {
    return items.reduce((acc, item) => {
      if (item.items) {
        acc = acc.concat(this.flattenItems(item.items));
      } else {
        acc.push(item);
      }
      return acc;
    }, []);
  }

  areAllItemsSelected(items) {
    let allSelected = true;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.items && item.items.length > 0) {
        allSelected = this.areAllItemsSelected(item.items);
      } else if (!this.isSelected(item)) {
        allSelected = false;
      }

      if (!allSelected) break;
    }

    return allSelected;
  }

  flattenItemsWithoutSelected(items) {
    return items.reduce((acc, item) => {
      if (item.items) {
        acc = acc.concat(this.flattenItemsWithoutSelected(item.items));
      } else if (!this.isSelected(item)) {
        acc.push(item);
      }
      return acc;
    }, []);
  }

  @computed
  get plainFilteredItems() {
    return this.flattenItems(this.items);
  }

  @computed
  get plainFilteredItemsWithoutSelected() {
    return this.flattenItemsWithoutSelected(this.items);
  }

  @computed
  get areAllItemsChecked() {
    return this.plainFilteredItemsWithoutSelected.length === 0;
  }

  @computed
  get items() {
    const query = trim(this.query).toLowerCase();

    if (!query || !this.filterResults) {
      return this._items;
    }

    return this.filterElements(this._items, query);
  }

  constructor(args) {
    this.update(args);
  }

  enableEmitChangeEvents() {
    this.dispose = reaction(
      () => this.selected,
      selected => this._handleChange(selected),
    );
  }

  disableEmitChangeEvents() {
    this.dispose && this.dispose();
  }

  _defaultMatcher(query, item) {
    return fuzzysearch(query, trim(item.text).toLowerCase());
  }

  @action
  update({ items, multiple, textField, valueField, disabledField, matchQuery }) {
    this.disableEmitChangeEvents();
    this.multiple = clsc(multiple, false);
    this._items = [];

    this.textField = textField;
    this.valueField = valueField;
    this.disabledField = disabledField;

    this.addItems(items, textField, valueField, disabledField);

    this._selected = new ObservableMap();
    this._matchQuery = matchQuery || this._defaultMatcher;
    this.enableEmitChangeEvents();
  }

  @computed
  get selection() {
    const selected = this.selected;
    const args = {};

    if (!this.multiple) {
      args.item = null;
      args.id = null;
      args.items = [];
      args.ids = [];
      if (selected.length > 0) {
        const current = selected[0];

        args.item = current.originalItem;
        args.id = current.id;

        args.items.push(args.item);
        args.ids.push(args.id);
      }
    } else {
      args.items = [];
      args.ids = [];

      selected.forEach(item => {
        args.items.push(item.originalItem);
        args.ids.push(item.id);
      });
    }
    // make sure only plain objects (not mobx models)
    // are exposed by accident to the consumers
    return toJS(args);
  }

  @action
  destroy() {
    this.dispose && this.dispose();

    this._items.clear();
    this._items = null;
    this._selected.clear();
    this._selected = null;
  }

  _findItemById(id, items) {
    const len = items.length;
    for (let i = 0; i < len; i++) {
      const item = items[i];
      if (item.id === id) {
        return item;
      }
      if (item.items && item.items.length > 0) {
        const res = this._findItemById(id, item.items);
        if (res !== null) {
          return res;
        }
      }
    }
    return null;
  }

  _sameItemsSelected(ids) {
    const selectedIds = this.selectedIds();

    if (ids && ids.length === selectedIds.length) {
      return ids.every(id => this._selected.has(id));
    }

    return false;
  }

  setSelectedByIds(args) {
    this.disableEmitChangeEvents();
    this._setSelectedByIds(args);
    this.enableEmitChangeEvents();
  }

  @action
  _setSelectedByIds(ids = []) {
    if (this._sameItemsSelected(ids)) {
      return;
    }

    this._selected.clear();

    ids.forEach(id => this.selectById(id));
  }

  @action
  selectById(id) {
    const item = this._findItemById(id, this._items);
    if (item) {
      this.select(item);
    }
  }

  selectedIds() {
    return this.selected.map(item => item.id);
  }

  _raiseChange(selected) {
    if (this.onChange) {
      this.onChange(selected);
    }
  }

  _handleChange(selected) {
    this._raiseChange(selected);
  }

  @computed
  get selected() {
    return [].slice.call(this._selected.values(), 0);
  }

  isSelected(item) {
    return this._selected.has(item.id);
  }

  @action
  unselectById(id) {
    if (this.isSelected({ id })) {
      const item = this._selected.get(id);
      if (item.disabled) {
        return;
      }
      this._selected.delete(id);
    }
  }

  @action
  unselect(item) {
    if (item.disabled) return;

    if (this.isSelected(item)) {
      this._selected.delete(item.id);
    }
  }

  @action
  select(item, { uncheckSelected = true } = {}) {
    if (item.disabled) return;

    if (this.multiple) {
      if (!this._selected.has(item.id)) {
        this._selected.set(item.id, item);
      } else {
        uncheckSelected && this._selected.delete(item.id);
      }
    } else {
      if (this._selected.has(item.id)) {
        return;
      }
      this._selected.clear();
      this._selected.set(item.id, item);
    }
  }

  @action
  selectAll() {
    this.items.forEach(item => this.select(item, { uncheckSelected: false }));
  }

  @action
  unselectAll() {
    this.items.forEach(item => this.unselect(item));
  }

  addItems(items = [], textField, valueField, disabledField) {
    items.forEach(item => this.addItem(item, textField, valueField, disabledField));
  }

  addItem(item, textField, valueField, disabledField) {
    this._items.push(new Item(item, textField, valueField, disabledField));
  }
}
