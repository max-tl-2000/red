/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import { expect } from 'chai';

export default class Logout extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  doLogout() {
    return this.clickOnElement('#logout');
  }

  async validateLogout() {
    const signInTitle = await this.getText('#signInTitle');
    expect(signInTitle).to.equal('Sign in');
  }
}
