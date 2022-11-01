/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from 'config';
import { searchInviteToken, searchTokenResetPassword } from 'lib/mail';
import { tenant } from 'support/hooks';
import { sendRegistrationInvite } from 'lib/utils/apiHelper';
import { expect } from 'chai';
import Login from '../test-pages/login';
import NeedHelp from '../test-pages/needHelp';
import ResetPassword from '../test-pages/resetPassword';
import Home from '../test-pages/home';
import Logout from '../test-pages/logout';
import Register from '../test-pages/register';

const { cucumber } = config;
const { users } = cucumber;
const { usersMap } = cucumber.mail;

module.exports = function ResetPasswordDirectStepDefs() {
  const login = new Login();
  const logout = new Logout();
  const needHelp = new NeedHelp();
  const resetPassword = new ResetPassword();
  const home = new Home();
  const register = new Register();
  let emailTo;
  let lastValidToken;
  let user;

  this.Given(
    /^The "([^"]*)" already had received an invitation to the application to register its account using the following information:$/,
    async (userId, data) => {
      await login.open();
      await login.setEmail(users.leasing.email);
      await login.setPassword(users.leasing.password);
      await login.doLogin();
      await home.checkForDashboard();
      user = usersMap[userId];
      const dataArray = data.raw();
      emailTo = dataArray[1][0];
      const invite = {
        mail: emailTo,
        organization: tenant.id,
        inviteData: {
          directEmailIdentifier: dataArray[1][1],
        },
      };
      await sendRegistrationInvite(invite);
      const token = await searchInviteToken({
        userConfig: user,
        emailTo,
      });
      expect(token).to.not.be.undefined;
      lastValidToken = token;
      await register.openWithToken(lastValidToken);
      await register.checkRegistrationIsDisplayed();
      const userData = {
        firstname: dataArray[1][2],
        preferredName: dataArray[1][3],
        password: dataArray[1][1],
      };
      await register.setFullName(userData.firstname);
      await register.setPreferredName(userData.preferredName);
      await register.setPassword(userData.password);
      await register.doRegister();
      await register.checkForDashboard();
      await home.openMainMenu();
      await home.clickLogout();
      await logout.validateLogout();
    },
  );

  this.Given(/^'NeedHelp' page is opened$/, async () => {
    await login.open();
    await login.doNeedHelp();
  });

  this.When(/^User clicks on 'I DON'T KNOW MY PASSWORD' option$/, async () => {
    await needHelp.clickOnIDontKnowMyPasswordOption();
  });

  this.When(/^Clicks on 'CONTINUE' button$/, async () => {
    await needHelp.elementContinueButton();
  });

  this.Then(/^The system should display the following message 'EMAIL SENT'$/, async () => {
    await needHelp.validateSentEmailTitleAndMessageIsDisplayed(); // .equal('Email sent');
  });

  this.When(/^The user clicks on 'DONE' button$/, async () => {
    await needHelp.clickOnDoneButton();
  });

  this.Then(/^The system displays the 'Login' page$/, async () => {
    await login.checkForLogin();
  });

  this.Given(/^The user has been entered on in his gmail with a received 'RESET PASSWORD' link$/, async () => {
    const token = await searchTokenResetPassword({
      userConfig: user,
      emailTo,
    });
    expect(token).to.not.be.undefined;
    lastValidToken = token;
  });

  this.When(/^He clicked the 'RESET PASSWORD' link$/, async () => {
    await resetPassword.openWithToken(lastValidToken);
  });

  this.Then(/^The reset password page should be displayed$/, async () => {
    await resetPassword.checkDashboardResetPassword();
  });

  this.When(/^User types his new password "([^"]*)"$/, async password => {
    await resetPassword.setPassword(password);
  });

  this.When(/^Clicks on 'RESET MY PASSWORD' button$/, async () => {
    await resetPassword.clickOnResetPasswordButton();
  });

  this.Then(/^Dashboard page is displayed automatically$/, async () => {
    await home.checkForDashboard();
  });

  this.When(/^The user clicks on 'Logout' button$/, async () => {
    await home.openMainMenu();
    await home.clickLogout();
  });

  this.Then(/^The system returns the 'Login' page$/, async () => {
    await login.checkForLogin();
  });

  this.When(/^User enters his email and new password "([^"]*)"$/, async password => {
    await login.open();
    login.setEmail(emailTo);
    login.setPassword(password);
  });

  this.When(/^Click on SIGN In button$/, () => {
    login.doLogin();
  });

  this.Then(/^Dashboard page is displayed$/, async () => {
    await home.checkForDashboard();
    await home.openMainMenu();
    await home.clickLogout();
  });
};
