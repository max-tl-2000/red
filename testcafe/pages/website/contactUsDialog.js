/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { clickOnElement } from '../../helpers/helpers';

export default class ContactUsDialog {
  constructor(t) {
    this.t = t;
    this.selectors = {
      FullNameInput: '[data-id="contactFormCard"] [data-id="contactInfoFullName"]',
      PhoneInput: '[data-id="contactFormCard"] [data-id="contactInfoPhoneNumber"]',
      EmailInput: '[data-id="contactFormCard"] [data-id="contactInfoEmail"]',
      AdditionalCommentsInput: '[data-id="contactFormCard"] [data-id="contactInfoAdditionalComments"]',
      MoveInRangeDropdown: '[data-id="contactFormCard"] [data-id="dropdownPlaceholder-When do you plan to move in?"]',
      MoveInRangeSecondItem: '[data-id="contactFormCard"] [data-id="dropdownItems-When do you plan to move in?"] [data-idx="2"]',
      MoveInRangeSelectedValue: '[data-id="contactFormCard"] [data-c="dropdown"] p',
      SendButtonSelector: '[data-id="button-Send"]',
    };
  }

  typeIntoContactUsForm = async (selector, text) => await this.t.typeText($(selector), text, { replace: true });

  checkFieldValidationError = async errorMessage =>
    await this.t.expect((await $('[data-id="contactFormCard"] p').withExactText(errorMessage)).visible).eql(true);

  checkInputFieldValue = async (selector, text) => await this.t.expect((await $(selector).withAttribute('value', text)).visible).eql(true);

  checkTextAreaFieldValue = async (selector, text) => await this.t.expect((await $(selector).withText(text)).visible).eql(true);

  checkDropdownFieldValue = async (selector, text) => await this.t.expect((await $(selector).withText(text)).visible).eql(true);

  clickOnMoveInRangeDropdown = async () => await clickOnElement(this.t, { selector: $(this.selectors.MoveInRangeDropdown) });

  clickOnMoveInRangeItem = async () => await clickOnElement(this.t, { selector: $(this.selectors.MoveInRangeSecondItem) });

  submitContactUsForm = async () => await clickOnElement(this.t, { selector: $(this.selectors.SendButtonSelector) });

  checkThankYouPage = async () => {
    await this.t.expect((await $('p').withExactText('Thank you for contacting us')).visible).eql(true);
    await this.t.expect((await $('p').withExactText("We'll have someone get back to you soon")).visible).eql(true);
  };
}
