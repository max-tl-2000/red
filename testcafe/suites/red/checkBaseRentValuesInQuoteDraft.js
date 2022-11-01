/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword } from '../../helpers/helpers';
import { createAParty, createAQuote } from '../../helpers/rentalApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';

setHooks(fixture('The base rent amount is being verified for each lease term selected in the quote draft'), {
  fixtureName: 'checkBaseRentValuesInQuoteDraft',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

test('TEST-113, TEST-114, TEST-115, TEST-116, TEST-122: Select lease term length and verify the base rent amount', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party creation info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const quoteInfo = {
    leaseTermsLength: ['6 months', '9 months', '12 months', '15 months'],
    ...getMockedQuoteDataByUnit('1010'),
  };

  const quoteDraftPage = new QuoteDraftPage(t);

  const baseRentAmountSelectors = [
    quoteDraftPage.selectors.baseRentLeaseTerm.replace('length', 6),
    quoteDraftPage.selectors.baseRentLeaseTerm.replace('length', 9),
    quoteDraftPage.selectors.baseRentLeaseTerm.replace('length', 15),
    quoteDraftPage.selectors.baseRentLeaseTerm.replace('length', 24),
  ];

  const mockBaseRentAmounts = ['8,917.00', '8,521.00', '8,125.00', '7,333.00'];

  // TEST-51: Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo);
  await quoteDraftPage.selectLeaseTerms(quoteInfo.leaseTermsLength);
  const amountsForLeaseTermsFromQuoteDraft = await quoteDraftPage.getAmountForEachLeaseTerm(baseRentAmountSelectors);
  await quoteDraftPage.compareActualResultGottenWithExpectedResult(mockBaseRentAmounts, amountsForLeaseTermsFromQuoteDraft);
});
