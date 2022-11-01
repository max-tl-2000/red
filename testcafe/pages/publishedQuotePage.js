/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { convertToCamelCaseAndRemoveBrackets } from '../../common/helpers/strings';
import BasePage from './basePage';
import { expectTextIsEqual, clickOnElement } from '../helpers/helpers';

export default class PublishedQuotePage extends BasePage {
  constructor(t) {
    super(t);

    this.selectors = {
      concession: '[data-id="name_concession"]',
      concessionAmount: '[data-id="name_concessionAmount"]',
      concessionsTotal: '[data-id="concessionsTotal"]',
      fee: '[data-id="name"]',
      feeAmount: '[data-id="name_amount"]',
      feesTotal: '[data-id="feesTotal"]',
      closePublishedLeaseBtn: '#quote-dialog_closeBtn',
      feeDepositAdminFeeCheckBox: '#adminFee_oneTimeFeeCheckBox',
    };
  }

  async checkConcession(concessionName, amount) {
    await this.checkItemAmount(concessionName, amount, [this.selectors.concession, this.selectors.concessionAmount]);
  }

  async checkQuoteFee(feeName, amount) {
    await this.checkItemAmount(feeName, amount, [this.selectors.fee, this.selectors.feeAmount]);
  }

  async checkItemAmount(itemName, amount, selectors) {
    const { t } = this;
    const [itemNameSelector, itemAmountSelector] = selectors;
    const selectorPrefix = convertToCamelCaseAndRemoveBrackets(itemName);
    const itemSelector = itemNameSelector.replace('name', selectorPrefix);
    const amountSelector = itemAmountSelector.replace('name', selectorPrefix);
    await expectTextIsEqual(t, { selector: itemSelector, text: itemName });
    await expectTextIsEqual(t, { selector: amountSelector, text: amount });
  }

  async selectAFeeFromOneTimeCharges(fee) {
    const { t } = this;
    const selectorToCheck = `#${convertToCamelCaseAndRemoveBrackets(fee)}_oneTimeFeeCheckBox`;
    await clickOnElement(t, { selector: selectorToCheck });
  }
}
