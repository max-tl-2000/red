/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, expectVisible, getTenantURL, expectTextIsEqual } from '../../helpers/helpers';
import { createAParty, validatePartyDataCreation, addAGuarantor } from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedGuarantorDataByEmail, mockResidentInfo, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { updatePersonContactInformation, verifyGuarantorNotLinked } from '../../helpers/leasingApplicationHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { removeGuarantorFromParty, addAResident, removeResidentFromParty } from '../../helpers/managePartyHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';
import PersonDetailsPage from '../../pages/personDetailsPage';

setHooks(fixture('Create Party From Lease Application and validate it was created properly'), {
  fixtureName: 'createPartyManagement',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

test('TEST-52, TEST-54, TEST-62, TEST-63, TEST-64: Party creation input validations', async t => {
  const partyDetailPage = new PartyDetailPage(t);
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: 'red&reva#' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const mockResidentInfoToBeUpdated = {
    legalName: 'Sophia Thom',
    preferredName: 'Sophia T',
    phone: '+51 994 999 999',
    email: 'qatest+sophiathom@reva.tech',
  };
  const mockGuarantorInfoToBeUpdated = {
    legalName: 'Rafaella Budge',
    preferredName: 'Rafa B.',
    phone: '+51 994 999 991',
    email: 'qatest+rafaellabudge@reva.tech',
  };
  const mockResidentInfoForPersonDetail = {
    legalName: 'Ray Gunn',
    preferredName: 'Ray G.',
    email: 'qatest+raygunn@reva.tech',
    phone: '+51 984 745 889',
  };

  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const guarantorInfo = getMockedGuarantorDataByEmail('qatest+kattiesmith@reva.tech');

  const managePartyPage = new ManagePartyPage(t);
  const personDetailsPage = new PersonDetailsPage(t);

  // TEST-51: Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await validatePartyDataCreation(t, { propertyName, contactInfo, qualificationInfo });
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();
  await managePartyPage.clickOnResidentCardByPersonName(contactInfo);

  // TEST-52:Update contact information to a resident
  await managePartyPage.clickEditContactOptionForResident();
  await updatePersonContactInformation(t, mockResidentInfoToBeUpdated);

  // TEST-53:Add a new Guarantor to the party
  await addAGuarantor(t, guarantorInfo);
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.missingResidentLink, text: trans('MISSING_RESIDENT') });
  await managePartyPage.clickOnGuarantorCardByPersonName(guarantorInfo);
  await managePartyPage.clickEditContactInfoGuarantor();

  // TEST-54:Update contact information to a guarantor
  await updatePersonContactInformation(t, mockGuarantorInfoToBeUpdated);
  await managePartyPage.closeManageParty();
  await verifyGuarantorNotLinked(t);
  await partyDetailPage.clickOnPartyDetailTitle();

  // TEST-62:Remove Guarantor from the party
  await removeGuarantorFromParty(t, mockGuarantorInfoToBeUpdated);
  await managePartyPage.closeManageParty();
  await partyDetailPage.checkOnlyOneMemberInTheParty();
  await partyDetailPage.clickOnPartyDetailTitle();

  // TEST-63:Add a new Resident to the party
  await addAResident(t, mockResidentInfo);
  await managePartyPage.verifyPartyMemberAdded(mockResidentInfo);

  // TEST-64:Remove Resident from the party
  await removeResidentFromParty(t, mockResidentInfo);
  await managePartyPage.verifyPartyMemberRemoved(mockResidentInfo);

  // TEST-80: Update Contact Information in person detail
  await addAResident(t, mockResidentInfoForPersonDetail);
  await managePartyPage.verifyPartyMemberAdded(mockResidentInfoForPersonDetail);
  await managePartyPage.clickOnResidentCardByPersonName(mockResidentInfoForPersonDetail);
  await managePartyPage.clickOpenDetailsForResident();
  await personDetailsPage.clickOnEditPersonDetails();
  // PreferredName should be an empty character, but if we set it to an empty character the entire test fail
  // and says AssertionError: expecting selector: "#addPhoneDialog" to be visible: expected false to deeply equal true
  // on updatePersonContactInformation.
  //
  // Just to mention is not my code in general if you just clean the preferred name for instance on mockResidentInfoToBeUpdated in the TEST-52
  // from preferredName: 'Sophia T', to preferredName: '', it fails with the same error.
  const data = {
    ...mockResidentInfoForPersonDetail,
    preferredName: '',
    email: 'qatest+raygunn2@reva.tech',
    phone: '+51 984 745 879',
  };
  await personDetailsPage.updatePersonDetails(data);
  await personDetailsPage.verifyPersonDetails({
    ...mockResidentInfoForPersonDetail,
    preferredName: '',
    emails: [mockResidentInfoForPersonDetail.email],
    phones: [mockResidentInfoForPersonDetail.phone],
  });
});
