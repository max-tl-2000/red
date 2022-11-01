/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import { expect } from 'chai';
import logger from 'helpers/logger';
import config from 'config';
import sleep from '../../../../common/helpers/sleep';

const { cucumber } = config;

const bedroomsOptions = {
  Studio: 'STUDIO',
  '1 bed': 'ONE_BED',
  '2 beds': 'TWO_BEDS',
  '3 beds': 'THREE_BEDS',
  '4+ beds': 'FOUR_PLUS_BEDS',
};

export default class partyDetailsPhaseOne extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async checkForPartyDetailsPhaseOnePage() {
    const isVisible = await this.isVisible('[data-component="partyPage"][data-phase="phaseI"]');
    expect(isVisible).to.equal(true);
  }

  async navBarContains(personName) {
    const condFunc = async () => {
      logger.trace(`Check for '${personName}' in nav bar title`);
      const navBarTitleText = await this.getText('[data-id="appBar"] p');
      return navBarTitleText.includes(personName);
    };
    await this.waitForCondition(`time to check if nav bar title contains: '${personName}' has expired`, condFunc, cucumber.selenium.defaultTimeout);
  }

  async personFirstStepCheck(personData, phoneNo) {
    const fullName = await this.getText('[data-id="cardTitle"]');
    const summary = await this.getText('[data-id="contactSummary"]');
    expect(phoneNo).to.equal(fullName);
    expect(personData).to.equal(summary);
  }

  async personSecondStepCheck(personData) {
    const answer1 = await this.getText('[data-id="question1"]', true /* allowEmpty */);
    const answer2 = await this.getText('[data-id="question2"]', true /* allowEmpty */);
    expect(personData.rows()[0]).to.deep.equal([answer1, answer2]);
  }

  async checkCombinedIncomeQuestion(response) {
    const responses = await this.findElements('#incomeQuestion button');
    expect(responses).to.have.length(3);
    const selectedResponse = response === 'Yes' ? responses[0] : responses[1];
    await this.clickOnWebdriverElement(selectedResponse);
  }

  async selectPreferredMoveInTime(moveInPeriod) {
    const response = await this.findElement('#moveInTimeQuestion');
    await this.clickOnWebdriverElement(response);
    const searchPath = `//div[contains(text(), "${moveInPeriod}")]`;
    const listItems = await this.findElements('[data-component="list-item"]');
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    return this.clickOnWebdriverElement(items[0]);
  }

  async selectLeaseType(leaseType) {
    const response = await this.findElement('#dropdownLeaseType');
    await this.clickOnWebdriverElement(response);
    const listItems = await this.findElements('[data-component="list-item"]');
    const searchPath = `//div[contains(text(), "${leaseType}")]`;
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    return this.clickOnWebdriverElement(items[0]);
  }

  async editContactInformation() {
    await this.clickOnElement('[data-component="common-person-card"]');
    await sleep(500);
    const searchPath = '//p[contains(text(), "Edit contact information")]';
    const listItems = await this.findElements('[data-component="list-item"]');
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    return this.clickOnWebdriverElement(items[0]);
  }

  async closeEditContactInfoDialog() {
    return this.clickOnElement('#dialog-overlay [data-command="OK"]');
  }

  async selectFirstContactChannel(channel) {
    const response = await this.findElement('#firstContactChannelDropdown');
    await this.clickOnWebdriverElement(response);
    const searchPath = `//div[contains(text(), "${channel}")]`;
    const listItems = await this.findElements('[data-component="list-item"]');
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    return this.clickOnWebdriverElement(items[0]);
  }

  async selectPartyLeaseType(leaseType) {
    const selector = '#newLeaseType';
    const throwErrorIfNotVisible = false;
    const maxAttempts = 3;
    const found = await this.isVisible(selector, maxAttempts, throwErrorIfNotVisible);
    logger.trace({ found, maxAttempts }, 'Is lease type dropdown visible');
    if (!found) return;
    logger.trace('Lease type drowndown is visible, so selecting a lease type');
    await this.clickOnWebdriverElement(await this.findElement(selector));
    const listItems = await this.findElements('[data-component="list-item"]');
    const searchPath = `//div[contains(text(), "${leaseType}")]`;
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    await this.clickOnWebdriverElement(items[0]);
  }

  getBedroomsKeysFromValues(values) {
    return values.map(value => bedroomsOptions[value]);
  }

  async selectFirstTourTypeFromDropDown() {
    const dropDownElement = await this.findElement('[data-id="tourTypes"]');
    await this.clickOnWebdriverElement(dropDownElement);
    const item = await this.findElement('[data-component="list-item"]:first-child', dropDownElement);
    return this.clickOnWebdriverElement(item);
  }
}
