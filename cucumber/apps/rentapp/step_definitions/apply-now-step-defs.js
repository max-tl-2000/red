/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import { getApplyNowLink } from 'lib/mail';
import config from 'config';
import { expect } from 'chai';
import Welcome from '../test-pages/welcome';

const { cucumber } = config;
const { usersMap } = cucumber.mail;

// doing a default export because cucumber
module.exports = function applyNowStepDefs() {
  const welcome = new Welcome();

  this.When(/^Customer clicks on 'Apply Now' link from quote emailed to "([^"]*)"$/, async emailTo => {
    const userConfig = usersMap.user1;
    const url = await getApplyNowLink({ userConfig, emailTo, testId: this.testId, filterByUnseen: false });
    expect(url).to.not.be.undefined;
    await welcome.openNewTab();
    await welcome.openWithUrl(url);
  });
};
