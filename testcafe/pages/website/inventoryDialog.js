/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import PropertyPage from './propertyPage';
import { expectVisible, expectNotPresent, clickOnElement } from '../../helpers/helpers';

export default class InventoryDialog {
  constructor(t) {
    this.t = t;
    this.selectors = {
      DialogContainer: '[data-id="unitDialogContainer"]',
      DialogContainerButtons: '[data-id="unitDialogButtons"] button',
      NameInput: '[data-id="contactInfoFullName"]',
      PhoneInput: '[data-id="contactInfoPhoneNumber"]',
      EmailInput: '[data-id="contactInfoEmail"]',
      DateSelector: '[data-id="unitDialogContainer"] [data-id="selectorInputContainer"]',
      MoveInDate: '[placeholder="When do you plan to move in?*"]',
      FooterButton: '[data-id="unitDialogFooter"] button',
      CalendarChevronRight: '[data-id="CalendarContainer"] [data-id="CalendarMonthHeader"] :nth-child(3)',
      DateAfterAvailabilityDay: '[data-id="CalendarMonthContainer"] [data-id="DayNumberContainer"]',
      CalendarOkButton: '[data-id="CalendarButtons"] span',
      SixMonthsLeaseTerm: '[data-id="lease-term"] [data-label="6 months"]',
      LeaseTerm: '[data-id="lease-term"]',
      LeaseTermLength: '[data-id="termLength"] [data-component="pickbox"]',
      UnavailableRentWarningMessage: '[data-id="TermsPageContainer"] div:nth-child(1) p',
      ClosestDateWithAvailableRent: '[data-id="TermsPageContainer"] [data-id="selectorInputContainer"] input',
      MarketingQuestionTitle: '[data-id="unitDialogContainer"] p',
      PetQuestionContainer: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(1)',
      PetYesRadioButton: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(1) [data-value="YES"]',
      PetNoRadioButton: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(1) [data-value="NO"]',
      PetDropdown: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(1) [data-id="dropdownPlaceholder-Quantity"]',
      PetDropdownAnswer: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(1) [data-c="dropdown"] p',
      PetDropdownQuantityItems: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(1) [data-id="dropdownItems-Quantity"] p',
      ServiceAnimalQuestionContainer: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2)',
      ServiceAnimalYesRadioButton: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-value="YES"]',
      ServiceAnimalNoRadioButton: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-value="NO"]',
      ServiceAnimalDropdown: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-id="dropdownPlaceholder-Quantity"]',
      ServiceAnimalDropdownAnswer: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-c="dropdown"] p',
      ServiceAnimalDropdownQuantityItems:
        '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-id="dropdownItems-Quantity"] p',
      StorageQuestionContainer: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(3)',
      StorageYesRadioButton: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(3) [data-label="Yes"]',
      StoragePrimaryQuestionsContainer:
        '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(3) [data-id="primaryStorageQuestionsContainer"]',
      StoragePrimaryQuestions: '[data-id="marketingQuestionContainer"]:nth-child(3) [data-id="primaryStorageQuestionsContainer"] div',
      StoragePrimaryYesRadioButton: '[data-id="marketingQuestionContainer"]:nth-child(3) [data-id="primaryStorageQuestionsContainer"] div [data-value="YES"]',
      StoragePrimaryNoRadioButton: '[data-id="marketingQuestionContainer"]:nth-child(3) [data-id="primaryStorageQuestionsContainer"] div [data-value="NO"]',
      StorageDropdown:
        '[data-id="marketingQuestionContainer"]:nth-child(3) [data-id="primaryStorageQuestionsContainer"] div [data-id="dropdownPlaceholder-Quantity"]',
      StorageDropdownPrimaryAnswer:
        '[data-id="marketingQuestionContainer"]:nth-child(3) [data-id="primaryStorageQuestionsContainer"] div [data-c="dropdown"] p',
      StorageDropdownQuantityItems: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(3) [data-id="dropdownItems-Quantity"] p',
      ParkingQuestionContainer: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2)',
      ParkingYesRadioButton: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-value="YES"]',
      ParkingDropdown: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-id="dropdownPlaceholder-Quantity"]',
      ParkingDropdownQuantityItems: '[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(2) [data-id="dropdownItems-Quantity"] p',
      MarketingQuestionTitles: '[data-id="unitDialogContainer"] p',
    };

    this.ScheduleSelectors = {
      ScheduleTime: '[data-id="dateSlot"] [data-id="dateOfTheMonth"]',
      MoveInRangeDropdown: '[data-id="unitDialogContainer"] [data-id="dropdownPlaceholder-When do you plan to move in?*"]',
      MoveInRangeSecondItem: '[data-id="unitDialogContainer"] [data-id="dropdownItems-When do you plan to move in?*"] [data-idx="2"]',
      ScheduleNameInput: '[data-id="contactInfoLegalName"]',
      ScheduleMobilePhoneInput: '[data-id="contactInfoMobilePhone"]',
      ScheduleEmailInput: '[data-id="contactInfoEmailAddress"]',
    };
  }

  clickButtonByText = async text =>
    clickOnElement(this.t, {
      selector: $(this.selectors.DialogContainer).find('span').withText(text.toUpperCase()),
    });

  verifyThankYouPage = async () => {
    const { t } = this;
    await expectVisible(t, { selector: 'p', text: 'Your personalized price is on the way!*' });
    await expectVisible(t, { selector: 'p', text: 'We sent you an email so it’s easy to find.' });
    await expectVisible(t, {
      selector: 'p',
      text: '*Your price quote includes a link to our rental application, if you are ready to take the first step towards moving in to your new home.',
    });
  };

  selectDateWithHigherRent = async date => await clickOnElement(this.t, { selector: $(this.selectors.DateAfterAvailabilityDay).withText(`${date}`) });

  pickHighRentDate = async rentMatrixStartDate => {
    const { t } = this;
    const currentDate = await $(this.selectors.MoveInDate).getAttribute('value');
    const currentMonth = currentDate.split(' ')[0];
    const highRentStartDate = rentMatrixStartDate.clone().add(8, 'days');
    const highRentMonth = highRentStartDate.format('MMMM');
    const highRentDay = highRentStartDate.format('D');

    if (currentMonth === highRentMonth) {
      await this.selectDateWithHigherRent(highRentDay);
    } else {
      await clickOnElement(t, { selector: $(this.selectors.CalendarChevronRight) });
      await this.selectDateWithHigherRent(highRentDay);
    }

    await clickOnElement(t, { selector: $(this.selectors.CalendarOkButton).withText('OK') });
  };

  toggleLeaseTerm = async leaseTermText =>
    await clickOnElement(this.t, { selector: $(this.selectors.DialogContainer).find(`div [data-label="${leaseTermText}"]`) });

  clickContinueExploringButton = async () => await clickOnElement(this.t, { selector: $('button').withText('CONTINUE EXPLORING YOUR COMMUNITY') });

  clickOnTimeIntervalByIndex = async index => await clickOnElement(this.t, { selector: $(this.ScheduleSelectors.ScheduleTime).nth(index) });

  extractTimeIntervalByIndex = async index => $(this.ScheduleSelectors.ScheduleTime).nth(index).textContent;

  checkDropdownFieldValue = async (selector, text) => await this.t.expect((await $(selector).withText(text)).visible).eql(true);

  clickOnMoveInRangeDropdown = async () => await clickOnElement(this.t, { selector: $(this.ScheduleSelectors.MoveInRangeDropdown) });

  clickOnMoveInRangeItem = async () => await clickOnElement(this.t, { selector: $(this.ScheduleSelectors.MoveInRangeSecondItem) });

  verifyThankYouPageScheduleTour = async () => {
    const { t } = this;
    await t.expect((await $('p').withExactText('Thank you for booking a tour!')).visible).eql(true);
    await t.expect((await $('p').withExactText('You will get your confirmation details via email.')).visible).eql(true);
  };

  checkHighlightedBetterPriceValue = async rentMatrixStartDate => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.LeaseTermLength).withText('6 months') });
    const lowRentEndDate = rentMatrixStartDate.clone().add(7, 'days').format('MM/DD');

    await expectVisible(t, { selector: 'span', text: `Move in on ${lowRentEndDate} for $1665 / mo` });

    await t.expect(await $('span span').withText(`Move in on ${lowRentEndDate} for $1665 / mo`).getStyleProperty('color')).eql('rgb(0, 191, 165)');
  };

  clickOnASpecificUnit = async title => {
    const { t } = this;
    const propertyPage = new PropertyPage(t);
    return await clickOnElement(t, { selector: $(propertyPage.selectors.MarketingLayoutApartmentNumberContainer).withText(title) });
  };

  checkDefaultLeasesWithPriceAreDisplayed = async expectedValues => {
    const { t: tst } = this;
    await mapSeries(expectedValues, async value => {
      const leaseTermNode = await $(this.selectors.LeaseTermLength)
        .withAttribute('data-value', `${value.leaseTerm}`)
        .withExactText(`${value.leaseTerm} months`)
        .with({ boundTestRun: tst });
      await tst.expect(leaseTermNode.visible).ok();

      const leasePriceNode = await $(this.selectors.LeaseTerm).withText(`${value.leaseTerm} months`).withText(value.leasePrice).with({ boundTestRun: tst });
      await tst.expect(leasePriceNode.visible).eql(true);
    });
  };

  checkDefaultLeasesWithNoPriceAreNotDisplayed = async () => {
    const { t } = this;
    await t.expect(await $(this.selectors.LeaseTerm).withExactText('2 months').exists).notOk();
  };

  checkNonDefaultLeasesWithPriceAreNotDisplayed = async notExpectedCardTitles => {
    const { t: tst } = this;
    await mapSeries(notExpectedCardTitles, async title => {
      const termLeasePeriod = await $(this.selectors.LeaseTerm).withText(`${title} months`).with({ boundTestRun: tst });
      await tst.expect(termLeasePeriod.exists).notOk();
    });
  };

  typeIntoGetPriceForm = async (selector, text) => await this.t.typeText($(selector), text, { replace: true });

  getEnteredDate = async () => await $(this.selectors.MoveInDate).getAttribute('value');

  selectDateAfterAvailabilityDay = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.MoveInDate) });
    await clickOnElement(t, { selector: $(this.selectors.CalendarChevronRight) });
    await t.wait(200);
    await clickOnElement(t, { selector: $(this.selectors.CalendarChevronRight) });
    await clickOnElement(t, { selector: $(this.selectors.DateAfterAvailabilityDay).withText('25') });
    await clickOnElement(t, { selector: $(this.selectors.CalendarOkButton).withText('OK') });
  };

  checkExactRentMessage = async () =>
    await expectVisible(this.t, {
      selector: this.selectors.UnavailableRentWarningMessage,
      text: 'Exact rent is unavailable for the date that you selected, so we’ve reset it to the closest date with an available rent.',
    });

  checkUnavailableRentMessage = async () =>
    await expectVisible(this.t, {
      selector: this.selectors.UnavailableRentWarningMessage,
      text: 'This unit is unavailable for the date that you selected, so we’ve reset it to the earliest date this unit becomes available.',
    });

  checkMarketingQuestionTitle = async () =>
    await expectVisible(this.t, {
      selector: this.selectors.MarketingQuestionTitle,
      text: 'Select additional options that you are interested in',
    });

  checkMarketingQuestions = async (order, marketingQuestions) => {
    const { t: tst } = this;
    await mapSeries(order, async elem => {
      const marketingQuestionContainer = `[data-id="unitDialogContainer"] [data-id="marketingQuestionContainer"]:nth-child(${elem})`;
      // TODO: this might not work the boundTestRun had to be done out of the callback
      await expectVisible(tst, { selector: marketingQuestionContainer, text: marketingQuestions[elem - 1], boundTestRun: true });
    });
  };

  checkMarketingQuestionsAreNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.MarketingQuestionTitles, text: 'Do you need additional parking?' });
  };

  checkPetFollowupQuestion = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.PetYesRadioButton) });
    await expectVisible(t, {
      selector: this.selectors.PetQuestionContainer,
      text: 'How many pets do you have?',
    });
  };

  checkDropdownQuantity = async (visibleQuantityData, notPresentItemValue, dropDownSelector, quantityValueSelector) => {
    const { t } = this;
    await clickOnElement(t, { selector: $(dropDownSelector) });
    await mapSeries(visibleQuantityData, async element => {
      const quantityValue = await $(quantityValueSelector).withText(element).with({ boundTestRun: t });
      await t.expect(quantityValue.visible).ok();
    });
    await expectNotPresent(t, {
      selector: quantityValueSelector,
      text: notPresentItemValue,
    });
  };

  checkPetDropdownNotDisplayed = async () => {
    await expectNotPresent(this.t, { selector: this.selectors.PetDropdown });
  };

  pickTwoPets = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.PetYesRadioButton) });
    await clickOnElement(t, { selector: $(this.selectors.PetDropdown) });
    await clickOnElement(t, { selector: $(this.selectors.PetDropdownQuantityItems).withText('2') });
  };

  checkServiceAnimalFollowupQuestion = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.ServiceAnimalYesRadioButton) });
    await expectVisible(t, {
      selector: this.selectors.ServiceAnimalQuestionContainer,
      text: 'How many service animals do you have?',
    });
  };

  checkServiceAnimalDropdownNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.ServiceAnimalDropdown });
  };

  pickOneServiceAnimal = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.ServiceAnimalYesRadioButton) });
    await clickOnElement(t, { selector: $(this.selectors.ServiceAnimalDropdown) });
    await clickOnElement(t, { selector: $(this.selectors.ServiceAnimalDropdownQuantityItems).withText('1') });
  };

  checkStoragePrimaryQuestions = async storagePrimaryQuestions => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.StorageYesRadioButton) });
    await expectVisible(t, { selector: this.selectors.StoragePrimaryQuestionsContainer });
    await mapSeries(storagePrimaryQuestions, async element => {
      await expectVisible(t, { selector: this.selectors.StoragePrimaryQuestions, text: element, boundTestRun: true });
    });
  };

  checkStoragelDropdownNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.StorageDropdown });
  };

  pickOne7x7storage = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.StoragePrimaryYesRadioButton) });
    await clickOnElement(t, { selector: $(this.selectors.StorageDropdown) });
    await clickOnElement(t, { selector: $(this.selectors.StorageDropdownQuantityItems).withText('1') });
  };

  pickTwoPetsParkmerced = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.PetDropdownQuantityItems).withText('2') });
  };

  checkParkingFollowupQuestion = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.ParkingYesRadioButton) });
    await expectVisible(t, {
      selector: this.selectors.ParkingQuestionContainer,
      text: 'How many parking spots do you need?',
    });
  };

  pickOneParking = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.ParkingDropdownQuantityItems).withText('1') });
  };

  checkStorageFollowupQuestionParkmerced = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.StorageYesRadioButton) });
    await expectVisible(t, {
      selector: this.selectors.StorageQuestionContainer,
      text: 'How many storage units do you need?',
    });
  };

  pickOneStorageParkmerced = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.StorageDropdownQuantityItems).withText('1') });
  };

  checkMarketingQuestionsAreNotDisplayedParkmerced = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.MarketingQuestionTitles, text: 'Do you have service animals?' });
  };

  checkButtonIsNotPresentByText = async buttonName =>
    await expectNotPresent(this.t, {
      selector: this.selectors.DialogContainerButtons,
      text: buttonName,
    });

  pickQuantity = async answers => {
    const { t } = this;
    await clickOnElement(t, { selector: answers.selectorRadioButton });
    await clickOnElement(t, { selector: answers.selectorDropdown });
    await clickOnElement(t, { selector: $(answers.selectorDropdownQuantityItem).withText(answers.quantity) });
  };

  checkSelectedQuantity = async answers => {
    const { t } = this;
    await expectVisible(t, {
      selector: answers.selectorAnswer,
      text: answers.quantity,
    });
  };
}
