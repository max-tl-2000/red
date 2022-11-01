/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import { expect } from 'chai';

export default class Register extends BasePage {
  constructor() {
    super();
    this.url = `${this.baseURL}/register/`;
  }

  openWithToken(token) {
    return this.visit(this.url + token);
  }

  async checkRegistrationIsDisplayed() {
    const isVisible = await this.isVisible('.register-view');
    expect(isVisible).to.equal(true);

    const isFormVisible = await this.isVisible('#register-form');
    expect(isFormVisible).to.equal(true);
  }

  async checkForDashboard() {
    const isVisible = await this.isVisible('.dashboard-view');
    expect(isVisible).to.equal(true);
  }

  async setFullName(name) {
    await this.setValue('#txtFullName', name);
  }

  async setPreferredName(value) {
    await this.setValue('#txtPreferredName', value);
  }

  async setPassword(password) {
    await this.setValue('#txtPassword', password);
  }

  async doRegister() {
    await this.clickOnElement('#btnRegister');
  }

  async validateUsedExpiredToken() {
    const text = await this.getText('#tokenErrorMessage');
    expect(text).to.equal('Your invitation link expired.');
  }

  async validateInvalidToken() {
    const text = await this.getText('#tokenErrorMessage');
    expect(text).to.equal('Your invitation link is invalid.');
  }
}
