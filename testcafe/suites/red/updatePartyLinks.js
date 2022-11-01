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
  removeGuarantorLinkFromResident,
  validateMissingResidentLink,
  linkResidentToGuarantor,
  editResidentLinkFromGuarantor,
  editGuarantorLinkFromResident,
  movePersonResidentToGuarantor,
  movePersonGuarantorToResident,
} from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedGuarantorDataByEmail, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';

setHooks(fixture('Update Party Links From Manage Party Page'), {
  fixtureName: 'updatePartyLinks',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-69, TEST-77, TEST-78: Validates the creation, update and removal of links between guarantors and residents', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party, contact info, guarantor info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const guarantorInfo = getMockedGuarantorDataByEmail('qatest+kattiesmith@reva.tech');
  const guarantorInfo2 = getMockedGuarantorDataByEmail('qatest+marydoe@reva.tech');

  // TEST-51: Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  const partyDetailPage = new PartyDetailPage(t);

  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  // TEST-53: Add a new Guarantor to the party
  await addAGuarantor(t, guarantorInfo);

  // TEST-65 Link Guarantor to a resident from the party
  await linkGuarantorToResident(t, contactInfo, guarantorInfo);

  // TEST-67 Remove the Guarantor link from Residents section
  await removeGuarantorLinkFromResident(t);

  await validateMissingResidentLink(t, guarantorInfo);

  // TEST-66 Link Resident to a guarantor from the party
  await linkResidentToGuarantor(t, guarantorInfo, contactInfo);

  // TEST-68 Edit Residents link from Guarantor section
  await editResidentLinkFromGuarantor(t, guarantorInfo, contactInfo);

  await validateMissingResidentLink(t, guarantorInfo);

  await linkGuarantorToResident(t, contactInfo, guarantorInfo);

  await addAGuarantor(t, guarantorInfo2);

  // TEST-69 Edit Guarantor link from Residents section
  await editGuarantorLinkFromResident(t, contactInfo, guarantorInfo2);

  // TEST-77 Move a person from Resident to Guarantor
  await movePersonResidentToGuarantor(t, contactInfo);

  await validateMissingResidentLink(t, contactInfo);

  // TEST-78 Move a person from Guarantor to Resident
  await movePersonGuarantorToResident(t, guarantorInfo2);
});
