/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed } from 'mobx';
import DataRow from './DataRow';

export default class DataGroup {
  constructor({ title, rows, id, selectionMode }) {
    this.id = id;
    this.title = title;
    this.selectionMode = selectionMode;
    this.addRows(rows);
  }

  title = '';

  @observable
  rows = [];

  @observable
  selectedValue = null;

  @computed
  get allSelected() {
    if (this.selectionMode === 'singleSelection') {
      return !!this.selectedValue;
    }
    const count = this.rows.length;
    for (let i = 0; i < count; i++) {
      if (!this.rows[i].selected && !this.rows[i].mandatory) {
        return false;
      }
    }
    return true;
  }

  @computed
  get subTotal() {
    if (this.selectionMode === 'singleSelection') {
      if (this.selectedValue) {
        if ('quantity' in this.selectedValue) {
          return this.selectedValue.quantity * this.selectedValue.amount;
        }
        return this.selectedValue.amount;
      }
      return 0; // none selected
    }
    return this.rows.reduce((seq, row) => {
      if (!row.selected && !row.mandatory) return seq;

      if ('quantity' in row) {
        seq += row.quantity * row.amount ; // eslint-disable-line
      } else {
        seq += row.amount; // eslint-disable-line
      }

      return seq;
    }, 0);
  }

  checkAll() {
    if (this.selectionMode === 'singleSelection') {
      return;
    }

    this.rows.forEach(row => {
      if (row.mandatory) return;
      row.selected = true;
    });
  }

  unCheckAll() {
    if (this.selectionMode === 'singleSelection') {
      return;
    }

    this.rows.forEach(row => {
      if (row.mandatory) return;
      row.selected = false;
    });
  }

  addRows(rows = []) {
    rows.forEach(row => this.addRow(row));
  }

  addRow(row) {
    this.rows.push(new DataRow(row));
  }
}
