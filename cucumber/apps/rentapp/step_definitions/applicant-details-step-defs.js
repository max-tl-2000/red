/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import ApplicantDetails from '../test-pages/applicant-details';

// doing a default export because cucumber
module.exports = function applicantDetailsStepDefs() {
  const applicantDetails = new ApplicantDetails();

  this.Then(/^The 'Applicant Details' page should be displayed$/, async () => {
    await applicantDetails.checkForApplicantDetails();
  });

  this.Then(/^The applicant stepper should contain in first step:$/, table => applicantDetails.applicantFirstStepCheck(table, this.testId));

  this.Then(/^The applicant stepper should contain in second step:$/, table => applicantDetails.applicantSecondStepCheck(table));

  this.Then(/^The 'Payment' dialog should be displayed$/, async () => {
    await applicantDetails.checkForPaymentDialog();
  });

  this.Then(/^The 'Payment' dialog should contain a confirmation message: "([^"]*)"$/, async message => {
    await applicantDetails.checkForPaymentConfirmation(message);
  });

  this.When(/^Customer fills out all the required fields:$/, async table => {
    await applicantDetails.completeApplicantForm(table);
  });

  this.When(/^Customer fills out the payment form:$/, async table => {
    await applicantDetails.completePaymentForm(table);
  });

  this.When(/^Selects a card expiration date: "([^"]*)"$/, async expiration => {
    await applicantDetails.selectCardExpirationDate(expiration);
  });

  this.When(/^Selects a State from dropdown "([^"]*)"$/, async state => {
    await applicantDetails.selectStateDropdown(state);
  });

  this.When(/^Clicks 'CONTINUE' button from 'Your Basic Info' stepper$/, async () => {
    await applicantDetails.continueButtonFromYourBasicInfo();
  });

  this.When(/^The 'Payment' stepper is shown$/, async () => {
    await applicantDetails.checkForPaymentStepper();
  });

  this.When(/^Clicks 'PAY & CONTINUE' button from 'Payment' stepper$/, async () => {
    await applicantDetails.payAndContinueButton();
  });

  this.When(/^Start his application and Complete field required in 'Your Basic Info' stepper$/, async table => {
    await applicantDetails.checkForApplicantDetails();
    await applicantDetails.completeApplicantForm(table);
  });

  this.When(/^Clicks 'PAY' button$/, async () => {
    await applicantDetails.payFakeButton();
  });
};
