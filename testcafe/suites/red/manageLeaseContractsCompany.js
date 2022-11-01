/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded } from '../../helpers/helpers';
import { createAParty, createAQuote, sendLaterAPublishQuote, addOccupantInPartyDetails } from '../../helpers/rentalApplicationHelpers';
import { promoteQuoteToLease, publishLease, voidLease } from '../../helpers/leasingApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedOccupantInfoByEmail } from '../../helpers/mockDataHelpers';

setHooks(fixture('Smoke: Creates leases for company and manages the flow of its uses.').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'manageLeaseContracts',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-1009: Creates lease contracts for a company, goes through the publish and void flows, and verifies info is correctly displayed.', async t => {
  // User Logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo, companyInfo } = mockPartyData;
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const occupant = getMockedOccupantInfoByEmail('qatest+michaeljohnson@reva.tech');
  const quoteInfo = {
    index: 0,
    leaseTerms: ['9 months'],
    ...getMockedQuoteDataByUnit('001SALT'),
  };

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo, companyInfo });
  // Creates a quote and publishes it
  await createAQuote(t, quoteInfo);
  await sendLaterAPublishQuote(t);
  // Promotes a quote to a lease and checks its info, then publishes it and finally voids it
  await promoteQuoteToLease(t, quoteInfo);
  const doNotSendLater = false;
  await publishLease(t, { companyInfo, sendLater: doNotSendLater });
  const verifyPartyMembersNotificationMsg = true;
  await voidLease(t, verifyPartyMembersNotificationMsg);
  // Adds an occupant, then creates a quote, promotes it to lease and verify the data including the occupant and then publishes it
  await addOccupantInPartyDetails(t, occupant);
  await createAQuote(t, quoteInfo, false);
  await sendLaterAPublishQuote(t);
  await promoteQuoteToLease(t, quoteInfo);
  await publishLease(t, { companyInfo, occupant, sendLater: doNotSendLater });
});
