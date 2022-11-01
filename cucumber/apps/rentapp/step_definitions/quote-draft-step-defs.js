/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import Login from 'apps/leasing/test-pages/login';
import Home from 'apps/leasing/test-pages/home';
import PartyDetailsPhaseTwo from 'apps/leasing/test-pages/partyDetailsPhaseTwo';
import QuoteDraft from 'apps/leasing/test-pages/quoteDraft';
import PublishedQuote from 'apps/leasing/test-pages/publishedQuote';
import config from 'config';
import { addAlias } from 'lib/utils/addAlias';
import { getApplyNowLink } from 'lib/mail';
import Welcome from '../test-pages/welcome';
import ApplicantDetails from '../test-pages/applicant-details';
import ApplicationAdditionalInfo from '../test-pages/application-additional-info';

const { cucumber } = config;
const {
  users,
  mail: { usersMap },
} = cucumber;

// doing a default export
module.exports = function quoteDraftStepDefs() {
  const base = new BasePage();
  const login = new Login();
  const home = new Home();
  const partyDetailsPhaseTwo = new PartyDetailsPhaseTwo();
  const quoteDraft = new QuoteDraft();
  const publishedQuote = new PublishedQuote();
  const welcome = new Welcome();
  const applicantDetails = new ApplicantDetails();
  const applicationAdditionalInfo = new ApplicationAdditionalInfo();

  const goToPartyDetailsPhaseTwo = async ({ guestName, dashboardColumn }) => {
    await login.open();
    if (await login.isLoginDisplayed()) {
      await login.setEmail(users.leasing.email);
      await login.waitForPasswordInputVisible();
      await login.setPassword(users.leasing.password);
      await login.doLogin();
    }
    await home.checkForDashboard();
    await base.clickOnElement('#switchTodayOnly');
    await home.checkIfCardExistInColumn(dashboardColumn, guestName);
    await home.clickOnCard(guestName, dashboardColumn);
    await partyDetailsPhaseTwo.checkForPartyDetailsPhaseTwoPage();
  };

  const publishAndSendQuote = async ({ unit, guestName, email }) => {
    console.log('>>> publishAndSendQuote start');
    await goToPartyDetailsPhaseTwo({ guestName, dashboardColumn: 'prospects' });
    await partyDetailsPhaseTwo.checkIfPartyTitleContainsGuestName(guestName);

    await partyDetailsPhaseTwo.openManageParty();
    await partyDetailsPhaseTwo.clickOnElement('[data-component="common-person-card"]');
    await partyDetailsPhaseTwo.clickOnElement('[data-component="list-item"][data-action="edit"]');
    await partyDetailsPhaseTwo.clickOnElement('[data-action="remove-email"]');
    await partyDetailsPhaseTwo.clickOnElement('#btnAddEmail');
    await base.setValue('#txtNewEmail', addAlias(email, this.testId));
    await base.clickOnElement('#btnVerifyEmailAddress');
    await base.clickOnElement('#btnCreatePerson');
    console.log('>>> publishAndSendQuote created person');
    await base.clickOnElement('#manage-party-details-dialog [data-action="closeFullscreenDialog"]');

    await base.clickOnElement('#communicationToggle');
    await partyDetailsPhaseTwo.clickQuoteUnitCard(unit);
    await partyDetailsPhaseTwo.checkQuoteDraftDisplayed();
    console.log('>>> publishAndSendQuote created quote draft');
    await quoteDraft.clickPublishQuoteButton();
    await quoteDraft.validateThatSendQuoteDialogDisplayed();
    await quoteDraft.clickSendLaterButton();
    // await publishedQuote.validateBaseRentAmountNonZero(unit);
    await publishedQuote.clickSendQuoteByEmail();
    await publishedQuote.clickSendEmailFromDialog();
    await publishedQuote.validateThatEmailHasBeenSent();
    await publishedQuote.closeDialog();
  };

  const openApplyNowLink = async email => {
    console.log('>>> openApplyNowLink', email);
    const url = await getApplyNowLink({ userConfig: usersMap.user1, emailTo: email, testId: this.testId });
    console.log('>>> openApplyNowLink got url', url);
    await welcome.openNewTab();
    console.log('>>> openApplyNowLink opened new tab');
    await welcome.openWithUrl(url);
    console.log('>>> openApplyNowLink opened with url');
  };

  const completeWelcomePageSteps = async () => {
    await welcome.checkForWelcome();
    await base.clickOnElement('#attestation');
    await welcome.elementContinueButton();
  };

  const completeApplicantDetailsPageSteps = async () => {
    await applicantDetails.checkForApplicantDetails();

    const applicantDetailsFields = [
      ['phone', '2025550114', 'phone'],
      ['dateOfBirth', '11/11/1995', 'maskedInput'],
      ['grossIncome', '100000', ''],
      ['addressLine1', '1225 Harvey Street', ''],
      ['city', 'Seattle', ''],
      ['zipCode', '98106', 'maskedInput'],
    ];

    await applicantDetails.setFields(applicantDetailsFields, '[data-id="', '"]');
    await applicantDetails.selectStateDropdown('Washington (WA)');
    await applicantDetails.continueButtonFromYourBasicInfo();
    await applicantDetails.payAndContinueButton();

    await base.focusIframe();
    const paymentFields = [
      ['name', 'Visa'],
      ['cardnumber', '4242424242424242'],
      ['cvv', '123'],
    ];
    await applicantDetails.setFields(paymentFields, '#form input[name=', ']');
    await applicantDetails.selectCardExpirationDate('11/2025');
    await applicantDetails.payFakeButton();
    await applicationAdditionalInfo.checkForApplicantAdditionalInfo();
  };

  this.Given(
    /^Published Quote with unit "([^"]*)" has been shared for Party guest "([^"]*)" and email "([^"]*)"$/,
    async (unit, guestName, email) => await publishAndSendQuote({ unit, guestName, email }),
  );

  this.Given(/^An agent that creates an application for unit "([^"]*)", with Party guest "([^"]*)" and email "([^"]*)"$/, async (unit, guestName, email) => {
    console.log('>>> about to publishAndSendQuote');
    await publishAndSendQuote({ unit, guestName, email });
    console.log('>>> about to open applyNow link');
    await openApplyNowLink(email);
    console.log('>>> about to complete welcome page steps');
    await completeWelcomePageSteps();
    console.log('>>> about to complete application details');
    await completeApplicantDetailsPageSteps();
  });

  this.When(/^Agent goes to Party Details Phase II for member "([^"]*)" and selects a quote for promotion for item "([^"]*)"$/, async (guestName, unit) => {
    await goToPartyDetailsPhaseTwo({ guestName, dashboardColumn: 'applicants' });
    await partyDetailsPhaseTwo.checkPromotionUnitItem(unit);
  });
};
