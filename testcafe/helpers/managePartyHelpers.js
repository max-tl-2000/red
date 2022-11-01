/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import ManagePartyPage from '../pages/managePartyPage';
import { expectTextIsEqual, expectVisible, clickOnElement } from './helpers';
import { createPerson } from './rentalApplicationHelpers';

export const checkForNoMatchInParties = async (t, mergeDialogBody = trans('NO_DUPLICATE_PARTY_FOUND_INFO1')) => {
  const managePartyPage = new ManagePartyPage(t);
  await expectVisible(t, { selector: managePartyPage.selectors.noDuplicateDialog });
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.noDuplicatePartyText1, text: mergeDialogBody });
  await clickOnElement(t, { selector: managePartyPage.selectors.noDuplicateDialogOkBtn });
};

export const checkForDuplicatesInParties = async (t, mergeDialogBody = trans('NO_DUPLICATE_PARTY_FOUND_INFO1')) => {
  const managePartyPage = new ManagePartyPage(t);
  await expectVisible(t, { selector: managePartyPage.selectors.possibleDuplicatePartiesDialog });
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.mergePartyConflictTxt, text: trans('MERGE_PARTY_CONFLICT_INFO') });
  await clickOnElement(t, { selector: managePartyPage.selectors.duplicatePartiesContinueBtn });
  await checkForNoMatchInParties(t, mergeDialogBody);
};

export const removeGuarantorFromParty = async (t, guarantorInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnGuarantorCardByPersonName(guarantorInfo);
  await managePartyPage.clickRemoveGuarantorFromParty();
  await managePartyPage.writeNoteToRemoveMember('Removing this guarantor from the party');
  await managePartyPage.clickOnRemoveFromPartyBtn();
};

export const addAResident = async (t, residentInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnAddResidentBtn();
  await createPerson(t, residentInfo);
};

export const removeResidentFromParty = async (t, residentInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnResidentNameToRemove(residentInfo);
  await managePartyPage.clickRemoveResidentFromParty();
  await managePartyPage.writeNoteToRemoveMember('Removing this resident from the party');
  await managePartyPage.clickOnRemoveFromPartyBtn();
};

export const checkNotAllowAddMembersToParty = async (t, memberType) => {
  const managePartyPage = new ManagePartyPage(t);
  await expectVisible(t, { selector: `${managePartyPage.selectors.actionNotAllowedDialog} ${managePartyPage.selectors.okBtn}` });
  await expectTextIsEqual(t, {
    selector: managePartyPage.selectors.contentActionNotAllowMsgBox,
    text: trans('CANNOT_ADD_MEMBERS_TEXT_DRAFT_LEASE', { memberType }),
  });
  await managePartyPage.clickActionNotAllowDialogOkBtn();
};
