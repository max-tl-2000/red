/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from 'config';
import Login from '../test-pages/login';
import Home from '../test-pages/home';
import PartyDetailsPhaseTwo from '../test-pages/partyDetailsPhaseTwo';
const { cucumber } = config;
const { users } = cucumber;

// doing a default export because cucumber
module.exports = function InventoryCardStepDefs() {
  const login = new Login();
  const home = new Home();
  const partyDetailsPhaseTwo = new PartyDetailsPhaseTwo();

  this.Given(/^A user is viewing the 'PartyDetailsPhaseTwo' page$/, async () => {
    await login.open();
    await login.setEmail(users.leasing.email);
    await login.setPassword(users.leasing.password);
    await login.doLogin();
    await home.checkForDashboard();
    await home.clickOnFirstLead();
    partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
  });
};
