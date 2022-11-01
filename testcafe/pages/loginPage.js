/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expectVisible } from '../helpers/helpers';

export default class LoginPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      emailTxt: '#txtEmail',
      passwordTxt: '#txtPassword',
      loginBtn: '#btnLogin',
      signInTitle: '#signInTitle',
    };
  }

  async writeEmail(mail) {
    await this.t.typeText(this.selectors.emailTxt, mail, { paste: true });
  }

  async writePassword(password) {
    await this.t.typeText(this.selectors.passwordTxt, password, { paste: true });
  }

  async checkLoginTitle() {
    await expectVisible(this.t, { selector: this.selectors.signInTitle });
  }
}
