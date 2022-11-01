/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action, ObservableMap } from 'mobx';
import { MobxRequest } from '../helpers/mobx-request';

class TeamsCallQueueStore {
  @observable
  _teamsCallQueueMap;

  constructor(service) {
    this._teamsCallQueueMap = new ObservableMap();
    this.teamsCallQueueRq = new MobxRequest({
      call: service.getTeamsCallQueue,
      onResponse: ({ response }) => this.combineResultsTeamsCallQueue(response),
    });
  }

  @action
  combineResultsTeamsCallQueue(teamsCallQueue) {
    teamsCallQueue.forEach(teamCallQueue => this._teamsCallQueueMap.set(teamCallQueue.teamId, teamCallQueue));
  }

  @action
  loadTeamCallQueue() {
    this.teamsCallQueueRq.execCall();
  }

  @computed
  get isLoadingTeamsCallQueue() {
    return this.teamsCallQueueRq.loading;
  }

  @computed
  get teamsCallQueueError() {
    return this.teamsCallQueueRq.error;
  }

  @computed
  get teamsCallQueue() {
    return this._teamsCallQueueMap;
  }
}

export const createTeamsCallQueueStore = service => new TeamsCallQueueStore(service);
