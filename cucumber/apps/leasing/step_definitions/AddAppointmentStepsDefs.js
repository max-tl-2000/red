/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import { expect } from 'chai';
import PartyDetailsPhaseTwo from '../test-pages/partyDetailsPhaseTwo';
import PartyDetailsCommon from '../test-pages/partyDetailsCommon';

module.exports = function AddAppointmentStepsDefs() {
  const base = new BasePage(); // eslint-disable-line
  const partyDetailsPhaseTwo = new PartyDetailsPhaseTwo();
  const partyDetailsCommon = new PartyDetailsCommon();

  this.When(/^The user clicks the Schedule appointment option from the burger menu$/, async () => {
    await partyDetailsPhaseTwo.clickOnElement('#partyCardMenu');
    await partyDetailsPhaseTwo.clickOnElement('[data-id="scheduleAppointment"]');
    await partyDetailsPhaseTwo.isVisible('#scheduleAppointment');
  });

  this.When(/^Selects tomorrow in the appointments calendar$/, async () => {
    await partyDetailsPhaseTwo.appointmentCalendarClickTomorrow();
  });

  this.When(/^Selects a slot for the appointment: today at ten PM$/, () => {
    partyDetailsPhaseTwo.setAgentCalendarSlot('22:00:00');
  });

  this.When(/^Clicks on done button$/, async () => {
    await partyDetailsPhaseTwo.clickOnElement('#scheduleAppointment #done');
  });

  this.Then(/^Appointments section should contain an appointment with the guest name "([^"]*)" and with "([^"]*)" as task owner$/, async (arg1, arg2) => {
    await base.waitForCondition('there is one appointment created', async () => {
      const elements = await base.findElements('[data-id="appointment-row"]'); // eslint-disable-line
      return elements.length === 1;
    });
    const guests = await base.getText('[data-id="appointmentSection"] [data-id="guests"]');
    expect(arg1).to.equal(guests);
    await partyDetailsCommon.checkTaskOwner(arg2);
  });

  this.Given(/^User clicks the edit appointment option$/, async () => {
    const elements = await base.findElements('[data-id="appointment-row"]'); // eslint-disable-line
    const button = await base.findElement('button', elements[0]); // eslint-disable-line
    await base.clickOnWebdriverElement(button);
    await partyDetailsPhaseTwo.clickOnElement('[data-id="appointment-card-menu-item-edit"]');
    await partyDetailsPhaseTwo.isVisible('#scheduleAppointment');

    await partyDetailsPhaseTwo.checkCalendarSlot('Selected time slot');
  });

  this.When(/^Navigates one week in the future$/, async () => {
    await partyDetailsPhaseTwo.clickOnElement('[data-id="fullCalendarHeader"] [data-red-icon][name="chevron-right"]');
  });

  this.When(/^Navigates one week in the past$/, async () => {
    await partyDetailsPhaseTwo.clickOnElement('[data-id="fullCalendarHeader"] [data-red-icon][name="chevron-left"]');
  });

  this.When(/^Selects team "([^"]*)" from the employee drop down$/, async teamName => {
    await partyDetailsPhaseTwo.selectTeamFromDropDown('[data-id="agent-selector"]', teamName);
  });

  this.When(/^Selects the tomorrow "([^"]*)" slot in team calendar$/, async slotTime => {
    await partyDetailsPhaseTwo.setTeamCalendarSlot(slotTime);
  });

  this.When(/^Selects the slot "([^"]*)" in agent calendar$/, async slotTime => {
    await partyDetailsPhaseTwo.setAgentCalendarSlot(slotTime);
  });

  this.Then(/^The agent "([^"]*)" should not be displayed in the available agent list$/, async agentName => {
    // await partyDetailsPhaseTwo.checkIfAgentInTeamSelector(agentName, 0);
    await partyDetailsPhaseTwo.setValue('#teamCalendarEmployeeSearch input', agentName);
    await partyDetailsPhaseTwo.isVisible('[data-component="list"] [data-component="markdown"] p');
  });

  this.Then(/^The agent "([^"]*)" should be displayed in the available agent list$/, async agentName => {
    await partyDetailsPhaseTwo.checkIfAgentInTeamSelector(agentName, 1);
  });
};
