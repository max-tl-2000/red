/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, expectVisible, getTenantURL, getUserPassword } from '../../helpers/helpers';
import { createAParty, addChildInPartyDetails, addPetInPartyDetails, addVehicleInPartyDetails } from '../../helpers/rentalApplicationHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';
import { mockPartyAdditionalInfo, removeChildFromPartyDetail, removePetFromPartyDetail, removeVehicleFromPartyDetail } from '../../helpers/partyAdditionalInfo';

setHooks(
  fixture(`Additional members are added to the party like as children, pets and vehicles. Then they are removed
      and verify the text are displayed when the party is empty`),
  {
    fixtureName: 'modifyAdditionalPartyMembers',
    beforeEach: async t => {
      await t.navigateTo(getTenantURL('/'));
    },
  },
);

test('TEST-59, TEST-60, TEST-61: Create Party, add and remove child, pet and vehicle validations', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  // defines party, contact info, guarantor info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const { childInfo, petInfo, vehicleInfo } = mockPartyAdditionalInfo;
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments

  // TEST-51: Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  const partyDetailPage = new PartyDetailPage(t);
  const managePartyPage = new ManagePartyPage(t);

  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  // TEST-56: Add a new child to the party
  await managePartyPage.verifyNoChildrenAddedText();
  await addChildInPartyDetails(t, childInfo);
  await managePartyPage.verifyNoChildrenAddedTextMissing();

  // TEST-57:Add a new pet to the party
  await managePartyPage.verifyNoPetsAddedText();
  await addPetInPartyDetails(t, petInfo);
  await managePartyPage.verifyNoPetsAddedTextMissing();

  await managePartyPage.verifyNoVehicleAddedText();
  await addVehicleInPartyDetails(t, vehicleInfo);
  await managePartyPage.verifyNoVehicleTextMissing();

  // TEST-59 Remove child
  await removeChildFromPartyDetail(t, childInfo);
  await managePartyPage.verifyNoChildrenAddedText();

  // TEST-60 Remove Pet
  await removePetFromPartyDetail(t, petInfo);
  await managePartyPage.verifyNoPetsAddedText();

  // TEST-61 Remove Vehicle
  await removeVehicleFromPartyDetail(t, vehicleInfo);
  await managePartyPage.verifyNoVehicleAddedText();
});
