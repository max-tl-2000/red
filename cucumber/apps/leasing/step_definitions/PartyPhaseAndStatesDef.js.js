/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from '../../../lib/BasePage';
import PartyDetailsPhaseOne from '../test-pages/partyDetailsPhaseOne';
import preprocessValue from '../../../lib/utils/preprocess-value';
import sleep from '../../../../common/helpers/sleep';

module.exports = function partyPhaseAndStatesDef() {
  const page = new BasePage();
  const partyDetailsPhaseOne = new PartyDetailsPhaseOne();
  this.Given(/^User creates a "([^"]*)" party with a party member called "([^"]*)" with email "([^"]*)"$/, async (leaseType, name, email) => {
    await page.clickOnElement('#btnCreateParty');
    await partyDetailsPhaseOne.selectPartyLeaseType(leaseType);
    await partyDetailsPhaseOne.selectFirstContactChannel('Walk-in');
    await page.clickOnElement('#submitAssignedProperty');
    await page.isVisible('[data-component="partyPage"]');
    await page.setValue('#txtLegalName', name);
    await page.clickOnElement('#btnAddEmail');
    await page.setValue('#txtNewEmail', preprocessValue(email, this.testId));
    await page.clickOnElement('#btnVerifyEmailAddress');
    await page.waitForCondition('the create person button is enabled', async () => await page.isEnabled('#btnCreatePerson'));
    await page.clickOnElement('#btnCreatePerson');
  });

  this.Given(/^The user schedules an appointment for tomorrow morning$/, async () => {
    await page.clickOnElement('#partyCardMenu');
    await page.clickOnElement('[data-id="scheduleAppointment"]');
    await sleep(500);

    const elements = await page.findElements('[data-component="weekDay"]'); // eslint-disable-line

    await page.clickOnWebdriverElement(elements[3]);
    await page.clickOnElement('[data-time="09:00:00"]');
    await partyDetailsPhaseOne.selectFirstTourTypeFromDropDown();
    await page.clickOnElement('#scheduleAppointment #done');
  });

  this.Given(/^There is one appointment shown in the UI$/, async () => {
    await page.waitForCondition('there is one appointment created', async () => {
    const elements = await page.findElements('[data-id="appointment-row"]'); // eslint-disable-line
      return elements.length === 1;
    });
  });

  this.Given(/^The party is still in phase I$/, async () => {
    await page.isVisible('[data-phase="phaseI"]');
  });
};
