/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import {
  loginAs,
  expectVisible,
  getTenantURL,
  getUserPassword,
  doLogoutIfNeeded,
  clickOnElement,
  getLocation,
  expectTextIsEqual,
  getSelectorWithIndex,
  clickOnCard,
} from '../../helpers/helpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import DashboardPage from '../../pages/dashboardPage';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import {
  signLease,
  counterSignLease,
  verifyLeaseIsSignedByCounterSigner,
  verifyLeaseIsSignedByApplicant,
  publishLease,
  checkIsPublishBtnDisabled,
  selectInventoryItems,
} from '../../helpers/leasingApplicationHelpers';
import { verifyRenewalDashboardCardByState } from '../../helpers/renewalsHelpers';

setHooks(fixture('Smoke: Renewal Parties').meta({ smoke: 'true' }), {
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
  skipDatabaseRestore: true,
});

// This test should be renabled when working on CPM-16587
test.skip('Create lease flow', async t => {
  const dashboardPage = new DashboardPage(t);
  const partyDetailPage = new PartyDetailPage(t);
  const quoteDraftPage = new QuoteDraftPage(t);
  await loginAs(t, { user: 'dispatcher+parkmerced@reva.tech', password: getUserPassword() });
  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: dashboardPage.selectors.switchToTodayToggle });

  const contactInfo = { legalName: 'Aline Selina', index: 1 };

  // check dashboard party card
  await verifyRenewalDashboardCardByState(t, { columnId: dashboardPage.selectors.prospectsColumn, contactInfo });
  await clickOnCard(t, { lane: dashboardPage.selectors.prospectsColumn, cardText: contactInfo.legalName });

  // check displayed sections when the party is in prospect state
  await partyDetailPage.checkRenewalPartyDetailsPageSectionVisibility({ isProspect: true, hasAppointments: false });

  // check party page sections
  const summaryData = {
    property: trans('SELECT_PROPERTY_LABEL'),
    currentLeaseEndsOn: trans('CURRENT_LEASE_ENDS_ON'),
    renewalLetterState: trans('RENEWAL_LETTER_STATE'),
    rentedInventory: trans('RENTED_INVENTORY'),
    leaseType: trans('LEASE_TYPE_LABEL'),
  };
  await partyDetailPage.checkRenewalPartySummarySection(summaryData);

  // create and publish renewal letter
  await expectVisible(t, { selector: partyDetailPage.selectors.sendRenewalLetterBtn, text: trans('REVIEW_RENEWAL_LETTER').toUpperCase() });
  await clickOnElement(t, { selector: partyDetailPage.selectors.sendRenewalLetterBtn });

  await quoteDraftPage.publishRenewalLetter(t);

  // create and publish lease
  await expectVisible(t, { selector: partyDetailPage.selectors.sendRenewalLetterBtn, text: trans('CREATE_LEASE').toUpperCase() });
  await clickOnElement(t, { selector: partyDetailPage.selectors.sendRenewalLetterBtn });

  await partyDetailPage.clickOnCreateLeaseBtn();

  const inventory = {
    inventoryFee: ['Door Fob'],
    inventoryFeeChild: ['Door Fob'],
  };

  await checkIsPublishBtnDisabled(t, inventory.inventoryFee);
  await selectInventoryItems(t, inventory.inventoryFee, inventory.inventoryFeeChild);

  await publishLease(t, { areChargeSectionsVisible: true });

  // check displayed sections when the party is in lease state
  await partyDetailPage.checkRenewalPartyDetailsPageSectionVisibility({ isProspect: false, hasAppointments: false });

  // check party state
  await clickOnElement(t, { selector: partyDetailPage.selectors.navigateBackBtn });

  await verifyRenewalDashboardCardByState(t, { columnId: dashboardPage.selectors.leasesColumn, contactInfo });
  await clickOnCard(t, { lane: dashboardPage.selectors.leasesColumn, cardText: contactInfo.legalName });

  // sign lease
  const currentPartyUrl = await getLocation();
  await signLease(t, contactInfo);
  await t.navigateTo(currentPartyUrl);

  await expectTextIsEqual(t, {
    selector: getSelectorWithIndex(partyDetailPage.selectors.countersignerSignatureStatusNotSent, 1),
    text: trans('LEASE_READY_FOR_SIGNATURE'),
  });

  // new user logs in as counter signer
  await clickOnElement(t, { selector: partyDetailPage.selectors.navigateBackBtn });
  await clickOnElement(t, { selector: '#side-nav' });
  await clickOnElement(t, { selector: '#logout' });

  const counterSignerUserInfo = { user: 'josh@reva.tech', password: getUserPassword(), fullName: 'Josh Helpman', team: 'Parkmerced Leasing', index: 1 };
  await loginAs(t, counterSignerUserInfo);
  await validateDashboardVisible(t);
  await t.navigateTo(currentPartyUrl);

  await expectTextIsEqual(t, {
    selector: getSelectorWithIndex(partyDetailPage.selectors.countersignerSignatureStatusNotSent, 1),
    text: trans('LEASE_READY_FOR_SIGNATURE'),
  });
  await counterSignLease(t, counterSignerUserInfo);
  await t.navigateTo(currentPartyUrl);

  // verify signatures
  await verifyLeaseIsSignedByApplicant(t, contactInfo.index);
  await verifyLeaseIsSignedByCounterSigner(t, counterSignerUserInfo.index);

  // check party state
  await clickOnElement(t, { selector: partyDetailPage.selectors.navigateBackBtn });
  await clickOnElement(t, { selector: '#side-nav' });
  await clickOnElement(t, { selector: '#logout' });
  await loginAs(t, { user: 'dispatcher+parkmerced@reva.tech', password: getUserPassword() });

  await verifyRenewalDashboardCardByState(t, { columnId: dashboardPage.selectors.futureResidentsColumn, contactInfo });
});
