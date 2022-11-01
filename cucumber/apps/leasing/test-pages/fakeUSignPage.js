/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';

export default class FakeUSignPage extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async checkForFakeUSignPage(tabNumber) {
    await this.switchToTab(tabNumber);
    await this.isVisible('[data-component="fake-u-sign-page"]');
  }

  async clickSignButton() {
    await this.clickOnElement('[data-id="signButton"]');
  }
}
