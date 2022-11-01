/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword } from '../../helpers/helpers';
import { createAParty, createAQuote, publishAQuote } from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { now } from '../../../common/helpers/moment-utils';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import LeaseApplicationPage from '../../pages/leaseApplicationPage';

setHooks(fixture('Verify service fee variable and non-variable'), {
  fixtureName: 'fee',
});

test('CPM-19672: Quote UI validation the default amount and amounts in the flyout editor', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfoAcme } = mockPartyData;
  const residentEmailAddress = 'qatest+kathejohnson@reva.tech';
  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const acmeApartments = partyInfo.properties[3].displayName;
  const team = 'Empyrean Horizon';
  const leaseApplicationData = {
    variableFees: [
      {
        title: 'Pet rent fee_v2',
        defaultAmount: '$0.00',
        minAmountInFlyout: '$0.00',
        maxAmountInFlyout: '$150.00',
        newMaxAmount: '150.01',
      },
      {
        title: 'Pet rent fee_v3',
        defaultAmount: '$100.00',
        minAmountInFlyout: '$0.00',
        maxAmountInFlyout: '$150.00',
        newMaxAmount: '151',
      },
      {
        title: 'Pet rent fee_v4',
        defaultAmount: '$150.00',
        minAmountInFlyout: '$0.00',
        maxAmountInFlyout: '$150.00',
        newMaxAmount: '152',
      },
    ],
    nonVariableFees: [
      {
        title: 'Pet rent',
        defaultAmount: '$30.00',
        minAmountInFlyout: '$0.00',
        newMaxAmount: '1000',
      },
    ],
  };

  const quoteInfo = {
    index: 0,
    baseRent: 1184,
    ...getMockedQuoteDataByUnit('101', 0),
  };

  const currentDate = now({ timezone: acmeApartments.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(2, 'day'),
  };
  await createAParty(t, { partyInfo, propertyName: acmeApartments, contactInfo, userInfo: team, qualificationInfo: qualificationInfoAcme });
  await createAQuote(t, quoteInfo, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: acmeApartments.timezone });
  const quoteDraftPage = new QuoteDraftPage(t);
  await quoteDraftPage.checkVariableFees(t, leaseApplicationData.variableFees);
  await quoteDraftPage.checkNonVariableFees(t, leaseApplicationData.nonVariableFees);
  await publishAQuote(t, contactInfo);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await leaseApplicationPage.createLease(t);
  const selectFeeCheckBox = true;
  await leaseApplicationPage.checkVariableFees(t, leaseApplicationData.variableFees, selectFeeCheckBox);
  await leaseApplicationPage.checkNonVariableFees(t, leaseApplicationData.nonVariableFees, selectFeeCheckBox);
});
