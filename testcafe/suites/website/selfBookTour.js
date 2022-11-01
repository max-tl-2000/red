/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { Selector as $ } from 'testcafe';
import { getWebsiteURL, clickOnElement } from '../../helpers/helpers';
import { PropertyNames } from '../../helpers/websiteConstants';
import { setHooks } from '../../helpers/hooks';
import Homepage from '../../pages/website/homepage';
import PropertyPage from '../../pages/website/propertyPage';
import InventoryDialog from '../../pages/website/inventoryDialog';

setHooks(fixture('Layout Filter'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

const legalNameInput = 'Yacouba Sawadogo';
const email = `yacoubasavadogo${newUUID()}@sahel.com`;
const phoneNumber = '800-800-2233';
const moveInRange = 'Next 2 months';

test('TEST-1390:Check field validation on the Schedule a tour dialog', async t => {
  const homepage = new Homepage(t);
  const propertyPage = new PropertyPage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult('Sierra Norte, Sioux Falls, South Dakota');

  await propertyPage.clickLayoutButton('2 Bedrooms');

  await inventoryDialog.clickOnASpecificUnit('1-103');

  await t.wait(3000);

  await propertyPage.checkUnitDialog();

  await clickOnElement(t, { selector: $('[data-id="unitDialogButtons"] button') });

  await propertyPage.checkDateSelectorDialog({ unitAvailability: true });

  await propertyPage.checkViewMoreDialog();

  await propertyPage.selectTimeSlot(1);

  await propertyPage.checkContactInfoForm();

  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.LegalNameInput, legalNameInput);
  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.EmailInput, email);
  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.PhoneNumberInput, phoneNumber);

  await propertyPage.clickOnMoveInRangeDropdown();
  await propertyPage.clickOnMoveInRangeItem();

  await propertyPage.submitTourScheduleForm();

  await propertyPage.checkThankYouPage();

  await propertyPage.closeThankYouPage();

  await propertyPage.clickLayoutButton('3 Bedrooms');
  await clickOnElement(t, { selector: $('[data-id="emptyStateContainer"] button').withText('SCHEDULE A TOUR') });

  await propertyPage.checkDateSelectorDialog({ unitAvailability: false });

  await propertyPage.checkViewMoreDialog();

  await propertyPage.selectTimeSlot(2);

  await propertyPage.checkTourScheduleFormInputs(legalNameInput, email, phoneNumber, moveInRange);

  await propertyPage.submitTourScheduleForm();

  await propertyPage.checkThankYouPage();

  await propertyPage.closeThankYouPage();

  await t.eval(() => window.location.reload(true));

  await propertyPage.clickLayoutButton('1 Bedroom');

  await inventoryDialog.clickOnASpecificUnit('1-104');
  await clickOnElement(t, { selector: $('[data-id="unitDialogButtons"] button') });

  await propertyPage.openContactInfoForm();

  await propertyPage.checkEmptyTourScheduleFormInputs();

  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.EmailInput, 'yacoubasavadogosahel.com');
  await t.pressKey('tab');
  await propertyPage.checkFieldValidationError('Enter a valid email');

  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.PhoneNumberInput, '800-AAA-2233');
  await t.pressKey('tab');
  await propertyPage.checkFieldValidationError('Enter a valid phone number');

  await clickOnElement(t, { selector: $(`${propertyPage.TourScheduleFormSelectors.FooterContainer} button`) });
  await clickOnElement(t, { selector: $(propertyPage.DialogDateSelectors.FooterBackButton) });
  await clickOnElement(t, { selector: $(propertyPage.ScheduleATourSelectors.UnitDialogCancelButton) });

  await t.eval(() => window.location.reload(true));

  await propertyPage.clickLayoutButton('2 Bedrooms');
  await inventoryDialog.clickOnASpecificUnit('1-103');
  await clickOnElement(t, { selector: $('[data-id="unitDialogButtons"] button') });

  await propertyPage.openContactInfoForm();

  await propertyPage.submitTourScheduleForm();

  const nameRequiredMsg = 'Name is required';
  const emailRequiredMsg = 'Email is required';
  const phoneRequiredMsg = 'Phone is required';
  const moveInRangeRequired = 'Move-in range is required';

  await propertyPage.checkFieldValidationError(nameRequiredMsg);
  await propertyPage.checkFieldValidationError(emailRequiredMsg);
  await propertyPage.checkFieldValidationError(phoneRequiredMsg);
  await propertyPage.checkFieldValidationError(moveInRangeRequired);

  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.LegalNameInput, 'Clair Cameron Patterson');
  await propertyPage.submitTourScheduleForm();
  await propertyPage.checkFieldValidationError(phoneRequiredMsg);
  await propertyPage.checkFieldValidationError(emailRequiredMsg);
  await propertyPage.checkFieldValidationError(moveInRangeRequired);

  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.EmailInput, 'noMoreLead@gasoline.com');
  await propertyPage.submitTourScheduleForm();
  await propertyPage.checkFieldValidationError(phoneRequiredMsg);
  await propertyPage.checkFieldValidationError(moveInRangeRequired);

  await propertyPage.typeIntoTourScheduleForm(propertyPage.TourScheduleFormSelectors.PhoneNumberInput, '800-800-1515');
  await propertyPage.submitTourScheduleForm();
  await propertyPage.checkFieldValidationError(moveInRangeRequired);

  await propertyPage.clickOnMoveInRangeDropdown();
  await propertyPage.clickOnMoveInRangeItem();

  await propertyPage.submitTourScheduleForm();
  await propertyPage.checkThankYouPage();
});
