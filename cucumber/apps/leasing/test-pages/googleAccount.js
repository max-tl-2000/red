/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';

export default class GoogleVoice extends BasePage {
  constructor() {
    super();
    this.url = 'https://accounts.google.com/ServiceLogin?service=mail&continue=https://mail.google.com/mail/#identifier';
  }

  async enterMailInAccountPage(email) {
    await this.clickOnElement('#Email');
    await this.setValue('#Email', email); // write mail account
    await this.clickOnElement('#next'); // click on next button
  }

  async enterPasswordInAccountPage(password) {
    await this.clickOnElement('#Passwd');
    await this.setValue('#Passwd', password); // write password account
    await this.clickOnElement('#signIn');
  }

  async doClickOnResetPasswordLink() {
    await this.clickOnElement('.J-Ke.n0'); // mail inbox
    this.setValue('#gbqfq', 'reset password'); // write "reset password" ro search
    await this.clickOnElement('#gbqfb > span'); // search button
    await this.clickOnElement('div[role="main"] tr:first-child'); // Enter to mail result
    const urlResetPassword = await this.getAttribute('[rel="noreferrer noopener"]', 'href');
    this.clickOnElement('[class*="btn--primary"]'); // enter to reset password link
    return urlResetPassword;
  }
}
