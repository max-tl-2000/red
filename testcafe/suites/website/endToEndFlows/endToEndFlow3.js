/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import newUUID from 'uuid/v4';
import Homepage from '../../../pages/website/homepage';
import PropertyPage from '../../../pages/website/propertyPage';
import { getWebsiteURL, getTenantURL, loginAs, expectDashboardLaneContains, getUserPassword, clickOnCard, clickOnElement } from '../../../helpers/helpers';
import { validateDashboardVisible } from '../../../helpers/dashboardHelpers';
import { selectTimeSlot } from '../../../helpers/bookerWidgetHelpers';
import { PropertyNames, PropertyTimezone } from '../../../helpers/websiteConstants';
import { setHooks } from '../../../helpers/hooks';
import InventoryDialog from '../../../pages/website/inventoryDialog';
import DashboardPage from '../../../pages/dashboardPage.js';
import PartyDetailPage from '../../../pages/partyDetailPage';
import PartyPhaseOne from '../../../pages/partyPhaseOne';
import { now } from '../../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_FORMAT, MONTH_DATE_YEAR_LONG_FORMAT, SHORT_DATE_FORMAT } from '../../../../common/date-constants';

setHooks(fixture('End To End Flow 3'), {
  skipDatabaseRestore: false,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

let _flowData;

const getFlowData = () => {
  if (!_flowData) {
    _flowData = {
      legalName: `Giordano Bruno ${newUUID()}`,
      email: `giordano${newUUID()}@gmail.com`,
      phoneRaw: '18008001234',
      formattedPhone: '(800) 800-1234',
      phoneFormattedContactForm: '800-800-1234',
      inquryMessage: 'A inqury message',
      contactSummary: '1 phone, 1 email',
    };
  }
  return _flowData;
};

const qualificationQuestionsAnswers = [
  {
    selector: 'leaseTypeTxt',
    answer: 'Not Yet Determined',
  },
  {
    selector: 'monthlyIncomeTxt',
    answer: 'Unknown',
  },
  {
    selector: 'moveInDatePreferenceTxt',
    answer: '2 - 4 months',
  },
];

const _qualificationQuestionsAnswers2Beds = [
  ...qualificationQuestionsAnswers,
  {
    selector: 'numberBedroomsTxt',
    answer: '2 beds',
  },
];

const qualificationQuestionsAnswers3Beds = [
  ...qualificationQuestionsAnswers,
  {
    selector: 'numberBedroomsTxt',
    answer: '3 beds',
  },
];

const expectedTaskCards = {
  status: 'check',
  name: 'Introduce yourself',
  details: 'Today',
};

const sierraAppointmentLongDate = now({ timezone: 'America/Rainy_River' }).add(2, 'days').format(MONTH_DATE_YEAR_LONG_FORMAT);

const sierraAppointmentDateMoment = now({ timezone: 'America/Rainy_River' }).add(2, 'days');

const sierraAppointmentDate = sierraAppointmentDateMoment.format('MMM D');

const moveInStartDate = now({ timezone: 'America/Rainy_River' }).add(2, 'months').format(SHORT_DATE_FORMAT);

const moveInFinalDate = now({ timezone: 'America/Rainy_River' }).add(4, 'months').format(MONTH_DATE_YEAR_FORMAT);

const taskSectionDate = now({ timezone: 'America/Rainy_River' }).add(2, 'days').format('M/D z');

const summaryData = {
  interestedProperty: PropertyNames.SierraNorte,
  source: 'The Sierra website',
  initialChannel: 'The Sierra website',
  layout: '3 beds',
  moveInDate: `${moveInStartDate} - ${moveInFinalDate}`,
};

const completeInventoryDialog = async (t, flowData) => {
  const inventoryDialog = new InventoryDialog(t);
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleNameInput, flowData.legalName);
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleEmailInput, flowData.email);
  await t.typeText(inventoryDialog.ScheduleSelectors.ScheduleMobilePhoneInput, flowData.phoneRaw);
  await inventoryDialog.clickOnMoveInRangeDropdown();
  await inventoryDialog.clickOnMoveInRangeItem();

  await inventoryDialog.clickButtonByText('Confirm your appointment');
  await inventoryDialog.verifyThankYouPageScheduleTour();
  await inventoryDialog.clickContinueExploringButton();
};

const loginAsAdmin = async t => {
  await t.navigateTo(getTenantURL('/'));

  const userInfo = { user: 'admin@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
};

const navigateToSierraDashboard = async t => {
  const dashboardPage = new DashboardPage(t);
  await dashboardPage.clickOnDropDownAgentsList();
  await dashboardPage.clickOnLeasingTeamItem('SierraLeasing_optionItem');
};

const checkAndSelectPartyCard = async (t, flowData) => {
  const expectedCard = { lane: '#leads', cardText: flowData.legalName };
  await expectDashboardLaneContains(t, expectedCard);
  await clickOnCard(t, expectedCard);
};

const checkPartyDetailsAndQualificationAnswers = async (t, flowData, qqAnswers) => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnManagePartyDetailsButton();
  await partyDetailPage.checkOnlyOneMemberInTheParty();
  await partyDetailPage.checkPartyResidentDetails(flowData);

  await partyDetailPage.checkQualificationQuestionsAnswers(t, qqAnswers);
  await partyDetailPage.closeManagePartyDetailsPage();
};

const checkPartySummarySectionAndTasks = async (t, expectedData) => {
  const { summary, taskCards } = expectedData;

  const partyDetailPage = new PartyDetailPage(t);
  const partyPhaseOne = new PartyPhaseOne(t);

  await partyDetailPage.checkPartySummarySection(summary);
  await partyPhaseOne.moreChecksOnPartySummarySection(summary);

  await partyPhaseOne.clickOnShowCompletedTaskButton();
  await partyPhaseOne.checkExpectedTasks(t, taskCards);
};

const checkInquiryMessages = async (t, flowData) => {
  const partyPhaseOne = new PartyPhaseOne(t);
  await partyPhaseOne.clickOnWebInqury();

  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(flowData.formattedPhone);
};

const checkWebInquiryNotificationAndTaskSection = async (t, flowData) => {
  const partyCardSelector = $('#leads [data-id="card"]').withText(flowData.legalName);
  const partyPhaseOne = new PartyPhaseOne(t);

  await partyPhaseOne.checkWebInquiryNotificationUnread(partyCardSelector);
  await partyPhaseOne.checkDownsideArrow(partyCardSelector);
  await partyPhaseOne.clickOnDownsideArrow(partyCardSelector);

  await partyPhaseOne.checkTaskSection(taskSectionDate);
};

test('TEST-1353:Schedule a tour - party verfications - without unit', async t => {
  const flowData = getFlowData();
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult(PropertyNames.SierraNorte);
  const propertyPage = new PropertyPage(t);

  await propertyPage.clickLayoutButton('3 Bedrooms');
  const partyPhaseOne = new PartyPhaseOne(t);

  await clickOnElement(t, { selector: $(partyPhaseOne.selectors.ScheduleATourButton).withText('SCHEDULE A TOUR') });

  const sierraTourTimeFormated = await selectTimeSlot(t, 2, 1, PropertyTimezone.Sierra);

  await completeInventoryDialog(t, flowData);

  await loginAsAdmin(t);

  await validateDashboardVisible(t);

  await navigateToSierraDashboard(t);

  await validateDashboardVisible(t);

  await clickOnElement(t, { selector: '#switchTodayOnly' });

  await checkAndSelectPartyCard(t, flowData);

  await checkPartyDetailsAndQualificationAnswers(t, flowData, qualificationQuestionsAnswers3Beds);

  await checkPartySummarySectionAndTasks(t, { summary: summaryData, taskCards: expectedTaskCards });

  const taskOwnerName = await partyPhaseOne.extractTaskOwner();

  const expectedAppointment = {
    title: `Upcoming: ${sierraAppointmentDate}, ${sierraTourTimeFormated} ${sierraAppointmentDateMoment.format('z')} with ${taskOwnerName} [Self book]`,
    legalName: flowData.legalName,
  };

  await partyPhaseOne.checkExpectedAppointmentCards({ expectedAppointment, hasAUnit: false });

  const expectedSmsText = `Your appointment has been confirmed for ${sierraAppointmentLongDate} at ${sierraTourTimeFormated}. You will meet with ${taskOwnerName} at our Leasing Office located at 3118 E Bragstad Dr Sioux Falls, SD, 57103. If you would like to modify or cancel this appointment, simply reply to this text message with your change.`;

  const expectedWebInquiryScheduleTour = {
    campaignType: '[website-property] Self book appointment',
    senderName: flowData.legalName,
    messageSection: `Self book appointment on ${sierraAppointmentDate}, ${sierraTourTimeFormated} ${sierraAppointmentDateMoment.format('z')}`,
  };

  const expectedEmailSubject = `Appointment confirmed - ${PropertyNames.SierraNorte}`;

  const checkMessageSection = true;
  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiryScheduleTour, checkMessageSection);
  await partyPhaseOne.checkSmsStructure(expectedSmsText, flowData.legalName);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject, flowData.legalName);

  await checkInquiryMessages(t, flowData);

  await partyPhaseOne.checkInquiryMessageMoveInDate(expectedWebInquiryScheduleTour.messageSection);

  await partyPhaseOne.closeFlyout();

  await partyPhaseOne.clickOnBackButton();

  await validateDashboardVisible(t);

  await checkWebInquiryNotificationAndTaskSection(t, flowData);
});

test('TEST-1353:Schedule a tour - party verfications - same slot with unit', async t => {
  const inventoryDialog = new InventoryDialog(t);
  const homepage = new Homepage(t);
  const flowData = getFlowData();
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult(PropertyNames.SierraNorte);

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickLayoutButton('2 Bedrooms');
  await inventoryDialog.clickOnASpecificUnit('1-103');

  await inventoryDialog.clickButtonByText('Schedule a tour');

  const sierraTourTimeFormated = await selectTimeSlot(t, 2, 1, PropertyTimezone.Sierra);

  await completeInventoryDialog(t, flowData);

  await loginAsAdmin(t);

  await validateDashboardVisible(t);

  await navigateToSierraDashboard(t);

  await validateDashboardVisible(t);

  await clickOnElement(t, { selector: '#switchTodayOnly' });

  await checkAndSelectPartyCard(t, flowData);

  await checkPartyDetailsAndQualificationAnswers(t, flowData, qualificationQuestionsAnswers3Beds);

  await checkPartySummarySectionAndTasks(t, {
    summary: { ...summaryData, layout: '3 beds' },
    taskCards: expectedTaskCards,
  });

  const partyPhaseOne = new PartyPhaseOne(t);

  const taskOwnerName = await partyPhaseOne.extractTaskOwner();

  const expectedAppointment = {
    title: `Upcoming: ${sierraAppointmentDate}, ${sierraTourTimeFormated} ${sierraAppointmentDateMoment.format('z')} with ${taskOwnerName} [Self book]`,
    legalName: flowData.legalName,
    unit: '1-103',
  };

  await partyPhaseOne.checkExpectedAppointmentCards({ expectedAppointment, hasAUnit: true });

  const expectedSmsText = `Your appointment has been confirmed for ${sierraAppointmentLongDate} at ${sierraTourTimeFormated}. You will meet with ${taskOwnerName} at our Leasing Office located at 3118 E Bragstad Dr Sioux Falls, SD, 57103. If you would like to modify or cancel this appointment, simply reply to this text message with your change.`;

  const expectedWebInquiryScheduleTour = {
    campaignType: '[website-property] Self book appointment',
    senderName: flowData.legalName,
  };

  const expectedEmailSubject = `Appointment confirmed - ${PropertyNames.SierraNorte}`;

  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiryScheduleTour);
  await partyPhaseOne.checkSmsStructure(expectedSmsText, flowData.legalName);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject, flowData.legalName);

  await checkInquiryMessages(t, flowData);

  await partyPhaseOne.closeFlyout();

  await partyPhaseOne.clickOnBackButton();

  await validateDashboardVisible(t);

  await checkWebInquiryNotificationAndTaskSection(t, flowData);
});

test('TEST-1353:Schedule a tour - party verifications - same unit, but different slot', async t => {
  const inventoryDialog = new InventoryDialog(t);
  const homepage = new Homepage(t);
  const flowData = getFlowData();
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult(PropertyNames.SierraNorte);

  const propertyPage = new PropertyPage(t);
  await propertyPage.clickLayoutButton('2 Bedrooms');
  await inventoryDialog.clickOnASpecificUnit('1-103');

  await inventoryDialog.clickButtonByText('Schedule a tour');

  await selectTimeSlot(t, 2, 2, PropertyTimezone.Sierra);

  await completeInventoryDialog(t, flowData);

  await loginAsAdmin(t);

  await validateDashboardVisible(t);

  await navigateToSierraDashboard(t);

  await validateDashboardVisible(t);

  await clickOnElement(t, { selector: '#switchTodayOnly' });

  await checkAndSelectPartyCard(t, flowData);

  await checkPartyDetailsAndQualificationAnswers(t, flowData, qualificationQuestionsAnswers3Beds);

  await checkPartySummarySectionAndTasks(t, {
    summary: summaryData,
    taskCards: expectedTaskCards,
  });

  const expectedWebInquiryScheduleTour = {
    campaignType: '[website-property] Self book appointment',
    senderName: flowData.legalName,
  };

  const expectedEmailSubject = `Appointment updated - ${PropertyNames.SierraNorte}`;

  const partyPhaseOne = new PartyPhaseOne(t);

  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiryScheduleTour);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject, flowData.legalName);

  await checkInquiryMessages(t, flowData);

  await partyPhaseOne.closeFlyout();

  await partyPhaseOne.clickOnBackButton();

  await validateDashboardVisible(t);

  await checkWebInquiryNotificationAndTaskSection(t, flowData);
});
