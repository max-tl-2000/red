/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import { expect } from 'chai';
import { getFixedAmount } from '../../../../client/helpers/quotes';

export default class publishedQuote extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async clickSendQuoteByEmail() {
    await this.clickOnElement('#dialog-header [name="email"]');
  }

  async clickSendEmailFromDialog() {
    await this.clickOnElement('#emailFlyout [data-component="button"]');
  }

  async closeDialog() {
    return this.clickOnElement('#quote-dialog [name="close"]');
  }

  async validateThatEmailHasBeenSent() {
    await this.waitForCondition('Quote has been sent', () => this.isVisible('#snackbar [data-component="text"]'));
  }

  async validateBaseRentAmountNonZero(unit) {
    let baseRentAmount;
    switch (unit) {
      case '1010':
        baseRentAmount = await this.getText('[data-id="24Months_baseRentAmount"]');
        break;
      case '1013':
        baseRentAmount = await this.getText('[data-id="18Months_baseRentAmount"]');
        break;
      case '1018':
        baseRentAmount = await this.getText('[data-id="24Months_baseRentAmount"]');
        break;
      default:
        break;
    }
    baseRentAmount.replace(/[$,]/g, '');
    const amount = getFixedAmount(baseRentAmount * 1, 2);
    expect(amount).to.not.equal(0);
  }
}
