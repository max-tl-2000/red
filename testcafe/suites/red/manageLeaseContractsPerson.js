/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, getLocation } from '../../helpers/helpers';
import {
  createAParty,
  createAQuote,
  publishAQuote,
  completeApplicationPart1,
  completeApplicationPart2,
  payApplicationFee,
} from '../../helpers/rentalApplicationHelpers';
import {
  publishLease,
  voidLease,
  reviewScreening,
  approveLease,
  voidLeaseDraft,
  verifyQuoteList,
  verifyVoidedLeaseSubHeaderTxt,
  verifyVoidedLeaseDescriptionTxt,
  verifyNewPromoteAppTaskAdded,
  checkSectionIsHidden,
} from '../../helpers/leasingApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import PartyDetailPage from '../../pages/partyDetailPage';
import LeaseApplicationPage from '../../pages/leaseApplicationPage';

setHooks(fixture('Smoke: Creates leases for person and manages the flow of its uses.').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'manageLeaseContracts',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-201, TEST-202: Creates lease contracts for a person, goes through the publish and void flows and verifies info is correctly displayed.', async t => {
  // User Logs in
  const userInfo = { user: 'kenny@reva.tech', password: getUserPassword(), fullName: 'SYSTEM', team: 'Cove Leasing' };
  await loginAs(t, userInfo);

  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const applicantData = getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech');
  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const quoteInfo = {
    index: 0,
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('005SALT'),
  };

  const partyDetailPage = new PartyDetailPage(t);

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo, skipPropertySelection: true });

  const partyALocation = await getLocation();

  // Creates a quote and publishes it
  await createAQuote(t, quoteInfo);
  await publishAQuote(t, contactInfo);
  // Applies on behalf of the person
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(partyALocation);

  // Review screening and create a lease draft
  await reviewScreening(t, quoteInfo);
  await approveLease(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await leaseApplicationPage.closeLeasePage(t);
  // Voids the lease draft
  await voidLeaseDraft(t);
  await t.navigateTo(partyALocation);
  // Creates a lease, publishes it and voids it and checks that data is correctly displayed.
  await reviewScreening(t, quoteInfo);
  await approveLease(t);
  // TEST-201: Publish Lease - Send Later
  const sendLater = true;
  await publishLease(t, { sendLater });
  const emailSubjectText = trans('SIGN_LEASE_EMAIL_SUBJECT', propertyName);
  await partyDetailPage.checkEmailIsNotSentInCommsPanel(emailSubjectText);

  await voidLease(t);
  await verifyQuoteList(t);
  await checkSectionIsHidden(t, partyDetailPage.selectors.applicationPendingApproval);
  await checkSectionIsHidden(t, `${partyDetailPage.selectors.leaseSection} ${partyDetailPage.selectors.table}`);
  await verifyVoidedLeaseSubHeaderTxt(t, trans('LEASE_SECTION_EMPTY_STATE'));
  const leaseTermIndex = 0;
  await verifyVoidedLeaseDescriptionTxt(t, quoteInfo, leaseTermIndex);
  await verifyNewPromoteAppTaskAdded(t, quoteInfo.index);
});
