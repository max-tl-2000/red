/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
// import { convertToCamelCaseAndRemoveBrackets } from '../../common/helpers/strings';

export default class WelcomeApplicationPage {
  constructor(t) {
    // TODO: since we store t in the page, why do all of the fns require it?
    this.t = t;
    this.selectors = {
      welcomeHeadline: '#welcome-headline',
      applicantNameTxt: '#applicantNameTitle',
      attestationCheckbox: '#attestation',
      continueBtn: '#continueBtn',
      appBar: '[data-id="appBar"]',
    };
  }

  async verifyWelcomeApplicationPageVisible(t) {
    await t.expect($(this.selectors.appBar).visible).eql(true).expect($(this.selectors.welcomeHeadline).withText('Welcome,').visible).eql(true);
  }

  async clickOnContinueBtnByProperty(t, _propertyName) {
    /*
     TODO: not sure if this ever worked, but there is no (property)ContinueButton anywhere in the
     rentapp code...
    const selectorToCheck = `#${convertToCamelCaseAndRemoveBrackets(propertyName)}continueBtn`;
    await clickOnElement(t, { selector: selectorToCheck });
    */
    await t.click($(this.selectors.continueBtn).filterVisible()); // eslint-disable-line red/no-tc-click
  }

  async verifyPropertyIsPresent(t, propertyName) {
    await t.expect($(this.selectors.appBar).withText(propertyName).visible).eql(true);
  }

  async checkPersonVisible(t, firstName) {
    await t.expect($(this.selectors.appBar).visible).eql(true).expect($(this.selectors.applicantNameTxt).withText(firstName).visible).eql(true);
  }
}
