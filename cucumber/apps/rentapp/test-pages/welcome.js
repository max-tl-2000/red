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
import chaiAsPromised from 'chai-as-promised';

const { cucumber } = config;
const { expect } = chai;
chai.use(chaiAsPromised);

export default class Welcome extends BasePage {
  constructor() {
    super();
    this.url = `https://${cucumber.rentappSubdomainName}.${cucumber.domain}`;
  }

  openWithUrl(url) {
    return this.visit(url);
  }

  async checkForWelcome() {
    return expect(this.isVisible('#welcome-headline')).to.eventually.equal(true);
  }

  async checkTermsOfService(/* termsOfService */) {
    // TODO: Implement a better way to check for the test
    // const attestation = await this.getText('#attestation');
    // expect(attestation).to.equal(termsOfService);
    await this.clickOnElement('#attestation');
  }

  elementContinueButton() {
    return this.clickOnElement('#continueBtn');
  }
}
