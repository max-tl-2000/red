/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, getLocation, expectCheckboxState } from '../../helpers/helpers';
import {
  reviewScreening,
  approveLease,
  publishLease,
  closeLeaseForm,
  viewOrEditLease,
  voidLease,
  verifyOneTimeFeeAmountAndCheckBoxSelected,
} from '../../helpers/leasingApplicationHelpers';
import {
  createAParty,
  completeApplicationPart1,
  completeApplicationPart2,
  waiveApplicationFee,
  createAQuote,
  publishAQuote,
} from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { now } from '../../../common/helpers/moment-utils';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import LeaseApplicationPage from '../../pages/leaseApplicationPage';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import PublishedQuotePage from '../../pages/publishedQuotePage';
import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';

setHooks(fixture('Verify the fees that are configured as a related fee on One-time Charges where the fee it is editable and controlled in the IU by Agent '), {
  fixtureName: 'leases',
});

test.skip('TEST-1498: The admin fee indicated as related fees should be rendered correctly on the quote and the lease edit pages', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party and contact info
  const { partyInfo, qualificationInfoSierra } = mockPartyData;
  const residentEmailAddress = 'qatest+connewald@reva.tech';
  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const applicantData = getMockedApplicantDataByEmail(residentEmailAddress);
  const sierraNorte = partyInfo.properties[4];
  const property = sierraNorte;
  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const inventoryFees = [
    {
      title: 'Admin Fee',
      amount: '$50.00',
    },
  ];

  const units = {
    quoteInfo1: {
      index: 0,
      baseRent: 1040,
      ...getMockedQuoteDataByUnit('103'),
    },
    quoteInfo2: {
      index: 0,
      baseRent: 1040,
      ...getMockedQuoteDataByUnit('104'),
    },
  };
  const adminFee = inventoryFees[0];

  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(2, 'day'),
  };
  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo: qualificationInfoSierra });
  // Get location of party/id in order to back after completing application part 1 and part 2
  const partyUrl = await getLocation();
  // check there are no vehicles added to this party
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnPartyDetailTitle();
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.verifyNoVehicleAddedText();
  await partyDetailPage.closeManagePartyDetailsPage();
  await createAQuote(t, units.quoteInfo1, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });

  const leaseApplicationPage = new LeaseApplicationPage(t);
  const publishedQuotePage = new PublishedQuotePage(t);
  const quoteDraftPage = new QuoteDraftPage(t);

  await expectCheckboxState(t, { selector: quoteDraftPage.selectors.feeDepositAdminFeeCheckBox, selected: false });

  // verify the fee name and amount
  await publishedQuotePage.checkQuoteFee(adminFee.title, adminFee.amount);
  await publishAQuote(t, contactInfo);
  // TEST-140:Complete application part 2 without filled up steppers in part 2
  await waiveApplicationFee(t, contactInfo);
  await completeApplicationPart1(t, applicantData, property.displayName);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);

  // Back to party details page
  await t.navigateTo(partyUrl);
  await reviewScreening(t, units.quoteInfo1);
  await approveLease(t);

  // TEST-729:Parking addendum is shown as checked when there is a complimentary parking
  await leaseApplicationPage.checkComplimentaryParking(t);
  await leaseApplicationPage.checkParkingAddendum(t);
  await leaseApplicationPage.checkFeesInLeaseForm(inventoryFees, { isFeeAmountEditable: true, checkUnselectedFees: false });
  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });

  // TEST-193:Edit Lease
  await viewOrEditLease(t);
  await expectCheckboxState(t, { selector: publishedQuotePage.selectors.feeDepositAdminFeeCheckBox, selected: false });
  await leaseApplicationPage.checkFeesInLeaseForm(inventoryFees, { isFeeAmountEditable: true, checkUnselectedFees: false });
  await publishedQuotePage.selectAFeeFromOneTimeCharges(adminFee.title);
  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });
  await viewOrEditLease(t);
  await expectCheckboxState(t, { selector: publishedQuotePage.selectors.feeDepositAdminFeeCheckBox, selected: true });
  await closeLeaseForm(t);
  await voidLease(t);
  await createAQuote(t, units.quoteInfo2, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });
  // verify the existing fee name and amount
  await publishedQuotePage.checkQuoteFee(adminFee.title, adminFee.amount);
  // select the checkbox in quote draft
  await quoteDraftPage.selectASingleFeeFromOneTimeCharges(adminFee.title);
  await publishAQuote(t, contactInfo);
  await reviewScreening(t, units.quoteInfo2);
  await approveLease(t);
  await leaseApplicationPage.checkFeesInLeaseForm(inventoryFees, { isFeeAmountEditable: true, checkUnselectedFees: true });
  // Verify the fee amount and checkbox selected in creation lease
  await verifyOneTimeFeeAmountAndCheckBoxSelected(t, adminFee.title, adminFee.amount);
  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });
  await viewOrEditLease(t);
  // Verify the fee amount and checkbox selected in Lease published
  await verifyOneTimeFeeAmountAndCheckBoxSelected(t, adminFee.title, adminFee.amount);
});
