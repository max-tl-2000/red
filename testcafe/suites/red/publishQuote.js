/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword } from '../../helpers/helpers';
import { createAParty, createAQuoteDraft, publishAQuoteDraft, checkStatusQuoteDraft } from '../../helpers/rentalApplicationHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';

const f = fixture('Create a party, create a draft quote and publish it');
setHooks(f, { fixtureName: 'publishQuote' });

test('TEST-97, TEST-98: Publish a quote flow', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const quoteInfo = {
    index: 0,
    ...getMockedQuoteDataByUnit('1001'),
  };

  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  // TEST-86 Create a quote draft
  await createAQuoteDraft(t, quoteInfo);
  // TEST-97: Send Quote published
  await publishAQuoteDraft(t, { quoteInfo, contactInfo });
  // TEST-98 Status unit card after quote published
  await checkStatusQuoteDraft(t, quoteInfo);
});
