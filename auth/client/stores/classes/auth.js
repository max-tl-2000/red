/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action, toJS } from 'mobx';
import cfg from 'helpers/cfg';
import { registerModel } from '../../models/register-model';
import { confirmRegisterModel } from '../../models/confirm-register-model';
import { resetPasswordModel } from '../../models/reset-password-model';

export class Auth {
  @observable
  user;

  @observable
  loginIn;

  @observable
  loginError;

  @observable
  token;

  @observable
  blockedAccount;

  @observable
  sentRegister;

  @observable
  registerError;

  @observable
  isRegistering;

  @observable
  confirmToken;

  @observable
  sentResetPassword;

  @observable
  resetPasswordError;

  @observable
  isResettingPassword;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this._registerModel = null;
    this._confirmRegisterModel = null;
    this._resetPasswordModel = null;
    this.init();
  }

  get userName() {
    const user = this.user;
    if (!this.user) {
      return 'anonymous';
    }
    return user.preferredName || user.fullName || user.email;
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
  hydrate({ token }) {
    this.token = token;
  }

  @computed
  get tokenObject() {
    // TODO: we don't need the entire auth token being decoded here
    return cfg('token', {});
  }

  @action
  hydrateConfirmToken(confirmToken) {
    this.confirmToken = confirmToken;
  }

  @computed
  get confirmRegisterToken() {
    return this.confirmToken;
  }

  @computed
  get isAuthenticated() {
    return !!this.token; // TODO: add validation of token here
  }

  @action
  logout() {
    this.token = null;
  }

  @action
  _updateUser({ user, token }) {
    this.user = user;
    this.token = token;
  }

  @action
  _handleSuccess(result) {
    this._updateUser(result);
    this.loginError = null;
    this.loginIn = false;
    return result;
  }

  @computed
  get authInfo() {
    return toJS({
      user: this.user,
      token: this.token,
    });
  }

  @action
  _handleError(err) {
    this.loginError = err.token || err.message;
    this.blockedAccount = err.blockedAccount;
    this.user = null;
    this.loginIn = false;
  }

  @action
  async login({ email, password, _name_ }) {
    this.loginIn = true;

    try {
      const result = await this.apiClient.post('/login', {
        data: { email, password, _name_ },
        isAuthCall: true,
      });

      if (result.err) {
        return this._handleError(result.err);
      }

      return this._handleSuccess(result);
    } catch (err) {
      this._handleError(err);

      // forward the error
      throw err;
    }
  }

  @action
  async changePasswordOnFirstLogin({ userId, password, emailAddress, token }) {
    this.loginIn = true;

    try {
      await this.apiClient.post('/commonUserChangePassword', {
        data: { userId, password, emailAddress, token },
        isAuthCall: true,
      });
    } catch (err) {
      this._handleError(err);

      // forward the error
      throw err;
    }
  }

  @action
  async registerCommonUser({ userId, password, emailAddress, isResetPassword, appId, token }) {
    this.loginIn = true;

    try {
      const result = await this.apiClient.post('/commonUser/register', {
        data: { userId, password, emailAddress, isResetPassword, appId, token },
        isAuthCall: true,
      });
      return this._handleSuccess(result);
    } catch (err) {
      this._handleError(err);

      // forward the error
      throw err;
    }
  }

  async checkIfRegisteredUser(userId) {
    try {
      const result = await this.apiClient.get(`/commonUser/check/${userId}`, {
        isAuthCall: true,
      });
      return !!result?.registered;
    } catch (err) {
      this._handleError(err);

      // forward the error
      throw err;
    }
  }

  @action
  handleRegisterSuccess() {
    this.sentRegister = true;
    this.isRegistering = false;
  }

  @action
  handleRegisterError(err) {
    this.registerError = err.token || err.message;
    this.isRegistering = false;
  }

  async inviteCommonUser({ email, token }) {
    this.isRegistering = true;
    const result = await this.apiClient.post('/commonUser/invite', {
      data: { emailAddress: email, token },
      isAuthCall: true,
    });

    if (result.err) {
      return this.handleRegisterError(result.err);
    }
    return this.handleRegisterSuccess();
  }

  @action
  handleRequestResetPasswordSuccess() {
    this.sentResetPassword = true;
  }

  @action
  handleRequestResetPasswordError(err) {
    this.resetPasswordError = err.token || err.message;
  }

  @action
  async requestResetPasswordCommonUser({ email, appId, confirmUrl, token, appName }) {
    this.isResettingPassword = true;
    // TODO: Refactor the auth code to properly use rejection as errors instead of 200 responses
    await this.apiClient.post('/commonUser/requestResetPassword', {
      data: { emailAddress: email, appId, confirmUrl, token, appName },
      isAuthCall: true,
    });
    this.isResettingPassword = false;
    return this.handleRequestResetPasswordSuccess();
  }

  @action
  async requestTemporalResetPassword({ appId, confirmUrl }) {
    return await this.apiClient.post('/commonUser/requestTemporalResetPassword', {
      data: { appId, confirmUrl },
      isAuthCall: true,
    });
  }

  @action
  updateSentRegister(sentRegister) {
    this.sentRegister = sentRegister;
    this.registerError = null;
  }

  @action
  updateSentResetPassword(sentResetPassword) {
    this.sentResetPassword = sentResetPassword;
    this.resetPasswordError = null;
  }

  get registerModel() {
    if (!this._registerModel) {
      this._registerModel = registerModel.create(this);
    }
    return this._registerModel;
  }

  get confirmRegisterModel() {
    if (!this._confirmRegisterModel) {
      this._confirmRegisterModel = confirmRegisterModel.create(this);
    }
    return this._confirmRegisterModel;
  }

  get resetPasswordModel() {
    if (!this._resetPasswordModel) {
      this._resetPasswordModel = resetPasswordModel.create(this);
    }
    return this._resetPasswordModel;
  }
}
