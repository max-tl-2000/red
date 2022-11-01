/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import {
  loginAs,
  expectVisible,
  getTenantURL,
  getUserPassword,
  clickOnCard,
  expectDashboardLaneContainsCorporateParty,
  doLogoutIfNeeded,
  clickOnElement,
  getLocation,
  getPartyIdFromUrl,
  expectNotVisible,
} from '../../helpers/helpers';
import {
  createAParty,
  addOccupantInPartyDetails,
  validateOccupantsSection,
  backToDashboard,
  createCorporatePartyWithoutCompanyDetails,
  checkCorporateWarnings,
  checkCompanyDetailsSectionWhenNoPOC,
  addCompanyDetails,
  checkCompanyDetailsSectionWithPOC,
  checkNoCorporateWarnings,
  editCompanyDetails,
  mergePersons,
  createAQuote,
  publishAQuote,
  checkEditCompanyDetailsForActiveLease,
} from '../../helpers/rentalApplicationHelpers';
import { promoteQuoteToLease, publishLease, signLease, counterSignLease } from '../../helpers/leasingApplicationHelpers';
import { validateDashboardVisible, clickSwitchTodayOnlyToggle } from '../../helpers/dashboardHelpers';
import { getSeededPartyByParentId } from '../../../server/dal/partyRepo.js';

import { mockPartyData, getMockedQuoteDataByUnit, LeaseTypes } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { mergeConditions } from '../../helpers/redConstants';
import { now } from '../../../common/helpers/moment-utils';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';

import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';
import BasePage from '../../pages/basePage';

const ctx = { tenantId: TEST_TENANT_ID };

setHooks(fixture('Create Party From Lease Application'), {
  fixtureName: 'createCorporatePartyWithoutCompanyDetails',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

test('TEST-510: Create a corporate party with an occupant', async t => {
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const partyDetailPage = new PartyDetailPage(t);

  const { partyInfo, qualificationInfo, companyInfo, occupantInfo } = mockPartyData;
  const propertyName = partyInfo.properties[0].displayName;

  // TEST-510 Create a corporate party with an occupant
  await createAParty(t, { partyInfo, propertyName, userInfo, qualificationInfo, companyInfo });
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });

  await backToDashboard(t);
  await clickSwitchTodayOnlyToggle(t);

  await expectDashboardLaneContainsCorporateParty(t, { lane: '#leads', cardText: companyInfo.companyName });

  await clickOnCard(t, { lane: '#leads', cardText: companyInfo.companyName });

  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  const [, occupant] = occupantInfo;
  const closeDialogOnAdd = false;
  await addOccupantInPartyDetails(t, occupant, closeDialogOnAdd);
  await validateOccupantsSection(t, 'corporate');
});

test.skip('TEST-1993:Create a corporate party without company details', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Parkmerced Leasing' };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const partyDetailPage = new PartyDetailPage(t);
  const managePartyPage = new ManagePartyPage(t);
  const basePage = new BasePage(t);

  const { partyInfo, qualificationInfo, companyInfo, occupantInfo } = mockPartyData;
  const propertyName = partyInfo.properties[0].displayName;
  const companyNameTextOne = 'Colgate';
  const companyNameTextTwo = 'Nespresso';
  const companyNameTextTwoAfterEdit = 'Edit';
  const companyInfoTwo = {
    companyName: 'Nespresso',
    contactName: 'Josh Helpman',
    phone: '+1 908 555 4570',
    formattedPhone: '(908) 555-4570',
  };
  const pointOfContactInfo = {
    legalName: 'Josh Helpman',
  };
  const quoteData = getMockedQuoteDataByUnit('1010', 1);
  const quoteInfo = {
    index: 0,
    leaseStartDate: '1',
    leaseTerms: ['6 months'],
    ...quoteData,
  };
  const leaseStartDate = now({ timezone: propertyName.timezone }).startOf('day');

  // create first corporate party without company details
  await createCorporatePartyWithoutCompanyDetails(t, { partyInfo, propertyName, userInfo, qualificationInfo, companyInfo });
  const partyUrlOne = await getLocation();
  // check the warnings from the manage party details page when having no company details
  await checkCorporateWarnings(t);
  // check and complete the company details
  await checkCompanyDetailsSectionWhenNoPOC(t);
  await addCompanyDetails(t, companyNameTextOne);
  await partyDetailPage.closeManagePartyDetailsPage();
  await partyDetailPage.clickOnPartyDetailTitle();
  await checkNoCorporateWarnings(t);
  await checkCompanyDetailsSectionWithPOC(t, companyNameTextOne);

  // TEST-1997:Create a corporate party with a contact person belonging to multiple parties
  await partyDetailPage.closeManagePartyDetailsPage();
  await backToDashboard(t);
  // create a second corporate party having the same POC
  await createCorporatePartyWithoutCompanyDetails(t, { partyInfo, propertyName, userInfo, qualificationInfo, companyInfo: companyInfoTwo });

  // merge the two POCs
  const partyUrl = await getLocation();
  await partyDetailPage.clickOnPartyDetailTitle();
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}` });
  await managePartyPage.clickOnPOCCardByPOCName(companyInfo);
  await managePartyPage.clickViewDuplicatesForResident();
  await mergePersons(t, mergeConditions.mergePOC, userInfo);

  // check the associated companies with the POC
  await managePartyPage.clickOnPOCCardByPOCName(companyInfo);
  await managePartyPage.clickOpenDetailsForResident();
  await expectVisible(t, { selector: partyDetailPage.selectors.associatedCompaniesSection, text: `${companyNameTextOne} - ${trans('ONE_OPEN_PARTY')}` });
  await expectVisible(t, {
    selector: partyDetailPage.selectors.associatedCompaniesSection,
    text: `${trans('NO_COMPANY_NAME_SET')} - ${trans('ONE_OPEN_PARTY')}`,
  });

  // add company details to the second corporate party
  await t.navigateTo(partyUrl);
  await partyDetailPage.clickOnPartyDetailTitle();
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}` });
  await checkCompanyDetailsSectionWhenNoPOC(t);
  await addCompanyDetails(t, companyNameTextTwo);

  // TEST - 2000:Edit POC and company details for a corporate party
  // edit company details for a new lease party
  await editCompanyDetails(t, companyNameTextTwo, companyNameTextTwoAfterEdit);

  // check the associated companies with the POC
  await managePartyPage.clickOnPOCCardByPOCName(companyInfo);
  await managePartyPage.clickOpenDetailsForResident();
  await expectVisible(t, { selector: partyDetailPage.selectors.associatedCompaniesSection, text: `${companyNameTextOne} - ${trans('ONE_OPEN_PARTY')}` });
  await expectVisible(t, {
    selector: partyDetailPage.selectors.associatedCompaniesSection,
    text: `${companyNameTextTwoAfterEdit} - ${trans('ONE_OPEN_PARTY')}`,
  });

  // spawning an active lease from second corporate party
  await t.navigateTo(partyUrl);
  await createAQuote(t, quoteInfo, true, { leaseStartDate, timezone: propertyName.timezone });
  await publishAQuote(t, companyInfoTwo, { leaseType: LeaseTypes.CORPORATE_LEASE });
  await promoteQuoteToLease(t, quoteInfo);
  await publishLease(t);
  await partyDetailPage.runProcessWorkflowsJob();

  // get active lease party Id
  const parentPartyId = await getPartyIdFromUrl();
  const activeLeaseParty = await getSeededPartyByParentId(ctx, parentPartyId);
  await t.navigateTo(`${getTenantURL()}/party/${activeLeaseParty.id}`);

  // edit company details for an active lease party
  await partyDetailPage.clickOnPartyDetailTitle();
  await checkEditCompanyDetailsForActiveLease(t, companyNameTextTwoAfterEdit);

  // check the associated companies with the POC
  await partyDetailPage.clickOnPartyDetailTitle();
  await managePartyPage.clickOnPOCCardByPOCName(companyInfo);
  await managePartyPage.clickOpenDetailsForResident();
  const numberOfOpenParties = 2;
  await expectVisible(t, { selector: partyDetailPage.selectors.associatedCompaniesSection, text: `${companyNameTextOne} - ${trans('ONE_OPEN_PARTY')}` });
  await expectVisible(t, {
    selector: partyDetailPage.selectors.associatedCompaniesSection,
    text: `${companyNameTextTwoAfterEdit} - ${trans('X_OPEN_PARTIES', { count: numberOfOpenParties })}`,
  });

  // archiving the new lease workflow for the second corporate party
  await t.navigateTo(partyUrl);
  await signLease(t, pointOfContactInfo);
  await t.navigateTo(partyUrl);
  await counterSignLease(t, userInfo);
  await t.navigateTo(partyUrl);
  await partyDetailPage.runProcessWorkflowsJob();

  // check the associated companies with the POC
  await t.navigateTo(partyUrlOne);
  await partyDetailPage.clickOnPartyDetailTitle();
  await managePartyPage.clickOnPOCCardByPOCName(companyInfo);
  await managePartyPage.clickOpenDetailsForResident();
  await expectVisible(t, { selector: partyDetailPage.selectors.associatedCompaniesSection, text: `${companyNameTextOne} - ${trans('ONE_OPEN_PARTY')}` });
  await expectVisible(t, {
    selector: partyDetailPage.selectors.associatedCompaniesSection,
    text: `${companyNameTextTwoAfterEdit} - ${trans('ONE_OPEN_PARTY')}`,
  });

  // TEST - 2000:Edit POC and company details for a corporate party
  // try to remove POC when no guarantors/occupants
  await t.navigateTo(partyUrlOne);
  await partyDetailPage.clickOnPartyDetailTitle();
  await managePartyPage.clickOnPOCCardByPOCName(companyInfo);
  await managePartyPage.clickRemoveResidentFromParty();
  await expectVisible(t, { selector: managePartyPage.selectors.dialogOverlay, text: trans('CLOSE_PARTY_CONFIRMATION') });
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.cancelBtn}` });

  // try to remove POC when there is an occupant in the party
  const [, occupant] = occupantInfo;
  const closeDialogOnAdd = false;
  await addOccupantInPartyDetails(t, occupant, closeDialogOnAdd);
  await managePartyPage.clickOnPOCCardByPOCName(companyInfo);
  await managePartyPage.clickRemoveResidentFromParty();
  await expectVisible(t, {
    selector: managePartyPage.selectors.dialogOverlay,
    text: trans('REMOVE_MEMBER_CONFIRMATION_QUESTION', { name: companyInfoTwo.contactName }),
  });
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}` });
  await expectVisible(t, { selector: managePartyPage.selectors.addResidentBtn });
  await expectNotVisible(t, { selector: managePartyPage.selectors.companyDetailsSection });
});
