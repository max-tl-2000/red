/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded } from '../../helpers/helpers';
import {
  createAParty,
  createAQuoteDraft,
  checkAQuoteDraftFromUnitList,
  sendLaterAPublishQuoteDraft,
  deleteAQuoteDraft,
  checkAmenitiesInQuoteDraft,
} from '../../helpers/rentalApplicationHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Smoke: Create quote drafts and manages the flow to publish and delete them.').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'manageQuoteDrafts',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-86, TEST-87, TEST-90, TEST-95, TEST-121: Creates a quote draft, checks its amenities, publishes it and sends it later, deletes it', async t => {
  // User Logs in
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
  // TEST-87 Create a quote draft that already exist
  await checkAQuoteDraftFromUnitList(t, quoteInfo);
  // TEST-95 Send Later quote publish
  await sendLaterAPublishQuoteDraft(t, quoteInfo);

  await createAQuoteDraft(t, quoteInfo);
  // TEST-90 Delete Quote draft from Quote published actions bar.
  await deleteAQuoteDraft(t, quoteInfo);
  // Creates another quote draft for the next test: TEST-121
  await createAQuoteDraft(t, quoteInfo);
  // TEST-121 Amenities in quote draft
  await checkAmenitiesInQuoteDraft(t, quoteInfo);
});
