/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from 'helpers/logger';
import Login from '../test-pages/login';
import Home from '../test-pages/home';

// doing a default export because cucumber
module.exports = function loginStepDefs() {
  const login = new Login();
  const home = new Home();

  this.Given(/^'Login' page is opened$/, async () => {
    await login.open();
    await login.checkForLogin();
  });

  this.Given(/^User logged in as admin:$/, async sales => {
    const salesArray = sales.raw();

    await login.setEmail(salesArray[1][0]);
    await login.setPassword(salesArray[1][1]);
    await login.doLogin();
  });

  this.Given(/^User is already logged in as a sales agent:$/, async sales => {
    const salesArray = sales.raw();
    await login.open();
    await login.setEmail(salesArray[1][0]);
    await login.setPassword(salesArray[1][1]);
    logger.trace('about to login as a sales agent');
    await login.doLogin();
  });

  this.When(/^User types his email "([^"]*)"$/, async email => {
    await login.setEmail(email);
  });

  this.Then(/^Types his password "([^"]*)"$/, async password => {
    await login.setPassword(password);
  });

  this.Then(/^Clicks on 'SignIn' button$/, async () => {
    await login.doLogin();
  });

  this.Then(/^'Dashboard' page should be displayed$/, async () => {
    await home.checkForDashboard();
  });

  this.Then(/^'Dashboard' page is displayed$/, async () => {
    await home.checkForDashboard();
  });

  this.Then(/^'Login' page should be displayed$/, async () => {
    await login.checkForLogin();
  });

  this.Then(/^Error 'INVALID_EMAIL' message should be displayed on 'Login' page$/, async () => {
    await login.validateErrorInvalidEmail();
  });

  this.Then(/^Error 'EMAIL_AND_PASSWORD_MISMATCH' message should be displayed$/, async () => {
    await login.validateErrorInvalidAccount();
  });
};
