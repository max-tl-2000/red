/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, getLocation } from '../../helpers/helpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible, clickOnCardInDashboard } from '../../helpers/dashboardHelpers';
import { forceUsersLogout } from '../../../cucumber/lib/utils/apiHelper';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import {
  createAParty,
  createAQuote,
  publishAQuote,
  completeApplicationPart1,
  payApplicationFee,
  completeApplicationPart2,
  verifyPendingApprovalData,
  backToDashboard,
} from '../../helpers/rentalApplicationHelpers';
import {
  requestScreeningApproval,
  approveLease,
  publishLease,
  verifyUnitNotAvailableMsg,
  verifyLeaseCannotBePublished,
} from '../../helpers/leasingApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import DashboardPage from '../../pages/dashboardPage';

setHooks(fixture('Manages the flow to download a created lease.'), {
  fixtureName: 'checkUnitNotAvailableForLease',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('Creates a quote and publish a lease to have an unit already used and taken.', async t => {
  const dashboardPage = new DashboardPage(t);
  // Logs Felicia in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const quoteInfo = {
    index: 0,
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('005SALT'),
  };

  // Creates a party
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  const partyALocation = await getLocation();

  // Creates a Quote and publishes it
  await createAQuote(t, quoteInfo);
  await publishAQuote(t, contactInfo);

  // Apply in applications parts 1 and 2 and then screening approval is requested.
  const applicantData = getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech');
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(partyALocation);
  await requestScreeningApproval(t, quoteInfo);
  // Logs Felicia out
  await backToDashboard(t);
  await forceUsersLogout({ tenantId: TEST_TENANT_ID });

  // Logs Kenny in in order to approve the screening application
  const userInfo2 = { user: 'kenny@reva.tech', password: getUserPassword(), fullName: 'Kenny Cruz' };
  await loginAs(t, userInfo2);
  await clickOnCardInDashboard(t, dashboardPage.selectors.applicantsCol, contactInfo);
  await verifyPendingApprovalData(t, quoteInfo);
  const openLeasePage = true;
  await approveLease(t, openLeasePage);

  // Lease is published using the unit 005SALT
  await publishLease(t);
});

test.skip('Creates another party and quote with the same unit as before and tries to publish the lease but a warning message says that it is not available.', async t => {
  const dashboardPage = new DashboardPage(t);

  // Logs Felicia in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const quoteInfo = {
    index: 0,
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('005SALT'),
  };

  // Creates a party
  const contactInfo = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech');
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  const partyALocation = await getLocation();

  // Creates a Quote and publishes it
  await createAQuote(t, quoteInfo);
  await publishAQuote(t, contactInfo);

  // Apply in applications parts 1 and 2 and then screening approval is requested.
  const applicantData = getMockedApplicantDataByEmail('qatest+joicetaylor@reva.tech');
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(partyALocation);
  await requestScreeningApproval(t, quoteInfo);
  // Logs Felicia out
  await backToDashboard(t);
  await forceUsersLogout({ tenantId: TEST_TENANT_ID });

  // Logs Kenny in in order to approve the screening application
  const userInfo2 = { user: 'kenny@reva.tech', password: getUserPassword(), fullName: 'Kenny Cruz' };
  await loginAs(t, userInfo2);
  await clickOnCardInDashboard(t, dashboardPage.selectors.applicantsCol, contactInfo);
  await verifyPendingApprovalData(t, quoteInfo);
  const openLeasePage = true;
  await approveLease(t, openLeasePage);

  // TEST-1127: Checks unit is not available.
  await verifyUnitNotAvailableMsg(t, quoteInfo, userInfo2);
  await verifyLeaseCannotBePublished(t);
});
