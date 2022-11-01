/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ClientFunction } from 'testcafe';
import { doLogoutIfNeeded, getTenantURL, getUserPassword, loginAs } from '../../helpers/helpers';
import {
  mockPartyData,
  getMockedGuarantorDataByEmail,
  getMockedQuoteDataByUnit,
  getMockedContactInfoByEmail,
  getMockedApplicantDataByEmail,
} from '../../helpers/mockDataHelpers';
import {
  addAGuarantor,
  completeApplicationPart1,
  completeApplicationPart2,
  completeApplicationPart2Guarantor,
  createAParty,
  createAQuote,
  linkGuarantorToResident,
  payApplicationFee,
  publishAQuote,
} from '../../helpers/rentalApplicationHelpers';
import { approveLease, closeLeaseForm, reviewScreening } from '../../helpers/leasingApplicationHelpers';
import { checkNotAllowAddMembersToParty } from '../../helpers/managePartyHelpers';
import ManagePartyPage from '../../pages/managePartyPage';
import PartyDetailPage from '../../pages/partyDetailPage';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Smoke: Remove members from party').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'removePartyMembersWithApplicationApproved',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-601: Verify party members can´t be removed after application is approved', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+lillibrown@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // The Cove at Tiburon
  const hasRequiredSteppers = true;
  const skipSteppers = false;
  const applicantData = getMockedApplicantDataByEmail('qatest+lillibrown@reva.tech');
  const guarantorInfo = getMockedGuarantorDataByEmail('qatest+kattiesmith@reva.tech'); // Kattie Smith
  const quoteInfo = {
    index: 0,
    leaseTerms: ['9 months'],
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('009SALT'),
  };

  const partyDetailPage = new PartyDetailPage(t);

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await partyDetailPage.clickOnPartyDetailTitle();
  await addAGuarantor(t, guarantorInfo);
  await linkGuarantorToResident(t, contactInfo, guarantorInfo);
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.closeManageParty();

  const getLocation = ClientFunction(() => document.location.href);
  const partyALocation = await getLocation();

  await createAQuote(t, quoteInfo);
  await publishAQuote(t, contactInfo);
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);

  // Complete guarantor application
  await t.navigateTo(partyALocation);
  await completeApplicationPart1(t, guarantorInfo, propertyName);
  await payApplicationFee(t, guarantorInfo);
  await completeApplicationPart2Guarantor(t, guarantorInfo);

  // Back to party details page
  await t.navigateTo(partyALocation);
  await reviewScreening(t, quoteInfo);
  await approveLease(t);
  await closeLeaseForm(t);

  // TEST:601 Verify party members can´t be removed after application is approved
  await partyDetailPage.clickOnPartyDetailTitle();
  await managePartyPage.clickOnResidentCardByPersonName(contactInfo);
  await managePartyPage.clickRemoveResidentFromParty();
  await checkNotAllowAddMembersToParty(t, 'Residents');

  await managePartyPage.clickOnGuarantorCardByPersonName(guarantorInfo);
  await managePartyPage.clickRemoveGuarantorFromParty();
  await checkNotAllowAddMembersToParty(t, 'Guarantors');
});
