/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import { formatAgent } from 'helpers/quotes';
import { callPromise } from 'helpers/call-promise';
import { FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';

export class Agent {
  @observable
  agent;

  @observable
  agentError;

  @observable
  loadingAgent = false;

  @observable
  agentFetchFailed = false;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  @computed
  get isAgentReady() {
    return this.agent && !this.loadingAgent && !this.agentFetchFailed;
  }

  @computed
  get isLAAgent() {
    return this.agent && this.agent.functionalRoles.includes(FunctionalRoleDefinition.LAA.name);
  }

  @action
  async fetchPartyAgent(partyId) {
    if (!partyId) return;
    this.agentFetchFailed = false;
    callPromise(
      async () => {
        try {
          const partyAgent = await this.apiClient.get(`/parties/${partyId}/agent`);
          const agentFormated = formatAgent(partyAgent);
          this.agent = {
            ...agentFormated,
            avatar: partyAgent.avatarUrl,
          };
        } catch (err) {
          this._handleError(err);
        }
      },
      'loadingAgent',
      this,
    );
  }

  @action
  _handleError(err) {
    this.agent = null;
    this.agentError = err.token || '';
    this.agentFetchFailed = true;
  }
}
