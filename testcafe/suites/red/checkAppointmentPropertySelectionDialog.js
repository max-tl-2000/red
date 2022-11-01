/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import ManagePartyPage from '../../pages/managePartyPage';
import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, clickOnElement, expectVisible, expectNotVisible } from '../../helpers/helpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedContactInfoByEmail, legalName } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import {
  editAppointmentDateAndTime,
  selectUnitForScheduleAppointment,
  selectDateTimeForScheduleAppointment,
  checkPropertySelectorDialog,
} from '../../helpers/appointmentHelper';
import { createAParty, checkAppointmentScheduledCorrect } from '../../helpers/rentalApplicationHelpers';
import PartyPhaseOne from '../../pages/partyPhaseOne';
import { now, formatMoment } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_LONG_FORMAT, TIME_MERIDIEM_FORMAT } from '../../../common/date-constants';
import { DALTypes } from '../../../common/enums/DALTypes';

setHooks(fixture('Create Party From Lease Application'), {
  fixtureName: 'schedulingAppointment',
  testlinkFlows: ['TEST-1039', 'TEST-1041', 'TEST-1042'],
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-1039 1041 1042: Select a unit in property selector different to owner property and send appointment', async t => {
  // create party
  const userInfo = { user: 'xavier@reva.tech', fullName: 'Xavier Mitchell', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const partyDetailPage = new PartyDetailPage(t);
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech', legalName);
  const propertyName = partyInfo.properties[5].displayName; // Coastal Palace
  const timezone = partyInfo.properties[5].timezone;
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  // TEST-1041: Do not show property selector dialog when we have only one item in the property array
  await partyDetailPage.clickOnPartyCardMenuBtn();
  await partyDetailPage.clickOnScheduleAppointmentMenuItem();
  const appointmentType = Object.keys(DALTypes.TourTypes).find(key => DALTypes.TourTypes[key] === DALTypes.TourTypes.IN_PERSON_TOUR);
  await partyDetailPage.selectAppointmentType(appointmentType);
  const unit = 'coastal-x1-1005';
  await selectUnitForScheduleAppointment(t, { index: 0, unitName: unit });
  const appointmentTime = {
    appointmentDate: now({ timezone }).add(2, 'days'),
    slotTime: '15:00:00',
    hour: 15,
  };
  await selectDateTimeForScheduleAppointment(t, appointmentTime);
  await expectNotVisible(t, { selector: partyDetailPage.selectors.assignedPropertyForAppointmentDropdownButton });

  // TEST-1039: Select a unit in property selector different to owner property and send appointment
  const secondPropertyName = partyInfo.properties[6].displayName; // Seascape Sunset
  const thirdPropertyName = partyInfo.properties[7].displayName; // Lakefront Beacon
  const propertyNames = [secondPropertyName, thirdPropertyName];
  await partyDetailPage.selectPropertiesFromPreferencesSection(propertyNames);
  await partyDetailPage.closePreferencesSection();
  await partyDetailPage.clickOnPartyCardMenuBtn();
  await partyDetailPage.clickOnScheduleAppointmentMenuItem();
  await partyDetailPage.selectAppointmentType(appointmentType);
  const unitSecondAppointment = 'lakefront-z-1001';
  await selectUnitForScheduleAppointment(t, { index: 0, unitName: unitSecondAppointment });
  const secondAppointmentTime = {
    appointmentDate: now({ timezone }).add(3, 'days'),
    slotTime: '14:00:00',
    hour: 14,
  };
  const formatedDateTime = {
    appointmentFormatedDate: secondAppointmentTime.appointmentDate.format(MONTH_DATE_YEAR_LONG_FORMAT),
    appointmentFormatedTime: formatMoment(secondAppointmentTime.appointmentDate.set({ hour: secondAppointmentTime.hour, minute: 0, second: 0 }), {
      format: TIME_MERIDIEM_FORMAT,
    }),
  };
  await selectDateTimeForScheduleAppointment(t, secondAppointmentTime);
  const correctDefaultPropertyAddress = 'Coastal Palace - 88 Howard St, San Francisco, CA  94105';
  const correctPropertyAddress = 'Lakefront Beacon - 300 Lakeside Dr, Oakland, CA  94612';
  const propertyForAppointment = thirdPropertyName;
  await checkPropertySelectorDialog(t, correctDefaultPropertyAddress, correctPropertyAddress, propertyNames, propertyForAppointment);
  await checkAppointmentScheduledCorrect(t, secondAppointmentTime, contactInfo.legalName, secondAppointmentTime.slotTime, 0);
  const partyPhaseOne = new PartyPhaseOne(t);
  const appointmentMessageInfo = {
    emailSubject: `Appointment confirmed - ${thirdPropertyName}`,
    smsContent: `Your appointment has been confirmed for ${formatedDateTime.appointmentFormatedDate} at ${formatedDateTime.appointmentFormatedTime}. You will meet with
        ${userInfo.fullName} at our Leasing Office located at 300 Lakeside Dr, Oakland, CA 94612. If you would like to modify or cancel this appointment, simply reply to this text message
        with your change.`,
  };
  await clickOnElement(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await partyPhaseOne.checkEmailStructure(appointmentMessageInfo.emailSubject, contactInfo.legalName, 0);
  await partyPhaseOne.checkSmsStructure(appointmentMessageInfo.smsContent, contactInfo.legalName, 1);

  // TEST-1042: Cancel property selector dialog after appointment is submitted
  await editAppointmentDateAndTime(t);
  const editAppointmentTime = {
    appointmentDate: now({ timezone }).add(4, 'days'),
    slotTime: '11:00:00',
    hour: 11,
  };
  const unitEditAppointment = 'seascape-y-1004';
  await selectUnitForScheduleAppointment(t, { index: 0, unitName: unitEditAppointment });
  await selectDateTimeForScheduleAppointment(t, editAppointmentTime);
  const managePartyPage = new ManagePartyPage(t);
  await clickOnElement(t, { selector: managePartyPage.selectors.cancelAssignedPropertyBtn });
  await expectVisible(t, { selector: partyDetailPage.selectors.scheduleAppointmentDialog });
});
