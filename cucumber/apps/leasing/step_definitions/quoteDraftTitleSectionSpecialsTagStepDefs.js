/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import config from 'config';
import Login from '../test-pages/login';
import Home from '../test-pages/home';
import PartyDetailsPhaseTwo from '../test-pages/partyDetailsPhaseTwo';
import QuoteDraft from '../test-pages/quoteDraft';
import { DALTypes } from 'enums/DALTypes'; // eslint-disable-line
const { cucumber } = config;
const { users } = cucumber;

// doing a default export because cucumber
module.exports = function quoteDraftTitleSectionSpecialsTagStepDefs() {
  const base = new BasePage(); // eslint-disable-line
  const login = new Login();
  const home = new Home();
  const partyDetailsPhaseTwo = new PartyDetailsPhaseTwo();
  const quoteDraft = new QuoteDraft();

  this.Given(/^The 'party prospect details' page is already opened with a guest "([^"]*)":$/, async guestName => {
    await login.open();
    await login.setEmail(users.leasing.email);
    await login.waitForPasswordInputVisible();
    await login.setPassword(users.leasing.password);
    await login.doLogin();
    await home.checkForDashboard();
    await home.checkIfCardExistInColumn('prospects', guestName);
    await home.clickOnCard(guestName, 'prospects');
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkIfPartyTitleContainsGuestName(guestName);
  });

  this.Given(/^User filtered units by number of bedrooms:$/, async (table) => { // eslint-disable-line
    // See CPM-4074.  The code in this steps is flawed, so the tests that use it have been disabled.
    // To make sure that no other tests attempt to use it, we throw an error
    return Promise.reject(new Error('Attempt to use buggy step function - see CPM-4074'));
  });

  this.Then(/^User publishes the quote but doesnt send the quote$/, async () => {
    await quoteDraft.clickPublishQuoteButton();
    await quoteDraft.validateThatSendQuoteDialogDisplayed();
    await quoteDraft.clickSendLaterButton();
  });
};
