/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import config from 'config';
import chai from 'chai';

const { cucumber } = config;
const { expect } = chai;

export default class applicationAdditionalInfo extends BasePage {
  constructor() {
    super();
    this.url = `https://${cucumber.rentappSubdomainName}.${cucumber.domain}`;
  }

  async checkForApplicantAdditionalInfo() {
    return expect(await this.isVisible('#instructions')).to.equal(true);
  }

  async clickOnStep() {
    expect(await this.isVisible('[data-id="residentStepper"]')).to.equal(true);
    await this.clickOnElement('[data-id="residentStepper"] > div:last-of-type > div:nth-child(2)');
  }

  async selectRenterInsurance() {
    this.clickOnElement('#erenterPlan');
  }

  async checkForAccountMessage(confirmation) {
    const text = await this.getText('#accountMessage');
    expect(text).to.equal(confirmation);
  }

  async checkWelcomeLabel() {
    const textElement = await this.getText('#welcome-headline');
    expect(textElement).to.equal('Welcome,');
  }

  async guestName(guestName) {
    await this.scrollTop('[data-layout="left-panel"]', 0);
    const elementApplicantName = await this.getText('#applicantNameTitle');
    const applicantName = elementApplicantName.slice(0, -1).trim();
    expect(applicantName).to.equal(guestName);
  }

  async iAmDoneButton() {
    return this.clickOnElement('#btnIAmDone');
  }
}
