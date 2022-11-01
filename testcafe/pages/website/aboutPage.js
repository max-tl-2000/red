/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { clickOnElement, expectNotPresent, expectVisible } from '../../helpers/helpers';

export default class AboutPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      SendMessageButton: '#sendMessageSection button',
      SelectDepartmentDropdown: '[data-c="dropdown"]',
      DepartmentDropdownItem: '[data-id="dropdownItems-Select Department*"] p',
      LegalNameField: '[data-component="textbox"] [placeholder="Full Name*"]',
      PhoneNumberField: '[data-component="textbox"] [placeholder="Phone"]',
      EmailFieldContactUs: '[data-component="textbox"] [placeholder="Email*"]',
      MessageField: '[data-component="textbox"] [placeholder="Message*"]',
      SendFormButton: '[data-id="button-Send"]',
      CloseThankYouPageButton: '[data-component="button"]',
      SendFeedbackButton: '#sendConcernSection [data-component="button"]',
      EmailFieldConcerns: '[data-component="textbox"] [placeholder="Email"]',
      LegalNameFieldConcerns: '[data-component="textbox"] [placeholder="Full Name"]',
      SearchPropertyField: '[data-component="textbox"] [placeholder="Search Community Name*"]',
      SearchDropdown: '[data-component="list"]',
      SearchDropdownItem: '[data-component="list-item"]',
    };
  }

  submitForm = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.SendFormButton });
  };

  selectDepartment = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.SelectDepartmentDropdown });
    await clickOnElement(t, { selector: $(this.selectors.DepartmentDropdownItem).withText('Media Contact') });
  };

  checkFieldWarningMessage = async errorMessage => {
    const { t } = this;

    await t.expect((await $('[data-component="textbox"] p').withExactText(errorMessage)).visible).eql(true);
  };

  checkDropdownWarningMessage = async errorMessage => {
    const { t } = this;
    await t.expect((await $('[data-c="dropdown"] p').withExactText(errorMessage)).visible).eql(true);
  };

  checkSearchFieldWarningMessage = async errorMessage => {
    const { t } = this;
    await t.expect((await $('[data-component="query-filter"] p').withExactText(errorMessage)).visible).eql(true);
  };

  checkFormIsNotSubmitted = async text => {
    const { t } = this;
    await expectNotPresent(t, { selector: $('p').withText(text) });
  };

  checkFormIsSubmitted = async text => {
    const { t } = this;
    await t.expect((await $('p').withExactText(text)).visible).eql(true);
    await t.expect((await $('p').withExactText("We'll have someone get back to you soon")).visible).eql(true);
  };

  searchForProperty = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.SearchPropertyField });
    await t.typeText($(this.selectors.SearchPropertyField), 'Parkmerced', { replace: true });
  };

  checkSearchResult = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.SearchDropdown });
    await t.expect((await $(this.selectors.SearchDropdownItem).withExactText('COMMUNITIES')).visible).eql(true);
    await t.expect((await $(this.selectors.SearchDropdownItem).withExactText('Parkmerced Apartments, Boston, Massachusetts')).visible).eql(true);
  };

  pickCommunity = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.SearchDropdownItem).withText('Parkmerced Apartments, Boston, Massachusetts') });
  };
}
