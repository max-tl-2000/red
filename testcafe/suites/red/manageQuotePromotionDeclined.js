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
  verifyCardNotExists,
  clickSwitchTodayOnlyToggle,
  lookForACardInDashboard,
} from '../../helpers/dashboardHelpers';
import {
  createAParty,
  createAQuote,
  publishAQuote,
  completeApplicationPart1,
  payApplicationFee,
  completeApplicationPart2,
  checkQuoteApplicationStatus,
  verifyQuotedItemMenuOptions,
  // verifyCreatedQuoteData,
  increaseQuoteLeasePrice,
  verifyPendingApprovalData,
  backToDashboard,
} from '../../helpers/rentalApplicationHelpers';
import { requestScreeningApproval, declineScreeningApproval, validateSnackbarMessage, verifyTaskIsDone } from '../../helpers/leasingApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';

import DashboardPage from '../../pages/dashboardPage';
import { forceUsersLogout } from '../../../cucumber/lib/utils/apiHelper';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';

setHooks(fixture('Smoke: Create quote and manage promotions flows.').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'manageQuotePromotionsDeclined',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-166: Creates a quote and promotes it. Then reviews the application and finally declines it.', async t => {
  // User Logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const applicantData = getMockedApplicantDataByEmail('qatest+lillibrown@reva.tech');
  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const contactInfo = getMockedContactInfoByEmail('qatest+lillibrown@reva.tech');
  const quoteInfo = {
    index: 0,
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('005SALT'),
  };
  const dashboardPage = new DashboardPage(t);

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  const partyLocation = await getLocation();

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
  await t.navigateTo(partyLocation);
  // Requests application approval
  await verifyQuotedItemMenuOptions(t, quoteInfo);
  const doNotOpenQuoteRowMenu = false;
  await requestScreeningApproval(t, quoteInfo, doNotOpenQuoteRowMenu);
  // Logs Felicia Out
  await backToDashboard(t);
  await forceUsersLogout({ tenantId: TEST_TENANT_ID });
  // Logs Kenny In to decline the request
  const userInfo2 = { user: 'kenny@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  await loginAs(t, userInfo2);
  await clickSwitchTodayOnlyToggle(t);
  await lookForACardInDashboard(t, contactInfo, '#applicants', 2);
  await verifyCardTaskName(t, trans('REVIEW_APPLICATION'));
  await clickOnCardInDashboard(t, dashboardPage.selectors.applicantsCol, contactInfo);
  const verifyIncreasedLeasePrice = true;
  await verifyPendingApprovalData(t, quoteInfo, verifyIncreasedLeasePrice);
  await declineScreeningApproval(t, quoteInfo);
  // Validates sent messages and info been set to a previous state.
  await validateSnackbarMessage(t, trans('APPLICATION_DECLINED_SMS_SENT_SUCCESS'));
  await checkQuoteApplicationStatus(t, trans('GUARANTOR_REQUIRED'));
  await verifyTaskIsDone(t, quoteInfo.index);
  await backToDashboard(t);
  await verifyCardNotExists(t, dashboardPage.selectors.applicantsCol, contactInfo);
});
