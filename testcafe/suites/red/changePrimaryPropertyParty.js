/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, expectVisible, getPathName } from '../../helpers/helpers';
import {
  createAParty,
  changePrimaryProperty,
  validatePartyDataCreation,
  validateChangePrimaryPropertySuccessful,
} from '../../helpers/rentalApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import { checkActivityLogEntryByIndex } from '../../helpers/activityLogHelpers';
import { checkForNoMatchInParties } from '../../helpers/managePartyHelpers';
import { getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';

setHooks(fixture('Create a party and change the primary property'), { fixtureName: 'changePrimaryPropertyParty' });

test('TEST-71: Change the primary property to the party and validate the change was done', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // The Cove at Tiburon

  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  // Get location of party/id in order to back after completing application part 1 and part 2
  const location = await getPathName();
  const partyDetailPage = new PartyDetailPage(t);

  await validatePartyDataCreation(t, { propertyName, contactInfo, qualificationInfo });
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });

  // TEST-71:Change the primary property to the party
  await changePrimaryProperty(t, userInfo.team, partyInfo.properties[1].displayName, partyInfo.properties[0].displayName);
  await checkForNoMatchInParties(t);
  await t.navigateTo(location);
  await validateChangePrimaryPropertySuccessful(t, partyInfo.properties[0].displayName);
  const changePrimaryPropertyActivityLogDetails = `Primary Property updated to: ${partyInfo.properties[0].displayName};`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'update', component: 'party (#1)', details: changePrimaryPropertyActivityLogDetails });
});
