/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';
import { AdditionalInfoTypes } from 'enums/partyTypes';
import { ChildCardModel } from './ChildCardModel';
import { PartyAdditionalInfo } from '../PartyAdditionalInfo';

export class ChildrenStore {
  @observable
  itemsMap;

  @observable
  partyId;

  @observable
  loaded;

  constructor({ apiClient, partyId, loadItems }) {
    this.type = AdditionalInfoTypes.CHILD;
    this.partyId = partyId;
    this.partyAdditionalInfo = new PartyAdditionalInfo({ apiClient });
    this.itemsMap = new ObservableMap();
    this.loaded = false;
    if (loadItems) {
      this.loadItems();
    }
  }

  @computed
  get items() {
    return this.itemsMap.values();
  }

  @action
  fillItems(children) {
    if (this.partyAdditionalInfo.isValid && children) {
      this.loaded = true;
      children.forEach(child => {
        this.itemsMap.set(
          child.id,
          new ChildCardModel({
            id: child.id,
            ...child.info,
            createdAt: child.created_at,
          }),
        );
      });
    }
  }

  @action
  async loadItems() {
    await this.partyAdditionalInfo.fetchAdditionalInfo({
      partyId: this.partyId,
      type: this.type,
    });
    this.fillItems(this.partyAdditionalInfo.additionalInfoPerType);
  }

  @action
  async add(item) {
    const partyAdditionalInfo = {
      partyId: this.partyId,
      type: this.type,
      info: item,
    };
    await this.partyAdditionalInfo.addPartyAdditionalInfo(partyAdditionalInfo);

    if (this.partyAdditionalInfo.isValid) {
      item.id = this.partyAdditionalInfo.additionalInfoId;
      this.itemsMap.set(item.id, new ChildCardModel(item));
    }
  }

  @action
  async update(entity, id) {
    const item = this.itemsMap.get(id);
    delete entity.id;
    const partyAdditionalInfo = {
      id,
      partyId: this.partyId,
      type: this.type,
      info: entity,
    };
    await this.partyAdditionalInfo.updatePartyAdditionalInfo(partyAdditionalInfo);

    if (this.partyAdditionalInfo.isValid) {
      item.update(entity);
    }
  }

  @action
  async remove(item) {
    const { id: additionalInfoId } = item;
    await this.partyAdditionalInfo.deletePartyAdditionalInfo({
      partyId: this.partyId,
      additionalInfoId,
    });

    if (this.partyAdditionalInfo.isValid) {
      this.itemsMap.delete(item.id);
    }
  }

  @computed
  get hasItems() {
    return this.itemsMap.values() && this.itemsMap.values().length;
  }
}
