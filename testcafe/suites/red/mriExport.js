/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { t as trans } from 'i18next';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import {
  getUserPassword,
  loginAs,
  getTenantURL,
  getSuperAdminURL,
  getSuperAdminUserPassword,
  getPathName,
  getLocation,
  expectBtnDisabled,
} from '../../helpers/helpers';
import { mockPartyData, getMockedContactInfoByEmail, getMockedQuoteDataByUnit } from '../../helpers/mockDataHelpers';
import { createAParty, createAQuote, publishAQuote } from '../../helpers/rentalApplicationHelpers';
import { schedulePastTour, markTourAsDone } from '../../helpers/appointmentHelper';
import { setHooks } from '../../helpers/hooks';
import SuperAdminPage from '../../pages/superAdminPage';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import LeaseApplicationPage from '../../pages/leaseApplicationPage';
import LeaseFormPage from '../../pages/leaseFormPage';

import {
  approveIncompleteScreening,
  publishLease,
  signLease,
  counterSignLease,
  selectOrUnselctConcession,
  leaseDatesChecks,
  checkConcessionAmount,
  viewOrEditLease,
  closeLeaseForm,
  selectPartyRepresentative,
} from '../../helpers/leasingApplicationHelpers';
import { knex } from '../../../server/database/factory.js';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import {
  getMriGuestCardRequestBody,
  getMriClearSelectedUnitRequestBody,
  getMriSelectUnitRequestBody,
  getMriConfirmLeaseRequestBody,
  checkLeaseTermData,
} from '../../helpers/dbQueries';
import { read } from '../../../common/helpers/xfs';
import { now } from '../../../common/helpers/moment-utils';
import { parseXmlResult } from '../../helpers/xml/xmlHelper';

setHooks(
  fixture('Create a party, mark as done a tour, create and publish a quote, execute a lease and check all the relevant MRI requests for this actions. ').meta({
    smoke: 'false',
  }),
  {
    fixtureName: 'MRI export',
    skipDatabaseRestore: false,
  },
);

const ctx = { tenantId: TEST_TENANT_ID, dbKnex: knex };

test.skip('TEST - 544, TEST - 558', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Acme Leasing', index: 1 };
  const superAdminUserInfo = { user: 'admin', password: getSuperAdminUserPassword() };

  // set backend mode to MRI
  await t.navigateTo(getSuperAdminURL('/'));
  await loginAs(t, superAdminUserInfo);
  const superAdminPage = new SuperAdminPage(t);
  await superAdminPage.setBackendMode('MRI');

  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // define party and contact info
  const { partyInfo, qualificationInfoAcme } = mockPartyData;
  const residentOneEmailAddress = 'qatest+lillibrown@reva.tech';
  const firstTimeSlot = '14:00:00';
  const resOneContactInfo = getMockedContactInfoByEmail(residentOneEmailAddress);
  const property = partyInfo.properties[3]; // Acme Apartments
  const quoteInfo = {
    index: 0,
    baseRent: 1056,
    displayedBaseRent: '$1,056',
    leaseTermsLength: ['1 month', '6 months'],
    ...getMockedQuoteDataByUnit('101'),
  };
  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
  };

  const leaseApplicationPage = new LeaseApplicationPage(t);
  const quoteDraftPage = new QuoteDraftPage(t);
  const leaseFormPage = new LeaseFormPage(t);

  const concessionSelectors = {
    checkBox: quoteDraftPage.selectors.heroesProgramConcessionCheckBox,
    isEditable: true,
    amountSelector: quoteDraftPage.selectors.heroesProgramConcessionAmount,
    amountText6Months: '$346.80',
    amountText5Months: '$289.00',
  };

  // create party
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo: resOneContactInfo, userInfo, qualificationInfo: qualificationInfoAcme });
  const partyPath = await getPathName();
  const partyId = partyPath.replace('/party/', '');

  const tryGetRequestResult = async (getRequestResult, myctx, mypartyId) => {
    let result = await getRequestResult(myctx, mypartyId);
    let retries = 20;
    while (!result && retries > 0) {
      await t.wait(2000);
      result = await getRequestResult(myctx, mypartyId);
      retries -= 1;
    }
    if (!result) {
      throw new Error(`The Request results for ${getRequestResult} was not populated in the DB`);
    } else {
      console.log(`will return ${result}`);
      return await result;
    }
  };

  // create and mark as done a past tour
  await schedulePastTour(t, firstTimeSlot);
  await markTourAsDone(t);
  const currentPartyUrl = await getLocation();

  // check guest card request body for the completed tour
  const requestBodyGuestCard = await tryGetRequestResult(getMriGuestCardRequestBody, ctx, partyId);
  const responseGuestCard = await read(path.resolve(__dirname, '../../helpers/xml/guestCardRequestBody.xml'));

  const responseGuestCardFormat = await parseXmlResult(responseGuestCard.toString());
  const responseFormatGuestCardKeys = Object.keys(responseGuestCardFormat);

  const requestBodyGuestCardFormat = await parseXmlResult(requestBodyGuestCard.toString());
  const requestBodyGuestCardFormatKeys = Object.keys(requestBodyGuestCardFormat);

  await t.expect(requestBodyGuestCardFormatKeys).eql(responseFormatGuestCardKeys);

  // create and publish a quote
  await createAQuote(t, quoteInfo, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });
  await quoteDraftPage.selectLeaseTerms(quoteInfo.leaseTermsLength);
  await selectOrUnselctConcession(t, concessionSelectors, false);
  await publishAQuote(t, resOneContactInfo);

  // create and publish a lease
  await approveIncompleteScreening(t, quoteInfo);

  // TEST-1425:Agent should confirm lease term length when the lease start or end date is changed in the lease form
  await checkConcessionAmount(t, concessionSelectors.amountSelector, concessionSelectors.amountText6Months);

  const leaseDateEditForDisplayingDialog = {
    leaseStartDate: currentDate.clone().add(8, 'day'),
    moveInDateError: trans('LEASE_FORM_MOVE_IN_DATE_VALIDATION_2'),
  };

  const dialogDropdownLeaseTermsOne = {
    firstLeaseTermOption: '5 months',
    secondLeaseTermOption: '6 months',
  };

  const initialLeaseEndDate = currentDate.clone().add(6, 'months');
  const eightDaysAheadDate = currentDate.clone().add(8, 'day');

  // change the lease start date, pick a new lease term and check if concession amount is being updated
  await leaseDatesChecks(
    t,
    { leaseDates: leaseDateEditForDisplayingDialog },
    dialogDropdownLeaseTermsOne.firstLeaseTermOption,
    dialogDropdownLeaseTermsOne.secondLeaseTermOption,
  );
  await checkConcessionAmount(t, concessionSelectors.amountSelector, concessionSelectors.amountText5Months);
  await expectBtnDisabled(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });
  await selectOrUnselctConcession(t, concessionSelectors, false);

  // select a party representative
  await selectPartyRepresentative(t, resOneContactInfo.legalName);

  // change move in date to enable the publish lease button
  await leaseFormPage.selectLeaseDate(t, leaseFormPage.selectors.moveInDateTxt, eightDaysAheadDate, property.timezone);
  await publishLease(t, { sendLater: false, snackbarMessage: trans('SIGN_LEASE_EMAIL_SUCCESS') });

  // check the initial and the published term length in DB
  const leaseTermLength = {
    initialTermLength: '6',
    publishedTermLength: '5',
  };
  const leaseData = await checkLeaseTermData({ tenantId: TEST_TENANT_ID }, partyId, leaseTermLength.initialTermLength, leaseTermLength.publishedTermLength);
  await t.expect(leaseData.length).eql(1);

  // check the confirm lease term dialog when editing the lease
  await viewOrEditLease(t);
  await leaseFormPage.selectLeaseDate(t, leaseFormPage.selectors.leaseEndDateTxt, initialLeaseEndDate.clone().add(8, 'day'), property.timezone);
  await leaseFormPage.checkTermLengthDialogIsNotDisplayed(t);
  await leaseFormPage.selectLeaseDate(t, leaseFormPage.selectors.leaseEndDateTxt, initialLeaseEndDate.clone().add(15, 'day'), property.timezone);

  const dialogDropdownLeaseTermsTwo = {
    firstLeaseTermOption: '6 months',
    secondLeaseTermOption: '7 months',
  };

  await leaseFormPage.confirmLeaseTermLengthDialog(dialogDropdownLeaseTermsTwo.firstLeaseTermOption, dialogDropdownLeaseTermsTwo.secondLeaseTermOption);

  await leaseFormPage.selectLeaseDate(t, leaseFormPage.selectors.leaseStartDateTxt, eightDaysAheadDate.clone().add(6, 'day'), property.timezone);
  await leaseFormPage.checkTermLengthDialogIsNotDisplayed(t);
  await leaseFormPage.selectLeaseDate(t, leaseFormPage.selectors.leaseStartDateTxt, eightDaysAheadDate.clone().add(15, 'day'), property.timezone);

  await leaseFormPage.confirmLeaseTermLengthDialog(dialogDropdownLeaseTermsOne.firstLeaseTermOption, dialogDropdownLeaseTermsOne.secondLeaseTermOption);

  const shouldDiscardChanges = true;
  await closeLeaseForm(t, shouldDiscardChanges);

  // check clear selected unit request body for published lease
  const requestBodyClearSelectedUnit = await tryGetRequestResult(getMriClearSelectedUnitRequestBody, ctx, partyId);
  const responseClear = await read(path.resolve(__dirname, '../../helpers/xml/clearSelectedUnitRequestBody.xml'));

  const responseClearFormat = await parseXmlResult(responseClear.toString());
  const responseClearFormatKeys = Object.keys(responseClearFormat);

  const requestClearBodyFormat = await parseXmlResult(requestBodyClearSelectedUnit.toString());
  const requestClearBodyFormatKeys = Object.keys(requestClearBodyFormat);

  await t.expect(requestClearBodyFormatKeys).eql(responseClearFormatKeys);

  // check select unit request body for published lease
  const requestBodySelectUnit = await tryGetRequestResult(getMriSelectUnitRequestBody, ctx, partyId);
  const responseSelectUnit = await read(path.resolve(__dirname, '../../helpers/xml/selectUnitRequestBody.xml'));

  const responseSelectUnitFormat = await parseXmlResult(responseSelectUnit.toString());
  const responseSelectUnitFormatKeys = Object.keys(responseSelectUnitFormat);

  const requestSelectUnitBodyFormat = await parseXmlResult(requestBodySelectUnit.toString());
  const requestSelectUnitBodyFormatKeys = Object.keys(requestSelectUnitBodyFormat);

  await t.expect(requestSelectUnitBodyFormatKeys).eql(responseSelectUnitFormatKeys);

  // execute lease
  await signLease(t, resOneContactInfo);
  await t.navigateTo(currentPartyUrl);
  await counterSignLease(t, userInfo);
  await t.navigateTo(currentPartyUrl);

  // check confirm lease request body for executed lease
  const requestBodyConfirmLease = await tryGetRequestResult(getMriConfirmLeaseRequestBody, ctx, partyId);

  const responseConfirmLease = await read(path.resolve(__dirname, '../../helpers/xml/confirmLeaseRequestBody.xml'));

  const responseConfirmLeaseFormat = await parseXmlResult(responseConfirmLease.toString());
  const responseConfirmLeaseFormatKeys = Object.keys(responseConfirmLeaseFormat);

  const requestConfirmLeaseBodyFormat = await parseXmlResult(requestBodyConfirmLease.toString());
  const requestConfirmLeaseBodyFormatKeys = Object.keys(requestConfirmLeaseBodyFormat);

  await t.expect(requestConfirmLeaseBodyFormatKeys).eql(responseConfirmLeaseFormatKeys);

  // set backend mode back to NONE
  await t.navigateTo(getSuperAdminURL('/'));
  await superAdminPage.setBackendMode('None');
});
