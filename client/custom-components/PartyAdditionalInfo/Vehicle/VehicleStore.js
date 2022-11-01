/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';
import { AdditionalInfoTypes } from 'enums/partyTypes';
import { VehicleCardModel } from './VehicleCardModel';
import { PartyAdditionalInfo } from '../PartyAdditionalInfo';

export class VehicleStore {
  @observable
  itemsMap;

  @observable
  partyId;

  @observable
  loaded;

  constructor({ apiClient, partyId, loadItems }) {
    this.type = AdditionalInfoTypes.VEHICLE;
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
  fillItems(vehicles) {
    if (this.partyAdditionalInfo.isValid && vehicles) {
      this.loaded = true;
      vehicles.forEach(vehicle => {
        this.itemsMap.set(
          vehicle.id,
          new VehicleCardModel({
            id: vehicle.id,
            ...vehicle.info,
            createdAt: vehicle.created_at,
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
      item.createdAt = this.partyAdditionalInfo.additionalInfo.created_at;
      this.itemsMap.set(item.id, new VehicleCardModel(item));
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
