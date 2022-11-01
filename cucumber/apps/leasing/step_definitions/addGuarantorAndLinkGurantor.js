/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import config from 'config';
import Login from '../test-pages/login';
import Home from '../test-pages/home';
import PartyDetailsPhaseTwo from '../test-pages/partyDetailsPhaseTwo';
import ManagePartyPage from '../test-pages/managePartyPage';

const { cucumber } = config;
const { users } = cucumber;

module.exports = function AddGuarantorAndLinkGurantor() {
  const base = new BasePage();
  const login = new Login();
  const home = new Home();
  const partyDetailsPhaseTwo = new PartyDetailsPhaseTwo();
  const managePartyPage = new ManagePartyPage();

  this.Given(/^User is in manage party for guest "([^"]*)"$/, async guestName => {
    await login.open();
    await login.setEmail(users.leasing.email);
    await login.waitForPasswordInputVisible();
    await login.setPassword(users.leasing.password);
    await login.doLogin();
    await home.checkForDashboard();
    await base.clickOnElement('#switchTodayOnly');
    await home.checkIfCardExistInColumn('prospects', guestName);
    await home.clickOnCard(guestName, 'prospects');
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkIfPartyTitleContainsGuestName(guestName);
    await partyDetailsPhaseTwo.openManageParty();
  });

  this.Given(/^Clicks on 'ADD GUARANTOR' button$/, async () => {
    await managePartyPage.clickAddGuarantor();
  });

  this.Then(/^"([^"]*)" alert should appear below of guarantor name$/, async missingResidentlink => {
    await managePartyPage.checkMissingresidentlink(missingResidentlink);
  });

  this.Then(/^The user close manage party$/, async () => {
    await managePartyPage.closeManageParty();
  });

  this.Then(/^The user goes to 'Guarantors' section of the party details$/, async () => {
    await partyDetailsPhaseTwo.validateGuarantorSection();
  });

  this.Then(/^The user goes to 'Applications and Quotes' section$/, async () => {
    await partyDetailsPhaseTwo.validateApplicationsAndQuotes();
  });

  this.Then(/^A hold warning with text "([^"]*)" should be shown$/, async holdTypeGuarantorNotLinked => {
    await managePartyPage.checkGuarantorNotLinked(holdTypeGuarantorNotLinked);
  });

  this.Given(/^Clicks on "([^"]*)" avatar$/, async guest => {
    await managePartyPage.clickResidentAvatar(guest);
  });

  this.Given(/^Clicks on 'Link guarantor' link$/, async () => {
    managePartyPage.clickLinkGuarantor();
  });

  this.Given(/^Select guarantor "([^"]*)"$/, async guarantor => {
    managePartyPage.selectGuarantor(guarantor);
  });

  this.Given(/^Clicks 'DONE' button$/, async () => {
    managePartyPage.clickOnDoneButtonOfGuarantorSelected();
  });

  this.Then(/^The user validates "([^"]*)" is missing$/, async holdTypeGuarantorAlreadyLinked => {
    managePartyPage.checkGuarantorLinked(holdTypeGuarantorAlreadyLinked);
  });

  this.Then(/^The user validates 'Missing resident link' is missing$/, async () => {
    managePartyPage.checkResidentlinked();
  });

  this.When(/^User goes to manage party$/, async () => {
    await partyDetailsPhaseTwo.openManageParty();
  });
};
