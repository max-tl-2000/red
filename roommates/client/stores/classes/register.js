/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable } from 'mobx';

export class Register {
  @observable
  token;

  @observable
  generateTokenError;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.token = null;
  }

  get registerToken() {
    return this.token;
  }

  handleRegisterToken(token) {
    this.token = token;
  }

  handleRegisterTokenError(err) {
    this.generateTokenError = err.token || err.message;
  }

  async generateRegisterToken(propertyConfig, confirmUrl, roommateProfileRequiredFields) {
    try {
      const result = await this.apiClient.post('/register/generateToken', {
        data: { propertyConfig, confirmUrl, roommateProfileRequiredFields },
      });
      this.handleRegisterToken(result);
    } catch (err) {
      this.handleRegisterTokenError(err);
    }
  }
}
