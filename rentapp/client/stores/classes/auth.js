/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action, toJS } from 'mobx';
import { t } from 'i18next';
import Request from '../../../../common/client/request';
import { location } from '../../../../client/helpers/navigator';

export class Auth {
  @observable
  token = null;

  @observable
  userId = null;

  @observable
  impersonatorUserId = null;

  @observable
  impersonatorEmail = null;

  invalidTokenMessage = null;

  constructor({ apiClient }) {
    this.apiClient = apiClient;

    this.init();

    this.rqValidateToken = Request.create({
      call: async ({ token }) => {
        if (!token) throw new TypeError('Missing token');
        const { isValid, isExpired } = await this.apiClient.post('/validResetToken', { data: { token } });

        if (isExpired) location.replace('/notFound');

        if (isValid) this.invalidTokenMessage = null;

        return { isValid };
      },
    });
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

      if (err.token === 'INVALID_TOKEN') {
        this.invalidTokenMessage = t('INVALID_TOKEN_ERROR');
      }
    });
  }

  @action
  logout({ skipOnLogoutEvent = false } = {}) {
    if (skipOnLogoutEvent) {
      this.skipOnLogoutEvent = true;
    }

    this.token = null;
    this.userId = null;
    this.impersonatorUserId = null;
    this.impersonatorEmail = null;
  }

  @action
  hydrate({ token, ...impersonationInfo }) {
    this.token = token;
    this.addImpersonationInfo(impersonationInfo);
  }

  @computed
  get isAuthenticated() {
    return !!this.token; // TODO: add validation of token here
  }

  @computed
  get isUserLogged() {
    return !!this.userId;
  }

  @computed
  get isImpersonation() {
    return !!this.impersonatorUserId;
  }

  @action
  _updateUser({ token, userId }) {
    this.token = token;
    this.userId = userId;
  }

  @action
  addImpersonationInfo({ impersonatorUserId, impersonatorEmail }) {
    this.impersonatorUserId = impersonatorUserId;
    this.impersonatorEmail = impersonatorEmail;
  }

  @action
  validateResetToken(token) {
    return this.rqValidateToken.execCall({ token });
  }

  @computed
  get tokenValidationError() {
    return this.invalidTokenMessage || this.rqValidateToken.error;
  }

  @computed
  get isValidToken() {
    return this.rqValidateToken.response.isValid;
  }

  @computed
  get isTokenValidationInProcess() {
    return this.rqValidateToken.loading;
  }

  @computed
  get authInfo() {
    return toJS({
      token: this.token,
      userId: this.userId,
      ...(this.isImpersonation
        ? {
            impersonatorUserId: this.impersonatorUserId,
            impersonatorEmail: this.impersonatorEmail,
          }
        : {}),
    });
  }
}
