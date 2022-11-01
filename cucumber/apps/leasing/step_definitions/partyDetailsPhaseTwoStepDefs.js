/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import { tenant } from 'support/hooks';
import PartyDetailsPhaseTwo from '../test-pages/partyDetailsPhaseTwo';
import PartyDetailsCommon from '../test-pages/partyDetailsCommon';
import logger from '../../../../common/helpers/logger';
import { formatPhoneToDisplay } from '../../../../server/helpers/phoneUtils';
import BasePage from '../../../lib/BasePage';
import QuoteDraft from '../test-pages/quoteDraft';

module.exports = function PartyDetailsStepDefs() {
  const partyDetailsPhaseTwo = new PartyDetailsPhaseTwo();
  const partyDetailsCommon = new PartyDetailsCommon();
  const base = new BasePage();
  const quoteDraft = new QuoteDraft();

  this.Then(/^The party details page in phase two should open$/, () => partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage());

  this.When(/^Waits for "([^"]*)"$/, arg1 => partyDetailsPhaseTwo.wait(arg1));

  this.Then(/^The units cards should contain "([^"]*)"$/, arg1 => partyDetailsPhaseTwo.unitsCardsShouldContain(arg1));

  this.Then(/^The units cards should include "([^"]*)"$/, arg1 => partyDetailsPhaseTwo.doUnitCardsContainInfo(arg1));

  this.When(/^User clicks 'Tour' on unit card "([^"]*)"$/, arg1 => partyDetailsPhaseTwo.clickTourUnitCard(arg1));

  this.When(/^User clicks 'Quote' on unit card "([^"]*)"$/, async arg1 => {
    await partyDetailsPhaseTwo.clickQuoteUnitCard(arg1);
    await partyDetailsPhaseTwo.checkQuoteDraftDisplayed();
  });

  this.Then(/^The field "([^"]*)" should contain "([^"]*)"$/, (arg1, arg2) => partyDetailsPhaseTwo.appointmentDialogContains(arg1, arg2));

  this.Then(/^The field "([^"]*)" should contain the phone number$/, async arg1 => {
    const plivoGuestPhoneNumber = formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber);
    logger.info(`the field ${arg1} contains ${plivoGuestPhoneNumber}`);
    await partyDetailsPhaseTwo.appointmentDialogContains(arg1, plivoGuestPhoneNumber);
  });

  // eslint-disable-next-line no-useless-escape
  this.When(/^User types in text\-area "([^"]*)" : "([^"]*)"$/, (arg1, arg2) => partyDetailsPhaseTwo.setValue(`[data-id="${arg1}"]`, arg2));

  this.When(/^Selects tour type "([^"]*)" from dropdown$/, async tourType => {
    await partyDetailsPhaseTwo.selectTourTypeFromDropDown('[data-id="tourTypes"]', tourType);
  });

  this.When(/^Selects the time slot: today 2:30 PM$/, () => partyDetailsPhaseTwo.setAgentCalendarSlot('14:30:00'));

  this.Then(
    /^Appointments section should contain an appointment with the guest name "([^"]*)" for unit "([^"]*)" and the description as "([^"]*)"$/,
    (arg1, arg2, arg3) => partyDetailsPhaseTwo.checkAppointment(arg1, arg2, arg3),
  );

  this.Then(/^Tasks section should contain a task with "([^"]*)" as task owner$/, arg1 => partyDetailsCommon.checkTaskOwner(arg1));

  this.Then(/^A list of inventory cards is displayed$/, () => partyDetailsPhaseTwo.checkUnitCardsAreAvailable());

  this.Then(/^All inventory cards contain an image$/, () => partyDetailsPhaseTwo.checkAllUnitCardsHaveImages());

  this.When(/^'Leasing' agent selects a quote for promotion for item "([^"]*)" from 'Party Details' page$/, async unit => {
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkPromotionUnitItem(unit);
  });

  this.When(/^Reviews the application for the quoted item "([^"]*)" with lease term "([^"]*)"$/, async (unit, lease) => {
    await partyDetailsPhaseTwo.checkLeaseTermSelectorDialog(unit);
    await partyDetailsPhaseTwo.selectLeaseTerm(lease);
    await partyDetailsPhaseTwo.clickReviewApplication();
  });

  this.When(/^The promotion details should be correct:$/, async data => {
    await partyDetailsPhaseTwo.checkPromotionDetails(data);
  });

  this.Then(/^The screening is reviewed for unit "([^"]*)"$/, async unit => await partyDetailsPhaseTwo.clickReviewOrPromoteApplication(unit));

  this.Then(/^The "([^"]*)" section should be displayed$/, async title => {
    await partyDetailsPhaseTwo.checkSection(title);
  });

  this.When(/^'Leasing' agent demotes an application promoted for approval from 'Party Details' page:$/, async data => {
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkForApplicationPendingApproval(data);
  });

  this.When(/^Cancels an approval request to promote another Quote$/, async () => {
    await partyDetailsPhaseTwo.clickAbandonApprovalRequest();
    await partyDetailsPhaseTwo.checkForAbandonApprovalDialog();
    await partyDetailsPhaseTwo.clickAbortApproval();
  });

  this.Then(/^Increases the deposit condition to "([^"]*)"$/, async value => {
    await partyDetailsPhaseTwo.increaseDepositCondition(value);
  });

  this.Given(/^'Leasing' agent opens review screening for item "([^"]*)" with lease term '18 months'$/, async unit => {
    await partyDetailsPhaseTwo.switchToTab('1');
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkPromotionUnitItem(unit);
    await partyDetailsPhaseTwo.clickReviewOrPromoteApplication(unit);
    // TODO. Add this flow separate as now the default lease term will just be one (taken from the rent matrix)
    // await partyDetailsPhaseTwo.checkLeaseTermSelectorDialog(unit);
    // await partyDetailsPhaseTwo.selectLeaseTerm(lease);
    // await partyDetailsPhaseTwo.clickReviewApplication();
  });

  this.Then(/^The user validates if person application has status "([^"]*)"$/, async status => {
    await partyDetailsPhaseTwo.validatePersonAplicationStatus(status);
  });

  this.Given(/^The system redirects to party details for the party guest "([^"]*)"$/, async guestName => {
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkIfPartyTitleContainsGuestName(guestName);
  });

  this.Given(/^Published Quote for unit "([^"]*)"$/, async unit => {
    await base.clickOnButtonId('communicationToggle');
    await partyDetailsPhaseTwo.clickQuoteUnitCard(unit);
    await partyDetailsPhaseTwo.checkQuoteDraftDisplayed();
    await quoteDraft.clickPublishQuoteButton();
  });

  this.Given(/^Clicks on 'SEND QUOTE' button from dialog$/, async () => {
    await quoteDraft.validateThatSendQuoteDialogDisplayed();
    await quoteDraft.clickSendQuoteButton();
  });

  this.Then(/^The user goes to party details for party guest "([^"]*)"$/, async guestName => {
    await partyDetailsPhaseTwo.switchToTab('1');
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkIfPartyTitleContainsGuestName(guestName);
  });

  this.Then(/^The 'Sign Lease' button should appear for guest$/, async () => await partyDetailsPhaseTwo.checkSignLeaseButton());

  this.Then(/^The 'Countersignsign Lease' button should be visible$/, async () => await partyDetailsPhaseTwo.checkCountersignLeaseButton());

  this.When(/^The user clicks 'Sign Lease' button$/, async () => await partyDetailsPhaseTwo.clickSignLeaseButton());

  this.When(/^The user clicks the 'Countersignsign Lease' button$/, async () => await partyDetailsPhaseTwo.clickCountersignLeaseButton());

  this.Then(/^The lease should appear as signed by the guest$/, async () => {
    await partyDetailsPhaseTwo.switchToTab('1');
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
    await partyDetailsPhaseTwo.checkThatLeaseIsSigned();
  });

  this.When(/^User clicks approve application button$/, async () => {
    await partyDetailsPhaseTwo.validateThatApproveApplicationIsDisplayed();
    await partyDetailsPhaseTwo.clickApproveApplication();
  });
};
