/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, getPathName, expectVisible, expectNotVisible, clickOnElement } from '../../helpers/helpers';
import {
  createAParty,
  mergePartiesFromMenu,
  backToDashboard,
  addAGuarantor,
  completeApplicationPart1,
  completeApplicationPart2,
  payApplicationFee,
  mergePersons,
  changePrimaryProperty,
  checkPartyMergeDialogDifferentProperties,
} from '../../helpers/rentalApplicationHelpers';
import { clickSwitchTodayOnlyToggle, validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { mergeConditions } from '../../helpers/redConstants';
import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';
import PersonCardPage from '../../pages/personCardPage';
import { addAResident, checkForNoMatchInParties } from '../../helpers/managePartyHelpers';
import { knex } from '../../../server/database/factory.js';
import { prepareRawQuery } from '../../../server/common/schemaConstants.js';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import { DALTypes } from '../../../common/enums/DALTypes';

import loggerInstance from '../../../common/helpers/logger';
const logger = loggerInstance.child({ subType: 'Smoke: Merge Party Management' });

setHooks(fixture('Smoke: Merge Party Management').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'mergePartyManagement',
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-620: Verify two parties with no coincidence can´t be merge', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'Felicia Sutton' };
  logger.trace('TEST-620 navigating to root');
  await t.navigateTo(getTenantURL('/'));
  logger.trace('TEST-620 logging in');
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const firstContactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const secondContactInfo = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments

  const partiesHaveCoincidences = false;
  await createAParty(t, { partyInfo, propertyName, contactInfo: firstContactInfo, userInfo, qualificationInfo });
  await backToDashboard(t);
  await clickSwitchTodayOnlyToggle(t);
  await createAParty(t, { partyInfo, propertyName, contactInfo: secondContactInfo, userInfo, qualificationInfo });

  // TEST-620:Verify two parties with no coincidence can´t be merge
  await mergePartiesFromMenu(t, partiesHaveCoincidences, trans('NO_DUPLICATE_PARTY_FOUND_INFO3'));
});

test('TEST-619: Verify system can merge persons but not parties from different properties', async t => {
  const userInfo = {
    user: 'admin@reva.tech',
    password: getUserPassword(),
    fullName: 'Reva Admin',
    team: 'Bay Area Call Center',
    teamOneChange: 'Coastal Palace',
    teamTwoChange: 'Seascape Sunset',
  };

  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+lillibrown@reva.tech');
  const propertyName1 = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const propertyName2 = partyInfo.properties[1].displayName; // The Cove at Tiburon

  const partiesHaveCoincidences = false;
  await createAParty(t, { partyInfo, propertyName: propertyName1, contactInfo, userInfo, qualificationInfo });
  const partyALocation = await getPathName();

  await backToDashboard(t);
  await clickSwitchTodayOnlyToggle(t);

  // TEST-619:Verify system can merge persons but not parties from different properties
  await createAParty(
    t,
    { partyInfo, propertyName: propertyName2, contactInfo, userInfo, qualificationInfo, mergeDialogBody: trans('NO_DUPLICATE_PARTY_FOUND_INFO6') },
    mergeConditions.mergeOnlyPersonsDiffProp,
  );
  const partyBLocation = await getPathName();

  // TEST-620:Verify two parties with no coincidence can´t be merge
  await mergePartiesFromMenu(t, partiesHaveCoincidences, trans('NO_DUPLICATE_PARTY_FOUND_INFO3'));

  // Back to party details page
  await t.navigateTo(partyALocation);
  await mergePartiesFromMenu(t, partiesHaveCoincidences, trans('NO_DUPLICATE_PARTY_FOUND_INFO3'));

  // TEST-2001:Merge parties from the same party cohort but from different properties
  const partyDetailPage = new PartyDetailPage(t);
  const managePartyPage = new ManagePartyPage(t);
  // change initial properties to properties from the  same party cohort
  await changePrimaryProperty(t, userInfo.teamOneChange, partyInfo.properties[0].displayName, partyInfo.properties[5].displayName);
  await checkForNoMatchInParties(t);
  await t.navigateTo(partyBLocation);
  await changePrimaryProperty(t, userInfo.teamTwoChange, partyInfo.properties[1].displayName, partyInfo.properties[6].displayName);
  // check property selector from party merge dialog and then merge parties
  await checkPartyMergeDialogDifferentProperties(t, partyInfo.properties[5].displayName, partyInfo.properties[6].displayName);
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.propertySelectorDropdown).withText(partyInfo.properties[5].displayName) });
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.employeeSelectorBtn) });
  await partyDetailPage.selectAgentInMergePartiesDialog(userInfo.fullName);
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.mergePartiesBtn) });
  // check if the surviving party has the correct property
  await clickOnElement(t, { selector: managePartyPage.selectors.noDuplicateDialogOkBtn });
  clickOnElement(t, {
    selector: $(partyDetailPage.selectors.partySummaryBodySection).find('p').withText(partyInfo.properties[5].displayName),
  });
});

test('TEST-427: Verify the party owner from "Merging parties" dialog should be displayed on top', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'Felicia Sutton' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const contactInfo = getMockedContactInfoByEmail('qatest+mathewgates@reva.tech');

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await backToDashboard(t);
  await clickSwitchTodayOnlyToggle(t);

  // TEST-427:Merge : Owner should be displayed on top of the list
  // mergePersonsAndParties condition allows to merge persons and party.
  // The owner given (Felicia Sutton) is the one that is selected to do the merge
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo }, mergeConditions.mergePersonsAndParties);
});

test('TEST-414:Merge two parties where the same member is an resident in one party and guarantor in another party', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'Felicia Sutton' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments

  const hasRequiredSteppers = false;
  const skipSteppers = true;

  const partyAMembers = {
    residentA1: {
      legalName: 'Alan Davis',
      email: 'qatest+alandavis@reva.tech',
    },
    residentA2: {
      legalName: 'Barbara Peck',
      email: 'qatest+barbarapeck@reva.tech',
      phone: '+1 908 505 6520',
      formattedPhone: '(908) 505-6520',
    },
  };
  const partyBMembers = {
    residentB: {
      legalName: 'Cassie Stewart',
      email: 'qatest+cassiestewart@reva.tech',
    },
    guarantorA: {
      legalName: 'Danny Robesrts',
      email: 'qatest+dannyroberts@reva.tech',
      phone: '+1 908 505 6520',
      formattedPhone: '(908) 505-6520',
    },
  };

  await createAParty(t, { partyInfo, propertyName, contactInfo: partyAMembers.residentA1, userInfo, qualificationInfo });
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();
  await addAResident(t, partyAMembers.residentA2);
  await partyDetailPage.closeManagePartyDetailsPage();
  const partyAPath = await getPathName();
  const applicantData = {
    residentA1: {
      legalName: 'Alan Davis',
      preferredName: 'Alan Davis',
      email: 'qatest+alandavis@reva.tech',
      dateOfBirth: '03/30/1985',
      grossIncome: '3500',
      addressLine1: '422 Massachusetts Avenue Northwest',
      city: 'Washington',
      state: 'Massachusetts (MA)',
      zipCode: '02474',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
      cardInfo: {
        name: 'Alan Davis',
        number: '4242424242424242',
        cvv: '122',
        expirationDate: '03',
        expirationYear: '2025',
      },
    },
    residentA2: {
      legalName: 'Barbara Peck',
      email: 'qatest+barbarapeck@reva.tech',
      preferredName: 'Barbara Peck',
      phone: '+1 908 505 6520',
      formattedPhone: '(908) 505-6520',
      dateOfBirth: '03/30/1985',
      grossIncome: '3500',
      addressLine1: '422 Massachusetts Avenue Northwest',
      city: 'Washington',
      state: 'Massachusetts (MA)',
      zipCode: '02474',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 2,
      cardInfo: {
        name: 'Barbara Peck',
        number: '4242424242424242',
        cvv: '122',
        expirationDate: '03',
        expirationYear: '2025',
      },
    },
    residentB: {
      legalName: 'Cassie Stewart',
      email: 'qatest+cassiestewart@reva.tech',
      preferredName: 'Cassie Stewart',
      dateOfBirth: '03/30/1985',
      grossIncome: '3500',
      addressLine1: '422 Massachusetts Avenue Northwest',
      city: 'Washington',
      state: 'Massachusetts (MA)',
      zipCode: '02474',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
      cardInfo: {
        name: 'Cassie Stewart',
        number: '4242424242424242',
        cvv: '122',
        expirationDate: '03',
        expirationYear: '2025',
      },
    },
  };

  await completeApplicationPart1(t, applicantData.residentA1, propertyName);
  await payApplicationFee(t, applicantData.residentA1);
  await completeApplicationPart2(t, applicantData.residentA1, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(`${getTenantURL()}${partyAPath}`);
  await completeApplicationPart1(t, applicantData.residentA2, propertyName);
  await payApplicationFee(t, applicantData.residentA2);
  await completeApplicationPart2(t, applicantData.residentA2, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(getTenantURL('/'));
  await createAParty(t, { partyInfo, propertyName, contactInfo: partyBMembers.residentB, userInfo, qualificationInfo });
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  const partyBPath = await getPathName();
  const partyBID = partyBPath.replace('/party/', '');

  await partyDetailPage.clickOnPartyDetailTitle();
  await addAGuarantor(t, partyBMembers.guarantorA);
  await partyDetailPage.closeManagePartyDetailsPage();
  await completeApplicationPart1(t, applicantData.residentB, propertyName);
  await payApplicationFee(t, applicantData.residentB);
  await completeApplicationPart2(t, applicantData.residentB, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(`${getTenantURL()}${partyAPath}`);

  const personA2Id = await knex.raw(
    prepareRawQuery(`SELECT p."id" FROM db_namespace."Person" as p WHERE p."fullName" = '${partyAMembers.residentA2.legalName}'`, TEST_TENANT_ID),
  );
  const residentA2Id = personA2Id.rows.find(row => row).id;

  await partyDetailPage.clickOnPartyDetailTitle(t);
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.checkPosibleDuplicatePartyMember(applicantData.residentA2);
  await managePartyPage.clickOnResidentCardByPersonName(applicantData.residentA2);
  await managePartyPage.clickViewDuplicatesForResident();
  const personCardPage = new PersonCardPage(t);
  await personCardPage.personMatchingPanelIsDisplayed(partyBMembers.guarantorA);
  await mergePersons(t, mergeConditions.mergePersonsAndParties, userInfo, trans('NO_DUPLICATE_PARTY_FOUND_INFO6'));
  await managePartyPage.checkAndCloseNoDuplicateDialog(trans('NO_DUPLICATE_PARTY_FOUND_INFO6'));

  await partyDetailPage.clickOnPartyDetailTitle(t);
  await managePartyPage.checkResidentIsDisplayed(partyAMembers.residentA1);
  await managePartyPage.checkResidentIsDisplayed(partyAMembers.residentA2);
  await managePartyPage.checkResidentIsDisplayed(partyBMembers.residentB);
  await managePartyPage.checkGuarantorIsDisplayed(partyBMembers.guarantorA, false);
  await expectNotVisible(t, { selector: managePartyPage.selectors.possibleDuplicateBanner });

  // No record should be register in endedAsMergedAt column for new party
  const personsApplicationRow = await knex.raw(
    prepareRawQuery(
      `SELECT pa."id", pa."personId", pa."partyId", pa."partyApplicationId", pa."endedAsMergedAt"
      FROM db_namespace."rentapp_PersonApplication" as pa
      WHERE pa."partyId" = '${partyBID}'`,
      TEST_TENANT_ID,
    ),
  );
  await t.expect(personsApplicationRow.rows.find(row => row.endedAsMergedAt !== null)).notOk();

  const residentA2ApplicationRow = await knex.raw(
    prepareRawQuery(
      `SELECT pa."id", pa."personId", pa."partyId", pa."partyApplicationId", pa."endedAsMergedAt"
      FROM db_namespace."rentapp_PersonApplication" as pa
      WHERE pa."personId" = '${residentA2Id}'`,
      TEST_TENANT_ID,
    ),
  );

  // The person (ResidentB) should be added in the party with the same personId
  await t.expect(residentA2ApplicationRow.rowCount === 2).ok();
});
