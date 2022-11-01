/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, getLocation, expectVisible } from '../../helpers/helpers';
import {
  createAParty,
  completeApplicationPart1,
  completeApplicationPart2,
  waiveApplicationFee,
  createAQuote,
  publishAQuote,
  selectLeaseTermInQuote,
} from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { now } from '../../../common/helpers/moment-utils';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import PartyPhaseOne from '../../pages/partyPhaseOne';

setHooks(
  fixture('Create a quote, publish the quote, fill application and do the lease process with an unit from Parkmerced property').meta({
    smoke: 'true',
    smoke1: 'true',
  }),
  {
    fixtureName: 'leases',
  },
);

test('TEST-2030:Contact party decline decision task', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const partyPhaseOne = new PartyPhaseOne(t);
  const { partyInfo, qualificationInfo } = mockPartyData;
  const residentEmailAddress = 'ens7m.test@inbox.testmail.app';
  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const applicantData = getMockedApplicantDataByEmail(residentEmailAddress);
  const property = partyInfo.properties[1]; // The Cove at Tiburon
  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const quoteInfo = {
    index: 0,
    baseRent: 6800,
    ...getMockedQuoteDataByUnit('009SALT'),
  };
  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(2, 'day'),
  };

  // Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo });
  const partyUrl = await getLocation();
  await createAQuote(t, quoteInfo, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });
  await selectLeaseTermInQuote(t, ['6 months']);
  await publishAQuote(t, contactInfo);
  await waiveApplicationFee(t, contactInfo);

  // Complete application
  await completeApplicationPart1(t, applicantData, property.displayName);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);

  // Check 'Contact party to explain the upcoming decline decision' task
  await t.navigateTo(partyUrl);
  await expectVisible(t, { selector: partyPhaseOne.selectors.contactPartyDeclineDecisionTask });
});
