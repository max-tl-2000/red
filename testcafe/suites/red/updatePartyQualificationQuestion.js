/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, expectVisible, getTenantURL } from '../../helpers/helpers';
import {
  createAParty,
  validatePartyDataCreation,
  changePartyType,
  updateQualificationQuestions,
  validateQualificationsQuestionsValues,
} from '../../helpers/rentalApplicationHelpers';
import { getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';

setHooks(fixture('Update party qualification questions from Manage Party Page'), {
  fixtureName: 'updatePartyQualificationQuestion',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

test('TEST-55, TEST-70: Update party qualification questions with decision Cancel and with decision Done', async t => {
  // User logs in
  const userInfo = { user: 'bill@reva.tech', password: 'red&reva#' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const updatedQualificationInfo = {
    bedrooms: '4+ beds, 2 beds',
    numBedsOption: '#TWO_BEDS',
    dropdownLeaseType: 'Students',
    incomeQuestion: 'Yes',
    moveInTimeQuestion: '2 - 4 months',
    lengthLeaseTxt: '9 month',
    companyQualificationInfo: {
      numberOfUnits: '2',
      leaseTerm: '9 months',
    },
  };

  const partyDetailPage = new PartyDetailPage(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  // TEST-51: Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await validatePartyDataCreation(t, { propertyName, contactInfo, qualificationInfo });
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  // Do not save the updates
  // TEST-70 Update qualification questions with decision Cancel
  await partyDetailPage.clickOnPartyDetailTitle();
  await updateQualificationQuestions(t, updatedQualificationInfo, false);
  await validateQualificationsQuestionsValues(t, qualificationInfo);
  // Save the updates
  // TEST-70 Update qualification questions with decision Done
  await updateQualificationQuestions(t, updatedQualificationInfo, true);
  await validateQualificationsQuestionsValues(t, updatedQualificationInfo);
  // TEST-55 Update qualification questions with party type change to Corporate
  updatedQualificationInfo.dropdownLeaseType = 'Corporate';
  await updateQualificationQuestions(t, updatedQualificationInfo, true);
  await changePartyType(t, true);
  updatedQualificationInfo.bedrooms = '4+ beds';
  await validateQualificationsQuestionsValues(t, updatedQualificationInfo);
});
