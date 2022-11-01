/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expectVisible, setDropdownValues, setRadioGroupValues, clickOnElement } from './helpers';
import ManagePartyPage from '../pages/managePartyPage';
import PartyDetailPage from '../pages/partyDetailPage';

export const mockPartyAdditionalInfo = {
  childInfo: {
    fullName: 'Daniel Smith',
    preferredName: 'Smith',
    text: 'DanielSmith',
  },
  petInfo: {
    name: 'Boby',
    type: 'Dog',
    breed: 'Beagle',
    size: '0-5lbs',
    sex: 'Male',
    text: 'Boby',
  },
  vehicleInfo: {
    type: 'Car',
    makeAndModel: 'Toyota Corolla',
    makeYear: '2018',
    color: 'black',
    tagNumber: '00027',
    state: 'Alaska (AK)',
    text: 'Toyota Corolla',
  },
};

export const setChildInfo = async (t, childInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.writeFullNameChild(childInfo.fullName);
  await managePartyPage.writePreferredNameChild(childInfo.preferredName);
};

export const setPetInfo = async (t, petInfo, setPetAsServiceAnimal) => {
  const managePartyPage = new ManagePartyPage(t);
  await t.typeText(managePartyPage.selectors.petNameTxt, petInfo.name);
  await setDropdownValues(t, { id: managePartyPage.selectors.petTypeDropdown, values: [petInfo.type] });
  await t.typeText(managePartyPage.selectors.petBreedTxt, petInfo.breed);
  await setDropdownValues(t, { id: managePartyPage.selectors.petSizeDropdown, values: [petInfo.size] });
  await setDropdownValues(t, { id: managePartyPage.selectors.petSexDropdown, values: [petInfo.sex] });
  if (setPetAsServiceAnimal) {
    await managePartyPage.setPetAsServiceAnimal(t);
  }
};

export const setVehicleInfo = async (t, vehicleInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await setDropdownValues(t, { id: managePartyPage.selectors.vehicleTypeDropdown, values: [vehicleInfo.type] });
  await t.typeText(managePartyPage.selectors.vehicleMakeAndModelTxt, vehicleInfo.makeAndModel);
  await t.typeText(managePartyPage.selectors.vehicleMakeYearTxt, vehicleInfo.makeYear);
  await t.typeText(managePartyPage.selectors.vehicleColorTxt, vehicleInfo.color);
  await t.typeText(managePartyPage.selectors.vehicleTagNumberTxt, vehicleInfo.tagNumber);
  await setDropdownValues(t, { id: managePartyPage.selectors.vehicleStateDropdown, values: [vehicleInfo.state] });
};

export const removeChildFromPartyDetail = async (t, childInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnChildNameToRemove(childInfo.fullName);
  await managePartyPage.clickOnRemoveChildOption();
};

export const removePetFromPartyDetail = async (t, petInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnPetNameToRemove(petInfo.name);
  await managePartyPage.clickOnRemovePetOption();
};

export const removeVehicleFromPartyDetail = async (t, vehicleInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnModelVehicleToRemove(vehicleInfo.makeAndModel);
  await managePartyPage.clickOnRemoveVehicleOption();
};

export const selectPartyQualificationQuestions = async (t, qualificationInfo, isTraditionalParty = true) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: '[data-component="common-person-card"]' });
  await expectVisible(t, { selector: partyDetailPage.selectors.bedroomsBar });
  await clickOnElement(t, { selector: qualificationInfo.numBedsOption });
  await partyDetailPage.checkVisibilityMoveInTimeQuestions();
  await setDropdownValues(t, { id: partyDetailPage.selectors.moveInTimeQuestionDropdown, values: [qualificationInfo.moveInTimeQuestion] });

  if (qualificationInfo.dropdownLeaseType === 'Corporate') {
    await partyDetailPage.checkVisibilityLeaseTypeDropdown();
    await setDropdownValues(t, { id: partyDetailPage.selectors.leaseTypeDropdown, values: [qualificationInfo.dropdownLeaseType] });
    isTraditionalParty = false;
  }

  if (isTraditionalParty) {
    await setRadioGroupValues(t, { selector: partyDetailPage.selectors.incomeQuestion, value: qualificationInfo.incomeQuestion });
    await partyDetailPage.checkVisibilityLeaseTypeDropdown();
    await setDropdownValues(t, { id: partyDetailPage.selectors.leaseTypeDropdown, values: [qualificationInfo.dropdownLeaseType] });
  } else {
    await partyDetailPage.checkVisibilityOfNumberOfUnits();
    await t.typeText(partyDetailPage.selectors.numberOfUnitsQuestion, qualificationInfo.companyQualificationInfo.numberOfUnits);
    await partyDetailPage.selectLengthOfLease(qualificationInfo.companyQualificationInfo.leaseTerm);
  }
};
