/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword } from '../../helpers/helpers';
import { createAParty, createAQuote, publishAQuote } from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { approveIncompleteScreening, revokeApprovedApplication } from '../../helpers/leasingApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import PartyDetailPage from '../../pages/partyDetailPage';
import LeaseApplicationPage from '../../pages/leaseApplicationPage';

setHooks(fixture('Smoke: Review application revoked').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'reviewApplicationRevoked',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

test('TEST-831: Review application revoked', async t => {
  // LAA User logs in
  const userInfo = { user: 'josh@reva.tech', password: getUserPassword(), fullName: 'Josh Helpman', team: 'Parkmerced Leasing' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const quoteInfo = {
    index: 0,
    leaseTerms: ['6 months'],
    ...getMockedQuoteDataByUnit('1010'),
  };

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo);
  const quoteDraftPage = new QuoteDraftPage(t);
  await quoteDraftPage.selectLeaseTerms(['24 months']);
  await quoteDraftPage.selectLeaseTerms(['6 months']);
  await publishAQuote(t, contactInfo);
  await approveIncompleteScreening(t, quoteInfo);

  const leaseApplicationPage = new LeaseApplicationPage(t);

  await leaseApplicationPage.closeLeaseFormPage();

  // TEST-831: Agent LAA revokes approved application
  await revokeApprovedApplication(t);
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.selectQuoteMenuOption(quoteInfo.index, trans('REVIEW_SCREENING'));
});
