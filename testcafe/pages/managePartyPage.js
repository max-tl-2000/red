/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { t as trans } from 'i18next';
import { expectTextIsEqual, expectVisible, expectNotPresent, replaceBlankSpaceWithCharacter, elementNotInPage, clickOnElement } from '../helpers/helpers';
import BasePage from './basePage';

export default class ManagePartyPage extends BasePage {
  constructor(t) {
    super(t);

    this.selectors = {
      ...this.selectors,
      residentsCardsSection: 'memberCardsResidentSection',
      guarantorsCardsSection: 'memberCardsGuarantorSection',
      editInResidentMenuItem: '#editInResidentMenuItem',
      openDetailsInResidentMenuItem: '#openInResidentMenuItem',
      contactSummaryResident: '[data-id="contactSummary"]',
      addGuarantorBtn: '[data-id="addGuarantorButton"]',
      missingResidentLink: '[data-component="validator"]',
      guarantorCardTitle: '[data-member-type="Guarantor"] [data-id="cardTitle"]',
      moveToGuarantorsInResidentMenuItem: '#moveToguarantorsInResidentMenuItem',
      moveToOccupantsInResidentMenuItem: '#moveTooccupantsInResidentMenuItem',
      linkInResidentMenuItem: '#linkInResidentMenuItem',
      closeManagePartyIcon: '[data-action="closeFullscreenDialog"]',
      removeGuarantorFromPartyMenuItem: '#removeFromPartyInGuarantorMenuItem',
      editInGuarantorMenuItem: '#editInGuarantorMenuItem',
      removeOccupantFromPartyMenuItem: '#removeFromPartyInOccupantMenuItem',
      removeResidentFromPartyMenuItem: '#removeFromPartyInResidentMenuItem',
      noteToRemoveMember: '#removeRememberNoteTxt',
      removeMemberFromPartyDialog: '#removeMemberDialog',
      addResidentBtn: '[data-id="addResidentButton"]',
      noChildrenAddText: '[data-id="no_MINOR_AddText"]',
      childCollectionPanel: '#childCollectionPanel',
      childSection: '[data-id="childSection"]',
      childFullNameTxt: '#childFullNameText',
      addNewEntityBtn: '#addNewEntityBtn',
      childPreferredNameTxt: '#childPreferredNameText',
      petCollectionPanel: '#petCollectionPanel',
      petSection: '[data-id="petSection"]',
      petNameTxt: '#petNameText',
      petBreedTxt: '#petBreedText',
      petTypeDropdown: 'dropdownPetType',
      petSizeDropdown: 'dropdownPetSize',
      petSexDropdown: 'dropdownPetSex',
      petServiceAnimalCheckbox: '#checkboxIsServiceAnimal',
      vehicleCollectionPanel: '#vehicleCollectionPanel',
      vehicleSection: '[data-id="vehicleSection"]',
      vehicleTypeDropdown: 'dropdownVehicleType',
      vehicleMakeAndModelTxt: '#vehicleMakeAndModelText',
      vehicleMakeYearTxt: '#vehicleMakeYearText',
      vehicleColorTxt: '#vehicleColorText',
      vehicleTagNumberTxt: '#vehicleTagNumberText',
      vehicleStateDropdown: 'dropdownVehicleState',
      noPetsAddTxt: '[data-id="no_ANIMAL_AddText"]',
      noVehicleAddTxt: '[data-id="no_Vehicles_AddText"]',
      editChildMenuItem: '[data-id="edit_Child_MenuItem"]',
      removeChildMenuItem: '[data-id="remove_MINOR_MenuItem"]',
      editPetMenuItem: '[data-id="edit_Pet_MenuItem"]',
      removePetMenuItem: '[data-id="remove_ANIMAL_MenuItem"]',
      editVehicleMenuItem: '[data-id="edit_Vehicle_MenuItem"]',
      removeVehicleMenuItem: '[data-id="remove_Vehicle_MenuItem"]',
      petNameLblTxT: '[data-id="petNameLabelText"]',
      childFullNameLblTxt: '[data-id="childFullNameLabelText"]',
      makeAndModelLblTxt: '[data-id="makeAndModelLabelText"]',
      managePartyDetailMenu: '[data-id="managePartyDetailsMenu"]',
      assignedPropertyDropdown: 'assignedProperty',
      assignedPropertyDropdownValue: '[data-id="selectedLabelTxt_assignedProperty"]',
      teamDropdown: 'teamDropdown',
      firstContactChannelDropdown: 'firstContactChannelDropdown',
      submitAssignedPropertyBtn: '#submitAssignedProperty',
      cancelAssignedPropertyBtn: '#cancelAssignedPropertyBtn',
      noDuplicateDialog: '[data-id="noDuplicateDialog"]',
      possibleDuplicatePartiesDialog: '[data-id="possibleDuplicatePartiesDialog"]',
      mergePartyConflictTxt: '[data-id="mergePartyConflictTxt"]',
      duplicatePartiesContinueBtn: '#duplicatePartiesContinueBtn',
      noDuplicatePartyText1: '[data-id="noDuplicatePartyFoundInfo1Txt"]',
      noDuplicateDialogOkBtn: '[data-id="noDuplicateDialogOkBtn"]',
      updateAnswersBtn: '[data-id="updateAnswersButton"]',
      cancelQQBtn: '#cancelQualificationQuestionsBtn',
      updateQQBtn: '#updateQualificationQuestionsBtn',
      numberOfBedroomsTxt: '[data-id="numberBedroomsTxt"]',
      leaseTypeTxt: '[data-id="leaseTypeTxt"]',
      monthlyIncomeTxt: '[data-id="monthlyIncomeTxt"]',
      moveInDatePreferenceTxt: '[data-id="moveInDatePreferenceTxt"]',
      changePartyTypeDialog: '#changePartyTypeDialog',
      numberOfUnitsTxt: '[data-id="numberOfUnitsTxt"]',
      lengthLeaseTxt: '[data-id="lengthLeaseTxt"]',
      addOccupantBtn: '[data-id="addOccupantButton"]',
      occupantCollectionPanel: '[data-id="memberCardsOccupantSection"]',
      residentCollectionPanel: '[data-id="memberCardsResidentSection"]',
      commonPersonCard: '[data-component="common-person-card"]',
      commonPersonCardMenuListItem: '[data-component="list-item"]',
      selectGuarantorDropdown: 'selectGuarantorsDropdown',
      selectResidentDropdown: 'selectResidentsDropdown',
      okBtnDialogCommand: '[data-command="OK"]',
      cancelBtnDialogCommand: '[data-command="CANCEL"]',
      extraBtnDialogCommand: '[data-command="EXTRA"]',
      addBtnDialogCommand: '[data-command="ADD"]',
      linkGuarantorResidentDialog: '#linkGuarantorResidentDialog',
      personCardComponent: '_PersonCard',
      personListItemComponent: '_ListItem',
      residentMissingWarning: '[data-id="missingResidentWarning"]',
      cardTitleComponent: '[data-id="cardTitle"]',
      actionNotAllowedDialog: '[data-id="actionNotAllowedMsgBox_dialogOverlay"]',
      contentActionNotAllowMsgBox: '#actionNotAllowedMsgBox_contentTxt',
      leaseTypeDropdown: 'newLeaseType',
      continueToRenewalBtn: '#continueToRenewalBtn',
      contactChannelListValue: `#firstContactChannelDropdown ${this.selectors.listItemValue}`,
      residentsSection: '#residentsSection',
      occupantsSection: '#occupantsSection',
      guarantorsSection: '#guarantorsSection',
      possibleDuplicateBanner: '[data-id="possibleDuplicateTxt"]',
      viewDuplicatesInResidentMenuItem: '#viewDuplicatesInResidentMenuItem',
      dialogOverlay: '#dialog-overlay',
      companyDetailsSection: '[data-id="companySection"]',
      companyName: '[data-id="companySection"] [class^="main-content"]',
      missingCompanyContent: '[class^="missingCompanyContent"]',
      addCompanyButton: '[data-id="addCompanyBtn"]',
      companyNameDropdown: '#txtCompanyName',
      companyNameDropdownInput: '#txtCompanyName input',
    };
  }

  getCommonPersonCardByComponent(personInfo, component) {
    return `[data-id="${replaceBlankSpaceWithCharacter(personInfo.legalName, '')}${component}"]`;
  }

  async clickOnResidentCardByPersonName(personInfo) {
    const personCardSelector = this.getCommonPersonCardByComponent(personInfo, this.selectors.personCardComponent);
    const selectorTpl = `[data-id="${this.selectors.residentsCardsSection}"] ${personCardSelector}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  getCommonPOCCardByComponent(personInfo, component) {
    return `[data-id="${replaceBlankSpaceWithCharacter(personInfo.contactName, '')}${component}"]`;
  }

  async clickOnPOCCardByPOCName(personInfo) {
    const personCardSelector = this.getCommonPOCCardByComponent(personInfo, this.selectors.personCardComponent);
    const selectorTpl = `[data-id="${this.selectors.residentsCardsSection}"] ${personCardSelector}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickEditContactOptionForResident() {
    await clickOnElement(this.t, { selector: $(this.selectors.editInResidentMenuItem).withText(trans('EDIT_CONTACT_INFORMATION')) });
  }

  async clickOpenDetailsForResident() {
    await clickOnElement(this.t, { selector: $(this.selectors.openDetailsInResidentMenuItem).withText(trans('OPEN_DETAILS')) });
  }

  async clickOnAddGuarantorBtn() {
    await clickOnElement(this.t, { selector: this.selectors.addGuarantorBtn });
  }

  async clickOnGuarantorCardByPersonName(personInfo) {
    const personCardSelector = this.getCommonPersonCardByComponent(personInfo, this.selectors.personCardComponent);
    const selectorTpl = `[data-id="${this.selectors.guarantorsCardsSection}"] ${personCardSelector}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickEditContactInfoGuarantor() {
    await clickOnElement(this.t, { selector: $(this.selectors.editInGuarantorMenuItem).withText(trans('EDIT_CONTACT_INFORMATION')) });
  }

  async closeManageParty() {
    return clickOnElement(this.t, { selector: this.selectors.closeManagePartyIcon });
  }

  async clickRemoveGuarantorFromParty() {
    await clickOnElement(this.t, { selector: this.selectors.removeGuarantorFromPartyMenuItem });
  }

  async writeNoteToRemoveMember(note) {
    await this.t.typeText(this.selectors.noteToRemoveMember, note);
  }

  async clickOnRemoveFromPartyBtn() {
    const selectorTpl = `${this.selectors.removeMemberFromPartyDialog} ${this.selectors.okBtnDialogCommand}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickOnAddResidentBtn() {
    await clickOnElement(this.t, { selector: this.selectors.addResidentBtn });
  }

  async clickRemoveResidentFromParty() {
    await clickOnElement(this.t, { selector: this.selectors.removeResidentFromPartyMenuItem });
  }

  async clickOnResidentNameToRemove(mockResidentInfo) {
    const selectorTpl = this.getCommonPersonCardByComponent(mockResidentInfo, this.selectors.personCardComponent);
    await clickOnElement(this.t, { selector: $(selectorTpl).withText(trans(mockResidentInfo.legalName)) });
  }

  async verifyPartyMemberAdded(memberInfo) {
    await expectTextIsEqual(this.t, {
      selector: `${this.getCommonPersonCardByComponent(memberInfo, this.selectors.personCardComponent)} ${this.selectors.cardTitleComponent}`,
      text: memberInfo.legalName,
    });
  }

  async verifyPartyMemberRemoved(memberInfo) {
    await elementNotInPage(this.t, {
      selector: `${this.getCommonPersonCardByComponent(memberInfo, this.selectors.personCardComponent)} ${this.selectors.cardTitleComponent}`,
      text: memberInfo.legalName,
    });
  }

  async verifyNoChildrenAddedText() {
    await expectTextIsEqual(this.t, { selector: this.selectors.noChildrenAddText, text: trans('NO_MINORS_ADDED') });
  }

  async verifyNoPetsAddedText() {
    await expectTextIsEqual(this.t, { selector: this.selectors.noPetsAddTxt, text: trans('NO_PETS_OR_SERVICE_ANIMALS_ADDED') });
  }

  async writeFullNameChild(fullName) {
    await this.t.typeText(this.selectors.childFullNameTxt, fullName);
  }

  async writePreferredNameChild(preferredName) {
    await this.t.typeText(this.selectors.childPreferredNameTxt, preferredName);
  }

  async verifyNoChildrenAddedTextMissing() {
    await expectNotPresent(this.t, { selector: this.selectors.noChildrenAddText });
  }

  async clickAddBtnInCollectionPanel(collectionPanelId) {
    const selectorTpl = `${collectionPanelId} ${this.selectors.addBtnDialogCommand}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickOkBtnInCollectionPanel(collectionPanelId) {
    const selectorTpl = `${collectionPanelId} ${this.selectors.okBtnDialogCommand}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async checkForEntityAdded(collectionPanelId, textValue) {
    const selectorTpl = `${collectionPanelId} [data-component="text"]`;
    await expectTextIsEqual(this.t, { selector: selectorTpl, text: textValue, message: 'THIS ERROR' });
  }

  async checkForVisibleSection(sectionId) {
    await expectVisible(this.t, { selector: sectionId });
  }

  async verifyNoPetsAddedTextMissing() {
    await expectNotPresent(this.t, { selector: this.selectors.noPetsAddTxt });
  }

  async verifyNoVehicleAddedText() {
    await expectTextIsEqual(this.t, { selector: this.selectors.noVehicleAddTxt, text: trans('NO_VEHICLES_ADDED') });
  }

  async verifyNoVehicleTextMissing() {
    await expectNotPresent(this.t, { selector: this.selectors.noVehicleAddTxt });
  }

  async clickOnChildNameToRemove(fullName) {
    await clickOnElement(this.t, { selector: $(this.selectors.childFullNameLblTxt).withText(fullName) });
  }

  async clickOnRemoveChildOption() {
    await clickOnElement(this.t, { selector: this.selectors.removeChildMenuItem });
  }

  async clickOnPetNameToRemove(petName) {
    await clickOnElement(this.t, { selector: $(this.selectors.petNameLblTxT).withText(petName) });
  }

  async setPetAsServiceAnimal() {
    await clickOnElement(this.t, { selector: $(this.selectors.petServiceAnimalCheckbox) });
  }

  async clickOnRemovePetOption() {
    await clickOnElement(this.t, { selector: this.selectors.removePetMenuItem });
  }

  async clickOnModelVehicleToRemove(modelVehicle) {
    await clickOnElement(this.t, { selector: $(this.selectors.makeAndModelLblTxt).withText(modelVehicle) });
  }

  async clickOnRemoveVehicleOption() {
    await clickOnElement(this.t, { selector: this.selectors.removeVehicleMenuItem });
  }

  async checkCurrentAssignedPropertyByValue(value) {
    await expectVisible(this.t, { selector: this.selectors.assignedPropertyDropdownValue });
    await expectTextIsEqual(this.t, { selector: this.selectors.assignedPropertyDropdownValue, text: value });
  }

  async clickBtnInDialogByCommand(dialogId, command) {
    const selectorTpl = `${dialogId} ${command}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickOnAddOccupantBtn() {
    await clickOnElement(this.t, { selector: this.selectors.addOccupantBtn });
  }

  getCommonPersonListItemByComponent(personInfo, component) {
    return `[data-id="${replaceBlankSpaceWithCharacter(personInfo.legalName, '')}${component}"]`;
  }

  async clickDropdownBtnInDialog(dropdownComponent) {
    const selectorTpl = `#${dropdownComponent}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickDropdownDoneBtn(dropdownSelector) {
    const selectorTpl = `#${dropdownSelector}_doneBtn`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickActionNotAllowDialogOkBtn() {
    const selectorTpl = `${this.selectors.actionNotAllowedDialog} ${this.selectors.okBtn}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickContinueToRenewalBtn() {
    await clickOnElement(this.t, { selector: this.selectors.continueToRenewalBtn, delay: 1000 });
  }

  async checkManagePartyPageSections() {
    await expectVisible(this.t, { selector: this.selectors.residentsSection, text: trans('RESIDENTS') });
    await expectVisible(this.t, { selector: this.selectors.occupantsSection, text: trans('OCCUPANTS') });
    await expectVisible(this.t, { selector: this.selectors.guarantorsSection, text: trans('GUARANTORS') });
    await expectVisible(this.t, { selector: this.selectors.childSection, text: trans('CHILDREN') });
    await expectVisible(this.t, { selector: this.selectors.petSection, text: trans('PETS') });
    await expectVisible(this.t, { selector: this.selectors.vehicleSection, text: trans('VEHICLES') });
  }

  async checkOcupantLinkTo() {
    const { t } = this;
    const occupantCard = `${this.selectors.occupantCollectionPanel} ${this.selectors.commonPersonCard}`;
    await clickOnElement(t, { selector: occupantCard });
    const occupantCardMenuListItem = `${this.selectors.occupantCollectionPanel} ${this.selectors.commonPersonCardMenuListItem}`;
    await expectNotPresent(t, {
      selector: occupantCardMenuListItem,
      text: trans('LINK_MEMBER_TYPE', { memberType: 'guarantor' }),
    });
    await expectNotPresent(t, {
      selector: occupantCardMenuListItem,
      text: trans('LINK_MEMBER_TYPE', { memberType: 'resident' }),
    });
  }

  async checkPosibleDuplicatePartyMember(memberInfo) {
    const { t } = this;
    const personCardSelector = this.getCommonPersonCardByComponent(memberInfo, this.selectors.personCardComponent);
    await expectVisible(t, { selector: personCardSelector });
    await expectVisible(t, { selector: `${personCardSelector} ${this.selectors.possibleDuplicateBanner}` });
  }

  async clickViewDuplicatesForResident() {
    await clickOnElement(this.t, { selector: $(this.selectors.viewDuplicatesInResidentMenuItem).withText(trans('VIEW_DUPLICATES')) });
  }

  async checkAndCloseNoDuplicateDialog(mergeDialogBody = trans('NO_DUPLICATE_PARTY_FOUND_INFO1')) {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.noDuplicateDialog });
    await expectVisible(t, {
      selector: this.selectors.noDuplicatePartyText1,
      text: mergeDialogBody,
    });
    await clickOnElement(t, { selector: this.selectors.noDuplicateDialogOkBtn });
  }

  async checkResidentIsDisplayed(personInfo, isDisplayed = true) {
    const personCardSelector = this.getCommonPersonCardByComponent(personInfo, this.selectors.personCardComponent);
    const selectorTpl = `[data-id="${this.selectors.residentsCardsSection}"] ${personCardSelector}`;
    isDisplayed ? await expectVisible(this.t, { selector: selectorTpl }) : await expectNotPresent(this.t, { selector: selectorTpl });
  }

  async checkGuarantorIsDisplayed(personInfo, isDisplayed = true) {
    const personCardSelector = this.getCommonPersonCardByComponent(personInfo, this.selectors.personCardComponent);
    const selectorTpl = `[data-id="${this.selectors.guarantorsSection}"] ${personCardSelector}`;
    isDisplayed ? await expectVisible(this.t, { selector: selectorTpl }) : await expectNotPresent(this.t, { selector: selectorTpl });
  }
}
