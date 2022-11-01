/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import Homepage from '../../../pages/website/homepage';
import PropertyPage from '../../../pages/website/propertyPage';
import PartyPhaseOne from '../../../pages/partyPhaseOne';
import ContactUsDialog from '../../../pages/website/contactUsDialog';
import {
  getWebsiteURL,
  getTenantURL,
  loginAs,
  doLogoutIfNeeded,
  getUserPassword,
  expectDashboardLaneContains,
  clickOnCard,
  clickOnElement,
} from '../../../helpers/helpers';
import { validateDashboardVisible } from '../../../helpers/dashboardHelpers';
import { PropertyNames } from '../../../helpers/websiteConstants';
import { setHooks } from '../../../helpers/hooks';
import PartyDetailPage from '../../../pages/partyDetailPage';

setHooks(fixture('End To End Flow 2'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

const flowData = {
  legalName: `Che Guevara${newUUID()}`,
  email: `che${newUUID()}@larevolution.com`,
  phoneRaw: '18008001111',
  formattedPhone: '(800) 800-1111',
  phoneFormattedContactForm: '800-800-1111',
  inquryMessage: 'Hasta la apartamento siempre!',
};

test('TEST-1391: Single user walks through contact us functionality - website flow', async t => {
  const homepage = new Homepage(t);
  // Navigate to the property page to have access to the Contact us form
  await homepage.isDisplayed();
  const contactUsDialog = new ContactUsDialog(t);
  const propertyPage = new PropertyPage(t);

  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, San Francisco, California');

  await propertyPage.clickContactUsButton();

  // Try to submit the form without all the mandatory values
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkFieldValidationError('Full name is required');
  await contactUsDialog.checkFieldValidationError('Phone is required');
  await contactUsDialog.checkFieldValidationError('Email is required');

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.FullNameInput, flowData.legalName);
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkFieldValidationError('Phone is required');
  await contactUsDialog.checkFieldValidationError('Email is required');

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, '18008001111');
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkFieldValidationError('Email is required');

  // Check that the email and phone values are validated correctly
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, '1800800abcd');
  await t.pressKey('tab');
  await contactUsDialog.checkFieldValidationError('Enter a valid phone number');

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, 'chelarevolution.com');
  await t.pressKey('tab');
  await contactUsDialog.checkFieldValidationError('Enter a valid email');

  // Successfully submit the form with all the required data
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, flowData.phoneRaw);
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, flowData.email);

  await contactUsDialog.clickOnMoveInRangeDropdown();
  await contactUsDialog.clickOnMoveInRangeItem();

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.AdditionalCommentsInput, flowData.inquryMessage);

  await contactUsDialog.submitContactUsForm();

  await contactUsDialog.checkThankYouPage();

  await t.pressKey('esc');

  await propertyPage.clickContactUsButton();

  // Check that the field data was persisted
  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.FullNameInput, flowData.legalName);
  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.PhoneInput, flowData.phoneFormattedContactForm);
  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.EmailInput, flowData.email);
  await contactUsDialog.checkDropdownFieldValue(contactUsDialog.selectors.MoveInRangeSelectedValue, 'Next 4 months');
  await contactUsDialog.checkTextAreaFieldValue(contactUsDialog.selectors.AdditionalCommentsInput, '');

  // Check that the field data is cleared on page reload
  await t.eval(() => window.location.reload(true));
  await propertyPage.clickContactUsButton();

  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.FullNameInput, '');
  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.PhoneInput, '');
  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.EmailInput, '');
  await contactUsDialog.checkTextAreaFieldValue(contactUsDialog.selectors.AdditionalCommentsInput, '');
});

test('TEST-1391: Single user walks through contact us functionality - leasing app flow', async t => {
  // Check that the correct party was created in the leasing app
  await t.navigateTo(getTenantURL('/'));
  const partyPhaseOne = new PartyPhaseOne(t);
  const userInfo = { user: 'sarah@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: '#switchTodayOnly' });

  const expectedCard = { lane: '#contacts', cardText: flowData.legalName };
  await expectDashboardLaneContains(t, expectedCard);
  await clickOnCard(t, expectedCard);

  await partyPhaseOne.checkPartyMember(flowData.legalName);

  await partyPhaseOne.clickOnWebInqury();

  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.formattedPhone);

  await partyPhaseOne.checkInquiryMessageMoveInDate('Move in date: 2 - 4 months');
  await partyPhaseOne.checkInquiryMessageContent(flowData.inquryMessage);

  const summaryData = {
    interestedProperty: 'Parkmerced Apartments',
    source: 'Parkmerced website',
    initialChannel: 'Web',
  };

  const partyDetailPage = new PartyDetailPage(t);

  await partyDetailPage.checkPartySummarySection(summaryData);
  await doLogoutIfNeeded(t);
});
