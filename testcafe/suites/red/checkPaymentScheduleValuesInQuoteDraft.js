/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded } from '../../helpers/helpers';
import { createAParty, createAQuote } from '../../helpers/rentalApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail } from '../../helpers/mockDataHelpers';

import QuoteDraftPage from '../../pages/quoteDraftPage';
import { now } from '../../../common/helpers/moment-utils';

setHooks(fixture('Check payment schedule is applying recurring and non-recurring concessions with start date as 1st day of the month'), {
  fixtureName: 'checkPaymentScheduleValuesInQuoteDraft',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

// This skip will be removed on CPM-16604
test.skip('TEST-117, TEST-118, TEST-123, TEST-124, TEST-126, TEST-127, TEST-130, TEST-1380, TEST-940, TEST-125: Select concession to be applying in the payment schedule', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party creation info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const { displayName: propertyName, timezone } = partyInfo.properties[0]; // Parkmerced Apartments

  const quoteInfo = {
    unitName: '1001',
    leaseTermsLength: ['12 months'],
    leaseStartOnDayOne: '1',
    leaseStartOnDayFive: '5',
    ...getMockedQuoteDataByUnit('1001'),
  };

  const concessionSpecialAmount = {
    specialMonthIncentiveAmount: '300',
    specialOneTimeIncentive: '211.98',
  };

  const quoteDraftPage = new QuoteDraftPage(t);

  const concessionSpecialsCheckBoxSelectors = [
    `${quoteDraftPage.selectors.specialMonthIncentiveConcessionCheckBox}`,
    `${quoteDraftPage.selectors.specialOneTimeIncentiveConcessionCheckBox}`,
  ];

  const concessionCheckBoxSelectors = [
    `${quoteDraftPage.selectors.monthFreeConcessionCheckBox}`,
    `${quoteDraftPage.selectors.employeeRentCreditConcessionCheckBox}`,
  ];

  const paymentScheduleInfo = {
    paymentScheduleInfoForTwelveMonths: '12 months',
    leaseStartOnDayOneAmount: ['80', '9558', '9883', '9671.02'],
    leaseStartOnDayFiveAmount: ['69.34', '10005.93', '11908', '1375.75'],
    scheduleAmountForRelatedFeesOfFeeApartment: ['929.94', '10998.93', '12901', '1508.15'],
  };

  const feeAppliances = {
    feeSection: 'appliance',
    feeName: ['Air conditioner (Window Unit)', 'Dryer', 'Washer', 'Washer-Dryer combo', 'Door Fob'],
    feeAmount: ['$25.00', '$30.00', '$30.00', '$50.00', '$0.00'],
  };

  const feeParking = {
    feeSection: 'parking',
    feeName: ['Boat slip (per linear foot)', 'Parking indoor', 'Parking lot 2'],
    feeAmount: ['$10.00', '$138.00', 'from:$220.00'],
  };

  const feePet = {
    feeSection: 'pet',
    feeName: ['Pet large (26-60 lb)', 'Pet small (25 lb or less)'],
    feeAmount: ['$100.00', '$50.00'],
  };

  const feeStorage = {
    feeSection: 'storage',
    feeName: ['Wine locker', 'Locker'],
    feeAmount: ['$20.00', '$0.00'],
  };

  const feeOneTimeCharges = {
    feeNameSection: 'deposit',
    feeName: [
      'Appliance deposit ( Washer-Dryer combo)',
      'Parking deposit ( Parking indoor)',
      'Parking deposit ( Parking lot 2)',
      'Pet deposit ( Pet large (26-60 lb))',
      'Pet deposit ( Pet small (25 lb or less))',
      'Security deposit',
    ],
    feeAmount: ['100.00', '400.00', '400.00', '600.00', '300.00', '10,128.00'],
    leaseTermsLength: '12 months',
  };

  // TODO: Remove the commented code once CPM-15796 is DONE
  /* const quotePublishConcessionsSummary = {
    leaseStartOnDayFive: '5',
    leaseTermsLength: '12 months',
    baseRent: '$3,533.00',
    concessionsName: ['Special month incentive -', '1 month free', 'Employee rent credit', 'Special one time incentive'],
    concessionsValues: ['Save: $3,600.00', 'Save: $3,533.00', 'Save: $300.00', 'Save: $211.98'],
  };

  const totalAmountOnQuotePublished = {
    monthlyTotalAmountOnCharges: '$4,286.00',
    totalAmountOnSpecials: 'Save: $7,644.98',
  }; */

  // TEST-51: Create a party with initial contact info
  const startOfMonth = now({ timezone }).startOf('month').startOf('day');
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo);
  await quoteDraftPage.selectLeaseDate(
    t,
    quoteDraftPage.selectors.leaseStartDateTxt,
    startOfMonth.clone().add(+quoteInfo.leaseStartOnDayOne - 1, 'day'),
    timezone,
  );
  await quoteDraftPage.selectLeaseTerms(quoteInfo.leaseTermsLength);
  await quoteDraftPage.clickOnExpandAndCollapseButton();
  await quoteDraftPage.selectConcession(concessionCheckBoxSelectors);
  await quoteDraftPage.selectSpecialConcession(concessionSpecialsCheckBoxSelectors, concessionSpecialAmount);
  await quoteDraftPage.checkAmountInPaymentScheduleCard(paymentScheduleInfo.paymentScheduleInfoForTwelveMonths, paymentScheduleInfo.leaseStartOnDayOneAmount);
  await quoteDraftPage.selectLeaseDate(
    t,
    quoteDraftPage.selectors.leaseStartDateTxt,
    startOfMonth.clone().add(+quoteInfo.leaseStartOnDayFive - 1, 'day'),
    timezone,
  );
  await quoteDraftPage.checkAmountInPaymentScheduleCard(paymentScheduleInfo.paymentScheduleInfoForTwelveMonths, paymentScheduleInfo.leaseStartOnDayFiveAmount);
  await quoteDraftPage.selectAGroupFeePerSection(feeAppliances);
  await quoteDraftPage.selectAGroupFeePerSection(feeParking);
  await quoteDraftPage.selectAGroupFeePerSection(feePet);
  await quoteDraftPage.selectAGroupFeePerSection(feeStorage);
  await quoteDraftPage.checkAmountInPaymentScheduleCard(
    paymentScheduleInfo.paymentScheduleInfoForTwelveMonths,
    paymentScheduleInfo.scheduleAmountForRelatedFeesOfFeeApartment,
  );
  const feeName = await quoteDraftPage.getFeeNameOfOneTimeCharges(feeOneTimeCharges);
  await quoteDraftPage.compareActualResultGottenWithExpectedResult(feeOneTimeCharges.feeName, feeName);
  const feeAmount = await quoteDraftPage.getFeeAmountOfOneTimeCharges(feeOneTimeCharges);
  await quoteDraftPage.compareActualResultGottenWithExpectedResult(feeOneTimeCharges.feeAmount, feeAmount);
  // TEST-940:Fees and concession prices after publish quote
  await quoteDraftPage.clickPublishQuoteButton();
  await quoteDraftPage.clickCancelBtnPublishQuoteDialog();

  // TODO: Remove the commented code once CPM-15796 is DONE
  // Verify concessions
  /* const currentConcessionsValues = await quoteDraftPage.getConcessionValueOfQuotePusblishedSummarySection(quotePublishConcessionsSummary);
  await quoteDraftPage.compareActualResultgottenWithExpectedResult(quotePublishConcessionsSummary.concessionsValues, currentConcessionsValues);
  // Verify Base Rent

  // const selectorBaseRent = `[data-id="${convertToCamelCaseAndRemoveBrackets(quotePublishConcessionsSummary.leaseTermsLength)}_baseRentAmount"]`;
  // await expectTextIsEqual(t, { selector: selectorBaseRent, text: quotePublishConcessionsSummary.baseRent });
  // Verify fees value selected in quote draft is showing in quote published

  // const currentValueFeeAppliance = await quoteDraftPage.getFeeAmountOfDetailsOnMonthlyChargesSection(feeAppliances.feeName);
  // await quoteDraftPage.compareActualResultgottenWithExpectedResult(feeAppliances.feeAmount, currentValueFeeAppliance);

  // const currentValueFeeParking = await quoteDraftPage.getFeeAmountOfDetailsOnMonthlyChargesSection(feeParking.feeName);
  // await quoteDraftPage.compareActualResultgottenWithExpectedResult(feeParking.feeAmount, currentValueFeeParking);

  // const currentValueFeePet = await quoteDraftPage.getFeeAmountOfDetailsOnMonthlyChargesSection(feePet.feeName);
  // await quoteDraftPage.compareActualResultgottenWithExpectedResult(feePet.feeAmount, currentValueFeePet);

  // const currentValueFeeStorage = await quoteDraftPage.getFeeAmountOfDetailsOnMonthlyChargesSection(feeStorage.feeName);
  // await quoteDraftPage.compareActualResultgottenWithExpectedResult(feeStorage.feeAmount, currentValueFeeStorage);
  // Verify in quote publish 'MONTHLY TOTAL' on monthly charges section
  // await expectTextIsEqual(t, {
  //   selector: `${quoteDraftPage.selectors.totalMonthlyChargesAmount}`,
  //   text: totalAmountOnQuotePublished.monthlyTotalAmountOnCharges,
  // });
  // Verify in quote publish 'TOTAL' on Specials section
  // await expectTextIsEqual(t, { selector: `${quoteDraftPage.selectors.totalSpecialConcessionAmount}`, text: totalAmountOnQuotePublished.totalAmountOnSpecials });
  // Verify values "one-time charges" generated in quote draft is showing "Additional one-time charges" from quote publish
  // const currentValueAditionalOneTimeCharges = await quoteDraftPage.getFeeAmountOfAdditionalOneTimeCharges(feeOneTimeCharges.feeName);
  // await quoteDraftPage.compareActualResultgottenWithExpectedResult(feeOneTimeCharges.feeAmount, currentValueAditionalOneTimeCharges);
  */
});

// This skip will be removed on CPM-16604
test.skip('Verify the payment schedule with fee selected and deselected in the quote where fee has quotePaymentScheduleFlag FALSE', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party creation info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+joicetaylor@reva.tech');
  const { displayName: propertyName, timezone } = partyInfo.properties[1]; // The Cove at Tiburon

  const feeService = {
    feeSection: 'service',
    feeName: 'Housekeeping service',
    feeAmount: '100',
  };
  const paymentScheduleInfo = {
    paymentScheduleInfoForThreeMonths: '3 months',
    leaseStartOnDayFiveAmount: ['5122.87', '5911', '788.13'],
  };
  const quoteInfo = {
    leaseStartOnDayFive: '5',
    ...getMockedQuoteDataByUnit('001SALT'),
  };
  const startOfMonth = now({ timezone }).startOf('month').startOf('day');

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo);

  const quoteDraftPage = new QuoteDraftPage(t);

  await quoteDraftPage.selectLeaseDate(
    t,
    quoteDraftPage.selectors.leaseStartDateTxt,
    startOfMonth.clone().add(+quoteInfo.leaseStartOnDayFive - 1, 'day'),
    timezone,
  );
  await quoteDraftPage.checkAFeeFromAdditionalMonthlyCharges(feeService);
  await quoteDraftPage.setFeeAmount(feeService);
  await quoteDraftPage.checkAmountEntered(feeService);
  await quoteDraftPage.checkAmountInPaymentScheduleCard(paymentScheduleInfo.paymentScheduleInfoForThreeMonths, paymentScheduleInfo.leaseStartOnDayFiveAmount);
  await quoteDraftPage.checkAFeeFromAdditionalMonthlyCharges(feeService);
  await quoteDraftPage.checkAmountInPaymentScheduleCard(paymentScheduleInfo.paymentScheduleInfoForThreeMonths, paymentScheduleInfo.leaseStartOnDayFiveAmount);
});
