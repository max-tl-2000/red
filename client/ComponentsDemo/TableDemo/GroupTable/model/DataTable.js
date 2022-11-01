/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed } from 'mobx';
import DataGroup from './DataGroup';

export default class DataTable {
  constructor(groups) {
    this.addGroups(groups);
  }

  @observable
  groups = [];

  @computed
  get allSelected() {
    const count = this.groups.length;
    for (let i = 0; i < count; i++) {
      if (!this.groups[i].allSelected) {
        return false;
      }
    }
    return true;
  }

  @computed
  get subTotal() {
    return this.groups.reduce((seq, group) => {
      seq += group.subTotal; // eslint-disable-line
      return seq;
    }, 0);
  }

  checkAll() {
    this.groups.forEach(row => row.checkAll());
  }

  unCheckAll() {
    this.groups.forEach(row => row.unCheckAll());
  }

  addGroups(groups = []) {
    groups.forEach(group => this.addGroup(group));
  }

  addGroup(group) {
    this.groups.push(new DataGroup(group));
  }
}
