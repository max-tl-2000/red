/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, getLocation } from '../../helpers/helpers';
import { setHooks } from '../../helpers/hooks';
import {
  validateDashboardVisible,
  clickOnCardInDashboard,
  verifyCardTaskName,
  clickSwitchTodayOnlyToggle,
  lookForACardInDashboard,
} from '../../helpers/dashboardHelpers';
import { forceUsersLogout } from '../../../cucumber/lib/utils/apiHelper';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import {
  createAParty,
  createAQuote,
  publishAQuote,
  completeApplicationPart1,
  payApplicationFee,
  completeApplicationPart2,
  verifyQuotedItemMenuOptions,
  increaseQuoteLeasePrice,
  verifyPendingApprovalData,
  backToDashboard,
} from '../../helpers/rentalApplicationHelpers';
import {
  requestScreeningApproval,
  approveLease,
  publishLease,
  signLease,
  counterSignLease,
  verifyLeaseIsExecuted,
  verifyExecutedLeaseMenuOptions,
  downloadLease,
} from '../../helpers/leasingApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';

import DashboardPage from '../../pages/dashboardPage';
import { now } from '../../../common/helpers/moment-utils';

setHooks(fixture('Manages the flow to create and download a lease.'), {
  fixtureName: 'verifyLeaseDownload',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-406: LAA receives the application and approves it, completes and signs the lease, finally downloads the lease', async t => {
  // User Logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const email = 'qatest+lillibrown@reva.tech';
  const applicantData = getMockedApplicantDataByEmail(email);
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail(email);
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const quoteInfo = {
    index: 0,
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('005SALT'),
  };

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  const partyALocation = await getLocation();

  // Creates a quote and publishes it
  await createAQuote(t, quoteInfo);
  const quoteLeasePrice = {
    newPrice: '5800',
    selectedLeaseTerm: 3,
  };
  await increaseQuoteLeasePrice(t, quoteLeasePrice);
  await publishAQuote(t, contactInfo);
  // Applies on behalf of the person
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(partyALocation);
  // Requests application approval
  await verifyQuotedItemMenuOptions(t, quoteInfo);
  const doNotOpenQuoteRowMenu = false;
  await requestScreeningApproval(t, quoteInfo, doNotOpenQuoteRowMenu);
  // Logs Felicia Out
  await backToDashboard(t);
  await forceUsersLogout({ tenantId: TEST_TENANT_ID });

  // Logs in with LAA agent, approves the lease, publish, sign and download the lease.
  // Logs Kenny In to approve the request.
  const userInfo2 = { user: 'kenny@reva.tech', password: getUserPassword(), fullName: 'Kenny Cruz' };
  await loginAs(t, userInfo2);

  const dashboardPage = new DashboardPage(t);
  const property = partyInfo.properties[1]; // Cove Apartments
  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(3, 'month'),
  };

  await clickSwitchTodayOnlyToggle(t);
  await lookForACardInDashboard(t, contactInfo, '#applicants', 2);
  await verifyCardTaskName(t, trans('REVIEW_APPLICATION'));
  await clickOnCardInDashboard(t, dashboardPage.selectors.applicantsCol, contactInfo);

  const partyLocation = await getLocation();
  const verifyIncreasedPrice = true;
  await verifyPendingApprovalData(t, quoteInfo, verifyIncreasedPrice);

  const openLeasePage = true;
  await approveLease(t, openLeasePage);
  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });

  await t.navigateTo(partyLocation);
  // Sign the lease and then downloads it
  await signLease(t, contactInfo);
  await t.navigateTo(partyLocation);
  await counterSignLease(t, userInfo2);
  await t.navigateTo(partyLocation);
  await verifyLeaseIsExecuted(t, quoteInfo);
  await verifyExecutedLeaseMenuOptions(t);
  await downloadLease(t);
});
