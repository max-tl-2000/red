/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import { expect } from 'chai';

export default class SignLeasePage extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async checkForSignLeasePage() {
    this.switchToTab(2);
    const page = await this.findElement('[data-id="sign-lease-page"]');
    expect(page).to.not.be.undefined;
  }

  async checkIdentityVerifiedCheckbox() {
    await this.clickOnElement('[data-component="checkbox"]');
  }

  async clickStartSignatureButton() {
    await this.clickOnElement('[data-component="button"]');
  }
}
