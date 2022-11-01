/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { setHooks } from '../../../helpers/hooks';
import { PropertyNames } from '../../../helpers/websiteConstants';

import Homepage from '../../../pages/website/homepage';
import PropertyPage from '../../../pages/website/propertyPage';
import InventoryDialog from '../../../pages/website/inventoryDialog';
import PartyDetailPage from '../../../pages/partyDetailPage';
import LeaseApplicationPage from '../../../pages/leaseApplicationPage';
import { getWebsiteURL, getTenantURL, loginAs, getUserPassword, expectDashboardLaneContains, clickOnCard, clickOnElement } from '../../../helpers/helpers';
import { validateDashboardVisible } from '../../../helpers/dashboardHelpers';
import DashboardPage from '../../../pages/dashboardPage';
import { SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT, DATE_US_FORMAT } from '../../../../common/date-constants';
import { now } from '../../../../common/helpers/moment-utils';

setHooks(fixture('End To End Flow 4'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

// TEST-1369:End-to-end-Flow1 data
const contactInfoFlow1 = {
  fullName: 'Maria Sara',
  phoneNumber: '18008001212',
  formattedPhone: '(800) 800-1212',
  email: `mariasara${newUUID()}@say.web`,
};

const marketingQuestionsFlow1 = ['Do you have pets', 'Do you have service animals?', 'Do you need additional storage?'];
const questionsOrder = [1, 2, 3];

const visibleQuantityDataPetFlow1 = ['1', '2'];
const notPresentItemValuePetFlow1 = '3';

const visibleQuantityDataServiceFlow1 = ['1', '2', '3', '4', '5'];
const notPresentItemValueServiceFlow1 = '6';

const visibleQuantityDataStorageFlow1 = ['1', '2', '3'];
const notPresentItemValueStorageFlow1 = '4';

const storagePrimaryQuestionsFlow1 = [
  'Do you need 7x7 storage?',
  'Do you need 7x8 storage?',
  'Do you need 7x9 storage?',
  'Do you need 8x7 storage?',
  'Do you need 10x9 storage?',
  'Do you need 11x9 storage?',
  'Do you need 13x9 storage?',
];

const partyCardFlow1 = [{ lane: '#prospects', cardText: contactInfoFlow1.fullName }];
const userInfo = { user: 'admin@reva.tech', password: getUserPassword() };

const qualificationQuestionsAnswers = [
  {
    selector: 'numberBedroomsTxt',
    answer: '1 bed',
  },
  {
    selector: 'leaseTypeTxt',
    answer: 'Not Yet Determined',
  },
  {
    selector: 'monthlyIncomeTxt',
    answer: 'Unknown',
  },
  {
    selector: 'moveInDatePreferenceTxt',
    answer: 'Within the next 4 weeks',
  },
];

const moveInStartDate = now({ timezone: 'America/Los_Angeles' }).format(SHORT_DATE_FORMAT);

const moveInFinalDate = now({ timezone: 'America/Los_Angeles' }).add(1, 'months').format(MONTH_DATE_YEAR_FORMAT);

const summaryData = {
  interestedProperty: 'The Cove at Tiburon',
  source: 'The Cove website',
  pets: '0',
  guarantors: '0',
  moveInDate: `${moveInStartDate} - ${moveInFinalDate}`,
};

const startDate = now({ timezone: 'America/Los_Angeles' }).format(DATE_US_FORMAT);

const quoteSectionInfos = {
  unitName: '001SALT',
  selfServeTag: 'Self serve',
  leaseStartDate: startDate,
  baseRent: '$3,421.00',
  leaseTerm: '6m',
};

const feeDetailsFLow1 = [
  {
    title: 'Pet rent',
    quantity: '2',
    amount: '$70.00',
  },
  {
    title: 'Service animal rent',
    quantity: '1',
    amount: '$0.00',
  },
  {
    title: 'Storage Barb/Bld13 7x7',
    quantity: '1',
    amount: '$175.00',
  },
];

// TEST-1369:End-to-end-Flow2 data

const contactInfoFlow2 = {
  fullName: 'Lara Lane',
  phoneNumber: '18008002929',
  formattedPhone: '(800) 800-2929',
  email: `laralane${newUUID()}@now.web`,
};

const partyCardFlow2 = [{ lane: '#prospects', cardText: contactInfoFlow2.fullName }];

const marketingQuestionsFlow2 = ['Do you have pets', 'Do you need additional parking?', 'Do you need additional storage?'];

const visibleQuantityDataPetFlow2 = ['1', '2', '3', '4', '5'];
const notPresentItemValuePetFlow2 = '6';

const visibleQuantityDataParkingFlow2 = ['1', '2', '3', '4', '5'];
const notPresentItemValueParkingFlow2 = '6';

const visibleQuantityDataStorageFlow2 = ['1', '2', '3', '4', '5'];
const notPresentItemValueStorageFlow2 = '6';

const feeDetailsFLow2 = [
  {
    title: 'Parking covered',
    quantity: '1',
    amount: '$80.00',
  },
  {
    title: 'Pet small (25 lb or less)',
    quantity: '2',
    amount: '$100.00',
  },
  {
    title: 'Storage',
    quantity: '1',
    amount: '$100.00',
  },
];

const pickFees = [
  {
    title: 'Parking covered',
    pickItem: 'parkingCovered',
  },
  {
    title: 'Storage',
    pickItem: 'storage',
  },
];
// TEST-1369:End-to-end-Flow3 data

const contactInfoFlow3 = {
  fullName: 'Fiona Gallagher',
  phoneNumber: '18008003939',
  formattedPhone: '(800) 800-3939',
  email: `fionagallagher${newUUID()}@sun.web`,
};

const feeDetailsFLow3 = [
  {
    title: 'Pet rent',
    quantity: '1',
    amount: '$35.00', // to be modified in 35$ CPM-15660
  },
];

const partyCardFlow3 = [{ lane: '#prospects', cardText: contactInfoFlow3.fullName }];

const performWebsiteActionsFlow1 = async t => {
  const homepage = new Homepage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Cove);
  await homepage.clickOnResult(PropertyNames.Cove);

  const propertyPage = new PropertyPage(t);
  await clickOnElement(t, { selector: propertyPage.PropertyInfoSelectors.FindApartmentButton });

  await propertyPage.clickLayoutButton('1 Bedroom');

  await inventoryDialog.clickOnASpecificUnit('1-001SALT');

  await inventoryDialog.clickButtonByText('GET PERSONALIZED PRICE');

  await t.typeText(inventoryDialog.selectors.NameInput, contactInfoFlow1.fullName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, contactInfoFlow1.phoneNumber, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, contactInfoFlow1.email, { replace: true });

  await inventoryDialog.checkMarketingQuestionTitle();

  await inventoryDialog.checkMarketingQuestions(questionsOrder, marketingQuestionsFlow1);

  await inventoryDialog.checkMarketingQuestionsAreNotDisplayed();

  await inventoryDialog.checkPetFollowupQuestion();

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataPetFlow1,
    notPresentItemValuePetFlow1,
    inventoryDialog.selectors.PetDropdown,
    inventoryDialog.selectors.PetDropdownQuantityItems,
  );

  await clickOnElement(t, { selector: inventoryDialog.selectors.PetNoRadioButton });

  await inventoryDialog.checkPetDropdownNotDisplayed();

  await inventoryDialog.pickTwoPets();

  await inventoryDialog.checkServiceAnimalFollowupQuestion();

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataServiceFlow1,
    notPresentItemValueServiceFlow1,
    inventoryDialog.selectors.ServiceAnimalDropdown,
    inventoryDialog.selectors.ServiceAnimalDropdownQuantityItems,
  );

  await clickOnElement(t, { selector: inventoryDialog.selectors.ServiceAnimalNoRadioButton });

  await inventoryDialog.checkServiceAnimalDropdownNotDisplayed();

  await inventoryDialog.pickOneServiceAnimal();

  await inventoryDialog.checkServiceAnimalFollowupQuestion();

  await inventoryDialog.checkStoragePrimaryQuestions(storagePrimaryQuestionsFlow1);

  await clickOnElement(t, { selector: inventoryDialog.selectors.StoragePrimaryYesRadioButton });

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataStorageFlow1,
    notPresentItemValueStorageFlow1,
    inventoryDialog.selectors.StorageDropdown,
    inventoryDialog.selectors.StorageDropdownQuantityItems,
  );

  await clickOnElement(t, { selector: inventoryDialog.selectors.StoragePrimaryNoRadioButton });

  await inventoryDialog.checkStoragelDropdownNotDisplayed();

  await inventoryDialog.pickOne7x7storage();

  await inventoryDialog.clickButtonByText('Next');

  await clickOnElement(t, { selector: inventoryDialog.selectors.SixMonthsLeaseTerm });

  await inventoryDialog.clickButtonByText('Send it to me');
};

const navigateToPartyCard = async (t, partyCard) => {
  const dashboardPage = new DashboardPage(t);
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  await dashboardPage.clickOnDropDownAgentsList();
  await dashboardPage.clickOnLeasingTeamItem('BayAreaCallCenter_optionItem');
  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: '#switchTodayOnly' });
  await expectDashboardLaneContains(t, partyCard[0]);
  await clickOnCard(t, partyCard[0]);
};

const partyChecks = async t => {
  await navigateToPartyCard(t, partyCardFlow1);
  const partyDetailPage = new PartyDetailPage(t);

  await partyDetailPage.clickOnManagePartyDetailsButton();
  await partyDetailPage.checkOnlyOneMemberInTheParty();

  await partyDetailPage.checkResidentContactInfos(contactInfoFlow1);

  await partyDetailPage.checkQualificationQuestionsAnswers(t, qualificationQuestionsAnswers);

  await partyDetailPage.closeManagePartyDetailsPage();

  await partyDetailPage.checkPartySummarySection(summaryData);

  await partyDetailPage.checkTheQuoteSection(quoteSectionInfos);
};

const leaseChecks = async (t, feeDetails) => {
  const leasePage = new LeaseApplicationPage(t);
  await leasePage.createLease();
  await leasePage.checkFeesInLeaseForm(feeDetails);
};

const performRevaAppChecksFlow1 = async t => {
  const leasePage = new LeaseApplicationPage(t);
  await partyChecks(t);
  await leaseChecks(t, feeDetailsFLow1);
  await leasePage.checkPublishLeaseDialogIsDisplayed();
};

const performWebsiteActionsFlow2 = async t => {
  const homepage = new Homepage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult(PropertyNames.Parkmerced);
  const propertyPage = new PropertyPage(t);

  await clickOnElement(t, { selector: propertyPage.PropertyInfoSelectors.FindApartmentButton });

  await propertyPage.clickLayoutButton('4 Bedrooms');

  await inventoryDialog.clickOnASpecificUnit('350 Arballo-1013');

  await inventoryDialog.clickButtonByText('GET PERSONALIZED PRICE');

  await t.typeText(inventoryDialog.selectors.NameInput, contactInfoFlow2.fullName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, contactInfoFlow2.phoneNumber, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, contactInfoFlow2.email, { replace: true });

  await inventoryDialog.checkMarketingQuestionTitle();

  await inventoryDialog.checkMarketingQuestions(questionsOrder, marketingQuestionsFlow2);

  await inventoryDialog.checkMarketingQuestionsAreNotDisplayedParkmerced();

  await inventoryDialog.checkPetFollowupQuestion();

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataPetFlow2,
    notPresentItemValuePetFlow2,
    inventoryDialog.selectors.PetDropdown,
    inventoryDialog.selectors.PetDropdownQuantityItems,
  );

  await inventoryDialog.pickTwoPetsParkmerced();

  await inventoryDialog.checkParkingFollowupQuestion();

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataParkingFlow2,
    notPresentItemValueParkingFlow2,
    inventoryDialog.selectors.ParkingDropdown,
    inventoryDialog.selectors.ParkingDropdownQuantityItems,
  );

  await inventoryDialog.pickOneParking();

  await inventoryDialog.checkStorageFollowupQuestionParkmerced();

  await inventoryDialog.checkDropdownQuantity(
    visibleQuantityDataStorageFlow2,
    notPresentItemValueStorageFlow2,
    inventoryDialog.selectors.StorageDropdown,
    inventoryDialog.selectors.StorageDropdownQuantityItems,
  );

  await inventoryDialog.pickOneStorageParkmerced();

  await inventoryDialog.clickButtonByText('Next');

  await clickOnElement(t, { selector: inventoryDialog.selectors.SixMonthsLeaseTerm });

  await inventoryDialog.clickButtonByText('Send it to me');
};

const performRevaAppChecksFlow2 = async t => {
  const leasePage = new LeaseApplicationPage(t);
  await navigateToPartyCard(t, partyCardFlow2);
  await leaseChecks(t, feeDetailsFLow2);
  await leasePage.pickLeaseItems(pickFees);
  await leasePage.checkPublishLeaseDialogIsDisplayed();
};

const performWebsiteActionsFlow3 = async t => {
  const homepage = new Homepage(t);
  const inventoryDialog = new InventoryDialog(t);
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.Cove);
  await homepage.clickOnResult(PropertyNames.Cove);

  const propertyPage = new PropertyPage(t);

  await clickOnElement(t, { selector: propertyPage.PropertyInfoSelectors.FindApartmentButton });

  await propertyPage.clickLayoutButton('2 Bedrooms');

  await inventoryDialog.clickOnASpecificUnit('1-011SALT');

  await inventoryDialog.clickButtonByText('GET PERSONALIZED PRICE');

  await t.typeText(inventoryDialog.selectors.NameInput, contactInfoFlow3.fullName, { replace: true });
  await t.typeText(inventoryDialog.selectors.PhoneInput, contactInfoFlow3.phoneNumber, { replace: true });
  await t.typeText(inventoryDialog.selectors.EmailInput, contactInfoFlow3.email, { replace: true });

  await clickOnElement(t, { selector: inventoryDialog.selectors.PetYesRadioButton });

  await clickOnElement(t, { selector: inventoryDialog.selectors.ServiceAnimalNoRadioButton });

  await inventoryDialog.clickButtonByText('Next');

  await clickOnElement(t, { selector: inventoryDialog.selectors.SixMonthsLeaseTerm });

  await inventoryDialog.clickButtonByText('Send it to me');
};

const performRevaAppChecksFlow3 = async t => {
  await navigateToPartyCard(t, partyCardFlow3);
  await leaseChecks(t, feeDetailsFLow3);
  const leasePage = new LeaseApplicationPage(t);
  await leasePage.checkPublishLeaseDialogIsDisplayed();
};

test('TEST-1369:GetPersonalizedPrice_Flow1 Select all available fees for "Cove at Tiburon" property and check them in lease form', async t => {
  await performWebsiteActionsFlow1(t);
  await performRevaAppChecksFlow1(t);
});

test('TEST-1369:GetPersonalizedPrice_Flow2 Select all available fees for "Parkmerced Apartments" property and check them in lease form', async t => {
  await performWebsiteActionsFlow2(t);
  await performRevaAppChecksFlow2(t);
});

test('TEST-1369:GetPersonalizedPrice_Flow3 Select just one fee from all available fees for "Cove at Tiburon" property and check it in lease form', async t => {
  await performWebsiteActionsFlow3(t);
  await performRevaAppChecksFlow3(t);
});
