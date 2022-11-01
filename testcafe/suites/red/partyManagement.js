/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, getPathName, expectDashboardLaneContains, expectVisible } from '../../helpers/helpers';
import {
  createAParty,
  backToDashboard,
  addAGuarantor,
  completeApplicationPart1,
  completeApplicationPart2,
  payApplicationFee,
  mergePersons,
  cannotMergePersonsDialogIsDisplayed,
  createAQuote,
  publishAQuote,
  selectLeaseTermInQuote,
} from '../../helpers/rentalApplicationHelpers';
import { clickSwitchTodayOnlyToggle, validateDashboardVisible, clickOnCardInDashboard } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { mergeConditions } from '../../helpers/redConstants';
import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';
import PersonCardPage from '../../pages/personCardPage';
import { addAResident } from '../../helpers/managePartyHelpers';
import { knex } from '../../../server/database/factory.js';
import { getPartyIsObsoleteValue, getEndedAsMergedAtColumn, getPartyApplicationStatus } from '../../helpers/dbQueries';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';

setHooks(fixture('Party Management'), {
  fixtureName: 'partyManagement',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

const ctx = { tenantId: TEST_TENANT_ID, dbKnex: knex };

test('TEST-1028: Verify the merge of two persons from different parties, both having a completed application', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'Felicia Sutton' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments

  const hasRequiredSteppers = false;
  const skipSteppers = true;

  const residentA = getMockedApplicantDataByEmail('qatest+juliastevens@reva.tech');
  const residentB = getMockedApplicantDataByEmail('qatest+henrysimpson@reva.tech');

  await createAParty(t, { partyInfo, propertyName, contactInfo: residentA, userInfo, qualificationInfo });
  const quoteInfo = {
    index: 0,
    leaseTerms: ['12 months'],
    ...getMockedQuoteDataByUnit('1010', 1),
  };
  await createAQuote(t, quoteInfo);
  await selectLeaseTermInQuote(t, ['12 months']);
  await publishAQuote(t, residentA);
  const partyAPath = await getPathName();
  const partyAID = partyAPath.replace('/party/', '');
  await completeApplicationPart1(t, residentA, propertyName);
  await payApplicationFee(t, residentA);
  await completeApplicationPart2(t, residentA, skipSteppers, hasRequiredSteppers);

  await t.navigateTo(getTenantURL('/'));

  await createAParty(t, { partyInfo, propertyName, contactInfo: residentB, userInfo, qualificationInfo });
  const partyBPath = await getPathName();
  const partyBID = partyBPath.replace('/party/', '');
  await createAQuote(t, quoteInfo);
  await selectLeaseTermInQuote(t, ['12 months']);
  await publishAQuote(t, residentA);
  await completeApplicationPart1(t, residentB, propertyName);
  await payApplicationFee(t, residentB);
  await completeApplicationPart2(t, residentB, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(`${getTenantURL()}${partyBPath}`);
  const partyDetailPage = new PartyDetailPage(t);

  await partyDetailPage.clickOnPartyDetailTitle();
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnResidentCardByPersonName(residentB);
  await managePartyPage.clickEditContactOptionForResident();
  const personCardPage = new PersonCardPage(t);
  await personCardPage.clickAndSetPhoneNumber('+1 908 505 6524');
  await personCardPage.clickVerifyPhoneButton();
  await personCardPage.clickCreatePersonButton(); // Save edited contanct info

  await managePartyPage.clickOnResidentCardByPersonName(residentB);
  await managePartyPage.clickViewDuplicatesForResident();
  await personCardPage.personMatchingPanelIsDisplayed(residentA);

  await cannotMergePersonsDialogIsDisplayed(t);
  await t.navigateTo(getTenantURL('/'));
  await clickSwitchTodayOnlyToggle(t);
  await expectDashboardLaneContains(t, { lane: '#applicants', cardText: residentA.legalName });
  await expectDashboardLaneContains(t, { lane: '#applicants', cardText: residentB.legalName });

  // Check that the both parties show the flag isObsolete set to false
  const query1 = [...(await getPartyIsObsoleteValue(ctx, partyAID)), ...(await getPartyIsObsoleteValue(ctx, partyBID))];
  await t.expect(query1.find(row => row.isObsolete)).notOk();

  await clickOnCardInDashboard(t, '#applicants', residentA);
  const residentGuarantorC = {
    legalName: 'Barbara Peck',
    email: 'qatest+barbarapeck@reva.tech',
  };

  await partyDetailPage.clickOnPartyDetailTitle();
  await addAGuarantor(t, residentGuarantorC);
  await partyDetailPage.closeManagePartyDetailsPage();
  await backToDashboard(t);
  await validateDashboardVisible(t);

  await clickOnCardInDashboard(t, '#applicants', residentB);
  await partyDetailPage.clickOnPartyDetailTitle();
  await addAResident(t, residentGuarantorC);
  await mergePersons(t, mergeConditions.mergePersonsAndParties, userInfo, trans('NO_DUPLICATE_PARTY_FOUND_INFO6'));
  await managePartyPage.checkAndCloseNoDuplicateDialog(trans('NO_DUPLICATE_PARTY_FOUND_INFO6'));

  await managePartyPage.checkResidentIsDisplayed(residentA);
  await managePartyPage.checkResidentIsDisplayed(residentB);
  await managePartyPage.checkResidentIsDisplayed(residentGuarantorC);
  await partyDetailPage.closeManagePartyDetailsPage();
  const finalPartyPath = await getPathName();

  const finalPartyID = finalPartyPath.replace('/party/', '');
  await backToDashboard(t);
  await expectDashboardLaneContains(t, { lane: '#applicants', cardText: `${residentA.legalName}, ${residentB.legalName}, ${residentGuarantorC.legalName}` });

  // Check no record should be register in endedAsMergedAt column for new party
  const query2 = await getEndedAsMergedAtColumn(ctx, finalPartyID);
  await t.expect(query2.find(row => row.endedAsMergedAt !== null)).notOk();

  const query3 = [...(await getPartyIsObsoleteValue(ctx, partyAID)), ...(await getPartyIsObsoleteValue(ctx, partyBID))];
  await mapSeries(query3, async elem => {
    elem.partyId === finalPartyID ? await t.expect(!elem.isObsolete).ok() : await t.expect(elem.isObsolete).ok();
  });
});

test('TEST-1117: Display payments paid in another party when a person is merged in another party', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), fullName: 'Felicia Sutton' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const partyDetailPage = new PartyDetailPage(t);

  const hasRequiredSteppers = false;
  const skipSteppers = true;

  const residentB = getMockedApplicantDataByEmail('qatest+juliastevens@reva.tech');
  const residentA = getMockedApplicantDataByEmail('qatest+mauricewalker@reva.tech');

  await createAParty(t, { partyInfo, propertyName, contactInfo: residentA, userInfo, qualificationInfo });
  const partyALocation = await getPathName();
  const partyAID = partyALocation.replace('/party/', '');
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  const managePartyPage = new ManagePartyPage(t);

  await addAResident(t, residentB);
  await managePartyPage.verifyPartyMemberAdded(residentB);
  await managePartyPage.closeManageParty();
  await completeApplicationPart1(t, residentA, propertyName);
  await payApplicationFee(t, residentA);
  await completeApplicationPart2(t, residentA, skipSteppers, hasRequiredSteppers);
  await t.navigateTo(`${getTenantURL()}${partyALocation}`);
  await completeApplicationPart1(t, residentB, propertyName);
  await payApplicationFee(t, residentB);
  await completeApplicationPart2(t, residentB, skipSteppers, hasRequiredSteppers);

  await t.navigateTo(`${getTenantURL()}`);

  const residentAInfo = {
    legalName: 'Maurice Walker',
  };
  await createAParty(t, { partyInfo, propertyName, contactInfo: residentAInfo, userInfo, qualificationInfo });
  const partyBLocation = await getPathName();
  const partyBID = partyBLocation.replace('/party/', '');
  await partyDetailPage.clickOnPartyDetailTitle();
  await managePartyPage.clickOnResidentCardByPersonName(residentAInfo);
  await managePartyPage.clickEditContactOptionForResident();
  await mergePersons(t, mergeConditions.mergeOnlyPersonsSameProp, userInfo, trans('NO_DUPLICATE_PARTY_FOUND_INFO4'));
  await t.navigateTo(`${getTenantURL()}${partyBLocation}`);
  await partyDetailPage.checkPaidInADifferentPartyLabelIsDisplayed(t);

  // Check if residents from PartyA and PartyB has application status completed
  const query = [...(await getPartyApplicationStatus(ctx, partyAID)), ...(await getPartyApplicationStatus(ctx, partyBID))];
  await mapSeries(query, async row => await t.expect(row.applicationStatus === 'completed').ok());
});
