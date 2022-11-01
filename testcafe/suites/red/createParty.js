/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, expectVisible, getTenantURL, getUserPassword, doLogoutIfNeeded } from '../../helpers/helpers';
import {
  createAParty,
  addAGuarantor,
  linkGuarantorToResident,
  addChildInPartyDetails,
  addPetInPartyDetails,
  addVehicleInPartyDetails,
  addOccupantInPartyDetails,
  validateOccupantsSection,
} from '../../helpers/rentalApplicationHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedGuarantorDataByEmail, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { mockPartyAdditionalInfo } from '../../helpers/partyAdditionalInfo';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';

setHooks(fixture('Create Party From Lease Application'), {
  fixtureName: 'createParty',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-51, TEST-53, TEST-56, TEST-57, TEST-58, TEST-65, TEST-494, TEST-488: Create Party from lease app with resident, guarantor, child, pet, vehicle and occupant', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const partyDetailPage = new PartyDetailPage(t);

  // defines party, contact info, guarantor info
  const { partyInfo, qualificationInfo, occupantInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const { childInfo, petInfo, vehicleInfo } = mockPartyAdditionalInfo;
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const guarantorInfo = getMockedGuarantorDataByEmail('qatest+kattiesmith@reva.tech');

  // TEST-51: Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  // TEST-53: Add a new Guarantor to the party
  await addAGuarantor(t, guarantorInfo);

  // TEST-65 Link Guarantor to a resident from the party
  await linkGuarantorToResident(t, contactInfo, guarantorInfo);

  // TEST-56: Add a new child to the party
  await addChildInPartyDetails(t, childInfo);

  // TEST-57: Add a new pet to the party
  await addPetInPartyDetails(t, petInfo);

  // TEST-58 Add a new vehicle to the party
  await addVehicleInPartyDetails(t, vehicleInfo);

  // TEST-494 Add occupants to a traditional party
  const [occupant] = occupantInfo;
  await addOccupantInPartyDetails(t, occupant);

  // TEST-488: Occupant does not need to be linked
  await partyDetailPage.clickOnPartyDetailTitle();
  await validateOccupantsSection(t, 'traditional');
});
