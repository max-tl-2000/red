/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import { getRegisterLink, getApplyNowLink, applyTestIdToEmail } from 'lib/mail';
import config from 'config';
import { expect } from 'chai';
import ApplicationsLanding from '../test-pages/applications-landing';
import ApplicationAdditionalInfo from '../test-pages/application-additional-info';

const { cucumber } = config;
const { usersMap } = cucumber.mail;

// doing a default export because cucumber
module.exports = function applicationsLandingStepDefs() {
  const applicationsLanding = new ApplicationsLanding();
  const applicationAdditionalInfo = new ApplicationAdditionalInfo();
  const userConfig = usersMap.user1;

  this.When(/^Customer clicks on register link for "([^"]*)"$/, async emailTo => {
    await applicationsLanding.closeCurrentTab();
    const url = await getRegisterLink({ userConfig, emailTo, testId: this.testId });
    expect(url).to.not.be.undefined;
    await applicationsLanding.visit(url);
  });

  this.When(/^Customer clicks on 'Apply Now' link from another quote, emailed to "([^"]*)"$/, async emailTo => {
    await applicationsLanding.closeCurrentTab();
    const url = await getApplyNowLink({ userConfig, emailTo, testId: this.testId, filterByUnseen: false });
    expect(url).to.not.be.undefined;
    await applicationsLanding.visit(url);
  });

  this.Then(/^types "([^"]*)" as password and clicks on 'Create Account'$/, async password => {
    await applicationsLanding.writePassword(password);
    await applicationsLanding.clickOnCreateAccount();
  });

  this.Then(/^'Application Additional Info' page should be displayed after the account has been created$/, async () => {
    await applicationAdditionalInfo.checkForApplicantAdditionalInfo();
  });

  this.Then(/^'Rentapp Login' page should be displayed$/, async () => {
    await applicationsLanding.checkForLoginPage();
  });

  this.Then(/^Types "([^"]*)" and "([^"]*)" as credentials$/, async (userName, password) => {
    await applicationsLanding.focusIframe('iframe');

    const emailWithTestId = applyTestIdToEmail(userName, this.testId);
    await applicationsLanding.writeUsername(emailWithTestId);
    await applicationsLanding.writePassword(password);
  });

  this.Then(/^Clicks on 'SIGN IN' button$/, async () => {
    await applicationsLanding.clickOnLogin();
  });

  this.Given(/^Should contain "([^"]*)" as applicant name$/, async applicantName => {
    await applicationAdditionalInfo.guestName(applicantName);
  });
};
