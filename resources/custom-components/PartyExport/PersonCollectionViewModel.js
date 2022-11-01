/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';
import PersonViewModel from './PersonViewModel';

export default class PersonCollectionViewModel {
  @observable
  itemsMap;

  handleAddPerson;

  handleUpdatePerson;

  memberType;

  constructor(personItems, memberType, handleAddPerson, handleUpdatePerson) {
    this.itemsMap = new ObservableMap();
    this.loadItems(personItems);
    this.handleAddPerson = handleAddPerson;
    this.handleUpdatePerson = handleUpdatePerson;
    this.memberType = memberType;
  }

  @computed
  get items() {
    return this.itemsMap.values();
  }

  @action
  loadItems(personItems = []) {
    personItems.forEach(personItem =>
      this.itemsMap.set(personItem.id, new PersonViewModel({ ...personItem, ...personItem.person, createdAt: personItem.created_at })),
    );
  }
}
