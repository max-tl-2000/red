/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Homepage from '../../pages/website/homepage';
import PropertyPage from '../../pages/website/propertyPage';
import ContactUsDialog from '../../pages/website/contactUsDialog';
import { getWebsiteURL } from '../../helpers/helpers';
import { PropertyNames } from '../../helpers/websiteConstants';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Contact Us'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

test('TEST-1327:Verify that client information is sent correctly in Contact Us form', async t => {
  const contactUsDialog = new ContactUsDialog(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, San Francisco, California');
  const propertyPage = new PropertyPage(t);
  await propertyPage.clickContactUsButton();

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.FullNameInput, 'Che Guevara');
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, '18008001111');
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, 'che@larevolution.com');

  await contactUsDialog.clickOnMoveInRangeDropdown();
  await contactUsDialog.clickOnMoveInRangeItem();

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.AdditionalCommentsInput, 'Hasta la apartamento siempre!');

  await contactUsDialog.submitContactUsForm();

  await contactUsDialog.checkThankYouPage();
});

test('TEST-1328:Verify warning messages when the client enters data with wrong format in Contact Us form', async t => {
  const homepage = new Homepage(t);
  await homepage.isDisplayed();
  const contactUsDialog = new ContactUsDialog(t);

  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, San Francisco, California');
  const propertyPage = new PropertyPage(t);
  await propertyPage.clickContactUsButton();

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, '1800800abcd');
  await t.pressKey('tab');
  await contactUsDialog.checkFieldValidationError('Enter a valid phone number');

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, 'chelarevolution.com');
  await t.pressKey('tab');
  await contactUsDialog.checkFieldValidationError('Enter a valid email');
});

test('TEST-1329:Verify warning messages when the client left fields in blank in Contact Us form', async t => {
  const contactUsDialog = new ContactUsDialog(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, San Francisco, California');

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickContactUsButton();
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkFieldValidationError('Full name is required');

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.FullNameInput, 'Che Guevara');
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkFieldValidationError('Phone is required');
  await contactUsDialog.checkFieldValidationError('Email is required');

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, '18008001111');
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkFieldValidationError('Email is required');

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, 'che@larevolution.com');
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkThankYouPage();
});

test('TEST-1330:Verify if we send data and reopen Contact Us form, the same data is available', async t => {
  const homepage = new Homepage(t);
  await homepage.isDisplayed();
  const contactUsDialog = new ContactUsDialog(t);

  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, San Francisco, California');

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickContactUsButton();

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.FullNameInput, 'Che Guevara');
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, '18008001111');
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, 'che@larevolution.com');

  await contactUsDialog.clickOnMoveInRangeDropdown();
  await contactUsDialog.clickOnMoveInRangeItem();

  await contactUsDialog.submitContactUsForm();

  await contactUsDialog.checkThankYouPage();
  await t.pressKey('esc');

  await propertyPage.clickContactUsButton();

  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.FullNameInput, 'Che Guevara');
  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.PhoneInput, '800-800-1111');
  await contactUsDialog.checkInputFieldValue(contactUsDialog.selectors.EmailInput, 'che@larevolution.com');
  await contactUsDialog.checkDropdownFieldValue(contactUsDialog.selectors.MoveInRangeSelectedValue, 'Next 4 months');
  await contactUsDialog.checkTextAreaFieldValue(contactUsDialog.selectors.AdditionalCommentsInput, '');
});
