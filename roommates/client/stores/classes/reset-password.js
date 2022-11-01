/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable } from 'mobx';

export class ResetPassword {
  @observable
  token;

  @observable
  generateTokenError;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.token = null;
  }

  get resetPasswordToken() {
    return this.token;
  }

  handleResetPasswordToken(token) {
    this.token = token;
  }

  handleResetPasswordTokenError(err) {
    this.generateTokenError = err.token || err.message;
  }

  async generateResetPasswordToken({ id, email }) {
    try {
      const result = await this.apiClient.post('/requestResetPassword/generateToken', { data: { userId: id, emailAddress: email } });
      this.handleResetPasswordToken(result);
    } catch (err) {
      this.handleResetPasswordTokenError(err);
    }
  }
}
