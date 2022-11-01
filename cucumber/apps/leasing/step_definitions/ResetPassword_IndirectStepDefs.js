/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sleep from 'helpers/sleep';
import Login from '../test-pages/login';
import NeedHelp from '../test-pages/needHelp';

module.exports = function ResetPasswordIndirectDirectStepDefs() {
  const login = new Login();
  const needHelp = new NeedHelp();
  const validUserWithIncorrectPass = {
    user: 'bill@reva.tech',
    pass: '12',
  };

  const doLogin = async (email, password) => {
    await login.setEmail(email);
    await login.setPassword(password);
    await login.doLogin();
  };

  this.Given(/^User attempted to log in "([^"]*)" times with incorrect password$/, async n => {
    await login.open();
    for (let index = 0; index < n; index++) {
      await doLogin(validUserWithIncorrectPass.user, validUserWithIncorrectPass.pass);
      await sleep(1000);
    }
  });

  this.When(/^A alert message 'WE LOCKED YOUR ACCOUNT' is displayed$/, async () => {
    await login.validateLockedAccount();
  });

  this.When(/^User clicks on 'RESET MY PASSWORD' button$/, async () => {
    await login.doLogin();
  });

  this.Then(/^'I DON'T KNOW MY PASSWORD' card is shown expanded$/, async () => {
    await needHelp.clickOnIDontKnowMyPasswordOption();
  });

  this.When(/^User goes to 'I DON'T KNOW MY PASSWORD' card$/, async () => {
    await needHelp.clickOnIDontKnowMyPasswordOption();
    await needHelp.validateLabelResetPasswordDisplayed();
  });

  this.When(/^User types his email address "([^"]*)"$/, async emailTo => {
    await needHelp.setIDontKnowMyPasswordEmail(emailTo);
  });

  this.Then(/^A confirmation message EMAIL SENT should be displayed$/, async () => {
    await needHelp.validateSentEmailTitleAndMessageIsDisplayed();
  });

  this.Then(/^'Done' button appears on 'I DON'T KNOW MY PASSWORD' card$/, async () => {
    await needHelp.validateButtonDoneIsDisplayed();
  });

  this.When(/^User clicks on 'DONE' button$/, async () => {
    await needHelp.clickOnDoneButton();
  });

  this.Then(/^System should display the 'Login' page$/, async () => {
    await login.checkForLogin();
  });

  this.Then(/^A validation message 'WRONG EMAIL' should be displayed$/, async () => {
    await needHelp.validateRequiredEmailMessageIsDisplayed();
  });
};
