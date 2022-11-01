/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action, toJS } from 'mobx';

export class Auth {
  @observable
  token = null;

  @observable
  user = null;

  tenantId;

  tenantName;

  propertyId;

  propertyName;

  propertyTimezone;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.init();
  }

  init() {
    const { apiClient } = this;

    apiClient.on('request:error', (evt, err) => {
      if ((err.status === 400 && err.token === 'INVALID_TENANT') || (err.status === 401 && this.isAuthenticated)) {
        this.logout();
      }

      if (err.status === 401) {
        this.logout();
      }
    });
  }

  @action
  logout({ skipOnLogoutEvent = false } = {}) {
    if (skipOnLogoutEvent) {
      this.skipOnLogoutEvent = true;
    }

    this.token = null;
    this.user = null;
  }

  @action
  hydrate({ token, user }) {
    this.token = token;
    this.user = user;

    this.apiClient.setExtraHeaders({
      apiToken: token,
      Authorization: `Bearer ${token}`,
      tenantId: this.tenantId,
      propertyId: this.propertyId,
      propertyName: this.propertyName,
      propertyTimezone: this.propertyTimezone,
    });
  }

  @action
  hydratePropertyConfig({ tenantId, tenantName, propertyId, propertyName, propertyTimezone }) {
    this.tenantId = tenantId;
    this.tenantName = tenantName;
    this.propertyId = propertyId;
    this.propertyName = propertyName;
    this.propertyTimezone = propertyTimezone;
  }

  get propertyConfig() {
    return toJS({
      tenantId: this.tenantId,
      tenantName: this.tenantName,
      propertyId: this.propertyId,
      propertyName: this.propertyName,
      propertyTimezone: this.propertyTimezone,
    });
  }

  @computed
  get isAuthenticated() {
    return !!this.token; // TODO: this should validate if the token is expired and if exists
  }

  _updateUser({ token, user }) {
    this.token = token;
    this.user = user;
  }

  @computed
  get authInfo() {
    return toJS({
      token: this.token,
      user: this.user,
    });
  }
}
