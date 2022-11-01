/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ClientFunction } from 'testcafe';
import { doLogoutIfNeeded, getTenantURL, getUserPassword, loginAs } from '../../helpers/helpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import {
  completeApplicationPart1,
  completeApplicationPart2,
  createAParty,
  createAQuote,
  payApplicationFee,
  publishAQuote,
} from '../../helpers/rentalApplicationHelpers';
import { approveLease, closeLeaseForm, reviewScreening } from '../../helpers/leasingApplicationHelpers';
import { checkNotAllowAddMembersToParty } from '../../helpers/managePartyHelpers';
import ManagePartyPage from '../../pages/managePartyPage';
import PartyDetailPage from '../../pages/partyDetailPage';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Smoke: Merge members in parties with application approved not allowed').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'addPartyMembersWithApplicationApproved',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-600: Verify party members can not be added after application is approved', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // The Cove at Tiburon
  const hasRequiredSteppers = true;
  const skipSteppers = false;
  const applicantData = getMockedApplicantDataByEmail('qatest+joicetaylor@reva.tech');
  const quoteInfo = {
    index: 0,
    leaseTerms: ['9 months'],
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('008SALT'),
  };

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  const getLocation = ClientFunction(() => document.location.href);
  const partyALocation = await getLocation();

  await createAQuote(t, quoteInfo);
  await publishAQuote(t, contactInfo);
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  // Back to party details page
  await t.navigateTo(partyALocation);
  await reviewScreening(t, quoteInfo);
  await approveLease(t);
  await closeLeaseForm(t);

  const partyDetailPage = new PartyDetailPage(t);
  const managePartyPage = new ManagePartyPage(t);

  // TEST-600:Verify party members can´t be added after application is approved
  await partyDetailPage.clickOnPartyDetailTitle();
  await managePartyPage.clickOnAddResidentBtn();
  await checkNotAllowAddMembersToParty(t, 'Residents');
  await managePartyPage.clickOnAddGuarantorBtn();
  await checkNotAllowAddMembersToParty(t, 'Guarantors');
});
