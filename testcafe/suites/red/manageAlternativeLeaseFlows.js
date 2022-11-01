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
  checkEmailSentInCommsPanel,
  backToDashboard,
  selectLeaseTermInQuote,
} from '../../helpers/rentalApplicationHelpers';
import {
  requestScreeningApproval,
  approveLease,
  publishLease,
  verifyCreatedLeaseDescriptionTxt,
  verifyLeaseStatus,
  sendEmailFromPartyDetail,
  checkIsPublishBtnDisabled,
  selectInventoryItems,
} from '../../helpers/leasingApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';

import DashboardPage from '../../pages/dashboardPage';
import LoginPage from '../../pages/loginPage';
import { forceUsersLogout } from '../../../cucumber/lib/utils/apiHelper';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import { now } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';

setHooks(fixture('Smoke: Manages alternative flows for leases.').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'manageAlternativeLeaseFlows',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-209: Part 1: Creates a party with a LA agent and request the screening approval.', async t => {
  // User Logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const hasRequiredSteppers = false;
  const skipSteppers = true;
  const applicantData = getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech');
  const quoteInfo = {
    index: 0,
    baseRent: 2213,
    ...getMockedQuoteDataByUnit('1019'),
  };

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  const partyALocation = await getLocation();

  // Creates a quote and publishes it
  await createAQuote(t, quoteInfo);
  await selectLeaseTermInQuote(t, ['24 months']);
  await selectLeaseTermInQuote(t, ['6 months']);
  const quoteLeasePrice = {
    newPrice: '4002',
    selectedLeaseTerm: 6,
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
});

// This test is marked as skipped, because the part 1 the result of Part 1 is removed and teh tenant is reset to pre Part 1 state
test.skip('TEST-209: Part 2: Logs in with LAA agent to approve the request and publish the lease.', async t => {
  // Logs in with Josh to approve the request
  const dashboardPage = new DashboardPage(t);
  const loginPage = new LoginPage(t);
  const { partyInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const property = partyInfo.properties[0]; // Parkmerced Apartments
  const userInfo2 = { user: 'josh@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  const quoteInfo = {
    index: 0,
    baseRent: 2213,
    ...getMockedQuoteDataByUnit('1019'),
  };

  await loginPage.checkLoginTitle();
  await loginAs(t, userInfo2);
  await clickSwitchTodayOnlyToggle(t);
  await lookForACardInDashboard(t, contactInfo, '#applicants', 2);

  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(6, 'month'),
  };

  const inventory = {
    name: quoteInfo.unitName,
    type: DALTypes.InventoryType.UNIT,
    property,
    building: {
      name: '350AR',
    },
    layout: {
      numBathrooms: 3,
      numBedrooms: 3,
    },
    inventoryFee: ['Door Fob', 'Parking indoor'],
    inventoryFeeChild: ['Door Fob', 'p101'],
    concessionsName: ['1 month free'],
    concessionsAmount: ['2213'],
  };

  await verifyCardTaskName(t, trans('REVIEW_APPLICATION'));
  await clickOnCardInDashboard(t, dashboardPage.selectors.applicantsCol, contactInfo);

  const verifyIncreasedLeasePrice = true;
  await verifyPendingApprovalData(t, quoteInfo, verifyIncreasedLeasePrice);

  const openLeasePage = true;
  await approveLease(t, openLeasePage);

  await checkIsPublishBtnDisabled(t, inventory.inventoryFee);

  await selectInventoryItems(t, inventory.inventoryFee, inventory.inventoryFeeChild);

  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });

  const leaseTermIndex = 2;
  await verifyCreatedLeaseDescriptionTxt(t, quoteInfo, verifyIncreasedLeasePrice, leaseTermIndex);
  let statusText = 'NOT_SENT';
  await verifyLeaseStatus(t, contactInfo, statusText);
  await sendEmailFromPartyDetail(t);
  const emailSubject = trans('SIGN_LEASE_EMAIL_SUBJECT', { propertyName: property.displayName });
  const partyLocation = await getLocation();
  await t.navigateTo(partyLocation);
  await checkEmailSentInCommsPanel(t, contactInfo, emailSubject, 0);
  // TODO: validateSnackbar has to be set later, since there is an unknown reason why in this specific part
  // the snackbar is not appearing in the test browser.
  // await validateSnackbarMessage(t, trans('SIGN_LEASE_EMAIL_SUCCESS'));
  statusText = 'SENT';
  await verifyLeaseStatus(t, contactInfo, statusText);
});
