/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ClientFunction } from 'testcafe';
import { t as trans } from 'i18next';
import { doLogoutIfNeeded, getTenantURL, getUserPassword, loginAs } from '../../helpers/helpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import {
  backToDashboard,
  completeApplicationPart1,
  completeApplicationPart2,
  createAParty,
  createAQuote,
  mergePartiesFromMenu,
  payApplicationFee,
  publishAQuote,
} from '../../helpers/rentalApplicationHelpers';
import { approveLease, publishLease, reviewScreening } from '../../helpers/leasingApplicationHelpers';
import { clickOnCardInDashboard, clickSwitchTodayOnlyToggle, lookForACardInDashboard } from '../../helpers/dashboardHelpers';
import { mergeConditions } from '../../helpers/redConstants';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Smoke: Merge members in parties with active lease not allowed').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'mergeTwoPartiesWithActiveLease',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-635: Verify system not allow party merge when both parties have active lease', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // The Cove at Tiburon
  const hasRequiredSteppers = true;
  const skipSteppers = false;
  const applicantData = getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech');
  const quoteInfo = {
    index: 0,
    leaseTerms: ['9 months'],
    ...getMockedQuoteDataByUnit('001SALT'),
  };

  const quoteInfo2 = {
    index: 0,
    leaseTerms: ['9 months'],
    leaseStartDate: '1',
    ...getMockedQuoteDataByUnit('005SALT'),
  };
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  const getLocation = ClientFunction(() => document.location.href);
  const partyALocation = await getLocation();

  await createAQuote(t, quoteInfo);
  await publishAQuote(t, contactInfo);
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  // Back to party details page
  await t.navigateTo(partyALocation);
  await reviewScreening(t, quoteInfo);
  await approveLease(t);
  await publishLease(t);

  // Back to dashboard and create second party
  await backToDashboard(t);
  await clickSwitchTodayOnlyToggle(t);
  await lookForACardInDashboard(t, contactInfo, '#leases', 2);
  await createAParty(
    t,
    { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo, mergeDialogBody: trans('NO_DUPLICATE_PARTY_FOUND_INFO4') },
    mergeConditions.mergeOnlyPersonsSameProp,
  );
  await createAQuote(t, quoteInfo2);
  await publishAQuote(t, contactInfo);
  await reviewScreening(t, quoteInfo2);
  await approveLease(t);
  await publishLease(t);

  await backToDashboard(t);
  await lookForACardInDashboard(t, contactInfo, '#leases', 2);
  await clickOnCardInDashboard(t, '#leases', contactInfo);

  // TEST-635 Verify system not allow party merge when both parties have active lease
  await mergePartiesFromMenu(t, true, trans('NO_DUPLICATE_PARTY_FOUND_INFO3'));
});
