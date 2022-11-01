/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';

export default class ResetPassword extends BasePage {
  constructor() {
    super();
    this.url = `${this.baseURL}/resetPassword/`;
  }

  openWithToken(token) {
    return this.visit(this.url + token);
  }

  async newPasswordField() {
    return this.clickOnElement('#txtPassword');
  }

  async setPassword(val) {
    await this.setValue('#txtPassword', val);
  }

  clickOnResetPasswordButton() {
    return this.clickOnElement('#btnSignIn');
  }

  async checkDashboardResetPassword() {
    await this.findElement('#content');
  }
}
