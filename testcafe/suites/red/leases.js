/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import sleep from '../../../common/helpers/sleep';
import {
  loginAs,
  getTenantURL,
  getUserPassword,
  expectBtnDisabled,
  expectBtnEnabled,
  getLocation,
  clickOnElement,
  expectVisible,
  updatingFeePrice,
  expectCheckboxState,
  getPathName,
} from '../../helpers/helpers';
import {
  reviewScreening,
  approveLease,
  publishLease,
  sendEmailLease,
  editLease,
  viewOrEditPublishedLease,
  selectInventoryItems,
  checkInventoryItems,
  validateLeaseSectionText,
  validateSnackbarMessage,
  closeLeaseForm,
  verifyDates,
  validateLeaseBaseRent,
  signLease,
  counterSignLease,
  verifyLeaseIsSignedByCounterSigner,
  viewOrEditLease,
  verifyLeaseDatesAndBaseRent,
  verifyConcessionsSelected,
  approveIncompleteScreening,
  checkFeeQuantityChanges,
  checkFeeNegativeAmount,
  checkFeeCheckBoxState,
  checkFeeValidAmountChanges,
  verifyLeaseIsExecuted,
  verifyExecutedLeaseMenuOptions,
  viewExecutedLease,
  selectOrUnselctConcession,
  verifyWarningMsg,
  verifyLeaseCannotBePublishedWithIncompleteInfo,
  verifyManageInfoCard,
  addEmailAddressAsContactInfo,
  removeAnonymousEmailAddressAsContactInfo,
  checkForReceivedEmails,
  voidExecutedLease,
  verifyPreviousDayExecutedLeaseMenuOptions,
} from '../../helpers/leasingApplicationHelpers';
import {
  createAParty,
  completeApplicationPart1,
  completeApplicationPart2,
  waiveApplicationFee,
  createAQuote,
  publishAQuote,
  selectLeaseTermInQuote,
  selectConcessionsInQuote,
  checkRentWithMinAmountLimit,
  checkConcessionWithMaxAmountLimit,
  addAGuarantor,
  validatePartyDataCreation,
  addPetInPartyDetails,
  backToDashboard,
} from '../../helpers/rentalApplicationHelpers';
import { emailSubjects } from '../../resources/emails/emailSubjects';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import { mockPartyAdditionalInfo } from '../../helpers/partyAdditionalInfo';
import { setHooks } from '../../helpers/hooks';
import { addAResident } from '../../helpers/managePartyHelpers';
import { getPartyAdditionalInfo, getInventoryByNameAndPropertyId, changeInventoryStatus, getLeasesByPartyId } from '../../helpers/dbQueries';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import LeaseApplicationPage from '../../pages/leaseApplicationPage';
import LeaseFormPage from '../../pages/leaseFormPage';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import PartyDetailPage from '../../pages/partyDetailPage';
import ManagePartyPage from '../../pages/managePartyPage';
import PartyPhaseOne from '../../pages/partyPhaseOne';
import { forceUsersLogout } from '../../../cucumber/lib/utils/apiHelper';
import { getPropertyByName } from '../../../server/dal/propertyRepo';
import { updateLease } from '../../../server/dal/leaseRepo';

const ctx = { tenantId: TEST_TENANT_ID };

setHooks(
  fixture('Create a quote, publish the quote, fill application and do the lease process with an unit from Parkmerced property').meta({
    smoke: 'true',
    smoke1: 'true',
  }),
  {
    fixtureName: 'leases',
  },
);

test('TEST-189, TEST-191, TEST-193: Leases', async t => {
  // User logs in LAA agent
  // TODO we should use a test LAA not Reva Admin
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const partyDetailPage = new PartyDetailPage(t);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const residentEmailAddress = 'ens7m.test@inbox.testmail.app';
  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const applicantData = getMockedApplicantDataByEmail(residentEmailAddress);
  const property = partyInfo.properties[0]; // Parkmerced Apartments
  const { petInfo } = mockPartyAdditionalInfo;
  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const quoteInfo = {
    index: 0,
    baseRent: 2213,
    ...getMockedQuoteDataByUnit('1019', 1),
  };
  const inventory = {
    name: quoteInfo.unitName,
    type: DALTypes.InventoryType.UNIT,
    property,
    building: {
      name: '350AR',
    },
    layout: {
      numBathrooms: 3,
      numBedrooms: 3,
    },
    inventoryFee: ['Door Fob', 'Parking indoor'],
    inventoryFeeChild: ['Door Fob', 'p101'],
    concessionsName: ['1 month free'],
    concessionsAmount: ['2213'],
  };
  const sixMonthLeaseTerm = quoteInfo.quote.leaseTerms[2];
  const promotedLeaseTerm = {
    ...sixMonthLeaseTerm,
    termLength: '1', // ConfirmLeaseTermDialog change the promoted lease based on logic
    period: DALTypes.LeasePeriod.MONTH,
    rent: parseFloat(sixMonthLeaseTerm.rentAmount.substr(1).replace(',', '')),
  };

  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(2, 'day'),
  };

  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo });
  const partyPath = await getPathName();
  const partyId = partyPath.replace('/party/', '');

  // TEST-1159:Add a pet as a service animal from manage party section
  await partyDetailPage.clickOnPartyDetailTitle();
  await addPetInPartyDetails(t, petInfo, true);
  await partyDetailPage.closeManagePartyDetailsPage();
  const additionalServicePetInfo = await getPartyAdditionalInfo(ctx, partyId);
  await t.expect(additionalServicePetInfo.length).eql(1);

  // Get location of party/id in order to back after completing application part 1 and part 2
  const partyUrl = await getLocation();

  await createAQuote(t, quoteInfo, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });
  await selectLeaseTermInQuote(t, ['24 months']);
  await selectLeaseTermInQuote(t, ['6 months']);
  await selectConcessionsInQuote(t);
  await publishAQuote(t, contactInfo);
  await waiveApplicationFee(t, contactInfo);
  // TEST-140:Complete application part 2 without filled up steppers in part 2
  await completeApplicationPart1(t, applicantData, property.displayName);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
  // Back to party details page
  await t.navigateTo(partyUrl);
  await reviewScreening(t, quoteInfo);
  await approveLease(t);

  await checkInventoryItems(t, inventory.inventoryFee);
  // TEST-526: Disable the Publish lease button until selecting an inventory item
  await selectInventoryItems(t, inventory.inventoryFee, inventory.inventoryFeeChild);

  // TEST-1163:Service animal label in the lease draft
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await leaseApplicationPage.checkPetIsServiceAnimal();

  // TEST-184 Publish Lease
  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });

  // TEST-209 Send Lease from party detail
  await validateLeaseSectionText(t, {
    inventory,
    promotedLeaseTerm,
    leaseSignedOrCreatedAt: currentDate,
    baseRent: quoteInfo.baseRent,
    leaseStatus: trans('LEASE_NOT_SENT_FOR_SIGNATURES_YET'),
  });
  await sendEmailLease(t, { ...contactInfo, rowIndex: 1, previousStatus: trans('NOT_SENT'), nextStatus: trans('SENT') });
  await validateSnackbarMessage(t, trans('SIGN_LEASE_EMAIL_SUCCESS'));
  await validateLeaseSectionText(t, {
    inventory,
    promotedLeaseTerm,
    leaseSignedOrCreatedAt: currentDate,
    baseRent: quoteInfo.baseRent,
    leaseStatus: trans('SIGNATURES_IN_PROGRESS'),
  });

  // TEST-189: Edit Lease - Discard changes
  await viewOrEditLease(t);

  const correctLeaseDates = {
    leaseStartDate: currentDate.clone().add(1, 'day'),
    leaseMoveInDate: currentDate.clone().add(2, 'day'),
    leaseEndDate: currentDate.clone().add(3, 'day'),
  };
  await editLease(t, { leaseDates: correctLeaseDates });
  const shouldDiscardChanges = true;
  await closeLeaseForm(t, shouldDiscardChanges);
  await viewOrEditPublishedLease(t);

  await verifyDates(
    t,
    {
      ...leaseDates,
      leaseMoveInDate: leaseDates.leaseMoveInDate,
    },
    property.timezone,
  );
  await closeLeaseForm(t, shouldDiscardChanges); // TODO: shouldDiscardChanges should be false once the issue in Lease is fixed (CPM-17409).

  // TEST-193:Edit Lease
  await viewOrEditLease(t);
  await verifyLeaseDatesAndBaseRent(t, { baseRent: quoteInfo.baseRent, leaseDates, promotedLeaseTerm }, property.timezone);
  await verifyConcessionsSelected(t, inventory.concessionsName, inventory.concessionsAmount);

  const wrongLeaseDatesToEdit = {
    leaseStartDate: currentDate.clone().add(10, 'days'),
    leaseMoveInDate: currentDate.clone().add(3, 'days'),
    leaseEndDate: currentDate.clone().add(7, 'days'),
    moveInDateError: trans('LEASE_FORM_MOVE_IN_DATE_VALIDATION_1'),
    endDateError: trans('LEASE_FORM_LEASE_END_DATE_VALIDATION_2'),
  };
  await editLease(t, { leaseDates: wrongLeaseDatesToEdit });
  await expectBtnDisabled(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });

  await editLease(t, { leaseDates: correctLeaseDates });
  await expectBtnEnabled(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });

  const leaseFormPage = new LeaseFormPage(t);
  const leaseData = {
    termLength: 1,
    baseRent: 2400,
  };

  await leaseFormPage.editConcessionAmount(
    leaseFormPage.selectors.baseRentLeaseTermEditor.replace('Index', leaseData.termLength),
    leaseFormPage.selectors.baseRentLeaseTermInput.replace('Index', leaseData.termLength),
    leaseData.baseRent,
  );
  await publishLease(t, { sendLater: false, snackbarMessage: trans('SIGN_LEASE_EMAIL_SUCCESS') });

  await leaseApplicationPage.checkPersonLeaseStatus(contactInfo.memberType, { rowIndex: 1, status: trans('SENT'), legalName: contactInfo.legalName });
  await validateLeaseBaseRent(t, leaseData.baseRent);

  // TEST-206 Sign Lease
  await signLease(t, contactInfo);
  await t.navigateTo(partyUrl);
  await counterSignLease(t, userInfo);
  await t.navigateTo(partyUrl);
  await verifyLeaseIsSignedByCounterSigner(t, userInfo.index);

  // TEST-1670: Registration of a new user
  await checkForReceivedEmails(t, partyId, [
    emailSubjects.ParkmercedApartments.LEASE_FOR_SIGNATURE,
    emailSubjects.ParkmercedApartments.LEASE_FOR_SIGNATURE,
    emailSubjects.ParkmercedApartments.WELCOME_EMAIL,
    emailSubjects.ParkmercedApartments.LEASE_EXECUTED,
    emailSubjects.ParkmercedApartments.RENTAL_APPLICATION,
    emailSubjects.ParkmercedApartments.LEASE_VOIDED,
    emailSubjects.ParkmercedApartments.QUOTE_EMAIL,
    emailSubjects.ParkmercedApartments.ACCOUNT_REGISTRATION_EMAIL,
  ]);
  // TODO CPM-15619:Edit Lease - Closing lease form
});

test('TEST-1617:Check if the fees amount and quantity changes from quote and lease are consistent', async t => {
  const quoteDraftPage = new QuoteDraftPage(t);
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Empyrean Horizon', index: 1 };

  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // define parties and contact infos
  const { partyInfo, qualificationInfo } = mockPartyData;
  const residentEmailAddress = 'qatest+lillibrown@reva.tech';
  const residentTwoEmailAddress = 'qatest+oliversmit@reva.tech';
  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const contactTwoInfo = getMockedContactInfoByEmail(residentTwoEmailAddress);
  const property = partyInfo.properties[2]; // Empyrean Horizon
  const quoteInfo = {
    index: 0,
    baseRent: 1115,
    displayedBaseRent: '$1,115',
    ...getMockedQuoteDataByUnit('1001', 1),
  };

  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(2, 'day'),
  };
  const checkedFeeDetails = [
    {
      title: 'Special one time incentive',
      quantity: null,
      amount: '$300.00',
    },
    {
      title: 'Air conditioner (Window Unit)',
      quantity: '2',
      amount: '$50.00',
    },
    {
      title: 'Washer-Dryer combo',
      quantity: null,
      amount: '$50.00',
    },
    {
      title: 'Pet large (26-60 lb)',
      quantity: '1',
      amount: '$50.00',
    },
  ];

  const uncheckedFeeDetails = [
    {
      title: 'Employee rent credit',
      quantity: null,
      amount: '$25.00',
    },
    {
      title: 'Boat slip (per linear foot)',
      quantity: '1',
      amount: '$10.00',
    },
    {
      title: 'Parking covered',
      quantity: '1',
      amount: '$80.00',
    },
    {
      title: 'Parking indoor',
      quantity: '1',
      amount: '$100.00',
    },
    {
      title: 'Pet small (25 lb or less)',
      quantity: '1',
      amount: '$50.00',
    },
    {
      title: 'Storage',
      quantity: '1',
      amount: '$100.00',
    },
    {
      title: 'Wine locker',
      quantity: '1',
      amount: '$20.00',
    },
    {
      title: 'Cable TV',
      quantity: null,
      amount: '$25.00',
    },
  ];

  const nonEditableFeeDetails = [
    {
      title: 'Boat slip (per linear foot)',
      quantity: '1',
      amount: '$10.00',
    },
    {
      title: 'Parking covered',
      quantity: '1',
      amount: '$80.00',
    },
    {
      title: 'Parking indoor',
      quantity: '1',
      amount: '$100.00',
    },
  ];

  const leaseApplicationPage = new LeaseApplicationPage(t);

  const feeSelectors = {
    airConditionerFee: {
      amount: leaseApplicationPage.selectors.airConditionerFeeAmount,
      amountEditor: leaseApplicationPage.selectors.airConditionerFeeAmountEditor,
      checkBox: leaseApplicationPage.selectors.airConditionerCheckBox,
      dropdownButton: leaseApplicationPage.selectors.airFeeDropdownButton,
      quantityItem: leaseApplicationPage.selectors.airFeeQuantityItems,
    },
    washDryerFee: {
      checkBox: leaseApplicationPage.selectors.washDryerFeeCheckBox,
    },
    petFee: {
      amount: leaseApplicationPage.selectors.petLargeFeeAmount,
      amountEditor: leaseApplicationPage.selectors.petLargeFeeAmountEditor,
      checkBox: leaseApplicationPage.selectors.petLargeFeeAountCheckBox,
    },
  };

  const concessionSelectors = {
    specialOneTimeConcession: {
      amountValue: '300',
      amountEditor: leaseApplicationPage.selectors.specialOneTimeConcessionAmountEditor,
      checkBox: quoteDraftPage.selectors.specialOneTimeIncentiveConcessionCheckBox,
      isEditable: true,
    },
    monthFreeConcession: {
      checkBox: quoteDraftPage.selectors.monthFreeConcessionCheckBox,
      isEditable: false,
    },
  };

  const contractDocumentsDetails = [
    {
      title: 'Rent Concession Agreement',
    },
  ];
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });

  // Edit base rent and concession amount in quote form
  await checkRentWithMinAmountLimit(t, quoteInfo);
  await checkConcessionWithMaxAmountLimit(t);
  await quoteDraftPage.clickOnExpandAndCollapseButton();
  await publishAQuote(t, contactInfo);

  // Edit fees in lease form
  await approveIncompleteScreening(t, quoteInfo);
  await checkFeeNegativeAmount(t, feeSelectors.airConditionerFee, '$25.00');
  await checkFeeQuantityChanges(t, feeSelectors.airConditionerFee, '$50.00');
  await checkFeeCheckBoxState(t, feeSelectors.washDryerFee);
  await checkFeeValidAmountChanges(t, feeSelectors.petFee, '50');

  // TEST-1388:Concessions selected displays in contract documents section correctly
  await leaseApplicationPage.checkConcessionInContractDocuments(contractDocumentsDetails, true);
  await selectOrUnselctConcession(t, concessionSelectors.monthFreeConcession, false);
  await selectOrUnselctConcession(t, concessionSelectors.specialOneTimeConcession, false);
  await leaseApplicationPage.checkConcessionInContractDocuments(contractDocumentsDetails, false);

  await selectOrUnselctConcession(t, concessionSelectors.monthFreeConcession, true);
  await selectOrUnselctConcession(t, concessionSelectors.specialOneTimeConcession, true);
  await leaseApplicationPage.checkConcessionInContractDocuments(contractDocumentsDetails, true);

  const partyAUrl = await getLocation();
  await publishLease(t, { sendLater: false, snackbarMessage: trans('SIGN_LEASE_EMAIL_SUCCESS') });
  await leaseApplicationPage.checkPersonLeaseStatus(contactInfo.memberType, { rowIndex: 1, status: trans('SENT') });

  // TEST-1456 Check unselected fees
  // Check lease changes after publish
  await viewOrEditPublishedLease(t);
  await leaseApplicationPage.checkFeesInLeaseForm(checkedFeeDetails, { isFeeAmountEditable: true, checkUnselectedFees: false });
  await leaseApplicationPage.checkFeesInLeaseForm(uncheckedFeeDetails, { isFeeAmountEditable: false, checkUnselectedFees: true });
  await closeLeaseForm(t);

  // Check lease changes after lease execution
  await signLease(t, contactInfo);
  await t.navigateTo(partyAUrl);

  await counterSignLease(t, userInfo);
  await t.navigateTo(partyAUrl);

  await verifyLeaseIsExecuted(t, quoteInfo);
  await verifyExecutedLeaseMenuOptions(t);
  await viewExecutedLease(t);
  await leaseApplicationPage.checkFeesInLeaseForm(checkedFeeDetails, { isFeeAmountEditable: false, checkUnselectedFees: false });
  await leaseApplicationPage.checkFeesInLeaseForm(uncheckedFeeDetails, { isFeeAmountEditable: false, checkUnselectedFees: true });

  // TEST-214:View Lease
  // Check lease document page buttons
  await leaseApplicationPage.checkLeasePageActiveButtons(t);
  await t.expect(getLocation()).contains('https://cucumber.local.env.reva.tech/publishedQuote');

  await t.navigateTo(partyAUrl);
  await verifyExecutedLeaseMenuOptions(t);
  await viewExecutedLease(t);

  await leaseApplicationPage.checkFeesAreReadOnly(nonEditableFeeDetails);

  // TEST-1419:Verify system allows to have other published lease using same unit
  // create a lease draft for party A - unit 1
  await t.navigateTo(partyAUrl);
  await voidExecutedLease(t);
  await approveIncompleteScreening(t, quoteInfo);
  const partyDetailPage = new PartyDetailPage(t);
  await leaseApplicationPage.closeLeasePage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.navigateBackBtn });

  // publish a quote for party B - unit 1(same unit)
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo: contactTwoInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });
  await publishAQuote(t, contactTwoInfo);
  const unitName = '1001';
  const propertyChose = await getPropertyByName(ctx, property.name);
  const currentOneInventory = await getInventoryByNameAndPropertyId(ctx, propertyChose.id, unitName);
  await changeInventoryStatus(ctx, currentOneInventory.id, DALTypes.InventoryState.VACANT_READY);

  // execute a lease for party A and then set the unit 1 state to vacantReady
  const partyBUrl = await getLocation();
  await t.navigateTo(partyAUrl);
  await partyDetailPage.clickOnReviewReleaseBtn(t);
  await publishLease(t, { sendLater: false, snackbarMessage: trans('SIGN_LEASE_EMAIL_SUCCESS') });
  await signLease(t, contactInfo);
  await t.navigateTo(partyAUrl);
  await counterSignLease(t, userInfo);
  const currentTwoInventory = await getInventoryByNameAndPropertyId(ctx, propertyChose.id, unitName);
  await changeInventoryStatus(ctx, currentTwoInventory.id, DALTypes.InventoryState.VACANT_READY);

  // check if executing a lease for party B - unit 1 it is possible
  await t.navigateTo(partyBUrl);
  await approveIncompleteScreening(t, quoteInfo);
  await publishLease(t, { sendLater: false, snackbarMessage: trans('SIGN_LEASE_EMAIL_SUCCESS') });
  await signLease(t, contactTwoInfo);
  await t.navigateTo(partyBUrl);
  await counterSignLease(t, userInfo);
  const currentThreeInventory = await getInventoryByNameAndPropertyId(ctx, propertyChose.id, unitName);
  await t.expect(currentThreeInventory.state).eql(DALTypes.InventoryState.VACANT_READY_RESERVED);

  // void the lease execute within party A - unit 1 and check if executing a new lease for unit 1 it is possible
  await t.navigateTo(partyAUrl);
  await voidExecutedLease(t);
  const currentFourInventory = await getInventoryByNameAndPropertyId(ctx, propertyChose.id, unitName);
  await t.expect(currentFourInventory.state).eql(DALTypes.InventoryState.VACANT_READY);
  await approveIncompleteScreening(t, quoteInfo);
  await publishLease(t, { sendLater: false, snackbarMessage: trans('SIGN_LEASE_EMAIL_SUCCESS') });
  await signLease(t, contactInfo);
  await t.navigateTo(partyAUrl);
  await counterSignLease(t, userInfo);
  const currentFiveInventory = await getInventoryByNameAndPropertyId(ctx, propertyChose.id, unitName);
  await t.expect(currentFiveInventory.state).eql(DALTypes.InventoryState.VACANT_READY_RESERVED);

  // void the lease execute within party B - unit 1 and check if executing a new lease for unit 1 it is possible
  await t.navigateTo(partyBUrl);
  await voidExecutedLease(t);
  const currentSixInventory = await getInventoryByNameAndPropertyId(ctx, propertyChose.id, unitName);
  await t.expect(currentSixInventory.state).eql(DALTypes.InventoryState.VACANT_READY);
  await approveIncompleteScreening(t, quoteInfo);
  await publishLease(t, { sendLater: false, snackbarMessage: trans('SIGN_LEASE_EMAIL_SUCCESS') });
  await signLease(t, contactTwoInfo);
  await t.navigateTo(partyBUrl);
  await counterSignLease(t, userInfo);
  const currentSevenInventory = await getInventoryByNameAndPropertyId(ctx, propertyChose.id, unitName);
  await t.expect(currentSevenInventory.state).eql(DALTypes.InventoryState.VACANT_READY_RESERVED);
});

test('TEST-1613:Check if the fees amount and quantity from Edit Lease correspond to those selected in the Quote', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const residentEmailAddress = 'qatest+oliversmit@reva.tech';

  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const applicantData = getMockedApplicantDataByEmail(residentEmailAddress);
  const property = partyInfo.properties[0]; // Parkmerced Apartments
  const hasRequiredSteppers = false;
  const skipSteppers = true;
  const shouldDiscardChanges = true;
  const quoteInfo = {
    index: 0,
    leaseTerms: ['18 months'],
    ...getMockedQuoteDataByUnit('1013', 1),
  };
  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(18, 'months').add(2, 'day'),
  };

  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo });
  const currentPartyUrl = await getLocation();

  await createAQuote(t, quoteInfo);

  const quoteDraftPage = new QuoteDraftPage(t);

  const parkmercedAllFees = [
    'Employee rent credit',
    'Air conditioner (Window Unit)',
    'Washer-Dryer combo',
    'Parking covered',
    'Boat slip (per linear foot)',
    'Parking indoor',
    'Pet large (26-60 lb)',
    'Pet small (25 lb or less)',
    'Storage',
    'Wine locker',
    'Cable TV',
  ];

  const quoteData = {
    lengthTerm: '18',
    baseRent: '9200',
    baseRentFormated: '$9,200',
    feeDetails: [
      {
        selector: quoteDraftPage.selectors.smallPetFeeCheckBox,
        title: 'Pet small (25 lb or less)',
        quantity: '1',
        amount: '$50.00',
      },
    ],
    uneditableFeeWithDetails: [
      {
        selector: quoteDraftPage.selectors.parckingCoveredCheckBox,
        title: 'Parking covered',
        quantity: '1',
        amount: '$80.00',
      },
      {
        selector: quoteDraftPage.selectors.storageCheckBox,
        title: 'Storage',
        quantity: '1',
        amount: '$100.00',
      },
    ],
    unselectedFees: [
      'Employee rent credit',
      'Air conditioner (Window Unit)',
      'Washer-Dryer combo',
      'Boat slip (per linear foot)',
      'Parking indoor',
      'Pet large (26-60 lb)',
      'Wine locker',
      'Cable TV',
    ],
  };

  const inventory = {
    inventoryFee: ['Parking covered', 'Storage'],
    inventoryItem: ['p300', 's380'],
  };

  await quoteDraftPage.changeBaseRentInQuote(quoteData);

  // TEST-1456:Verify that fee shows not selected in Lease UI, when was not selected in Quote draft (unselected fees)
  await quoteDraftPage.checkUnselectedFees(parkmercedAllFees);

  // Select some fees
  await clickOnElement(t, { selector: quoteData.feeDetails[0].selector });
  await clickOnElement(t, { selector: quoteData.uneditableFeeWithDetails[0].selector });
  await clickOnElement(t, { selector: quoteData.uneditableFeeWithDetails[1].selector });

  await quoteDraftPage.checkUnselectedFees(quoteData.unselectedFees);

  await publishAQuote(t, contactInfo);
  await waiveApplicationFee(t, contactInfo);
  await completeApplicationPart1(t, applicantData, property.displayName);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);

  // Back to party details page
  await t.navigateTo(currentPartyUrl);
  await reviewScreening(t, quoteInfo);
  await approveLease(t);

  await clickOnElement(t, { selector: '#reviewLeaseBtn' });
  await quoteDraftPage.checkBaseRentValue(quoteData);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const leaseApplicationData = {
    feeDetails: [
      {
        name: 'airConditionerWindowUnit',
        title: 'Air conditioner (Window Unit)',
        quantity: '2',
        amount: '$50.00',
      },
      {
        name: 'boatSlipPerLinearFoot',
        title: 'Boat slip (per linear foot)',
        quantity: '3',
        amount: '$30.00',
      },
      {
        name: 'petLarge2660Lb',
        title: 'Pet large (26-60 lb)',
        quantity: '2',
        amount: '$200.00',
      },
    ],
    oneTimeCharges: [
      {
        title: 'Pet deposit (Pet small (25 lb or less))',
        amount: '$300.00',
      },
      {
        title: 'Security deposit',
        amount: '$9,200.00',
      },
    ],
  };

  const leaseData = {
    feeDetails: [
      {
        title: 'Air conditioner (Window Unit)',
        quantity: '2',
        amount: '$50.00',
      },
      {
        title: 'Boat slip (per linear foot)',
        quantity: '3',
        amount: '$30.00',
      },
      {
        title: 'Pet large (26-60 lb)',
        quantity: '2',
        amount: '$200.00',
      },
      {
        title: 'Pet small (25 lb or less)',
        quantity: '1',
        amount: '$50.00',
      },
    ],
    uneditableFeeWithDetails: [
      {
        title: 'Parking covered',
        quantity: '1',
        amount: '$80',
      },
      {
        title: 'Storage',
        quantity: '1',
        amount: '$100',
      },
    ],
    oneTimeCharges: [
      {
        title: 'Pet deposit (2 Pet large (26-60 lb))',
        amount: '$1,200.00',
      },
      {
        title: 'Pet deposit (Pet small (25 lb or less))',
        amount: '$300.00',
      },
      {
        title: 'Security deposit',
        amount: '$9,200.00',
      },
    ],
    unselectedFees: ['Employee rent credit', 'Washer-Dryer combo', 'Parking indoor', 'Pet large (26-60 lb)', 'Wine locker', 'Cable TV'],
  };

  await leaseApplicationPage.checkFeesInLeaseForm(quoteData.feeDetails);
  await leaseApplicationPage.checkFeesInLeaseForm(quoteData.uneditableFeeWithDetails, { isFeeAmountEditable: false });
  await quoteDraftPage.checkUnselectedFees(quoteData.unselectedFees);

  // TEST-756:Pet related fees should not disappear from the lease UI when you set the pet rent to 0.00 -pet deposit pentru pet fee = 0
  const feeWithAmountZero = {
    feeDetails: [
      {
        title: 'Pet large (26-60 lb)',
        quantity: '1',
        amount: '0',
        formatedAmount: '$0.00',
        name: 'petLarge2660Lb',
      },
    ],
    oneTimeCharges: [
      {
        title: 'Pet deposit (Pet large (26-60 lb))',
        amount: '$600.00',
      },
    ],
  };
  await leaseApplicationPage.selectFeesInLeaseForm(feeWithAmountZero.feeDetails, true);
  await leaseApplicationPage.checkFeesInLeaseForm(feeWithAmountZero.oneTimeCharges);

  // TEST-504:Discard changes dialog should be displayed in the lease
  await leaseApplicationPage.closeLeaseFormPage(t);
  await t.wait(300);
  await t.pressKey('esc');

  // TEST-1387:Concessions selected discarded are not selected when enter to the lease form again-dicard lease changes
  await closeLeaseForm(t, shouldDiscardChanges);
  await sleep(2000);

  await clickOnElement(t, { selector: '#reviewLeaseBtn' });
  await sleep(2000);
  await leaseApplicationPage.checkUnselectedFees(quoteData.unselectedFees);
  await leaseApplicationPage.checkFeesInLeaseForm(quoteData.uneditableFeeWithDetails, { isFeeAmountEditable: false });
  await selectInventoryItems(t, inventory.inventoryFee, inventory.inventoryItem);

  await leaseApplicationPage.selectFeesInLeaseForm(leaseApplicationData.feeDetails);
  await leaseApplicationPage.checkFeesInLeaseForm(leaseApplicationData.oneTimeCharges);
  await leaseApplicationPage.checkUnselectedFees(leaseData.unselectedFees);

  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });

  await viewOrEditLease(t);
  await quoteDraftPage.checkBaseRentValue(quoteData);

  await leaseApplicationPage.checkFeesInLeaseForm(leaseData.feeDetails);
  await leaseApplicationPage.checkFeesInLeaseForm(leaseData.uneditableFeeWithDetails, { isFeeAmountEditable: false });
  await leaseApplicationPage.checkFeesInLeaseForm(leaseData.oneTimeCharges);
  await leaseApplicationPage.checkUnselectedFees(leaseData.unselectedFees);
});

test('TEST-1250:Publish lease when the party members do not have a email address or his member has temporary email', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Empyrean Horizon', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo } = mockPartyData;
  const property = partyInfo.properties[2]; // Empyrean Horizon

  const partyMembers = {
    residentAInfo: {
      legalName: 'Ryan Taylor',
      phone: '+1 908 505 6520',
      formattedPhone: '(908) 505-6520',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    residentBInfo: {
      legalName: 'Abigail Wilson',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 2,
    },
    residentCInfo: {
      legalName: 'Charlotte Jones',
      email: 'qatest+charlotejones@reva.tech',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 3,
    },
    guarantorInfo: {
      legalName: 'Jackob Brown',
      index: 1,
    },
  };

  const quoteInfo = {
    index: 0,
    baseRent: 2365,
    displayedBaseRent: '$2,365',
    ...getMockedQuoteDataByUnit('4003'),
  };

  const contactInfo = [partyMembers.residentAInfo, partyMembers.residentBInfo, partyMembers.residentCInfo, partyMembers.guarantorInfo];
  const partyDetailPage = new PartyDetailPage(t);

  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo: partyMembers.residentAInfo, userInfo, qualificationInfo });
  await validatePartyDataCreation(t, { propertyName: property.displayName, contactInfo: partyMembers.residentAInfo, qualificationInfo });

  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();

  await addAResident(t, partyMembers.residentBInfo);
  await addAResident(t, partyMembers.residentCInfo);
  await addAGuarantor(t, partyMembers.guarantorInfo);

  await partyDetailPage.closeManagePartyDetailsPage();

  await createAQuote(t, quoteInfo);
  await publishAQuote(t, partyMembers.residentAInfo);

  await approveIncompleteScreening(t, quoteInfo);

  await verifyWarningMsg(t, 'Abigail Wilson, Jackob Brown, and Ryan Taylor need a valid email address to publish the lease.');
  await verifyLeaseCannotBePublishedWithIncompleteInfo(t);
  await verifyManageInfoCard(t, contactInfo);
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.closeManageParty();

  await clickOnElement(t, { selector: '#reviewLeaseBtn' });
  await expectVisible(t, { selector: '#leaseForm' });
  await verifyWarningMsg(t, 'Abigail Wilson, Jackob Brown, and Ryan Taylor need a valid email address to publish the lease.');
  await clickOnElement(t, { selector: '[data-id="invalid-email-warning"] a', text: trans('ADD_EMAIL_ADDRESS') });

  await verifyManageInfoCard(t, contactInfo);

  const partyMembersUpdateInfo = {
    residentAInfo: {
      legalName: 'Ryan Taylor',
      phone: '+1 908 505 6520',
      formattedPhone: '(908) 505-6520',
      email: 'rayen.taylor.mwy3y@renter.apartmentlist.com',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    residentBInfo: {
      legalName: 'Abigail Wilson',
      email: 'qatest+abigailwilson@reva.tech',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 2,
    },
    residentCInfo: {
      legalName: 'Charlotte Jones',
      email: 'qatest+charlotejones@reva.tech',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 3,
    },
    guarantorInfo: {
      legalName: 'Jackob Brown',
      email: 'qatest+jackobbrown@reva.tech',
      memberType: DALTypes.MemberType.GUARANTOR,
      index: 1,
    },
  };

  await addEmailAddressAsContactInfo(t, partyMembersUpdateInfo.residentBInfo, { isGuarantor: false, makePrimary: false });
  await addEmailAddressAsContactInfo(t, partyMembersUpdateInfo.guarantorInfo, { isGuarantor: true, makePrimary: false });
  //  Add an anonymized email addresses
  await addEmailAddressAsContactInfo(t, partyMembersUpdateInfo.residentAInfo, { isGuarantor: false, makePrimary: false });

  await managePartyPage.closeManageParty();
  await clickOnElement(t, { selector: '#reviewLeaseBtn' });
  await expectVisible(t, { selector: '#leaseForm' });
  await verifyWarningMsg(t, 'Ryan Taylor needs a valid email address to publish the lease.');
  await verifyLeaseCannotBePublishedWithIncompleteInfo(t);

  // Add a valid email address
  const residentAInfo = {
    legalName: 'Ryan Taylor',
    phone: '+1 908 505 6520',
    formattedPhone: '(908) 505-6520',
    email: 'qatest+rayentaylor@reva.tech',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
  };
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await addEmailAddressAsContactInfo(t, residentAInfo, { isGuarantor: false, makePrimary: true });
  await managePartyPage.closeManageParty();
  await clickOnElement(t, { selector: '#reviewLeaseBtn' });
  await expectVisible(t, { selector: '#leaseForm' });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });
  await leaseApplicationPage.expectPublishAndSendLeaseDialogVisible();
  await clickOnElement(t, { selector: `${leaseApplicationPage.selectors.publishLeaseDialogOverlay} ${leaseApplicationPage.selectors.cancelBtn}` });
  await partyDetailPage.clickOnManagePartyDetailsButton();
  await removeAnonymousEmailAddressAsContactInfo(t, partyMembersUpdateInfo.residentAInfo);
  await managePartyPage.closeManageParty();

  const expectedTaskCards = {
    status: 'check',
    name: 'Remove temporary email address for Ryan Taylor',
    details: 'Today',
    isAnonymousTask: true,
  };
  const partyPhaseOne = new PartyPhaseOne(t);
  await partyPhaseOne.clickOnShowCompletedTaskButton();
  await partyPhaseOne.checkExpectedTasks(expectedTaskCards);
});

test('Check fee price updated in the UI Lease that it has not been selected in the published quote', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center', index: 1 };
  const userInfoTwo = { user: 'felicia@reva.tech', password: getUserPassword(), agentName: 'Felicia Sutton' };

  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const residentEmailAddress = 'qatest+darianawells@reva.tech';
  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const applicantData = getMockedApplicantDataByEmail(residentEmailAddress);
  const property = partyInfo.properties[0]; // Parkmerced Apartments
  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const quoteInfo = {
    index: 0,
    baseRent: 2213,
    ...getMockedQuoteDataByUnit('1019', 1),
  };

  const inventory = {
    property,
    inventoryFeeNameToUpdatePrice: 'Pet small (25 lb or less)',
    priceToUpdate: 900,
    inventoryFee: ['Door Fob'],
    inventoryFeeChild: ['Door Fob'],
  };
  const currentDate = now({ timezone: property.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(2, 'day'),
  };
  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo, userInfo, qualificationInfo });

  const partyPath = await getPathName();
  const partyId = partyPath.replace('/party/', '');

  // Get location of party/id in order to back after completing application part 1 and part 2
  const partyUrl = await getLocation();

  await createAQuote(t, quoteInfo, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: property.timezone });

  const leaseApplicationPage = new LeaseApplicationPage(t);

  await publishAQuote(t, contactInfo);
  // TEST-140:Complete application part 2 without filled up steppers in part 2
  await waiveApplicationFee(t, contactInfo);
  await completeApplicationPart1(t, applicantData, property.displayName);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);

  // Back to party details page
  await t.navigateTo(partyUrl);

  // Call API to update fee price
  await updatingFeePrice(property, inventory.inventoryFeeNameToUpdatePrice, inventory.priceToUpdate);

  await reviewScreening(t, quoteInfo);
  await approveLease(t);

  // taking the fee price from the Lease UI should be equal to the price updated
  await leaseApplicationPage.checkFeePriceUpdated(inventory.priceToUpdate);

  await leaseApplicationPage.checkASingleFeeFromAdditionalMonthlyCharges(inventory.inventoryFeeNameToUpdatePrice);
  // TEST-184 Publish Lease
  await selectInventoryItems(t, inventory.inventoryFee, inventory.inventoryFeeChild);
  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });

  // TEST-193:Edit Lease
  await viewOrEditLease(t);
  // verify the price updated and check fee box should selected
  await leaseApplicationPage.checkFeePriceUpdated(inventory.priceToUpdate);
  await expectCheckboxState(t, { selector: leaseApplicationPage.selectors.petSmallOrLessFeeCheckBox, selected: true });

  // TEST-1184:Void Lease option in the case the lease start date is in past
  // execute lease
  await t.navigateTo(partyUrl);
  await signLease(t, contactInfo);
  await t.navigateTo(partyUrl);

  await counterSignLease(t, userInfo);
  await t.navigateTo(partyUrl);

  const leases = await getLeasesByPartyId(ctx, partyId);
  const leaseData = leases[0];
  const previousDay = toMoment(currentDate.clone().add(-1, 'day'), { timezone: property.timezone }).toISOString();

  leaseData.signDate = previousDay;
  leaseData.baselineData.publishedLease.moveInDate = previousDay;
  leaseData.baselineData.publishedLease.leaseStartDate = previousDay;

  // update lease start date and lease sign date from current date to previous date
  await updateLease(ctx, leaseData);

  // check that the lease overflow menu for admin agent contains void lease option
  await verifyExecutedLeaseMenuOptions(t);

  await backToDashboard(t);
  await forceUsersLogout({ tenantId: TEST_TENANT_ID });

  // check that the lease overflow menu for regular agent doesn't contain void lease option
  await loginAs(t, userInfoTwo);
  await t.navigateTo(partyUrl);
  await verifyPreviousDayExecutedLeaseMenuOptions(t);

  // TEST-1232:Agent tries to counter sign a lease on a different date than the resident
  await backToDashboard(t);
  await forceUsersLogout({ tenantId: TEST_TENANT_ID });
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  await t.navigateTo(partyUrl);

  await voidExecutedLease(t);
  await reviewScreening(t, quoteInfo);
  await approveLease(t);
  await selectInventoryItems(t, inventory.inventoryFee, inventory.inventoryFeeChild);
  await publishLease(t, { sendLater: true, timezone: property.timezone, leaseDates });
  await signLease(t, contactInfo);

  // TO DO when CPM-19812 is fixed
  // check that the lease can't be countersigned when lease allowCounterSigningInPast flag is set to FALSE
  // await updateSettingsTenant(ctx);

  // check that the lease can be countersigned when lease allowCounterSigningInPast flag is set to TRUE
  leaseData.signDate = previousDay;
  leaseData.baselineData.publishedLease.moveInDate = previousDay;
  leaseData.baselineData.publishedLease.leaseStartDate = previousDay;

  // update lease start date and lease sign date from current date to previous date
  await updateLease(ctx, leaseData);

  await t.navigateTo(partyUrl);
  await counterSignLease(t, userInfo);
  await t.navigateTo(partyUrl);
  await verifyLeaseIsExecuted(t, quoteInfo);
});
