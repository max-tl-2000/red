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

export default class applicationComplete extends BasePage {
  constructor() {
    super();
    this.url = `https://${cucumber.rentappSubdomainName}.${cucumber.domain}`;
  }

  async checkForInfoMessages(infoMessages) {
    const text = await this.getText('#infoMessages');
    expect(text).to.equal(infoMessages);
  }

  async checkForApplicationComplete() {
    expect(await this.isVisible('#infoMessages')).to.equal(true);
  }
}
