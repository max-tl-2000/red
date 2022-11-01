/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';

import Logout from '../test-pages/logout';
import Home from '../test-pages/home';

module.exports = function logoutStepDefs() {
  const logout = new Logout();
  const home = new Home();

  this.Given(/^User is already logged in the app$/, async () => {});

  this.When(/^Clicks on 'Logout' button$/, async () => {
    await home.openMainMenu();
    await home.clickLogout();
  });

  this.Then(/^Log out is successful$/, async () => {
    await logout.validateLogout();
  });

  this.When(/^User goes back to Dashboard and logs out$/, async () => {
    await home.openPage();
    await home.openMainMenu();
    await home.clickLogout();
  });
};
