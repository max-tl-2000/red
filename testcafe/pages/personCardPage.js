/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { clickOnElement, expectVisible, expectInputIsEqual } from '../helpers/helpers';
import loggerInstance from '../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'personCardPage' });

export default class PersonCardPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      legalName: '#txtLegalName',
      preferredNameBtn: '#addPreferredNameBtn',
      preferredName: '#txtPreferredName',
      addPhoneDialog: '#addPhoneDialog',
      addPhoneBtn: '#addPhoneBtn',
      newPhone: '#newPhoneText',
      verifyPhoneNumberBtn: '#verifyPhoneNumberBtn',
      phoneNumberOne: '[data-id="addPhoneText1"]',
      phoneNumberTwo: '[data-id="addPhoneText2"]',
      addEmailDialog: '#addEmailDialog',
      addEmailBtn: '#btnAddEmail',
      newEmail: '#txtNewEmail',
      verifyEmailAddressBtn: '#btnVerifyEmailAddress',
      emailOne: '[data-id="addEmailText1"]',
      emailTwo: '[data-id="addEmailText2"]',
      createPersonBtn: '#btnCreatePerson',
      guestTitleTag: '#guestTitleTag',
      numBedroomsText: '#numBedroomsText',
      propertyNameInfoText: '#propertyNameInfoText',
      makePrimaryPhoneTwoBtn: '#makePrimaryPhoneBtn2',
      makePrimaryEmailTwoBtn: '#makePrimaryEmailBtn2',
      primaryLabelPhoneOne: '[data-id="primaryPhoneText1"]',
      primaryLabelEmailOne: '[data-id="primaryEmailText1"]',
      primaryLabelPhoneTwo: '[data-id="primaryPhoneText2"]',
      primaryLabelEmailTwo: '[data-id="primaryEmailText2"]',
      addCompanyButton: '[data-id="addCompanyBtn"]',
      companyName: '#txtCompanyName',
      saveCompanyButton: '[data-component="dialog-actions"] [data-command="OK"]',
      pointOfContactNameBtn: '[data-id="addPointOfContactNameBtn"]',
      pointOfContactName: '#txtLegalName',
      samePersonYesBtn: '#samePersonYesBtn',
      personMatchingPanel: '[data-id="personMatchingPanel"]',
      samePersonNoBtn: '#samePersonNoBtn',
      samePersonText: '#samePersonText',
    };
  }

  async clearLegalName() {
    await this.t.selectText(this.selectors.legalName).pressKey('delete');
  }

  async clearPreferredName() {
    await this.t.selectText(this.selectors.preferredName).pressKey('delete');
  }

  async writeLegalName(name) {
    await this.t.typeText(this.selectors.legalName, name, { paste: true });
  }

  async writeCompanyName(name) {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.addCompanyButton });
    await clickOnElement(t, { selector: this.selectors.addCompanyButton });
    await this.t.typeText(this.selectors.companyName, name, { paste: true });
    await clickOnElement(t, { selector: this.selectors.saveCompanyButton });
  }

  async writePreferredName(preferredName) {
    const { t } = this;

    if (!preferredName) {
      await clickOnElement(t, { selector: this.selectors.legalName }); // force re-render of the page
      await t.wait(500); // give it time to render the button again
    } else {
      await expectVisible(t, { selector: this.selectors.preferredName });
      await t.typeText(this.selectors.preferredName, preferredName, { paste: true, speed: 0.5 });
      await expectInputIsEqual(t, { selector: this.selectors.preferredName, text: preferredName });
    }
  }

  async writePointOfContactName(pointOfContactName) {
    await this.t.typeText(this.selectors.pointOfContactName, pointOfContactName, { paste: true });
  }

  async clickOnAddPreferredNameBtn() {
    await clickOnElement(this.t, { selector: this.selectors.preferredNameBtn });
  }

  async clickOnAddPointOfContactNameBtn() {
    await clickOnElement(this.t, { selector: this.selectors.pointOfContactNameBtn });
  }

  async clickAddPhoneButton() {
    await clickOnElement(this.t, { selector: this.selectors.addPhoneBtn });
  }

  async writePhoneNumber(phoneNumber) {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.addPhoneDialog });
    await expectVisible(t, { selector: this.selectors.newPhone });
    await t.typeText(this.selectors.newPhone, phoneNumber, { paste: true });
  }

  async clickAndSetPhoneNumber(phone) {
    logger.trace('>>> clickAndSetPhoneNumber start');

    await this.clickAddPhoneButton();
    await this.writePhoneNumber(phone);

    logger.trace('>>> clickAndSetPhoneNumber done');
  }

  async clickVerifyPhoneButton() {
    await clickOnElement(this.t, { selector: this.selectors.verifyPhoneNumberBtn, delay: 500 });
  }

  async clickMakePrimaryPhoneTwoButton() {
    await clickOnElement(this.t, { selector: this.selectors.makePrimaryPhoneTwoBtn });
  }

  async clickAddEmailButton() {
    await clickOnElement(this.t, { selector: this.selectors.addEmailBtn, requireVisibility: true, delay: 500 });
  }

  async writeEmail(mail) {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.addEmailDialog });
    await expectVisible(t, { selector: this.selectors.newEmail });
    await t.typeText(this.selectors.newEmail, mail, { paste: true, speed: 0.5 });
  }

  async clickVerifyEmailButton() {
    await expectVisible(this.t, { selector: this.selectors.verifyEmailAddressBtn });
    await clickOnElement(this.t, { selector: this.selectors.verifyEmailAddressBtn });
  }

  async clickMakePrimaryEmailTwoButton() {
    await clickOnElement(this.t, { selector: this.selectors.makePrimaryEmailTwoBtn });
  }

  async clickCreatePersonButton() {
    await clickOnElement(this.t, { selector: this.selectors.createPersonBtn });
  }

  async verifyCardLegalName(legalName) {
    await expectVisible(this.t, { selector: this.selectors.legalName, text: legalName });
  }

  async personMatchingPanelIsDisplayed(member) {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.personMatchingPanel, text: member.legalName });
    await expectVisible(t, { selector: `${this.selectors.personMatchingPanel} ${this.selectors.samePersonText}` });
    await expectVisible(t, { selector: `${this.selectors.personMatchingPanel} ${this.selectors.samePersonYesBtn}` });
    await expectVisible(t, { selector: `${this.selectors.personMatchingPanel} ${this.selectors.samePersonNoBtn}` });
  }
}
