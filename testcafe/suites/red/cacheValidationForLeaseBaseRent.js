/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ClientFunction } from 'testcafe';
import { loginAs, getTenantURL, getUserPassword, expectTextIsEqual, getPathName, clickOnElement } from '../../helpers/helpers';
import { reviewScreening, publishLease, selectInventoryItems } from '../../helpers/leasingApplicationHelpers';
import { createAParty, createAQuote, publishAQuote } from '../../helpers/rentalApplicationHelpers';
import { getMockedContactInfoByEmail, getMockedQuoteDataByUnit, mockPartyData } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import LeaseFormPage from '../../pages/leaseFormPage';
import PartyDetailPage from '../../pages/partyDetailPage';
import LeaseApplicationPage from '../../pages/leaseApplicationPage';
import loggerInstance from '../../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'cacheValidationForLeaseBaseRent' });

setHooks(fixture('Verify base rent is not affected by cache issues after lease creation or approval revoke'), {
  fixtureName: 'cacheValidationForLeaseBaseRent',
});

const createQuoteAndLease = async (t, { quoteInfo, contactInfo, location }) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  await createAQuote(t, quoteInfo);
  await clickOnElement(t, { selector: quoteDraftPage.selectors.leaseTermsDropdown });
  await clickOnElement(t, { selector: quoteDraftPage.selectors.leaseTermsDropdownItem.replace('length', '12') });
  await publishAQuote(t, contactInfo);
  // Back to party details page
  await t.navigateTo(location);
  await reviewScreening(t, quoteInfo);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: '[name="btnReviewApplication"]' });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.applicationSummaryApproveBtn });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.screeningIncompleteDialogOkBtn });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.approveApplicationDialogOkBtn });
};

const getLocation = ClientFunction(() => document.location.href);

const executeCreateLeaseWithTwoTermsFlow = async (t, { quoteInfo, contactInfo, userInfo }) => {
  const { partyInfo, qualificationInfo } = mockPartyData;
  const property = partyInfo.properties[0]; // Parkmerced Apartments

  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo });
  const location = await getLocation();
  await createQuoteAndLease(t, { quoteInfo, contactInfo, location });
};

test('TEST-1227: Verify base rent is not affected by cache issues after lease creation or approval revoke', async t => {
  // User logs in LAA agent
  // TODO: login as admin@reva.tech is temporary, we need an LAA for Parkmerced.
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // STEP-1
  const firstContactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const firstQuoteInfo = {
    index: 0,
    baseRent: 1811,
    ...getMockedQuoteDataByUnit('1019'),
  };

  const inventoryFee = ['Door Fob'];
  const inventoryFeeChild = ['Door Fob'];

  await executeCreateLeaseWithTwoTermsFlow(t, { quoteInfo: firstQuoteInfo, contactInfo: firstContactInfo, userInfo });
  const partyAUrl = await getPathName();
  await selectInventoryItems(t, inventoryFee, inventoryFeeChild);
  logger.trace('about to publish the lease');
  await publishLease(t, { sendLater: true });

  // STEP-2
  logger.trace('about to navigate to root');
  await t.navigateTo(getTenantURL('/'));

  const secondContactInfo = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech');
  const secondQuoteInfo = {
    index: 0,
    baseRent: 6680,
    ...getMockedQuoteDataByUnit('1001'),
  };
  const leaseFormPage = new LeaseFormPage(t);
  const baseRentLeaseTerm24 = leaseFormPage.selectors.baseRentLeaseTermEditor.replace('Index', '24');
  await executeCreateLeaseWithTwoTermsFlow(t, { quoteInfo: secondQuoteInfo, contactInfo: secondContactInfo, userInfo });
  await t.wait(5000);
  await expectTextIsEqual(t, { selector: baseRentLeaseTerm24, text: '$5,495.00' });

  // STEP-3
  const partyDetailPage = new PartyDetailPage(t);
  await t.navigateTo(partyAUrl);
  await clickOnElement(t, { selector: partyDetailPage.selectors.pendingApprovalMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.abandonRequestApproval });
  await clickOnElement(t, { selector: '[data-component="dialog-wrapper"] [data-command="OK"]' });
  const thirdQuoteInfo = {
    index: 0,
    baseRent: 4244,
    ...getMockedQuoteDataByUnit('1010'),
  };
  await createQuoteAndLease(t, { quoteInfo: thirdQuoteInfo, contactInfo: firstContactInfo, location: partyAUrl });
  await t.wait(5000);
  await expectTextIsEqual(t, { selector: baseRentLeaseTerm24, text: '$7,333.00' });

  // STEP-4
  await t.navigateTo(getTenantURL('/'));
  const thirdContactInfo = getMockedContactInfoByEmail('qatest+lillibrown@reva.tech');
  const fourthQuoteInfo = {
    index: 0,
    baseRent: 4396,
    ...getMockedQuoteDataByUnit('1013'),
  };
  await executeCreateLeaseWithTwoTermsFlow(t, { quoteInfo: fourthQuoteInfo, contactInfo: thirdContactInfo, userInfo });
  await t.wait(5000);
  await expectTextIsEqual(t, { selector: `${leaseFormPage.selectors.baseRentLeaseTermEditor.replace('Index', '18')} span`, text: '$7,596' });
});
