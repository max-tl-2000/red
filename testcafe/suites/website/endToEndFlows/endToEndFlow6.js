/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { Selector as $ } from 'testcafe';
import Homepage from '../../../pages/website/homepage';
import AboutPage from '../../../pages/website/aboutPage';
import SearchResultsPage from '../../../pages/website/searchResultsPage';
import ContactUsDialog from '../../../pages/website/contactUsDialog';
import PropertyPage from '../../../pages/website/propertyPage';
import PartyPhaseOne from '../../../pages/partyPhaseOne';
import InventoryDialog from '../../../pages/website/inventoryDialog';
import DashboardPage from '../../../pages/dashboardPage';
import LeaseApplicationPage from '../../../pages/leaseApplicationPage';
import { getWebsiteURL, getTenantURL, loginAs, getUserPassword, expectDashboardLaneContains, clickOnCard, clickOnElement } from '../../../helpers/helpers';
import { validateDashboardVisible } from '../../../helpers/dashboardHelpers';
import { selectTimeSlot } from '../../../helpers/bookerWidgetHelpers';
import { setHooks } from '../../../helpers/hooks';
import { PropertyNames } from '../../../helpers/websiteConstants';
import PartyDetailPage from '../../../pages/partyDetailPage';
import { now } from '../../../../common/helpers/moment-utils';
import {
  SHORT_DAY_OF_MONTH_FORMAT,
  MONTH_DATE_YEAR_FORMAT,
  LA_TIMEZONE,
  SHORT_DATE_FORMAT,
  MONTH_DATE_YEAR_LONG_FORMAT,
  DATE_US_FORMAT,
} from '../../../../common/date-constants';

setHooks(fixture('End To End Flow 6'), {
  skipDatabaseRestore: false,
  beforeEach: async t => {
    await t.resizeWindow(375, 812);
    await t.navigateTo(getWebsiteURL('/'));
  },
});

const flowData = {
  legalName: `April Sun${newUUID()}`,
  email: `che${newUUID()}@april.com`,
  phone: '18008001111',
  inquiryMessage: 'April is here!',
};

const flowDataTour = {
  legalName: `May Sun${newUUID()}`,
  email: `che${newUUID()}@may.com`,
  phone: '18008002222',
};

const flowDataQuote = {
  legalName: `June Sun${newUUID()}`,
  email: `che${newUUID()}@june.com`,
  phone: '18008003333',
};

const userInfo = { user: 'admin@reva.tech', password: getUserPassword() };

const marketingQuestions = ['Do you have pets', 'Do you have service animals?', 'Do you need additional storage?'];
const questionsOrder = [1, 2, 3];

const visibleQuantityDataPet = ['1', '2'];
const notPresentItemValuePet = '3';

const visibleQuantityDataService = ['1', '2', '3', '4', '5'];
const notPresentItemValueService = '6';

const visibleQuantityDataStorage = ['1', '2', '3'];
const notPresentItemValueStorage = '4';

const storagePrimaryQuestions = [
  'Do you need 7x7 storage?',
  'Do you need 7x8 storage?',
  'Do you need 7x9 storage?',
  'Do you need 8x7 storage?',
  'Do you need 10x9 storage?',
  'Do you need 11x9 storage?',
  'Do you need 13x9 storage?',
];

const qualificationQuestionsAnswers = [
  {
    selector: 'numberBedroomsTxt',
    answer: '2 beds',
  },
  {
    selector: 'leaseTypeTxt',
    answer: 'Not Yet Determined',
  },
  {
    selector: 'monthlyIncomeTxt',
    answer: 'Unknown',
  },
];

const qualificationQuestionsAnswersTour = [
  ...qualificationQuestionsAnswers,
  {
    selector: 'moveInDatePreferenceTxt',
    answer: '2 - 4 months',
  },
];

const qualificationQuestionsAnswersQuote = [
  ...qualificationQuestionsAnswers,
  {
    selector: 'moveInDatePreferenceTxt',
    answer: 'Within the next 4 weeks',
  },
];

const contactUsFormText = 'Thank you for contacting us';
const concernFormText = 'Thank you for submitting your concerns';

const completeInventoryDialog = async (t, data, inventoryDialog) => {
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleNameInput, data.legalName);
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleEmailInput, data.email);
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleMobilePhoneInput, data.phone);
  await inventoryDialog.clickOnMoveInRangeDropdown();
  await inventoryDialog.clickOnMoveInRangeItem();

  await inventoryDialog.clickButtonByText('Confirm your appointment');
  await inventoryDialog.verifyThankYouPageScheduleTour();
  await inventoryDialog.clickContinueExploringButton();
};

const checkWarningMessagesForInvalidData = async (t, text, contactUsDialog, aboutPage, emailSelector) => {
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.PhoneNumberField, '800800aaaa');
  await t.pressKey('tab');
  await aboutPage.checkFieldWarningMessage('Enter a valid phone number');

  await contactUsDialog.typeIntoContactUsForm(emailSelector, 'saymyname.com');
  await t.pressKey('tab');
  await aboutPage.checkFieldWarningMessage('Enter a valid email');

  await aboutPage.submitForm();

  await aboutPage.checkFormIsNotSubmitted(text);
};

test('TEST-1401:End to end flow 6: Mobile User', async t => {
  const homepage = new Homepage(t);
  const aboutPage = new AboutPage(t);
  const contactUsDialog = new ContactUsDialog(t);
  const searchResultsPage = new SearchResultsPage(t);
  const propertyPage = new PropertyPage(t);
  const partyPhaseOne = new PartyPhaseOne(t);
  const partyDetailPage = new PartyDetailPage(t);
  const inventoryDialog = new InventoryDialog(t);
  const dashboardPage = new DashboardPage(t);
  const leasePage = new LeaseApplicationPage(t);

  await homepage.isDisplayed();
  await clickOnElement(t, { selector: homepage.selectors.MobileNavMenuButton });
  await homepage.checkMobileNavMenuItems();
  await clickOnElement(t, { selector: $(homepage.selectors.MobileNavMenuItemsButton).withText('About') });

  // check warning messages for blank fields - Contact Us form
  await clickOnElement(t, { selector: aboutPage.selectors.SendMessageButton });

  await aboutPage.submitForm();
  await aboutPage.checkDropdownWarningMessage('Department selection is required');
  await aboutPage.checkFieldWarningMessage('Full Name is required');
  await aboutPage.checkFieldWarningMessage('Email is required');
  await aboutPage.checkFieldWarningMessage('Message is required');
  await aboutPage.checkFormIsNotSubmitted(contactUsFormText);

  await aboutPage.selectDepartment();
  await t.pressKey('tab');
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.LegalNameField, flowData.legalName);
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.MessageField, flowData.inquiryMessage);

  await aboutPage.submitForm();
  await aboutPage.checkFieldWarningMessage('Email is required');
  await aboutPage.checkFormIsNotSubmitted(contactUsFormText);

  // check warning messages for invalid data - Contact Us form
  await checkWarningMessagesForInvalidData(t, concernFormText, contactUsDialog, aboutPage, aboutPage.selectors.EmailFieldContactUs);

  // check form is submitted for valid data - Contact Us form
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.PhoneNumberField, flowData.phone);
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.EmailFieldContactUs, flowData.email);

  await aboutPage.submitForm();
  await t.wait(500);
  await aboutPage.checkFormIsSubmitted(contactUsFormText);
  await clickOnElement(t, { selector: $(aboutPage.selectors.CloseThankYouPageButton).withText('CLOSE') });

  // check warning messages for blank fields - Customer Concerns form
  await clickOnElement(t, { selector: aboutPage.selectors.SendFeedbackButton });
  await aboutPage.submitForm();
  await aboutPage.checkSearchFieldWarningMessage('Community selection is required');
  await aboutPage.checkFieldWarningMessage('Message is required');
  await aboutPage.checkFormIsNotSubmitted(concernFormText);

  // check warning messages for invalid data - Customer Concerns form
  await checkWarningMessagesForInvalidData(t, concernFormText, contactUsDialog, aboutPage, aboutPage.selectors.EmailFieldConcerns);

  // check form is submitted for valid data - Customer Concerns form
  await aboutPage.searchForProperty();
  await aboutPage.checkSearchResult();
  await aboutPage.pickCommunity();
  await t.pressKey('tab');
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.LegalNameFieldConcerns, flowData.legalName);
  await t.pressKey('tab');
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.PhoneNumberField, flowData.phone);
  await t.pressKey('tab');
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.EmailFieldConcerns, flowData.email);
  await t.pressKey('tab');
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.MessageField, flowData.inquiryMessage);

  // TODO: uncomment next two lines after submit issue will be fixed on CPM-17372;
  // await aboutPage.submitForm();
  // await aboutPage.checkFormIsSubmitted(concernFormText);

  await t.pressKey('esc');

  // check form is submitted only with required data - Customer Concerns form
  await clickOnElement(t, { selector: aboutPage.selectors.SendFeedbackButton });
  await aboutPage.searchForProperty();
  await aboutPage.checkSearchResult();
  await aboutPage.pickCommunity();
  await contactUsDialog.typeIntoContactUsForm(aboutPage.selectors.MessageField, flowData.inquiryMessage);

  // TODO: uncomment next two lines after submit issue will be fixed on CPM-17372;
  // await aboutPage.submitForm();
  // await aboutPage.checkFormIsSubmitted(concernFormText);

  await t.pressKey('esc');

  await homepage.navigateThroughLogo();
  await homepage.isDisplayed();

  await homepage.checkMarketsOverlay();

  await homepage.navigateThroughMarketsOverlay();
  await searchResultsPage.isSearchResultsPageDisplayedMobile();

  // check search result page
  const BayAreaProperties = [PropertyNames.Coastal, PropertyNames.Seascape, PropertyNames.Lakefront];
  await searchResultsPage.checkPropertyCardsArePresent(t, BayAreaProperties);

  await searchResultsPage.checkMobileSectionTabs();
  await searchResultsPage.checkMobileMapTab();
  await searchResultsPage.checkMobileListTab();

  await searchResultsPage.checkMobileFiltersOverlay();
  await searchResultsPage.pickFilterForNoResults();
  await searchResultsPage.checkNoMatchFoundState(BayAreaProperties);

  await clickOnElement(t, { selector: $(searchResultsPage.selectors.PropertyCard).withText('Seascape Sunset') });
  await propertyPage.isMobilePropertyPageDisplayed();

  await propertyPage.checkInputFieldValue(propertyPage.PropertyInfoSelectors.MobileSearchBoxInput, 'Seascape Sunset');

  await propertyPage.checkMobilePropertyTabs(t, propertyPage.selectors.MobilePropertyTabs);

  await clickOnElement(t, { selector: $(propertyPage.selectors.MobilePropertyTabs).withText('DESCRIPTION') });
  await propertyPage.checkMobileNavigationPropertyTabs();

  await clickOnElement(t, { selector: $(propertyPage.selectors.RelatedPropertyCard).withText('Coastal Palace') });
  await propertyPage.isMobilePropertyPageDisplayed();
  await propertyPage.checkInputFieldValue(propertyPage.PropertyInfoSelectors.MobileSearchBoxInput, 'Coastal Palace');

  await clickOnElement(t, { selector: homepage.selectors.MobileNavMenuButton });
  await clickOnElement(t, { selector: $(homepage.selectors.MobileNavMenuItemsButton).withText('Home') });

  await homepage.typeIntoSearch(PropertyNames.Cove);
  await homepage.clickOnResult(PropertyNames.Cove);
  await propertyPage.isMobilePropertyPageDisplayed();
  await propertyPage.checkInputFieldValue(propertyPage.PropertyInfoSelectors.MobileSearchBoxInput, 'The Cove at Tiburon');

  // contact us flow party verifications
  await propertyPage.clickMobileContactUsButton();

  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.FullNameInput, flowData.legalName);
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.PhoneInput, flowData.phone);
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.EmailInput, flowData.email);
  await contactUsDialog.clickOnMoveInRangeDropdown();
  await contactUsDialog.clickOnMoveInRangeItem();
  await contactUsDialog.typeIntoContactUsForm(contactUsDialog.selectors.AdditionalCommentsInput, flowData.inquiryMessage);

  await contactUsDialog.submitContactUsForm();

  await contactUsDialog.checkThankYouPage();

  await t.pressKey('esc');

  await t.resizeWindow(1920, 1080);

  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  await dashboardPage.clickOnDropDownAgentsList();
  await dashboardPage.clickOnLeasingTeamItem('BayAreaCallCenter_optionItem');
  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: $('#switchTodayOnly') });

  const expectedCard = { lane: '#contacts', cardText: flowData.legalName };
  await expectDashboardLaneContains(t, expectedCard);
  await clickOnCard(t, expectedCard);

  await partyPhaseOne.checkPartyMember(flowData.legalName);

  await partyPhaseOne.clickOnWebInqury();

  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.formattedPhone);

  await partyPhaseOne.checkInquiryMessageMoveInDate('Move in date: 2 - 4 months');
  await partyPhaseOne.checkInquiryMessageContent(flowData.inquiryMessage);

  const summaryDataContactUs = {
    interestedProperty: 'The Cove at Tiburon',
    source: 'The Cove website',
    initialChannel: 'Web',
  };
  await partyDetailPage.checkPartySummarySection(summaryDataContactUs);

  await t.resizeWindow(375, 812);

  // Schedule tour flow party verifications
  await t.navigateTo(getWebsiteURL('/'));

  await homepage.typeIntoSearch(PropertyNames.Cove);
  await homepage.clickOnResult(PropertyNames.Cove);

  await propertyPage.clickLayoutButton('2 Bedrooms');
  await inventoryDialog.clickOnASpecificUnit('1-011SALT');

  await clickOnElement(t, { selector: $(inventoryDialog.selectors.DialogContainerButtons).withText('SCHEDULE A TOUR') });

  const currentDate = now({ timezone: LA_TIMEZONE }).format(SHORT_DAY_OF_MONTH_FORMAT);

  const currentDatePlusOne = now({ timezone: LA_TIMEZONE }).add(1, 'days').format(SHORT_DAY_OF_MONTH_FORMAT);

  const currentDatePlusTwo = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(SHORT_DAY_OF_MONTH_FORMAT);

  const appointmentDate = now({ timezone: LA_TIMEZONE }).add(2, 'days').format('MMM D');

  const appointmentLongDate = now({ timezone: LA_TIMEZONE }).add(2, 'days').format(MONTH_DATE_YEAR_LONG_FORMAT);

  await propertyPage.checkMobileTourCalendar([currentDate, currentDatePlusOne, currentDatePlusTwo]);

  const tourTimeFormated = await selectTimeSlot(t, 2, 1, LA_TIMEZONE);

  await completeInventoryDialog(t, flowDataTour, inventoryDialog);

  await t.resizeWindow(1920, 1080);

  await t.navigateTo(getTenantURL('/'));
  await validateDashboardVisible(t);
  await dashboardPage.clickOnDropDownAgentsList();
  await dashboardPage.clickOnLeasingTeamItem('BayAreaCallCenter_optionItem');
  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: $('#switchTodayOnly') });

  const expectedCardTour = { lane: '#leads', cardText: flowDataTour.legalName };
  await expectDashboardLaneContains(t, expectedCardTour);
  await clickOnCard(t, expectedCardTour);

  await partyDetailPage.clickOnManagePartyDetailsButton();

  await partyDetailPage.checkQualificationQuestionsAnswers(t, qualificationQuestionsAnswersTour);
  await partyDetailPage.closeManagePartyDetailsPage();

  const moveInStartDateTour = now({ timezone: LA_TIMEZONE }).add(2, 'months').format(SHORT_DATE_FORMAT);

  const moveInFinalDateTour = now({ timezone: LA_TIMEZONE }).add(4, 'months').format(MONTH_DATE_YEAR_FORMAT);

  const summaryDataTour = {
    interestedProperty: 'The Cove at Tiburon',
    source: 'The Cove website',
    layout: '2 beds',
    moveInDate: `${moveInStartDateTour} - ${moveInFinalDateTour}`,
  };

  await partyDetailPage.checkPartySummarySection(summaryDataTour);

  const expectedTaskCards = {
    status: 'check',
    name: 'Introduce yourself',
    details: 'Today',
  };

  await partyPhaseOne.clickOnShowCompletedTaskButton();
  await partyPhaseOne.checkExpectedTasks(t, expectedTaskCards);

  const taskOwnerName = await partyPhaseOne.extractTaskOwner();

  const expectedAppointment = {
    title: `Upcoming: ${appointmentDate}, ${tourTimeFormated} PDT with ${taskOwnerName} [Self book]`,
    legalName: flowDataTour.legalName,
    unit: 'cove-1-011SALT',
  };

  await partyPhaseOne.checkExpectedAppointmentCards({ expectedAppointment, hasAUnit: false });

  const expectedSmsText = `Your appointment has been confirmed for ${appointmentLongDate} at ${tourTimeFormated}. You will meet with ${taskOwnerName} at our Leasing Office located at 728 Main St, New York City, NY 10044. If you would like to modify or cancel this appointment, simply reply to this text message with your change.`;

  const expectedWebInquiryScheduleTour = {
    campaignType: '[website-property] Self book appointment',
    senderName: flowDataTour.legalName,
    unit: '1-011SALT',
  };

  const expectedEmailSubject = `Appointment confirmed - ${PropertyNames.Cove}`;

  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiryScheduleTour);
  await partyPhaseOne.checkSmsStructure(expectedSmsText, flowDataTour.legalName);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject, flowDataTour.legalName);

  await partyPhaseOne.clickOnWebInqury();

  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowDataTour.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowDataTour.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowDataTour.formattedPhone);

  await partyPhaseOne.closeFlyout();

  await t.resizeWindow(375, 812);

  // self quote flow party verifications
  await t.navigateTo(getWebsiteURL('/'));

  await homepage.typeIntoSearch(PropertyNames.Cove);
  await homepage.clickOnResult(PropertyNames.Cove);

  await propertyPage.clickLayoutButton('2 Bedrooms');
  await inventoryDialog.clickOnASpecificUnit('1-011SALT');
  await inventoryDialog.clickButtonByText('GET PERSONALIZED PRICE');

  await t.typeText(inventoryDialog.selectors.NameInput, flowDataQuote.legalName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, flowDataQuote.phone, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, flowDataQuote.email, { replace: true });

  await inventoryDialog.checkMarketingQuestionTitle();

  await inventoryDialog.checkMarketingQuestions(questionsOrder, marketingQuestions);

  await inventoryDialog.checkPetFollowupQuestion();

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataPet,
    notPresentItemValuePet,
    inventoryDialog.selectors.PetDropdown,
    inventoryDialog.selectors.PetDropdownQuantityItems,
  );

  await clickOnElement(t, { selector: inventoryDialog.selectors.PetNoRadioButton });

  await inventoryDialog.checkPetDropdownNotDisplayed();

  await inventoryDialog.pickTwoPets();

  await inventoryDialog.checkServiceAnimalFollowupQuestion();

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataService,
    notPresentItemValueService,
    inventoryDialog.selectors.ServiceAnimalDropdown,
    inventoryDialog.selectors.ServiceAnimalDropdownQuantityItems,
  );

  await clickOnElement(t, { selector: inventoryDialog.selectors.ServiceAnimalNoRadioButton });

  await inventoryDialog.checkServiceAnimalDropdownNotDisplayed();

  await inventoryDialog.pickOneServiceAnimal();

  await inventoryDialog.checkServiceAnimalFollowupQuestion();

  await inventoryDialog.checkStoragePrimaryQuestions(storagePrimaryQuestions);

  await clickOnElement(t, { selector: inventoryDialog.selectors.StoragePrimaryYesRadioButton });

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataStorage,
    notPresentItemValueStorage,
    inventoryDialog.selectors.StorageDropdown,
    inventoryDialog.selectors.StorageDropdownQuantityItems,
  );

  await clickOnElement(t, { selector: inventoryDialog.selectors.StoragePrimaryNoRadioButton });

  await inventoryDialog.checkStoragelDropdownNotDisplayed();

  await inventoryDialog.pickOne7x7storage();

  await inventoryDialog.clickButtonByText('Next');

  await clickOnElement(t, { selector: inventoryDialog.selectors.SixMonthsLeaseTerm });
  await inventoryDialog.clickButtonByText('Send it to me');

  await t.resizeWindow(1920, 1080);

  await t.navigateTo(getTenantURL('/'));
  await validateDashboardVisible(t);
  await dashboardPage.clickOnDropDownAgentsList();
  await dashboardPage.clickOnLeasingTeamItem('BayAreaCallCenter_optionItem');
  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: $('#switchTodayOnly') });

  const expectedCardQuote = { lane: '#prospects', cardText: flowDataQuote.legalName };
  await expectDashboardLaneContains(t, expectedCardQuote);
  await clickOnCard(t, expectedCardQuote);
  await partyDetailPage.clickOnManagePartyDetailsButton();
  await partyDetailPage.checkOnlyOneMemberInTheParty();

  await partyDetailPage.checkQualificationQuestionsAnswers(t, qualificationQuestionsAnswersQuote);

  await partyDetailPage.closeManagePartyDetailsPage();
  const moveInStartDateQuote = now({ timezone: LA_TIMEZONE }).format(SHORT_DATE_FORMAT);

  const moveInFinalDateQuote = now({ timezone: LA_TIMEZONE }).add(1, 'months').format(MONTH_DATE_YEAR_FORMAT);

  const summaryDataQuote = {
    interestedProperty: 'The Cove at Tiburon',
    source: 'The Cove website',
    pets: '0',
    guarantors: '0',
    moveInDate: `${moveInStartDateQuote} - ${moveInFinalDateQuote}`,
  };

  const startDate = now({ timezone: LA_TIMEZONE }).format(DATE_US_FORMAT);

  const quoteSectionInfos = {
    unitName: '011SALT',
    selfServeTag: 'Self serve',
    leaseStartDate: startDate,
    baseRent: '$4,225.00',
    leaseTerm: '6m',
  };

  const feeDetails = [
    {
      title: 'Pet rent',
      quantity: '2',
      amount: '$70.00',
    },
    {
      title: 'Service animal rent',
      quantity: '1',
      amount: '$0.00',
    },
    {
      title: 'Storage Barb/Bld13 7x7',
      quantity: '1',
      amount: '$175.00',
    },
  ];

  await partyDetailPage.checkPartySummarySection(summaryDataQuote);

  await partyDetailPage.checkTheQuoteSection(quoteSectionInfos);

  await leasePage.createLease();
  await leasePage.checkFeesInLeaseForm(feeDetails);
  await leasePage.checkPublishLeaseDialogIsDisplayed();
});
