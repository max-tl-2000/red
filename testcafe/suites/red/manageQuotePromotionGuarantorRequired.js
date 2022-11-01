/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, getLocation } from '../../helpers/helpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import {
  createAParty,
  createAQuote,
  publishAQuote,
  completeApplicationPart1,
  payApplicationFee,
  completeApplicationPart2,
  checkQuoteApplicationStatus,
  verifyQuotedItemMenuOptions,
  // verifyCreatedQuoteData,
  increaseQuoteLeasePrice,
} from '../../helpers/rentalApplicationHelpers';
import { verifyScreeningData } from '../../helpers/leasingApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';

setHooks(fixture('Smoke: Create quote and manage promotions flows.').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'manageQuotePromotionGuarantorRequired',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-143: Creates a quote and promotes it with an "GUARANTOR REQUIRED " status. Checks the data from amenities in the screening section and in the created quote', async t => {
  // User Logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const applicantData = getMockedApplicantDataByEmail('qatest+joicetaylor@reva.tech');
  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const contactInfo = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech');
  const quoteInfo = {
    index: 0,
    ...getMockedQuoteDataByUnit('005SALT'),
  };

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  const partyALocation = await getLocation();

  // Creates a quote and publishes it
  await createAQuote(t, quoteInfo);
  const quoteLeasePrice = {
    newPrice: '5800',
    selectedLeaseTerm: 3,
  };
  await increaseQuoteLeasePrice(t, quoteLeasePrice);
  await publishAQuote(t, contactInfo);
  // Applies on behalf of the person
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(partyALocation);

  await checkQuoteApplicationStatus(t, trans('GUARANTOR_REQUIRED'));
  await verifyQuotedItemMenuOptions(t, quoteInfo);
  const openScreeningSummaryPage = true;
  await verifyScreeningData(t, quoteInfo, openScreeningSummaryPage);
  // This is because of template changes
  // const leasePriceIncreased = true;
  // await verifyCreatedQuoteData(t, quoteInfo, leasePriceIncreased);
});
