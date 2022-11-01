/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import { expect } from 'chai';

export default class NeedHelp extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  clickOnIDontKnowMyPasswordOption() {
    return this.clickOnElement('[data-expandable-card-id="forget-password"]');
  }

  async validateLabelResetPasswordDisplayed() {
    const text = await this.getText('[data-content-card-label="forgot-password"]');
    return expect(text).to.be.equal('To reset your password, enter the email address you use to sign into Reva. This is usually your work email address.');
  }

  async validateEmailLabelIsDisplayed() {
    const text = await this.getText('#forgotPasswordTxtEmail');
    return text.to.equal('Email');
  }

  setIDontKnowMyPasswordEmail(val) {
    return this.setValue('#forgotPasswordTxtEmail', val);
  }

  doClickOnTextBoxSendEmail() {
    this.setFocus('#forgotPasswordTxtEmail');
  }

  elementInputEmail(val) {
    this.setValue('#forgotPasswordTxtEmail', val);
  }

  elementCancelButton() {
    return this.clickOnElement('[data-button-label="Cancel"]');
  }

  elementContinueButton() {
    return this.clickOnElement('[data-button-label="Continue"]');
  }

  async validateRequiredEmailMessageIsDisplayed() {
    const text = await this.getText('#forgotPasswordTxtEmail-err-msg');
    return expect(text).to.be.equal('Enter a valid email address');
  }

  async validateSentEmailTitleAndMessageIsDisplayed() {
    // This findElement is necessary to wait for the time where the success title and message is actually shown
    const elt = await this.findElement('[data-content-card-label="reset-password-success"]');
    expect(elt).not.to.be.null;
    const title = await this.getText('[data-expandable-card-id="forget-password"] [data-component="card-title"]');
    expect(title).to.equal('Email sent');
    const content = await this.getText('[data-content-card-label="reset-password-success"]');
    expect(content).to.equal('We sent you an email with instructions to reset your password. If you need additional help, email us at support@reva.tech.');
  }

  async validateButtonDoneIsDisplayed() {
    await this.waitForCondition('done button is visible', () => this.isVisible('[data-button-label="Done"]'));
  }

  clickOnDoneButton() {
    return this.clickOnElement('[data-button-label="Done"]');
  }
}
