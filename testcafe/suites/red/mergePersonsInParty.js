/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, expectVisible } from '../../helpers/helpers';
import { createAParty, backToDashboard, addAGuarantor } from '../../helpers/rentalApplicationHelpers';
import { clickSwitchTodayOnlyToggle, validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { mergeConditions } from '../../helpers/redConstants';
import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';
import { addAResident } from '../../helpers/managePartyHelpers';

setHooks(fixture('Smoke: Merge Party Management').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'mergePersonsInParty',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-1010: Verify system can merge guarantor not linked as a resident on parties with the same property', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'Felicia Sutton' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const resident1Info = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech'); // Kathe Johnson - Party A
  const resident2Info = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech'); // Joice Taylor - Party A
  const resident3Info = getMockedContactInfoByEmail('qatest+lillibrown@reva.tech'); // Lilli Brown - Party B

  const propertyName = partyInfo.properties[1].displayName; // The Cove at Tiburon
  const partyDetailPage = new PartyDetailPage(t);

  // TEST-1010:Guarantor not linked hold should not appear after merge a guarantor as a resident.
  await createAParty(t, { partyInfo, propertyName, contactInfo: resident1Info, userInfo, qualificationInfo });
  // const partyALocation = await getPathName();
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  const managePartyPage = new ManagePartyPage(t);

  await addAResident(t, resident2Info);
  await managePartyPage.verifyPartyMemberAdded(resident2Info);
  await managePartyPage.closeManageParty();

  await backToDashboard(t);
  await clickSwitchTodayOnlyToggle(t);

  await createAParty(t, { partyInfo, propertyName, contactInfo: resident3Info, userInfo, qualificationInfo });

  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  await addAGuarantor(t, resident1Info, { userInfo, mergePersonCondition: mergeConditions.mergePersonsAndParties });
  // Navigate to resulting party details page
  /* await t.navigateTo(partyALocation);

  await partyDetailPage.checkPartyDetailsResidentsAdded([resident1Info, resident2Info, resident3Info]);
  await expectNotVisible(t, { selector: partyDetailPage.selectors.applicationHoldBanner }); */
});
