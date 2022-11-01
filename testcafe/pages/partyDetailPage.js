/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import { t as trans } from 'i18next';
import { expectTextIsEqual, expectVisible, setDropdownValues, clickOnElement, elementNotExist, expectNotPresent, clearTextElement } from '../helpers/helpers';
import BasePage from './basePage';
import { LeaseTypes } from '../helpers/mockDataHelpers';
import { formatMoney } from '../../common/money-formatter';
import { USD } from '../../common/currency';
import PartyPhaseOne from './partyPhaseOne';

export default class PartyDetailPage extends BasePage {
  constructor(t) {
    super(t);

    this.elementIds = {
      waiveApplicationFeeDialog: '#waiveApplicationFeeDialog',
    };

    this.selectors = {
      ...this.selectors,
      headerPartyDetail: '[data-id="managePartyTrigger"]',
      goToManageParty: '#iconToGoManageParty',
      guestTitleTag: '#guestTitleTag',
      numBedroomsText: '#numBedroomsText',
      propertyNameInfoText: '#propertyNameInfoText',
      waiveApplicationFeeOption: '#waive-application',
      editApplicationOption: '#edit-application',
      waiveApplicationFeeReasonText: '#waiver-reason',
      waiveApplicationFeeDialog: this.elementIds.waiveApplicationFeeDialog,
      rowApplicationListItems: '[data-component="list-item"]',
      screeningOnHoldGuarantorNotLinked: '[data-id="messageHoldTypes"]',
      errorMissingResidentInTheGuarantorMember: '#errorMessageMissingResident',
      guarantorSection: '#guarantorGroupSection',
      quantityMemberInTheParty: '#quantityMembersInTheParty',
      inventoryFilterBar: '#inventoryFilterBar',
      residentRowApplicationMenu: '[data-id="ResidentIndex_menu"]',
      memberTypeRowApplicationMenu: '[data-id="memberTypeIndex_menu"]',
      memberTypeApplicationListOption: '#ResidentIndex_menu_optionList',
      applicationStatusText: '#ResidentIndex_screeningStatus',
      communicationToggleBtn: '#communicationToggle',
      quoteRow: '[data-id="rowQuoteIndex"]',
      quoteRowMenu: '[data-id="rowQuoteIndex_menu"]',
      residentRow: '[data-id="ResidentIndex"]',
      quoteRowStatusTag: '[id="rowQuoteIndex_statusTag"]',
      partyCardMenu: '#partyCardMenu',
      propertySelectionDialog: '#propertySelectionDialog',
      changePropertyMenuItem: '#changePropertyMenuItem',
      viewActivityLogItem: '[data-id="viewActivityLogItem"]',
      mergePartiesItem: '[data-id="mergePartiesItem"]',
      scheduleAppointmentItem: '[data-id="scheduleAppointment"]',
      importAndProcessWorkflowsItem: '[data-id="importAndProcessWorkflowItem"]',
      importAndProcessWorkflowsDialog: '[data-id="importAndProcessWorkflowsDialog_dialogOverlay"]',
      scheduleAppointmentDialog: '#scheduleAppointment',
      todoSection: '[data-id="todoSection"]',
      taskDueDataTxt: '[data-id="taskDueDataTxt"]',
      taskRowCardMenu: '[data-id="appointment-row"] [data-component="card-menu"]',
      taskRowCardMenuCancel: '[data-id="appointment-row"] [data-component="list-item"]',
      appointmentRow: '[data-id="appointment-row"]',
      appointmentRowCardMenu: '[data-id="appointment-row"] [data-component="card-menu"]',
      appointmentRowCardMenuEdit: '[data-id="appointment-row"] [data-id="appointment-card-menu-item-edit"]',
      appointmentRowCardMenuAssign: '[data-id="appointment-row"] [data-id="appointment-card-menu-item-assign"]',
      appointmentRowCardMenuMarkDone: '[data-id="appointment-row"] [data-id="appointment-card-menu-item-mark-done"]',
      appointmentRowCardMenuMarkAsUndone: '[data-id="appointment-row"] [data-id="appointment-card-menu-item-mark-not-done"]',
      markAsDoneBtn: '[data-action="mark-as-done"]',
      appointmentRowCardMenuMarkAsNoShow: '[data-id="appointment-row"] [data-id="appointment-card-menu-item-mark-no-show"]',
      appointmentRowCardMenuMarkAsCancelled: '[data-id="appointment-row"] [data-id="appointment-card-menu-item-cancel"]',
      snackBarText: '[data-component="snackbar"] [data-id="snackbarText"]',
      bedroomsBar: '#bedroomsBar',
      leaseTypeDropdown: 'dropdownLeaseType',
      incomeQuestion: '#incomeQuestion',
      moveInTimeQuestionDropdown: 'moveInTimeQuestion',
      saveAndContinueBtn: '#btnSaveAndContinue',
      numberOfUnitsText: '#numberOfUnitsQuestion',
      leaseTermsDropdown: 'dropdownLeaseTerms',
      changePartyTypeBtn: '[data-id=changePartyTypeBtn]',
      numberOfUnitsQuestion: '#numberOfUnitsQuestion',
      feeWaivedText: `#ResidentIndex_applicationFeeWaived${this.selectors.tag}`,
      waiveApplicationFeeDialogTitle: `${this.elementIds.waiveApplicationFeeDialog} ${this.selectors.title}`,
      waiveApplicationFeeDialogBodyTxt: `${this.elementIds.waiveApplicationFeeDialog} ${this.selectors.dialogBody} ${this.selectors.markdown}`,
      waiveApplicationFeeDialogOkBtn: `${this.elementIds.waiveApplicationFeeDialog} ${this.selectors.okBtn}`,
      waiveApplicationFeeDialogCancelBtn: `${this.elementIds.waiveApplicationFeeDialog} ${this.selectors.cancelBtn}`,
      navigateBackBtn: '#navigateBack',
      mergePartiesDialog: '#mergePartiesDialog',
      mergePersonsDialog: '#mergePersonsDialog',
      employeeSelectorBtn: '#employeeSelectorBtn',
      propertySelectorBtn: '#propertySelectorBtn',
      propertySelectorDropdown: '[data-id="propertySelectorFlyoutOverlay"]',
      propertySelectorDropdownItem: '#mergePartiesDialog [data-id="propertySelectorFlyoutOverlay"][data-component="list-item"]',
      mergePartiesBtn: '#mergePartiesBtn',
      mergePersonsBtn: '#mergePersonsBtn',
      doNotMergePartiesBtn: '#doNotMergePartiesBtn',
      employeeSearchForm: '#employeeSearchForm',
      searchFormEmployeeList: '[data-id="employeeSearchFormList"]',
      transactionAmount1: '[data-id="transactionAmount1"]',
      transactionAmount2: '[data-id="transactionAmount2"]',
      preferencesSection: '[data-id="preferencesSection"]',
      selectLifestyleAndPropertiesButton: '[data-step-name="Select Lifestyle and Properties"]',
      covePropertyCard: '[data-property-card-name="The Cove at Tiburon"]',
      empyreanHorizonPropertyCard: '[data-property-card-name="Empyrean Horizon"]',
      moveInDatePreferenceText: '#moveInDatePreferenceText',
      maxPriceRangeText: '[data-id="maxPriceRangeText"]',
      threeBedsPreferencesBtn: '#THREE_BEDS',
      selectPropertyBtn: '#selectPropertyBtn',
      updatePreferencesBtn: '#updatePreferencesBtn',
      inventoryCardUnitNameText: '[data-id="qualifiedName"]',
      smallInventoryCardUnitNameText: '[data-id="qualifiedName"]>span',
      inventoryFilterInput: '#inventoryFilterBar [data-component="toolbar-item"] [data-component="textbox"] [type="text"]',
      createLeaseBtn: '#createLeaseBtn',
      leaseMenuBtn: '[data-id="leaseForUnit_menu"]',
      editLeaseDialogDialog: '[data-id="editLeaseDialog_dialogOverlay"]',
      leaseOptionsSection: '[data-id="leaseOptions"]',
      editLeaseOption: '#editLeaseOption',
      voidLeaseOption: '#voidLeaseOption',
      emailSubject: '[data-id="emailThreadSubject_Index"]',
      applicationApprovalDate: '[data-id="applicationApprovalDate"]',
      applicationApprovalDateTxt: '[data-id="applicationApprovalDateTxt"]',
      reviewApplicationBtn: '#reviewApplicationBtn',
      leaseState: '[data-id="leaseStateTxt"]',
      reviewLeaseBtn: '#reviewLeaseBtn',
      taskIndex: '[data-id="task_Name_Index"]',
      pendingApprovalAmount: '[data-id="pendingApprovalAmount"]',
      pendingApprovalMenu: '[data-id="pendingApprovalMenu"]',
      hideOrViewAllQuotes: '[data-id="hideOrViewAllQuotes"]',
      abandonRequestApproval: '#abandonRequestApproval',
      reviewApplication: '#reviewApplication',
      taskName: '[data-id="taskName"]',
      leaseDraftMenuBtn: '[data-id="leaseForUnitSection"] [data-component="card-menu"]',
      voidLeaseDraftBtn: '#abandonRequestApproval',
      applicationPendingApproval: '[data-id="applicationPendingApproval"]',
      quoteList: '[data-component="quote-list"]',
      leaseSection: '[data-id="leaseSection"]',
      leaseVoidedSection: '[data-id="leaseVoidedForUnitSection"]',
      leasePeriodTermsTxt: '[data-id="leasePeriodTermsTxt"]',
      leaseQuoteForUnitTxt: '[data-id="leaseQuoteForUnitTxt"]',
      leaseUnitNameTxt: '[data-id="leaseUnitNameTxt"]',
      leaseMoneyTxt: '[data-component="money"]',
      leaseWasVoidedTxt: '[data-id="leaseWasVoidedTxt"]',
      leaseVoidedDateTxt: '[data-id="leaseVoidedDateTxt"]',
      leaseComplimentaryItemsTxt: '[data-id="leaseComplimentaryItemsTxt"]',
      table: '[data-component="table"]',
      residentCard: '[data-id="memberCardsResidentSection"] [data-member-type="Resident"]',
      residentName: '[data-id="memberCardsResidentSection"] [data-id="cardTitle"]',
      residentContactSummary: '[data-id="memberCardsResidentSection"] [data-id="contactSummary"]',
      closeManagePartyDetailButton: '#manage-party-details-dialog_closeBtn',
      quoteScreeningStatusTxt: '#quoteScreeningStatusTxt',
      employeeSelectorFlyoutOverlay: '[data-id="employeeSelectorFlyoutOverlay"]',
      residentNameSelector: '[data-id="ResidentfullName_name"]',
      applicationHoldBanner: '[data-id="holdScreeningNotification"]',
      partySummaryBodySection: '[data-id="partySummaryBodySection"]',
      partySummaryPartyType: '[data-id="partySummaryPartyType"]',
      appointmentsSection: '[data-id="appointmentSection"]',
      applicationAndQuotesSection: '[data-id="applicationsAndQuotesSection"]',
      paymentsAndFeesSection: '[data-id="paymentsAndFeesSection"]',
      participantsSection: '[data-id="participantsSection"]',
      scheduleAppointmentMenuItem: '[data-id="scheduleAppointment"]',
      scheduleAppointmentCalendarRow: '#calendarRow',
      scheduleAppointmentDoneBtn: '#done',
      scheduleAppointmentCancelBtn: '#cancelAppointmentDialog',
      scheduleAppointmentTourTypeDropdown: 'dropdownTourType',
      scheduleAppointmentTourTypeSelectedText: '[data-id="tourTypes"] [data-id="selectedLabelTxt_dropdownTourType"]',
      scheduleAppointmentTourTypeDropdownItems: '[data-id="tourTypes"] [data-component="list-item"]',
      scheduleAppointmentUnitField: '[id="scheduleAppointment"] [data-id="units"]',
      scheduleAppointmentFirstUnitItem: '#inventorySelectorFirstLine',
      scheduleAppointmentBackArrow: '[data-id = "chevron-left"]',
      assignedPropertyForAppointmentDropdownButton: '[data-id="selectedLabelTxt_assignedProperty"]',
      submitAssignedPropertyButton: '#submitAssignedProperty',
      countersignerSignatureStatusNotSent: '#counterSignatureStatusText-Index-not_sent',
      countersignerSignatureStatusSigned: '#counterSignatureStatusText-Index-signed',
      applicantSignatureStatusSigned: '#signatureStatusText-Index-signed',
      applicantSignatureStatusSent: '#signatureStatusText-Index-sent',
      applicationLayoutInfoTxt: '#applicationLayoutInfoTxt',
      check: '[name="check"]',
      inventoryCardQuoteBtn: `[data-id="quote-unitName"]${this.selectors.button}`,
      inventoryCardTourBtn: `[data-id="tour-unitName"]${this.selectors.button}`,
      inventoryCardUnitStatus: '[data-id="status"]',
      inventoryCardStartingAtText: '[data-id$="unitName_startingAtPriceText"]',
      leaseTerm: '[data-id="leaseTerm"]',
      leaseUnitName: '[data-id="unitShortHand"]',
      leaseBaseRent: '[data-id="baseRentInLeaseStatusText"]',
      leaseCreatedDate: '[data-id="createdAt"]',
      residentSignatureStatus: '[data-id="signatureStatus"]',
      leaseResidentName: '[data-id="residentRowIndex"] [data-id="signerName"]',
      sendEmailLeaseBtn: '[data-id="sendEmailLeaseButton"]',
      emailThreadContactName: '#emailThreadContactNameTxt_Index',
      sendRenewalLetterBtn: '[data-id="sendRenewalLetterBtn"]',
      partySummarySection: '[data-id="partySummarySection"]',
      activeLeasesSection: '[data-id="activeLeasesSection"]',
      renewalLetterSection: '[data-id="renewalLetterSection"]',
      markAsMovingOutBtn: '[data-id="markAsMovingOutBtn"]',
      residentsMovingOutCheckbox: '[data-id="The resident_checkbox"]',
      propertyMovingOutCheckbox: '[data-id="The property_checkbox"]',
      dateOfNoticeSelector: '[data-id="dateOfNoticeSelector"]',
      vacateDateSelector: '[data-id="vacateDateSelector"]',
      vacateDateCalendarRightBtn: '[data-id="dateSelectorRightBtn"]',
      vacateDateCalendarOkBtn: '[data-id="dateSelectorOkBtn"]',
      movingOutNotes: '[data-id="movingOutNotes"]',
      markAsMovingOutDlgBtn: '[data-id="markAsMovingOutDlgBtn"]',
      cancelMovingOutDlgBtn: '[data-id="cancelMovingOutDlgBtn"]',
      cancelMovingOutBtn: '[data-id="cancelMovingOutBtn"]',
      warningScheduledAppointment: '[data-id="warningScheduledAppointment"]',
      sectionTitle: '[data-id="sectionTitleTxt"]',
      editContactInfo: '#editInResidentMenuItem p',
      residentPhoneNumber: '[data-id="addPhoneText1"]',
      residentEmail: '[data-id="addEmailText1"]',
      cancelContactInfoDialogButton: '#btnCancelEditContactInfo',
      quoteListContainer: '[data-component="section"] [data-component="quote-list"]',
      quoteSectionRow: '[data-component="quote-list-row"]',
      missingQuoteMessage: '[data-component="section"] [data-component="empty-message"] [data-id="noQuotesMessage"]',
      unitNameQuoteSection: '[data-id="qualifiedName"] [data-id="unitName"]',
      selfeServeTagQuoteSection: '[data-component="tag"] [id="undefined_truncate"]',
      leasePriceTermQuoteSection: '[data-component="quote-lit-lease-terms"] [data-component="lease-term-row"]',
      overflowMenuQuoteSection: '[data-component="quote-list-row"] [data-component="card-menu"]',
      reviewScreeningButton: '[data-component="flyout-overlay"] [name="review-promote-application"]',
      approveApplicationButton: '[data-id="btnApproveApplication"]',
      confirmButtonScreeningIncompleteDialog: '[data-id="screeningIncompleteDialog_dialogOverlay"] [data-command="OK"]',
      dialogApproveApplicationButton: '#dialog-overlay [data-action="OK"]',
      closeLeaseFormButton: '#dialog-header #close',
      navigateBackFromPartyPage: '#navigateBack',
      discardLeaseFormChangesButton: '[data-part="dlg-container"] [data-command="OK"]',
      FeeRowContainer: '[data-component="row"]',
      OverflowMenuApplicationSection: '[data-id="applicationPendingApproval"] [data-component="card-menu"]',
      RevokeApprovedApplicationButton: '#abandonRequestApproval',
      RevokeButtonFromRevokeDialog: '[data-part="dlg-container"] [data-command="OK"]',
      partyOwner: '[data-id="ownerPartyName"] p',
      paidInADifferentParty: '[data-id="paidInADifferentParty"]',
      addPriorActivityItem: '[data-id="addPriorActivityItem"]',
      addTaskItem: '[data-id="addTaskItem"]',
      viewAllWorkflowsItem: '[data-id="viewAllWorkflowsItem"]',
      exportPartyFileItem: '[data-id="exportPartyFileItem"]',
      closePartyItem: '[data-id="closePartyItem"]',
      emailFlyout: '#flyoutContainer',
      inventoryStartingPrice: '[data-id="completeUnitName_startingAtPriceText"] [data-part="integer"]',
      companyDetailsSection: '[data-id="companySection"]',
      associatedCompaniesSection: '[data-id="associatedCompaniesSection"]',
      remindMeButton: '[data-id="remindMe"]',
      manualTaskMenuBtn: '[data-id="manualTask_menu"]',
      editManualTask: '[data-id="editManualTask"]',
      manualTaskName: '[data-id="manualTaskName"]',
      manualTaskNotes: '[data-id="manualTaskNotes"]',
      assignManualTask: '[data-id="assignManualTask"]',
      employeeDropDown: '[data-id="employeeDropDown"]',
      cancelEditTaskDialog: '[data-id="cancelEditTaskDialog"]',
      saveEditTaskDialog: '[data-id="saveEditTaskDialog"]',
      markAsDone: '[data-id="markDone"]',
      unmarkAsDone: '[data-id="unmarkDone"]',
      manualTaskClosingNotes: '#dialog-overlay [class^=dialog-body]',
      closeResonDropdown: '#dialog-overlay [class^=dropdown]',
      closePartyButtonFromClosePartyDialog: '[data-component="dialog-actions"] [data-command="OK"]',
    };
  }

  getPropertyCardSelector = propertyName => `[data-property-card-name="${propertyName}"]`;

  getPreferencesStepSelector = stepName => `[data-step-name="${stepName}"]`;

  getCalendarSlotTimeSelector = slotTime => `tr[data-time="${slotTime}"] td:last-child`;

  async clickDialogBtnOk() {
    await clickOnElement(this.t, { selector: `${this.selectors.dialogOverlay} ${this.selectors.okBtn}`, requireVisibility: true });
  }

  async clickOnLeaseMenuBtn() {
    await clickOnElement(this.t, { selector: this.selectors.leaseMenuBtn });
  }

  async clickOnCreateLeaseBtn() {
    await clickOnElement(this.t, { selector: this.selectors.createLeaseBtn });
  }

  async clickOnPartyDetailTitle() {
    await clickOnElement(this.t, { selector: this.selectors.goToManageParty });
  }

  async clickOnMemberRowApplicationMenu(rowIndex, memberType) {
    const selectorTpl = this.selectors.memberTypeRowApplicationMenu;
    const applicationSelectorIndex = selectorTpl.replace('Index', rowIndex);
    const applicationSelector = applicationSelectorIndex.replace('memberType', memberType);
    await clickOnElement(this.t, { selector: applicationSelector });
  }

  async checkVisibleFlyOutList(rowIndex, memberType) {
    const selectorTpl = this.selectors.memberTypeApplicationListOption;
    const applicationSelectorIndex = selectorTpl.replace('Index', rowIndex);
    const applicationSelector = applicationSelectorIndex.replace('memberType', memberType);
    await expectVisible(this.t, { selector: `${applicationSelector}`, delayBetweenRetries: 1500, maxAttempts: 5 });
  }

  async clickOnPartyCardMenuBtn() {
    await clickOnElement(this.t, { selector: this.selectors.partyCardMenu });
  }

  async checkEmailIsNotSentInCommsPanel(subjectMsg) {
    await elementNotExist(this.t, { selector: $(this.selectors.emailSubject).withText(subjectMsg) });
  }

  async messageGuarantorNotLinkedInQuoteSection(message) {
    await expectTextIsEqual(this.t, {
      selector: this.selectors.screeningOnHoldGuarantorNotLinked,
      text: message,
    });
  }

  async messageGuarantorNotLinkedInGuarantorSection(message) {
    await expectTextIsEqual(this.t, {
      selector: this.selectors.errorMissingResidentInTheGuarantorMember,
      text: message,
    });
  }

  async checkOnlyOneMemberInTheParty() {
    const quantityMember = trans('PARTY_MEMBER', { count: 1 });
    await expectTextIsEqual(this.t, { selector: this.selectors.quantityMemberInTheParty, text: `${quantityMember}` });
  }

  async searchUnitByNameInInventory(unitName) {
    const selectorTpl = `${this.selectors.inventoryFilterBar} [data-component="toolbar-item"] [data-component="textbox"]`;
    await this.t.typeText(selectorTpl, unitName);
  }

  async existUnitNameInInventory(unitName) {
    const quoteNameSelector = this.selectors.inventoryCardQuoteBtn.replace('unitName', unitName);
    await expectVisible(this.t, { selector: quoteNameSelector });
  }

  async clickOnUnitToCreateQuote(unitName, leaseType = LeaseTypes.NEW_LEASE) {
    const { t } = this;
    const quoteBtnSelector = this.selectors.inventoryCardQuoteBtn.replace('unitName', unitName);
    await expectTextIsEqual(t, {
      selector: quoteBtnSelector,
      text: leaseType === LeaseTypes.NEW_LEASE ? trans('QUOTE').trim() : trans('QUOTE', { renewal: 'RENEWAL' }),
    });
    await clickOnElement(t, { selector: quoteBtnSelector });
  }

  async checkVisibilityOfSelectorWithIndex(selector, rowIndex) {
    const selectorTpl = selector.replace('Index', rowIndex);
    await expectVisible(this.t, { selector: selectorTpl });
  }

  async clickOnSelectorRow(selector, rowIndex) {
    const selectorTpl = selector.replace('Index', rowIndex);
    await expectVisible(this.t, { selector: `${selectorTpl}` });
    await clickOnElement(this.t, { selector: `${selectorTpl}` });
  }

  async checkScreeningStatusValue(rowIndex, statusValue) {
    const selectorTpl = this.selectors.applicationStatusText.replace('Index', rowIndex);
    await expectTextIsEqual(this.t, { selector: selectorTpl, text: statusValue });
  }

  async checkVisibilityLeaseTypeDropdown() {
    const selectorTpl = `#${this.selectors.leaseTypeDropdown}`;
    await expectVisible(this.t, { selector: selectorTpl });
  }

  async checkVisibilityOfNumberOfUnits() {
    await expectVisible(this.t, { selector: this.selectors.numberOfUnitsQuestion });
  }

  async checkVisibilityMoveInTimeQuestions() {
    const selectorTpl = `#${this.selectors.moveInTimeQuestionDropdown}`;
    await expectVisible(this.t, { selector: selectorTpl });
  }

  async selectLeaseTerm(leaseTerm) {
    await clickOnElement(this.t, { selector: this.selectors.leaseTermsDropdown });
    await clickOnElement(this.t, { selector: $('[data-component="list-item"]').withText(leaseTerm) });
  }

  async selectLengthOfLease(lengthOfLease) {
    await setDropdownValues(this.t, { id: this.selectors.leaseTermsDropdown, values: [`${lengthOfLease}`] });
  }

  getEmployeeCardSelector(agentName) {
    return `${this.selectors.employeeSelectorFlyoutOverlay} ${this.selectors.employeeSearchForm} [data-id="${agentName}_contactCard"]`;
  }

  async selectAgentInMergePartiesDialog(fullName) {
    const { t } = this;
    const agentName = fullName.replace(/\s/g, '');
    const contactCardSelectorTpl = this.getEmployeeCardSelector(agentName);
    await expectVisible(t, { selector: contactCardSelectorTpl });
    await clickOnElement(t, { selector: contactCardSelectorTpl });
  }

  getEmployeeSelector(agentName) {
    return `${this.selectors.employeeSearchForm} [data-id="${agentName}_contactCard"]`;
  }

  async selectAgentInEmployeeSelector(fullName) {
    const { t } = this;
    const agentName = fullName.replace(/\s/g, '');
    const contactCardSelectorTpl = this.getEmployeeSelector(agentName);
    await expectVisible(t, { selector: contactCardSelectorTpl });
    await clickOnElement(t, { selector: contactCardSelectorTpl });
  }

  getResidentNameSelector(fullName) {
    return this.selectors.residentNameSelector.replace('fullName', fullName);
  }

  async checkPartyDetailsResidentsAdded(members) {
    const { t } = this;
    await Promise.all(
      members.map(async ({ legalName }) => {
        const name = legalName.replace(/\s/g, '');
        const residentSelector = this.getResidentNameSelector(name);
        await expectVisible(t, { selector: residentSelector });
        await expectTextIsEqual(t, { selector: residentSelector, text: legalName });
      }),
    );
  }

  async selectQuoteMenuOption(quoteIndex, option) {
    const { t } = this;
    await this.clickOnSelectorRow(this.selectors.quoteRowMenu, quoteIndex);
    await clickOnElement(t, { selector: $('[data-component="list-item"]').withText(option) });
  }

  async clickOnManagePartyDetailsButton() {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.headerPartyDetail) });
  }

  async createManualTask() {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.remindMeButton) });
  }

  async clickOnRemindMeMenuBtn() {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.manualTaskMenuBtn) });
  }

  async editManualTaskNameAndNotes(taskNewName, taskNotes) {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.manualTaskMenuBtn) });
    await clickOnElement(t, { selector: $(this.selectors.editManualTask) });
    await clearTextElement(t, { selector: $(this.selectors.manualTaskName) });
    await t.typeText({ selector: $(this.selectors.manualTaskName) }, taskNewName);
    await t.typeText({ selector: $(this.selectors.manualTaskNotes) }, taskNotes);
  }

  async editManualTaskDueDate(date) {
    const { t } = this;
    const basePage = new BasePage(t);
    await basePage.selectLeaseDate(t, basePage.selectors.manualTaskDueDateText, date);
  }

  async editManulTaskAssignAgent(assignedAgentName) {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.employeeDropDown) });
    await clickOnElement(t, { selector: `#dialog-overlay [data-id="${assignedAgentName}_contactCard"]` });
  }

  async reassignManualTask(reassignedAgentName) {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.manualTaskMenuBtn) });
    await clickOnElement(t, { selector: $(this.selectors.assignManualTask) });
    await clickOnElement(t, { selector: `#employeeSearchForm [data-id="${reassignedAgentName}_contactCard"]` });
  }

  async markTaskDoneAndAddNotes(markAsDoneNotes) {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.manualTaskMenuBtn });
    await clickOnElement(t, { selector: this.selectors.markAsDone });
    await t.typeText({ selector: $(this.selectors.manualTaskClosingNotes) }, markAsDoneNotes);
    await clickOnElement(t, { selector: this.selectors.markAsDoneBtn });
  }

  async unmarkTaskDoneAndAddNotes(unmarkAsDoneNotes) {
    const { t } = this;
    const partyPhaseOne = new PartyPhaseOne(t);
    await partyPhaseOne.clickOnShowCompletedTaskButton();
    await clickOnElement(t, { selector: this.selectors.manualTaskMenuBtn });
    await clickOnElement(t, { selector: this.selectors.unmarkAsDone });
    await clickOnElement(t, { selector: this.selectors.manualTaskMenuBtn });
    await clickOnElement(t, { selector: this.selectors.markAsDone });
    await t.typeText({ selector: $(this.selectors.manualTaskClosingNotes) }, unmarkAsDoneNotes);
    await clickOnElement(t, { selector: this.selectors.markAsDoneBtn });
  }

  async closeParty(closeReason) {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.partyCardMenu) });
    await clickOnElement(t, { selector: $(this.selectors.closePartyItem) });
    await clickOnElement(t, { selector: $(this.selectors.closeResonDropdown) });
    await clickOnElement(t, { selector: $('[data-component="list-item"]').withText(trans(closeReason)) });
    await clickOnElement(t, { selector: $(this.selectors.closePartyButtonFromClosePartyDialog) });
  }

  async reopenParty() {
    const { t } = this;
    await clickOnElement(t, { selector: '[data-component="button"]', text: 'Reopen party' });
  }

  async editManualTask() {
    const { t } = this;
    await clickOnElement(t, { selector: $(this.selectors.manualTaskMenuBtn) });
    await clickOnElement(t, { selector: $(this.selectors.editManualTask) });
  }

  checkResidentContactInfos = async testData => {
    const { t } = this;
    await expectVisible(t, {
      selector: this.selectors.residentCard,
      text: testData.fullName,
    });

    await clickOnElement(t, { selector: $(this.selectors.residentCard) });
    await clickOnElement(t, { selector: $(this.selectors.editContactInfo).withText('Edit contact information') });

    await expectVisible(t, {
      selector: this.selectors.residentPhoneNumber,
      text: testData.formattedPhone,
    });

    await expectVisible(t, {
      selector: this.selectors.residentEmail,
      text: testData.email,
    });
    await clickOnElement(t, { selector: $(this.selectors.cancelContactInfoDialogButton) });
  };

  async checkQualificationQuestionsAnswers(tst, qualificationAnswers) {
    await mapSeries(qualificationAnswers, async element => {
      const qualificationAnswer = await $(`[data-id="${element.selector}"]`).withText(element.answer).with({ boundTestRun: tst });
      await tst.expect(qualificationAnswer.exists).ok();
    });
  }

  async closeManagePartyDetailsPage() {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.closeManagePartyDetailButton });
  }

  async checkPartySummarySection(expectedData) {
    const { t } = this;
    await Promise.all([
      expectedData.leasingPartyType &&
        expectVisible(t, {
          selector: $(this.selectors.partySummaryPartyType).find('p').withText(expectedData.leasingPartyType),
        }),
      expectVisible(t, {
        selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.interestedProperty),
      }),
      expectVisible(t, {
        selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.source),
      }),
      expectedData.initialChannel &&
        expectVisible(t, {
          selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.initialChannel),
        }),
      expectedData.leaseType &&
        expectVisible(t, {
          selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.leaseType),
        }),
      expectedData.pets &&
        expectVisible(t, {
          selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.pets),
        }),
      expectedData.guarantors &&
        expectVisible(t, {
          selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.guarantors),
        }),
      expectedData.moveInDate &&
        expectVisible(t, {
          selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.moveInDate),
        }),
    ]);
  }

  async checkRenewalPartyDetailsPageSectionVisibility({ isProspect, hasAppointments }) {
    const { t } = this;

    await Promise.all([
      expectVisible(t, { selector: this.selectors.partySummarySection }),
      hasAppointments && expectVisible(t, { selector: this.selectors.todoSection, text: trans('TO_DO_LABEL').replace(/(\s)([a-zA-Z])/, '$1d') }),
      expectVisible(t, { selector: this.selectors.appointmentsSection, text: trans('APPOINTMENTS_LABEL') }),
      expectVisible(t, { selector: this.selectors.activeLeasesSection, text: trans('ACTIVE_LEASES_SECTION_TITLE') }),
      expectVisible(t, { selector: this.selectors.participantsSection, text: trans('LEASING_TEAM_LABEL') }),
      !isProspect ? expectVisible(t, { selector: this.selectors.leaseSection }) : expectVisible(t, { selector: this.selectors.renewalLetterSection }),
    ]);
  }

  async checkRenewalPartySummarySection(expectedData) {
    const { t } = this;

    await Promise.all([
      expectVisible(t, {
        selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.property),
      }),
      expectVisible(t, {
        selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.currentLeaseEndsOn),
      }),
      expectVisible(t, {
        selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.renewalLetterState),
      }),
      expectVisible(t, {
        selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.rentedInventory),
      }),
      expectVisible(t, {
        selector: $(this.selectors.partySummaryBodySection).find('p').withText(expectedData.leaseType),
      }),
    ]);
  }

  async clickOnScheduleAppointmentMenuItem() {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.scheduleAppointmentMenuItem });
  }

  async clickOnReviewReleaseBtn() {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.reviewLeaseBtn });
  }

  async checkEmailSubjectTextInCommsPanel(threadIndex, subjectMsg) {
    const { t } = this;
    const selectorTpl = this.selectors.emailSubject.replace('Index', threadIndex);
    await expectTextIsEqual(t, { selector: selectorTpl, text: subjectMsg });
  }

  checkTheQuoteSection = async quoteSectionInfos => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.quoteListContainer });
    await expectNotPresent(t, { selector: this.selectors.missingQuoteMessage });
    await expectVisible(t, { selector: this.selectors.unitNameQuoteSection, text: quoteSectionInfos.unitName });
    await expectVisible(t, { selector: this.selectors.selfeServeTagQuoteSection, text: quoteSectionInfos.selfServeTag });
    await expectVisible(t, { selector: this.selectors.quoteSectionRow, text: quoteSectionInfos.leaseStartDate });
    await expectVisible(t, { selector: this.selectors.leasePriceTermQuoteSection, text: quoteSectionInfos.baseRent });
    await expectVisible(t, { selector: this.selectors.leasePriceTermQuoteSection, text: quoteSectionInfos.leaseTerm });
  };

  getTaskSelectorWithName(name) {
    return this.selectors.taskIndex.replace('Name', name);
  }

  async checkQuoteStatus(t, legalName, { status, index }) {
    await expectVisible(t, { selector: this.selectors.sectionTitle, text: trans('APPLICATIONS_AND_QUOTES_TITLE') });
    const residentRow = this.selectors.residentRow.replace('Index', index);
    const statusCell = this.selectors.applicationStatusText.replace('Index', index);
    await expectVisible(t, { selector: residentRow, text: legalName });
    await expectVisible(t, { selector: statusCell, text: status });
  }

  async checkPaidInADifferentPartyLabelIsDisplayed(t) {
    await expectVisible(t, { selector: this.selectors.paymentsAndFeesSection, text: trans('PAYMENTS_AND_FEES') });
    await expectVisible(t, { selector: this.selectors.paidInADifferentParty, text: trans('PAID_IN_A_DIFFERENT_PARTY') });
  }

  async checkPartyCardMenuItems() {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.scheduleAppointmentItem, text: trans('DASHBOARD_MENU_SCHEDULE_APPOINTMENT') });
    await expectVisible(t, { selector: this.selectors.addPriorActivityItem, text: trans('ADD_CONTACT_ACTIVITY') });
    await expectVisible(t, { selector: this.selectors.addTaskItem, text: trans('BUTTON_ADD_TASK') });
    await expectVisible(t, { selector: this.selectors.viewActivityLogItem, text: trans('BUTTON_VIEW_ACTIVITY_LOGS') });
    await expectVisible(t, { selector: this.selectors.viewAllWorkflowsItem, text: trans('BUTTON_VIEW_ALL_WORKFLOWS') });
    await expectVisible(t, { selector: this.selectors.exportPartyFileItem, text: trans('BUTTON_EXPORT_PARTY') });
    await expectVisible(t, { selector: this.selectors.closePartyItem, text: trans('BUTTON_CLOSE_PARTY') });
    await expectVisible(t, { selector: this.selectors.mergePartiesItem, text: trans('MERGE_PARTIES_LABEL') });
  }

  async selectPropertiesFromPreferencesSection(propertyNames) {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.selectLifestyleAndPropertiesButton });
    await mapSeries(propertyNames, async propertyLegalName => {
      await clickOnElement(t, { selector: `[data-property-card-name="${propertyLegalName}"]`, boundTestRun: t });
    });
  }

  async closePreferencesSection() {
    const { t } = this;
    await clickOnElement(t, { selector: '[data-component="card-actions"] [data-component="button"]', text: 'Close' });
  }

  async selectAppointmentType(appointmentType) {
    const { t } = this;
    await setDropdownValues(t, { id: this.selectors.scheduleAppointmentTourTypeDropdown, values: [trans(appointmentType)] });
  }

  async clickOnEmailLinkOption(t) {
    await clickOnElement(t, { selector: $(this.selectors.rowApplicationListItems).withText('Email link') });
  }

  async openEmailSent(t, lastEmailSent) {
    const selectorEmail = this.selectors.emailSubject.replace('Index', lastEmailSent);
    await expectVisible(t, { selector: selectorEmail });
    await clickOnElement(t, { selector: selectorEmail });
  }

  async clickOnOpenApplicationButton(t) {
    await expectVisible(t, { selector: this.selectors.emailFlyout });
    await t.switchToIframe(`${this.selectors.emailFlyout} iframe`);
    await clickOnElement(t, { selector: $('td>a') });
    await t.switchToMainWindow(); // This is necessary even though the window has switched
  }

  async checkInventoryStartingPrice(t, startingPrice, completeUnitName) {
    const { integerPart } = formatMoney({
      amount: startingPrice,
      currency: USD.code,
    });
    await expectVisible(t, {
      selector: this.selectors.inventoryStartingPrice.replace('completeUnitName', completeUnitName),
      text: integerPart,
    });
  }

  async runProcessWorkflowsJob() {
    const { t } = this;
    const basePage = new BasePage(t);
    await this.clickOnPartyCardMenuBtn();
    await expectVisible(t, { selector: this.selectors.importAndProcessWorkflowsItem });
    await clickOnElement(t, { selector: this.selectors.importAndProcessWorkflowsItem });
    await expectVisible(t, { selector: this.selectors.importAndProcessWorkflowsDialog });
    await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}`, text: 'Run job' });
    await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}`, text: 'OK' });
  }
}
