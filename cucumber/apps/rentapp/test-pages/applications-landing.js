/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import config from 'config';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

const { cucumber } = config;
const { expect } = chai;
chai.use(chaiAsPromised);

export default class ApplicationsLanding extends BasePage {
  constructor() {
    super();
    this.url = `https://${cucumber.rentappSubdomainName}.${cucumber.domain}`;
  }

  async clickOnCreateAccount() {
    const createAccountButtonSelector = '[data-id="createAccountBtn"]';
    expect(await this.isVisible(createAccountButtonSelector)).to.equal(true);
    await this.clickOnElement(createAccountButtonSelector);
  }

  async writePassword(value) {
    const passwordTxtSelector = '[data-id="passwordTxt"]';
    expect(await this.isVisible(passwordTxtSelector)).to.equal(true);
    await this.setValue(passwordTxtSelector, value);
  }

  async checkForLoginPage() {
    return expect(await this.isVisible('[data-id="loginIframe"]')).to.equal(true);
  }

  async writeUsername(value) {
    const usernameTxtTxtSelector = '[data-id="usernameTxt"]';
    expect(await this.isVisible(usernameTxtTxtSelector)).to.equal(true);
    await this.setValue(usernameTxtTxtSelector, value);
  }

  async clickOnLogin() {
    const loginButtonSelector = '[data-id="loginBtn"]';
    expect(await this.isVisible(loginButtonSelector)).to.equal(true);
    await this.clickOnElement(loginButtonSelector);
  }
}
