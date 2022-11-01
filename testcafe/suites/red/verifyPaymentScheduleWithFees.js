/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded } from '../../helpers/helpers';
import { createAParty, createAQuote } from '../../helpers/rentalApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';

import QuoteDraftPage from '../../pages/quoteDraftPage';
import { now } from '../../../common/helpers/moment-utils';

setHooks(fixture('Verify payment schedule values with fees in quote draft.'), {
  fixtureName: 'checkPaymentScheduleWithFees',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

// TODO: this should be refactored and enabled as part of CPM-16975
test.skip('Verify payment schedule in quote draft with selected and deselected fees where a fee has quotePaymentScheduleFlag FALSE', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party creation info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech');
  const { displayName: propertyName, timezone } = partyInfo.properties[1]; // The Cove at Tiburon

  const feeService = {
    feeSection: 'service',
    feeName: 'Housekeeping service',
    feeAmount: '100',
  };
  const paymentScheduleInfo = {
    paymentScheduleInfoForThreeMonths: '3 months',
    leaseStartOnDayFiveAmount: ['5122.87', '5911', '788.13'],
  };
  const quoteInfo = {
    leaseStartOnDayFive: '5',
    ...getMockedQuoteDataByUnit('001SALT'),
  };
  const startOfMonth = now({ timezone }).startOf('month').startOf('day');

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo);

  const quoteDraftPage = new QuoteDraftPage(t);

  await quoteDraftPage.selectLeaseDate(
    t,
    quoteDraftPage.selectors.leaseStartDateTxt,
    startOfMonth.clone().add(+quoteInfo.leaseStartOnDayFive - 1, 'day'),
    timezone,
  );
  await quoteDraftPage.checkAFeeFromAdditionalMonthlyCharges(feeService);
  await quoteDraftPage.setFeeAmount(feeService);
  await quoteDraftPage.checkAmountEntered(feeService);
  await quoteDraftPage.checkAmountInPaymentScheduleCard(paymentScheduleInfo.paymentScheduleInfoForThreeMonths, paymentScheduleInfo.leaseStartOnDayFiveAmount);
  await quoteDraftPage.checkAFeeFromAdditionalMonthlyCharges(feeService);
  await quoteDraftPage.checkAmountInPaymentScheduleCard(paymentScheduleInfo.paymentScheduleInfoForThreeMonths, paymentScheduleInfo.leaseStartOnDayFiveAmount);
});
