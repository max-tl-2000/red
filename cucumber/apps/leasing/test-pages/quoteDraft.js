/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import { expect } from 'chai';

export default class partyDetailsPhaseTwo extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async clickPublishQuoteButton() {
    return this.clickOnElement('#publishButton');
  }

  async clickConfirmPublishButton() {
    return this.clickOnElement('#dialog-overlay [data-command="OK"]');
  }

  async validateThatPublishedQuoteIsDisplayed() {
    const isVisible = await this.isVisible('#quote-publish-card');
    expect(isVisible).to.equal(true);
  }

  async validateThatSendQuoteDialogDisplayed() {
    const isVisible = await this.isVisible('#sendPublishedQuoteDialog');
    expect(isVisible).to.equal(true);
  }

  async clickSendLaterButton() {
    return this.clickOnElement('#dialog-overlay [data-command="CANCEL"]');
  }

  async clickSendQuoteButton() {
    return this.clickOnElement('#dialog-overlay [data-command="OK"]');
  }
}
