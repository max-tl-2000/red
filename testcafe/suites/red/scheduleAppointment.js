/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { t as trans } from 'i18next';
import { setHooks } from '../../helpers/hooks';
import WidgetPage from '../../pages/widgetPage';
import { loginAs, getTenantURL, getUserPassword, clickOnElement, expectVisible, getPathName } from '../../helpers/helpers';
import {
  validateDashboardVisible,
  clickOnCardInDashboard,
  clickSwitchTodayOnlyToggle,
  checkCardWithWebInquiryNotification,
  clickOnCardByResidentName,
} from '../../helpers/dashboardHelpers';
import { checkAgentsAvailabilityForAppointments, scheduleAppointmentForSpecificAgent, checkCommunicationType } from '../../helpers/appointmentHelper';
import { now } from '../../../common/helpers/moment-utils';
import { mockPartyData, getPartyOwnerEmailByName } from '../../helpers/mockDataHelpers';
import { createAParty } from '../../helpers/rentalApplicationHelpers';
import { LA_TIMEZONE, YEAR_MONTH_DAY_FORMAT, ISO_DATE_FORMAT_SHORT } from '../../../common/date-constants';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import { DALTypes } from '../../../common/enums/DALTypes';
import PartyPhaseOne from '../../pages/partyPhaseOne';
import FloatingAgentPage from '../../pages/floatingAgentPage';
import { createASelfQuote } from '../../helpers/bookerWidgetHelpers';
import DashboardPage from '../../pages/dashboardPage';
import PartyDetailPage from '../../pages/partyDetailPage';
import QuoteDraftPage from '../../pages/quoteDraftPage';

import loggerInstance from '../../../common/helpers/logger';
const logger = loggerInstance.child({ subType: 'Smoke: Seed - Scheduling' });

const ctx = { tenantId: TEST_TENANT_ID };

setHooks(fixture('Smoke: Seed - Scheduling').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'schedule',
});

test('TEST-1014:Navigation on the self-book widget', async t => {
  await t.navigateTo(getTenantURL('/websiteUtilsTest'));
  const widgetPage = new WidgetPage(t);
  await widgetPage.validateWidgetVisible(t);
  await t.typeText('#txtProgram', 'cove', { replace: true });
  await widgetPage.openRenderWidget(t);
  await widgetPage.checkWidgetFunctionality(t);
});

test('TEST-1155:Scheduling availability for floating agents', async t => {
  // Login as a RM agent
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const { partyInfo, qualificationInfo } = mockPartyData;
  const property = partyInfo.properties[1]; // Cove
  const contactInfo = {
    legalName: 'Andrew Larson',
    email: 'qatest+andrewlarson@reva.tech',
    preferredName: 'Andrew L.',
    phone: '+1 908 555 4622',
    formattedPhone: '(908) 555-4622',
    index: 1,
  };

  const mockData = {
    floatingAgentName: 'Tanya Francis',
    floatingAgentType: 'Leasing Agent',
    nonFloatingAgentName: 'Ida Munoz',
    checkRoatingAgentPage: true,
    teams: ['Cove Leasing', 'Bay Area Call Center'],
    avabilitySetUp: [
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(1, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Cove Leasing',
      },
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(2, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Cove Leasing',
      },
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(3, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Bay Area Call Center',
      },
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(4, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Bay Area Call Center',
      },
    ],
    avabilityDaysPerTeam: [
      {
        team: 'Cove Leasing',
        availableDays: [now({ timezone: LA_TIMEZONE }).add(1, 'days'), now({ timezone: LA_TIMEZONE }).add(2, 'days')],
        unavailableDays: [now({ timezone: LA_TIMEZONE }).add(3, 'days'), now({ timezone: LA_TIMEZONE }).add(4, 'days')],
      },
      {
        team: 'Bay Area Call Center',
        availableHours: '10:00 AM - 5:00 PM ',
        unavailableHours: ['12:00 AM - 10:00 AM', '5:00 PM - 12:00 AM'],
        availableDays: [now({ timezone: LA_TIMEZONE }).add(3, 'days'), now({ timezone: LA_TIMEZONE }).add(4, 'days')],
        unavailableDays: [now({ timezone: LA_TIMEZONE }).add(1, 'days'), now({ timezone: LA_TIMEZONE }).add(2, 'days')],
      },
    ],
  };
  const floatingAgentPage = new FloatingAgentPage(t);
  await floatingAgentPage.checkFloatingAgentPage(t);
  await floatingAgentPage.checkFloatingAgentIsDisplayed(t, mockData.nonFloatingAgentName);
  await floatingAgentPage.checkFloatingAgentIsDisplayed(t, mockData.floatingAgentName, true);
  await floatingAgentPage.setUpFloatingAgent(t, mockData);
  await clickOnElement(t, { selector: '#_closeBtn' });
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo });

  const partyPath = await getPathName();
  const partyId = partyPath.replace('/party/', '');

  logger.info('TEST-1155 about to checkAgentsAvailabilityForAppointments');
  await checkAgentsAvailabilityForAppointments(t, mockData);
  logger.info('TEST-1155 about to cancel');
  await clickOnElement(t, { selector: '#cancelAppointmentDialog' });

  const mockAppointmentData1 = {
    floatingAgentName: 'Tanya Francis',
    floatingAgentType: 'Leasing Agent',
    team: 'Cove Leasing',
    appointmentDate: now({ timezone: LA_TIMEZONE }).add(1, 'days'),
    slotTime: '14:00:00',
  };
  const mockAppointmentData2 = {
    floatingAgentName: 'Tanya Francis',
    floatingAgentType: 'Leasing Agent',
    team: 'Bay Area Call Center',
    appointmentDate: now({ timezone: LA_TIMEZONE }).add(3, 'days'),
    slotTime: '16:00:00',
  };

  await scheduleAppointmentForSpecificAgent(t, mockAppointmentData1);
  await scheduleAppointmentForSpecificAgent(t, mockAppointmentData2);

  // TEST 1200 - Check communication type
  await checkCommunicationType(t, ctx, partyId, DALTypes.CommunicationMessageType.CONTACTEVENT);

  await checkCommunicationType(t, ctx, partyId, DALTypes.CommunicationMessageType.EMAIL);

  await checkCommunicationType(t, ctx, partyId, DALTypes.CommunicationMessageType.SMS);

  const partyPhaseOne = new PartyPhaseOne(t);
  await partyPhaseOne.clickOnBackButton();
  await floatingAgentPage.checkFloatingAgentPage(t);

  const mockData2 = {
    floatingAgentName: 'Tanya Francis',
    floatingAgentType: 'Leasing Agent',
    teams: ['Cove Leasing', 'Bay Area Call Center'],
    avabilitySetUp: [
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(1, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Cove Leasing',
      },
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(2, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Bay Area Call Center',
      },
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(3, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Cove Leasing',
      },
      {
        availableDate: now({ timezone: LA_TIMEZONE }).add(4, 'days').format(YEAR_MONTH_DAY_FORMAT),
        team: 'Bay Area Call Center',
      },
    ],
    avabilityDaysPerTeam: [
      {
        team: 'Cove Leasing',
        availableDays: [now({ timezone: LA_TIMEZONE }).add(1, 'days'), now({ timezone: LA_TIMEZONE }).add(3, 'days')],
        unavailableDays: [now({ timezone: LA_TIMEZONE }).add(2, 'days'), now({ timezone: LA_TIMEZONE }).add(4, 'days')],
      },
      {
        team: 'Bay Area Call Center',
        availableHours: '10:00 AM - 5:00 PM ',
        unavailableHours: ['12:00 AM - 10:00 AM', '5:00 PM - 12:00 AM'],
        availableDays: [now({ timezone: LA_TIMEZONE }).add(2, 'days'), now({ timezone: LA_TIMEZONE }).add(4, 'days')],
        unavailableDays: [now({ timezone: LA_TIMEZONE }).add(1, 'days'), now({ timezone: LA_TIMEZONE }).add(3, 'days')],
      },
    ],
  };

  await floatingAgentPage.checkFloatingAgentIsDisplayed(t, mockData2.floatingAgentName, true);
  await floatingAgentPage.setUpFloatingAgent(t, mockData2);
  await clickOnElement(t, { selector: '#_closeBtn' });
  await clickSwitchTodayOnlyToggle(t);
  await clickOnCardInDashboard(t, '#leads', contactInfo);
  await checkAgentsAvailabilityForAppointments(t, mockData2);
});

test('TEST-1202:Create a self quote from widget', async t => {
  await t.navigateTo(getTenantURL('/widgetTest'));
  const widgetPage = new WidgetPage(t);
  await widgetPage.validateWidgetVisible(t);

  const quoteMockData = {
    legalName: 'Robbie Nicholson',
    email: 'qatest+robbienicholson@reva.tech',
    phone: '+1 908 555 4578',
    moveInDate: now({ timezone: LA_TIMEZONE }).add(2, 'days').format(ISO_DATE_FORMAT_SHORT).toString(),
    numberOfPets: '1 pet',
    unit: '004SALT',
    propertyName: 'The Cove at Tiburon',
  };
  const unit = 'cove-1-004SALT';

  await createASelfQuote(t, unit, quoteMockData);

  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const dashboardPage = new DashboardPage(t);
  await dashboardPage.searchAndOpenPartyByResidentName(quoteMockData.legalName);

  const partyPath = await getPathName();
  const partyId = partyPath.replace('/party/', '');

  const partyDetailPage = new PartyDetailPage(t);
  const partyOwnerName = await $(partyDetailPage.selectors.partyOwner).innerText;
  const partyOwnerEmail = getPartyOwnerEmailByName(partyOwnerName);
  await clickOnElement(t, { selector: partyDetailPage.selectors.navigateBackBtn });
  await clickOnElement(t, { selector: '#side-nav' });
  await clickOnElement(t, { selector: '#logout' });

  const partyOwnerInfo = { user: partyOwnerEmail, password: getUserPassword(), fullName: partyOwnerName };

  await loginAs(t, partyOwnerInfo);
  await validateDashboardVisible(t);

  // TEST 1200 - Check communication type
  await checkCommunicationType(t, ctx, partyId, DALTypes.CommunicationMessageType.WEB);

  await checkCardWithWebInquiryNotification(t, quoteMockData.legalName);
  await clickOnCardByResidentName(t, quoteMockData.legalName);

  await partyDetailPage.checkQuoteStatus(t, quoteMockData.legalName, { status: 'Sent', index: '1' });

  await partyDetailPage.selectQuoteMenuOption('0', trans('VIEW_QUOTE'));

  const quoteDraftPage = new QuoteDraftPage(t);
  await expectVisible(t, { selector: quoteDraftPage.selectors.quoteTitleDialog, text: `Quote for Unit ${quoteMockData.unit}` });
  await quoteDraftPage.closeQuoteDraft();
  const expectedEmailSubject = `Quote from ${quoteMockData.propertyName}`;
  const expectedWebInquiry = {
    campaignType: '[website-property] Quote sent',
    senderName: quoteMockData.legalName,
    messageSection: 'Quote sent for apartment cove-1-004SALT',
  };

  const partyPhaseOne = new PartyPhaseOne(t);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject, quoteMockData.legalName);
  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiry);
  await partyPhaseOne.clickOnWebInqury();

  await partyPhaseOne.checkInquiryMessageHeader(expectedWebInquiry.campaignType);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(quoteMockData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(quoteMockData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(quoteMockData.formattedPhone);
  await partyPhaseOne.checkInquiryMessageMoveInDate(expectedWebInquiry.messageSection);

  const unit2 = 'cove-1-008SALT';
  await t.navigateTo(getTenantURL('/widgetTest'));
  await createASelfQuote(t, unit2, quoteMockData);

  await t.navigateTo(getTenantURL('/'));
  await validateDashboardVisible(t);
  await clickOnCardByResidentName(t, quoteMockData.legalName);
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject, quoteMockData.legalName, 2);
  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiry);
  const expectedWebInquiry2 = {
    campaignType: '[website-property] Quote sent',
    senderName: quoteMockData.legalName,
    messageSection: 'Quote sent for apartment cove-1-008SALT',
  };
  await partyPhaseOne.checkEmailStructure(expectedEmailSubject, quoteMockData.legalName);
  await partyPhaseOne.checkWebInquiryStructure(expectedWebInquiry2);
  await partyPhaseOne.clickOnWebInqury();

  await partyPhaseOne.checkInquiryMessageHeader(expectedWebInquiry2.campaignType);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(quoteMockData.legalName);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(quoteMockData.email);
  await partyPhaseOne.checkInquiryMessageHeaderLabel(quoteMockData.formattedPhone);
  await partyPhaseOne.checkInquiryMessageMoveInDate(expectedWebInquiry2.messageSection);
});
