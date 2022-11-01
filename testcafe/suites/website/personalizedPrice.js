/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import newUUID from 'uuid/v4';
import { setHooks } from '../../helpers/hooks';
import { PropertyNames, PropertyTimezone } from '../../helpers/websiteConstants';
import { now } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_LONG_FORMAT } from '../../../common/date-constants';
import Homepage from '../../pages/website/homepage';
import PropertyPage from '../../pages/website/propertyPage';
import InventoryDialog from '../../pages/website/inventoryDialog';
import ContactUsDialog from '../../pages/website/contactUsDialog';
import {
  getWebsiteURL,
  getTenantURL,
  loginAs,
  getUserPassword,
  doLogoutIfNeeded,
  expectDashboardLaneContains,
  clickOnCard,
  updateInventoryPricing,
  createTwoWeekRentMatrix,
  clickOnElement,
} from '../../helpers/helpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { selectTimeSlot } from '../../helpers/bookerWidgetHelpers';
import PartyPhaseOne from '../../pages/partyPhaseOne';
import DashboardPage from '../../pages/dashboardPage';

setHooks(fixture('Personalised Price - Self Quote'), {
  skipDatabaseRestore: true,
  runBeforeFn: async () => {
    const { rentMatrix } = createTwoWeekRentMatrix();
    await updateInventoryPricing('sierra', { externalId: '1102', state: 'vacantReady', type: 'unit' }, rentMatrix);
  },
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

test('TEST-1359:Self book a quote - party verifications', async t => {
  const testData = {
    fullName: 'Tim Burton',
    phoneNumber: '18008002222',
    email: 'timburton@spider.web',
    leaseTerm: '12 months',
  };

  const homepage = new Homepage(t);
  const propertyPage = new PropertyPage(t);
  const inventoryDialog = new InventoryDialog(t);

  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, San Francisco, California');

  await propertyPage.clickLayoutButton('2 Bedrooms');

  await propertyPage.clickOnInventoryCardByIndex(1);

  await inventoryDialog.clickButtonByText('Get Personalized Price');

  await t.typeText(inventoryDialog.selectors.NameInput, testData.fullName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, testData.phoneNumber, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, testData.email, { replace: true });

  await inventoryDialog.clickButtonByText('Next');

  await inventoryDialog.toggleLeaseTerm(testData.leaseTerm);

  await inventoryDialog.clickButtonByText('Send it to me');

  await inventoryDialog.verifyThankYouPage();

  await inventoryDialog.clickContinueExploringButton();
});

const getWebInquiryFlowData = () => ({
  legalName: `Emmy Bolton${newUUID()}`,
  email: `emmy${newUUID()}@gmail.com`,
  phoneRaw: '+40744521331',
  formattedPhone: '+40 744 521 331',
  phoneFormattedContactForm: '+4074-452-1331',
  inquryMessage: 'This apartment',
  leaseTerm: '12 months',
});

const contactUs = async (t, flowData) => {
  const homepage = new Homepage(t);
  await t.navigateTo(getWebsiteURL('/'));
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult(PropertyNames.Parkmerced);

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickContactUsButton();

  const contactUsDialog = new ContactUsDialog(t);

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.FullNameInput, flowData.legalName);
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, flowData.phoneRaw);
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, flowData.email);
  await contactUsDialog.clickOnMoveInRangeDropdown();
  await contactUsDialog.clickOnMoveInRangeItem();
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.AdditionalCommentsInput, flowData.inquryMessage);
  await contactUsDialog.submitContactUsForm();
  await contactUsDialog.checkThankYouPage();
};

const scheduleTour = async (t, flowData) => {
  const homepage = new Homepage(t);
  await t.navigateTo(getWebsiteURL('/'));
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult(PropertyNames.Parkmerced);

  const propertyPage = new PropertyPage(t);
  const inventoryDialog = new InventoryDialog(t);

  await propertyPage.clickLayoutButton('2 Bedrooms');
  await inventoryDialog.clickOnASpecificUnit('350 Arballo-1015');
  await inventoryDialog.clickButtonByText('Schedule a tour');

  const parkmercedTourTimeFormated = await selectTimeSlot(t, 1, 1, PropertyTimezone.Parkmerced);

  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleNameInput, flowData.legalName);
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleEmailInput, flowData.email);
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleMobilePhoneInput, flowData.phoneRaw);
  await inventoryDialog.clickOnMoveInRangeDropdown();
  await inventoryDialog.clickOnMoveInRangeItem();
  await inventoryDialog.clickButtonByText('Confirm your appointment');
  await inventoryDialog.verifyThankYouPageScheduleTour();
  await inventoryDialog.clickContinueExploringButton();

  return parkmercedTourTimeFormated;
};

test('TEST-1364:Verifying different web inquiries for the same party', async t => {
  // contactUs data
  const contactUsFlowData = getWebInquiryFlowData();
  const expectedWebInquiryContactUs = {
    campaignType: '[website-property] Website inquiry',
    senderName: contactUsFlowData.legalName,
    messageSection: 'Move in date: 2 - 4 months',
  };

  // schedule tour data
  const scheduleTourFlowData = getWebInquiryFlowData();

  const parkmercedAppointmentDateMoment = now({ timezone: PropertyTimezone.Parkmerced }).add(1, 'days');
  const parkmercedAppointmentDate = parkmercedAppointmentDateMoment.format('MMM D');
  const parkmercedAppointmentLongDate = parkmercedAppointmentDateMoment.format(MONTH_DATE_YEAR_LONG_FORMAT);

  // personalized price data
  const personalizedPriceFlowData = getWebInquiryFlowData();
  const expectedWebInquiryGetPersonalizedPrice = {
    campaignType: '[website-property] Quote sent',
    senderName: personalizedPriceFlowData.legalName,
    messageSection: 'Quote sent for apartment swparkme-350AR-1015',
  };

  const expectedCards = [
    { lane: '#contacts', cardText: contactUsFlowData.legalName },
    { lane: '#leads', cardText: scheduleTourFlowData.legalName },
    { lane: '#prospects', cardText: personalizedPriceFlowData.legalName },
  ];

  // "Contact Us"
  await contactUs(t, contactUsFlowData);

  // "ContactUs" + "Schedule a Tour"
  await contactUs(t, scheduleTourFlowData);
  const parkmercedTourTimeFormated = await scheduleTour(t, scheduleTourFlowData);

  const expectedEmailSubject = ['Appointment confirmed - Parkmerced Apartments', 'Quote from Parkmerced Apartments'];
  const expectedSms = `Your appointment has been confirmed for ${parkmercedAppointmentLongDate} at ${parkmercedTourTimeFormated}. You will meet with .* at our Leasing Office located at 3711 19th Ave, San Francisco, CA 94132. If you would like to modify or cancel this appointment, simply reply to this text message with your change.`;
  const expectedWebInquiryScheduleTour = {
    campaignType: '[website-property] Self book appointment',
    senderName: scheduleTourFlowData.legalName,
    messageSection: `Self book appointment for apartment swparkme-350AR-1015 on ${parkmercedAppointmentDate}, ${parkmercedTourTimeFormated} ${parkmercedAppointmentDateMoment.format(
      'z',
    )}`,
  };

  // "ContactUs" + "ScheduleTour" + "Get personalized price"
  await contactUs(t, personalizedPriceFlowData);
  await scheduleTour(t, personalizedPriceFlowData);
  await t.navigateTo(getWebsiteURL('/'));

  const homepage = new Homepage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult(PropertyNames.Parkmerced);

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickLayoutButton('2 Bedrooms');
  await inventoryDialog.clickOnASpecificUnit('350 Arballo-1015');

  await inventoryDialog.clickButtonByText('Get Personalized Price');
  await t.typeText(inventoryDialog.selectors.NameInput, personalizedPriceFlowData.legalName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, personalizedPriceFlowData.phoneRaw, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, personalizedPriceFlowData.email, { replace: true });
  await inventoryDialog.clickButtonByText('Next');
  await inventoryDialog.toggleLeaseTerm(personalizedPriceFlowData.leaseTerm);
  await inventoryDialog.clickButtonByText('Send it to me');
  await inventoryDialog.verifyThankYouPage();
  await inventoryDialog.clickContinueExploringButton();

  const dashboardPage = new DashboardPage(t);

  // Go to REVA app
  await t.navigateTo(getTenantURL('/'));
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  await dashboardPage.clickOnDropDownAgentsList();
  await dashboardPage.clickOnLeasingTeamItem('BayAreaCallCenter_optionItem');
  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: '#switchTodayOnly' });

  // Verify web inqury structure from "Contact Us" flow
  await expectDashboardLaneContains(t, expectedCards[0]);
  await clickOnCard(t, expectedCards[0]);

  const partyPhaseOne = new PartyPhaseOne(t);

  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiryContactUs);
  await partyPhaseOne.clickOnWebInqury();
  await partyPhaseOne.checkInquiryMessageHeader(expectedWebInquiryContactUs.campaignType);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(contactUsFlowData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(contactUsFlowData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(contactUsFlowData.formattedPhone);
  await partyPhaseOne.checkInquiryMessageMoveInDate(expectedWebInquiryContactUs.messageSection);
  await partyPhaseOne.checkInquiryMessageContent(contactUsFlowData.inquryMessage);
  await partyPhaseOne.closeFlyout();
  await partyPhaseOne.clickOnBackButton();

  // Verify web inquiry structure from "Schedule a Tour" flow
  await expectDashboardLaneContains(t, expectedCards[1]);
  await clickOnCard(t, expectedCards[1]);
  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiryScheduleTour);
  await partyPhaseOne.checkSmsStructure(new RegExp(`${expectedSms}`), scheduleTourFlowData.legalName);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject[0], scheduleTourFlowData.legalName);
  await partyPhaseOne.clickOnWebInqury();
  await partyPhaseOne.checkInquiryMessageHeaderLabel(scheduleTourFlowData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(scheduleTourFlowData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(scheduleTourFlowData.formattedPhone);
  await partyPhaseOne.checkInquiryMessageMoveInDate(expectedWebInquiryScheduleTour.messageSection);
  await partyPhaseOne.closeFlyout();
  await partyPhaseOne.clickOnBackButton();

  // Verify web inquiry structure from "Get personalized price" flow
  await expectDashboardLaneContains(t, expectedCards[2]);
  await clickOnCard(t, expectedCards[2]);
  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiryGetPersonalizedPrice);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject[1], personalizedPriceFlowData.legalName);
  await partyPhaseOne.clickOnWebInqury();
  await partyPhaseOne.checkInquiryMessageHeaderLabel(personalizedPriceFlowData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(personalizedPriceFlowData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(personalizedPriceFlowData.formattedPhone);
  await partyPhaseOne.checkInquiryMessageMoveInDate(expectedWebInquiryGetPersonalizedPrice.messageSection);
  await partyPhaseOne.closeFlyout();
  await partyPhaseOne.clickOnBackButton();
  await doLogoutIfNeeded();
});

test('TEST-1346:The UI should show cheaper rent as a highlight text that is closer to the move-in date entered', async t => {
  const testData = {
    fullName: 'Sally Sue',
    phoneNumber: '18008003333',
    email: 'sallysue@song.web',
  };
  const { startDate: rentMatrixStartDate } = createTwoWeekRentMatrix();
  const homepage = new Homepage(t);
  const propertyPage = new PropertyPage(t);

  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult(PropertyNames.SierraNorte);

  await clickOnElement(t, { selector: propertyPage.PropertyInfoSelectors.FindApartmentButton });

  await propertyPage.clickLayoutButton('1 Bedroom');

  const inventoryDialog = new InventoryDialog(t);

  await inventoryDialog.clickOnASpecificUnit('1-102');

  await inventoryDialog.clickButtonByText('GET PERSONALIZED PRICE');

  await clickOnElement(t, { selector: inventoryDialog.selectors.DateSelector });
  await inventoryDialog.pickHighRentDate(rentMatrixStartDate);

  await t.typeText(inventoryDialog.selectors.NameInput, testData.fullName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, testData.phoneNumber, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, testData.email, { replace: true });

  await inventoryDialog.clickButtonByText('Next');

  await inventoryDialog.checkHighlightedBetterPriceValue(rentMatrixStartDate);

  await inventoryDialog.clickButtonByText('Send it to me');

  await inventoryDialog.clickButtonByText('Continue exploring your community');
});

test('TEST-1351:Verify the system display price only for ServeDefaultLeaseLengh when AllowExpandLeaseLength is false', async t => {
  const testData = {
    fullName: 'Frank Frodo',
    phoneNumber: '18008001212',
    email: 'frankfrodo@play.web',
  };
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.Cove);
  await homepage.clickOnResult(PropertyNames.Cove);
  const propertyPage = new PropertyPage(t);

  await clickOnElement(t, { selector: propertyPage.PropertyInfoSelectors.FindApartmentButton });

  await propertyPage.clickLayoutButton('1 Bedroom');

  const inventoryDialog = new InventoryDialog(t);

  await inventoryDialog.clickOnASpecificUnit('1-001SALT');

  await inventoryDialog.clickButtonByText('GET PERSONALIZED PRICE');

  await t.typeText(inventoryDialog.selectors.NameInput, testData.fullName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, testData.phoneNumber, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, testData.email, { replace: true });

  await inventoryDialog.clickButtonByText('Next');

  const expectedLeaseTermsAndPrices = [
    {
      leaseTerm: 12,
      leasePrice: '$3421 / mo',
    },
    {
      leaseTerm: 6,
      leasePrice: '$3421 / mo',
    },
    {
      leaseTerm: 3,
      leasePrice: '$3421 / mo',
    },
  ];
  await inventoryDialog.checkDefaultLeasesWithPriceAreDisplayed(expectedLeaseTermsAndPrices);
  await inventoryDialog.checkDefaultLeasesWithNoPriceAreNotDisplayed();

  await inventoryDialog.checkButtonIsNotPresentByText('Show all lease term options');

  const notExpectedLeaseTerms = ['4', '5', '7', '8', '9', '10', '11', '13', '14'];
  await inventoryDialog.checkNonDefaultLeasesWithPriceAreNotDisplayed(notExpectedLeaseTerms);
});

test('TEST-1349:Verify the price default and expand lease term regarding the Property Settings set up and state LT', async t => {
  const flowData = {
    legalName: 'Timmy Madison',
    email: 'timmymadison@gmail.com',
    phoneRaw: '18008003220',
  };

  const homepage = new Homepage(t);
  const propertyPage = new PropertyPage(t);

  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult(PropertyNames.Parkmerced);

  await propertyPage.clickLayoutButton('2 Bedrooms');

  const inventoryDialog = new InventoryDialog(t);
  await inventoryDialog.clickOnASpecificUnit('350 Arballo-1015');

  await inventoryDialog.clickButtonByText('Get Personalized Price');
  await t.typeText(inventoryDialog.selectors.NameInput, flowData.legalName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, flowData.phoneRaw, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, flowData.email, { replace: true });
  await inventoryDialog.clickButtonByText('Next');

  const expectedParkmercedDefaultLeaseTerms = [
    {
      leaseTerm: '6',
      leasePrice: '$2246 / mo',
    },
    {
      leaseTerm: '12',
      leasePrice: '$2042 / mo',
    },
  ];

  const unexpectedLeaseTerm = ['9', '1', '15', '24', '18', '10'];

  await inventoryDialog.checkDefaultLeasesWithPriceAreDisplayed(expectedParkmercedDefaultLeaseTerms);
  await inventoryDialog.checkNonDefaultLeasesWithPriceAreNotDisplayed(unexpectedLeaseTerm);
  await inventoryDialog.clickButtonByText('Show all lease term options');

  const expectedParkmercedExpandedLeaseTerms = [
    {
      leaseTerm: '24',
      leasePrice: '$1837 / mo',
    },
    {
      leaseTerm: '15',
      leasePrice: '$2042 / mo',
    },
    {
      leaseTerm: '12',
      leasePrice: '$2042 / mo',
    },
    {
      leaseTerm: '9',
      leasePrice: '$2144 / mo',
    },
    {
      leaseTerm: '6',
      leasePrice: '$2246 / mo',
    },
  ];

  const unexpectedLeaseTermAfterExpand = ['18', '1', '10'];

  await inventoryDialog.checkDefaultLeasesWithPriceAreDisplayed(expectedParkmercedExpandedLeaseTerms);
  await inventoryDialog.checkNonDefaultLeasesWithPriceAreNotDisplayed(unexpectedLeaseTermAfterExpand);
});

test('TEST-1347:Verify warning message when the move-in-date is after the availability date', async t => {
  const homepage = new Homepage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult('Sierra Norte, Sioux Falls, South Dakota');

  const propertyPage = new PropertyPage(t);

  await propertyPage.clickLayoutButton('1 Bedroom');
  await inventoryDialog.clickOnASpecificUnit('1-102');

  await inventoryDialog.clickButtonByText('Get personalized price');

  await inventoryDialog.selectDateAfterAvailabilityDay();

  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.NameInput, 'Jan Oort');
  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.PhoneInput, '5003001515');
  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.EmailInput, 'janoort@darkmatter.com');

  const enteredDate = await inventoryDialog.getEnteredDate();

  await inventoryDialog.clickButtonByText('Next');

  await inventoryDialog.checkExactRentMessage();

  await t.expect(await $(inventoryDialog.selectors.ClosestDateWithAvailableRent).getAttribute('value')).notEql(enteredDate);

  await inventoryDialog.clickButtonByText('Back');

  await t.expect(await $(inventoryDialog.selectors.MoveInDate).getAttribute('value')).eql(enteredDate);
});

test('TEST-1348:Verify warning message when the move-in-date is before the availability date', async t => {
  const homepage = new Homepage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult('Sierra Norte, Sioux Falls, South Dakota');

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickLayoutButton('1 Bedroom');
  await inventoryDialog.clickOnASpecificUnit('1-102');

  await inventoryDialog.clickButtonByText('Get personalized price');

  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.NameInput, 'Edmond Halley');
  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.PhoneInput, '6004003232');
  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.EmailInput, 'halley@comet.com');

  const enteredDate = await inventoryDialog.getEnteredDate();

  await inventoryDialog.clickButtonByText('Next');
  await inventoryDialog.checkUnavailableRentMessage();

  await t.expect(await $(inventoryDialog.selectors.ClosestDateWithAvailableRent).getAttribute('value')).notEql(enteredDate);

  await inventoryDialog.clickButtonByText('Back');

  await t.expect(await $(inventoryDialog.selectors.MoveInDate).getAttribute('value')).eql(enteredDate);
});

test('TEST-1404: Check marketing questions on GetPersonalizedPrice screen', async t => {
  const homepage = new Homepage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Cove);
  await homepage.clickOnResult('The Cove at Tiburon, New York City, New York');

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickLayoutButton('1 Bedroom');
  await inventoryDialog.clickOnASpecificUnit('1-005SALT');

  await inventoryDialog.clickButtonByText('Get personalized price');

  const marketingQuestions = ['Do you have pets', 'Do you have service animals?', 'Do you need additional storage?'];
  const questionsOrder = [1, 2, 3];
  await inventoryDialog.checkMarketingQuestionTitle();
  await inventoryDialog.checkMarketingQuestions(questionsOrder, marketingQuestions);

  const answers = {
    pet: {
      selectorRadioButton: inventoryDialog.selectors.PetYesRadioButton,
      selectorDropdown: inventoryDialog.selectors.PetDropdown,
      selectorDropdownQuantityItem: inventoryDialog.selectors.PetDropdownQuantityItems,
      quantity: '2',
      selectorAnswer: inventoryDialog.selectors.PetDropdownAnswer,
    },
    serviceAnimal: {
      selectorRadioButton: inventoryDialog.selectors.ServiceAnimalYesRadioButton,
      selectorDropdown: inventoryDialog.selectors.ServiceAnimalDropdown,
      selectorDropdownQuantityItem: inventoryDialog.selectors.ServiceAnimalDropdownQuantityItems,
      quantity: '1',
      selectorAnswer: inventoryDialog.selectors.ServiceAnimalDropdownAnswer,
    },
    storage7X7: {
      selectorRadioButton: inventoryDialog.selectors.StoragePrimaryYesRadioButton,
      selectorDropdown: inventoryDialog.selectors.StorageDropdownPrimaryAnswear,
      selectorDropdownQuantityItem: inventoryDialog.selectors.StorageDropdownQuantityItems,
      quantity: '3',
      selectorAnswer: inventoryDialog.selectors.StorageDropdownPrimaryAnswer,
    },
  };

  await inventoryDialog.checkPetFollowupQuestion();
  await inventoryDialog.pickQuantity(answers.pet);
  await inventoryDialog.checkSelectedQuantity(answers.pet);
  await clickOnElement(t, { selector: inventoryDialog.selectors.PetNoRadioButton });
  await inventoryDialog.checkPetDropdownNotDisplayed();
  await clickOnElement(t, { selector: inventoryDialog.selectors.PetYesRadioButton });
  await inventoryDialog.checkSelectedQuantity(answers.pet);

  await inventoryDialog.checkServiceAnimalFollowupQuestion();
  await inventoryDialog.pickQuantity(answers.serviceAnimal);
  await inventoryDialog.checkSelectedQuantity(answers.serviceAnimal);
  await clickOnElement(t, { selector: inventoryDialog.selectors.ServiceAnimalNoRadioButton });
  await inventoryDialog.checkServiceAnimalDropdownNotDisplayed();
  await clickOnElement(t, { selector: inventoryDialog.selectors.ServiceAnimalYesRadioButton });
  await inventoryDialog.checkSelectedQuantity(answers.serviceAnimal);

  const storagePrimaryQuestions = [
    'Do you need 7x7 storage?',
    'Do you need 7x8 storage?',
    'Do you need 7x9 storage?',
    'Do you need 8x7 storage?',
    'Do you need 10x9 storage?',
    'Do you need 11x9 storage?',
    'Do you need 13x9 storage?',
  ];

  await inventoryDialog.checkStoragePrimaryQuestions(storagePrimaryQuestions);
  await clickOnElement(t, { selector: inventoryDialog.selectors.StoragePrimaryNoRadioButton });
  await inventoryDialog.checkStoragelDropdownNotDisplayed();

  await inventoryDialog.pickQuantity(answers.storage7X7);
  await inventoryDialog.checkSelectedQuantity(answers.storage7X7);

  await inventoryDialog.clickButtonByText('back');
  await inventoryDialog.clickButtonByText('Get personalized price');

  await inventoryDialog.checkSelectedQuantity(answers.pet);
  await inventoryDialog.checkSelectedQuantity(answers.serviceAnimal);
  await inventoryDialog.checkSelectedQuantity(answers.storage7X7);

  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.NameInput, 'Sophie Barty');
  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.PhoneInput, '6004003233');
  await inventoryDialog.typeIntoGetPriceForm(inventoryDialog.selectors.EmailInput, 'sophie@comet.com');
  await inventoryDialog.clickButtonByText('next');
  await inventoryDialog.clickButtonByText('back');

  await inventoryDialog.checkSelectedQuantity(answers.pet);
  await inventoryDialog.checkSelectedQuantity(answers.serviceAnimal);
  await inventoryDialog.checkSelectedQuantity(answers.storage7X7);
});
