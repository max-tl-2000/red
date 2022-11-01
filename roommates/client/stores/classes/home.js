/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, ObservableMap } from 'mobx';
import assign from 'lodash/assign';
import HomeModel from '../../models/home';
import RoommateModel from '../../models/roommate';
import { DALTypes } from '../../../common/enums/dal-types';

export class Home {
  @observable
  roommateList;

  @observable
  homeError;

  @observable
  myProfile;

  @observable
  roommatesFilter = {};

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.roommateList = new ObservableMap();
    this.nonFilteredRoommatesList = [];
  }

  get HomeModel() {
    if (!this._HomeModel) {
      this._HomeModel = new HomeModel({});
    }
    return this._HomeModel;
  }

  @computed
  get roommates() {
    return this.roommateList.values();
  }

  @action
  setMyRoommateProfile(profile) {
    this.myProfile = profile;
  }

  @action
  updateFilterState(filter) {
    this.roommatesFilter = assign(this.roommatesFilter, filter);
  }

  @action
  fillRoommates(roommates, userId) {
    this.nonFilteredRoommatesList = roommates;
    const filteredList = userId ? roommates.filter(roommate => userId !== roommate.id) : roommates.slice(0, 5);
    filteredList.forEach(filteredRoommate => this.roommateList.set(filteredRoommate.id, new RoommateModel(filteredRoommate)));
  }

  @action
  async fetchRoommates({ userId, filter, replaceFilterState = true }) {
    if (replaceFilterState) this.roommatesFilter = filter;

    this.cleanRoommatesList();
    const roommates = await this.apiClient.get('/roommates', {
      params: { filter: JSON.stringify(filter), userId },
    });
    this.fillRoommates(roommates, userId);
  }

  @action
  cleanRoommatesList() {
    this.roommateList.clear();
  }

  @action
  fillNonFilteredRoommates() {
    this.cleanRoommatesList();
    const roommates = this.nonFilteredRoommatesList.map(roommate => {
      roommate.contacted = false;
      return roommate;
    });
    this.fillRoommates(roommates);
  }

  @action
  handleSendEmailToRoommateError(err) {
    this.homeError = err.token || err.message;
  }

  @action
  handleSendEmailToRoommateSuccess(roommate) {
    const contactedRoommate = this.roommateList.get(roommate.id);
    contactedRoommate.contacted = true;
    this.roommateList.set(roommate.id, new RoommateModel(contactedRoommate));
  }

  @action
  async sendEmailToRoommate(property, profile, roommate, message, appName) {
    try {
      this.homeError = '';
      const payload = {
        roommateMessageProperty: { id: property.id, name: property.name },
        messageContent: message,
        from: { id: profile.id, name: profile.name },
        to: [{ id: roommate.id, name: roommate.name }],
        communicationType: DALTypes.PersonMessageType.EMAIL,
        appName,
      };
      await this.apiClient.post('/roommates/messages/send', { data: payload });
      this.handleSendEmailToRoommateSuccess(roommate);
    } catch (error) {
      this.handleSendEmailToRoommateError(error);
    }
  }
}
