/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import { expect } from 'chai';
import isEqual from 'lodash/isEqual';

export default class ManageParty extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async clickAddGuarantor() {
    return this.clickOnElement('[data-id="addGuarantorButton"]');
  }

  async checkGuarantorNotLinked(holdTypeGuarantorNotLinked) {
    const guarantorNotLinkedElement = await this.getText('[data-id="messageHoldTypes"]');
    expect(guarantorNotLinkedElement).to.equal(holdTypeGuarantorNotLinked);
  }

  async checkMissingresidentlink(missingResidentlink) {
    const validadorMisingResident = await this.getText('[data-component="validator"]');
    expect(validadorMisingResident).to.equal(missingResidentlink);
  }

  async closeManageParty() {
    return this.clickOnElement('[data-action="closeFullscreenDialog"]');
  }

  async clickResidentAvatar(guest) {
    const personResidentElement = this.waitForElement('[data-member-type="Resident"] [data-id="cardTitle"]');
    const personResidentName = await personResidentElement.getText();
    expect(personResidentName).to.equal(guest);
    return this.clickOnWebdriverElement(personResidentElement);
  }

  async clickLinkGuarantor() {
    const searchPath = '//p[contains(text(), "Link guarantor")]';
    const listItems = await this.findElements('[data-component="list-item"]');
    const linkGuarantorOption = await Promise.all(listItems.map(element => this.findElementByXpath(searchPath, element)));
    expect(linkGuarantorOption.length).to.not.equal(0);
    return this.clickOnWebdriverElement(linkGuarantorOption[0]);
  }

  async selectGuarantor(guarantor) {
    const searchPath = `//div[contains(text(), "${guarantor}")]`;
    const listItems = await this.findElements('[data-component="list-item"]');
    const guarantorFound = await Promise.all(listItems.map(element => this.findElementByXpath(searchPath, element)));
    expect(guarantorFound.length).to.not.equal(0);
    return this.clickOnWebdriverElement(guarantorFound[0]);
  }

  async clickOnDoneButtonOfGuarantorSelected() {
    await this.clickOnElement('#dialog-overlay [data-command="OK"]');
  }

  async clickSendEmailFromDialog() {
    await this.clickOnElement('#emailFlyout [data-component="button"]');
  }

  async checkGuarantorLinked(holdTypeGuarantorAlreadyLinked) {
    const guarantorNotLinkedElement = await this.getText('[data-id="messageHoldTypes"]');
    return !isEqual(guarantorNotLinkedElement, holdTypeGuarantorAlreadyLinked);
  }

  async checkResidentlinked() {
    await this.isNotVisible('[data-component="validator"]');
  }
}
