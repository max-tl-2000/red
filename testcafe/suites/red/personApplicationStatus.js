/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { ClientFunction } from 'testcafe';
import { loginAs, getTenantURL, getUserPassword } from '../../helpers/helpers';

import {
  createAParty,
  createAQuoteDraft,
  checkPersonApplicationStatus,
  publishAQuoteDraft,
  payApplicationFee,
  completeApplicationPart1,
  completeApplicationPart2,
  editApplication,
} from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';

const f = fixture(
  "Transition Applicant status from party detail in order to validate Applicant status 'Not Sent', 'Sent', 'Paid' and 'Complete' as a Leasing Agent",
);
setHooks(f, {
  fixtureName: 'personApplicationStatus',
});

test('Check person application status "Not Sent" before and "Sent" after publish quote', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'josh@reva.tech', password: getUserPassword(), fullName: 'Josh Helpman', team: 'Bay Area Call Center' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName;
  const applicantData = getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech');
  const quoteInfo = {
    index: 0,
    ...getMockedQuoteDataByUnit('1019'),
  };
  const skipSteppers = true;

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  // Get location of party/id in order to back after completing application part 1 and part 2
  const getLocation = ClientFunction(() => document.location.href);
  const location = await getLocation();

  await createAQuoteDraft(t, quoteInfo);

  await checkPersonApplicationStatus(t, contactInfo, trans('NOT_SENT'));

  await publishAQuoteDraft(t, { quoteInfo, contactInfo });

  await checkPersonApplicationStatus(t, contactInfo, trans('SENT'));

  await completeApplicationPart1(t, applicantData, propertyName);

  await payApplicationFee(t, applicantData);

  // Back to party details page
  await t.navigateTo(location);

  await checkPersonApplicationStatus(t, contactInfo, trans('PAID'));

  await editApplication(t, contactInfo);

  await completeApplicationPart2(t, applicantData, skipSteppers);

  // Back to party details page
  await t.navigateTo(location);

  await checkPersonApplicationStatus(t, contactInfo, trans('COMPLETED'));
});
