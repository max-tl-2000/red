/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword } from '../../helpers/helpers';
import { LA_TIMEZONE } from '../../../common/date-constants';
import {
  createAParty,
  scheduleAppointmentFromMenu,
  checkAppointmentScheduledCorrect,
  backToDashboard,
  generateScheduleTimeForAppointment,
} from '../../helpers/rentalApplicationHelpers';
import { getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';
import { lookForACardInDashboard, checkAppointmentScheduledInCard } from '../../helpers/dashboardHelpers';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Verify the correct time zone is displayed when an appointment is created'), { fixtureName: 'createAppointmentInParty' });

test('TEST-428: Create a party, create an appointment and verify the correct timezone is displayed', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'kenny@reva.tech', password: getUserPassword(), fullName: 'Kenny Cruz', team: 'Cove Leasing' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // The Cove at Tiburon
  const slotTime = '14:00:00';
  const hour = 14;

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo, skipPropertySelection: true });
  // Schedule appointment from Menu
  await scheduleAppointmentFromMenu(t, slotTime);

  await scheduleAppointmentFromMenu(t, slotTime);

  const appointmentDateTime = generateScheduleTimeForAppointment(slotTime, LA_TIMEZONE, hour);
  const scheduledTime = appointmentDateTime.split(' ');

  // TEST-428:The party card displays the correct time zone
  // The appointment displays a date selected in To Do section
  await checkAppointmentScheduledCorrect(t, appointmentDateTime, contactInfo.legalName, slotTime, 0);

  await backToDashboard(t);
  await lookForACardInDashboard(t, contactInfo, '#leads');
  // The party card displays the correct date with timezone
  await checkAppointmentScheduledInCard(t, scheduledTime[1]);
});
