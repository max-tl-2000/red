/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import { tenant } from 'support/hooks';
import Home from '../test-pages/home';
import { formatPhoneToDisplay } from '../../../../server/helpers/phoneUtils';
import sleep from '../../../../common/helpers/sleep';

module.exports = function demoFlowStepDefs() {
  const dashboard = new Home();

  this.Then(/^The "([^"]*)" column should contain a card with "([^"]*)"$/, async (column, name) => await dashboard.checkIfCardExistInColumn(column, name));

  this.When(/^User clicks on "([^"]*)" card in "([^"]*)" column$/, async (card, column) => await dashboard.clickOnCard(card, column));

  this.When(/^User clicks on the first card in Leads column$/, async () => await dashboard.clickOnFirstLead());

  this.When(
    /^The card "([^"]*)" in column "([^"]*)" should display message "([^"]*)"$/,
    async (card, column, message) => await dashboard.checkIfCardContainsMessage(card, column, message),
  );

  this.Then(
    /^The "([^"]*)" column should contain a card with a phone number$/,
    async column => await dashboard.checkIfCardExistInColumn(column, formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber)),
  );

  this.When(
    /^User clicks on the card with the phone number in "([^"]*)" column$/,
    async column => await dashboard.clickOnCard(formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber), column),
  );

  this.When(
    /^The card with the phone number in column "([^"]*)" should display message "([^"]*)"$/,
    async (column, message) => await dashboard.checkIfCardContainsMessage(formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber), column, message),
  );

  this.When(/^User toggles the 'Availability' switch$/, async () => {
    await dashboard.openMainMenu();
    await sleep(500); // animation delays?
    await dashboard.toggleAvailability();
    await sleep(500);
    await dashboard.openPage();
  });

  this.When(/^The user clicks the 'Im Available' button$/, async () => {
    await dashboard.clickIMAvailable();
  });

  this.Then(/^The 'Employee Card' for the logged in user should display the status "([^"]*)"$/, async status => {
    await dashboard.checkEmployeeCardStatus(status);
  });

  this.When(/^Selects "([^"]*)" task for Party guest "([^"]*)"$/, async (taskName, guestName) => {
    await dashboard.checkIfCardExistInColumn('applicants', guestName);
    await dashboard.clickOnTask('applicants', guestName, taskName);
  });

  this.When(/^The user navigates right$/, async () => await dashboard.navigateRight());
};
