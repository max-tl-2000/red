/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';

export default class leaseForm extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async clickPublishLeaseButton() {
    await this.clickOnElement('#publishLease');
  }

  async clickConfirmPublishButton() {
    await this.clickOnElement('#dialog-overlay [data-command="OK"]');
  }

  async closeLeaseDialog() {
    await this.findElement('#leaseForm [name="close"]');
    return this.clickOnElement('#leaseForm [name="close"]');
  }
}
