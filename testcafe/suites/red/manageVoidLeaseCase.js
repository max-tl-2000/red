/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { Selector as $ } from 'testcafe';
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
  voidLease,
  checkSectionIsHidden,
  verifyVoidedLeaseSubHeaderTxt,
  verifyVoidedLeaseDescriptionTxt,
  verifyNewPromoteAppTaskAdded,
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
import PartyDetailPage from '../../pages/partyDetailPage';

setHooks(fixture('Smoke: Manages alternative flows for leases.').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'manageVoidLeaseCase',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-200: Part 1: Creates a lease with LA agent and request the screening approval', async t => {
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

test.skip('TEST-200: Part 2 With a LAA agent approves the lease and then voids it, sending an email to the party members.', async t => {
  // Logs in with Josh to approve the request
  const { partyInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const property = partyInfo.properties[0]; // Parkmerced Apartments
  const userInfo2 = { user: 'josh@reva.tech', password: getUserPassword(), fullName: 'SYSTEM' };
  const quoteInfo = {
    index: 0,
    baseRent: 2213,
    ...getMockedQuoteDataByUnit('1019'),
  };

  const loginPage = new LoginPage(t);

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

  const dashboardPage = new DashboardPage(t);

  await verifyCardTaskName(t, trans('REVIEW_APPLICATION'));
  await clickOnCardInDashboard(t, dashboardPage.selectors.applicantsCol, contactInfo);
  const partyLocation = await getLocation();

  const verifyIncreasedLeasePrice = true;
  await verifyPendingApprovalData(t, quoteInfo, verifyIncreasedLeasePrice);

  const openLeasePage = true;
  await approveLease(t, openLeasePage);

  await checkIsPublishBtnDisabled(t, inventory.inventoryFee);

  await selectInventoryItems(t, inventory.inventoryFee, inventory.inventoryFeeChild);

  await publishLease(t, { sendLater: false, timezone: property.timezone, leaseDates });

  await t.navigateTo(partyLocation);
  const verifyPartyMembersNotificationMsg = true;
  await voidLease(t, verifyPartyMembersNotificationMsg);

  await backToDashboard(t);
  await t.navigateTo(partyLocation);

  const partyDetailPage = new PartyDetailPage(t);

  const emailSubject = `Your lease ${trans('WAS_VOIDED')}`;
  await checkEmailSentInCommsPanel(t, contactInfo, emailSubject, 0);
  await checkSectionIsHidden(t, {
    selector: $(`${partyDetailPage.selectors.applicationPendingApproval} ${partyDetailPage.selectors.text}`).withText('APPLICATION_APPROVED'),
  });
  await checkSectionIsHidden(t, `${partyDetailPage.selectors.leaseSection} ${partyDetailPage.selectors.table}`);
  await verifyVoidedLeaseSubHeaderTxt(t, trans('LEASE_SECTION_EMPTY_STATE'));
  const compareIncreasedPriced = true;
  const leaseTermIndex = 2;
  await verifyVoidedLeaseDescriptionTxt(t, quoteInfo, leaseTermIndex, compareIncreasedPriced);
  await verifyNewPromoteAppTaskAdded(t, quoteInfo.index);
});
