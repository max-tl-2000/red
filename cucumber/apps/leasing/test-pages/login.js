/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import logger from 'helpers/logger';
import { expect } from 'chai';

export default class Login extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async setEmail(val) {
    logger.trace('Check if email field is displayed');
    await this.findElement('#txtEmail');
    logger.trace('Email field is displayed');
    return this.setValue('#txtEmail', val);
  }

  async setPassword(val) {
    logger.trace('Check if password field is displayed');
    await this.findElement('#txtPassword');
    logger.trace('password field is displayed');
    return this.setValue('#txtPassword', val);
  }

  async doLogin() {
    await this.clickOnElement('#btnLogin');
  }

  async checkForDashboard() {
    const isVisible = await this.isVisible('.dashboard-view');
    expect(isVisible).to.equal(true);
  }

  async checkForLogin() {
    const isVisible = await this.isVisible('.sign-in-view');
    expect(isVisible).to.equal(true);
  }

  async isLoginDisplayed() {
    try {
      return await this._findElement('.sign-in-view');
    } catch (error) {
      return false;
    }
  }

  async validateErrorInvalidEmail() {
    logger.trace('Check if validation message is displayed');
    await this.findElement('#txtEmail-err-msg');
    logger.trace('Invalid account message is displayed');
    const text = await this.getText('#txtEmail-err-msg');
    expect(text.trim()).to.equal('Provide a valid email address');
  }

  async validateErrorInvalidAccount() {
    logger.trace('Check if validation message is displayed');
    await this.findElement('[data-id="signInError"]');
    logger.trace('Invalid account message is displayed');
    const text = await this.getText('[data-id="signInError"]');
    expect(text).to.equal('Your email and password do not match our records.');
  }

  async waitForPasswordInputVisible() {
    await this.waitForCondition('password is visible', () => this.isVisible('#txtPassword'));
  }

  async validateLockedAccount() {
    logger.trace('Check if validation message is displayed');
    await this.findElement('[data-id="signInError"]');
    logger.trace('Locked account message is displayed');
    const text = await this.getText('[data-id="signInError"]');
    expect(text).to.equal('We disabled your account after too many sign in failures. Reset your password to enable your account again.');
  }

  doNeedHelp() {
    return this.clickOnElement('#btnHelp');
  }
}
