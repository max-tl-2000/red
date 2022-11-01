/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword } from '../../helpers/helpers';
import {
  createAParty,
  waivePartyMember,
  cancelWaive,
  makePaymentForAPartyMemberWaived,
  checkTransactionsPayments,
} from '../../helpers/rentalApplicationHelpers';
import { getMockedApplicantDataByEmail, getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Smoke - Waive application fee').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'waiveApplicationFee',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

test('TEST-433, TEST-434, TEST-436, TEST-437: Waive a party member application fee', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'Felicia Sutton' };
  await loginAs(t, userInfo);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced
  const applicantData = getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech');

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  // TEST-433 Make a waive to party member
  await waivePartyMember(t, contactInfo, userInfo);

  // TEST-434 Cancel the wave to party member
  await cancelWaive(t, contactInfo, userInfo);

  // TEST-436 Make a payment when the party member has been made "Waive application fee"
  await waivePartyMember(t, contactInfo, userInfo);
  await makePaymentForAPartyMemberWaived(t, propertyName, applicantData);

  // TEST-437:New entry in "Payments and Fees" section when the member is waive
  const feeAmount = '$50';
  const feeWaivedAmount = '-$50';
  await checkTransactionsPayments(t, { feeAmount, feeWaivedAmount });
});
