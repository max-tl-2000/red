/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import BasePage from './basePage';
import { expectVisible, expectTextIsEqual, clickOnElement, expectNotPresent, clearTextElement, getText, expectNotVisible } from '../helpers/helpers';
import PartyDetailPage from './partyDetailPage';
import { convertToCamelCaseAndRemoveBrackets } from '../../common/helpers/strings';

export default class LeaseApplicationPage extends BasePage {
  constructor(t) {
    super(t);

    this.selectors = {
      ...this.selectors,
      createLeaseBtn: '#btnCreateLease',
      publishLeaseBtn: '#publishLease',
      publishLeaseDialog: '#publishLeaseDialog',
      publishLeaseDialogOverlay: '[data-id="publishLeaseDialog_dialogOverlay"]',
      approveLeaseAppBtn: 'btnApproveApplication',
      requestApprovalBtn: '#btnRequestApproval',
      approveApplicationDialog: '#approveApplication',
      internalNotesTxt: '#internalNotes',
      publishStatusSuccessSection: '#publishStatusSuccess',
      companyNameTxt: '#companyNameTxt',
      residentsCategoryTxt: '#residents_categoryTxt',
      pointOfContactCategoryTxt: '#pointofcontact_categoryTxt',
      guarantorsCategoryTxt: '#guarantors_categoryTxt',
      occupantsCategoryTxt: '#occupants_categoryTxt',
      childrenCategoryTxt: '#minors_categoryTxt',
      petsCategoryTxt: '#petsandassistanceanimals_categoryTxt',
      vehiclesCategoryTxt: '#vehicles_categoryTxt',
      approvalSummary: '#approvalSummary',
      leftPanel: '[data-id="leftPanel"]',
      rightPanel: '[data-id="rightPanel"]',
      applicationSummaryFrame: '[data-id="applicationSummaryFrame"]',
      screeningRecommendationSection: '[data-id="screeningRecommendationSection"]',
      screeningReportSummarySection: '[data-id="screeningReportSummarySection"]',
      viewFullReportBtn: '#viewFullReportBtn',
      viewQuoteBtn: '[data-id="viewQuoteButton"]',
      applicationSummaryQuoteImage: '[data-id="applicationSummary_quoteImage"]',
      applicationSummaryQuoteInfo: '[data-id="applicationSummary_quoteInfo"]',
      applicationSummaryDeclineBtn: '#applicationSummaryDeclineBtn',
      applicationSummaryRequireWorkBtn: '#applicationSummaryRequireWorkBtn',
      applicationSummaryApproveBtn: '[data-id="btnApproveApplication"]',
      resident0ExpandButton: '[data-id="resident0_expandButton"]',
      privateDocument0: '[data-id="privateDocument0"]',
      resident0Address: '[data-id="resident0_address"]',
      resident0Income: '[data-id="resident0_income"]',
      resident0DateOfBirth: '[data-id="resident0_dateOfBirth"]',
      resident0FullName: '[data-id="resident0_fullName"]',
      increaseDeposit: '#increaseDeposit',
      depositDropdown: '#depositDropdown',
      viewRelatedQuoteBtn: '#viewRelatedQuoteBtn',
      leaseFormTitle: '[data-id="leaseFormTitle"]',
      depositAmountOther: '#depositAmount_other',
      depositAmountTxt: '#depositAmountTxt',
      depositAmount2: '#depositAmount_2',
      approvalSummaryCloseBtn: '#approvalSummary_closeBtn',
      unitNotAvailableWarningMsg: '[class^="unit-reserved-warning"]',
      screeningIncompleteDialog: '#screeningIncompleteDialog',
      leaseFormCloseBtn: '#leaseForm_closeBtn',
      leaseSection: '[data-id="leaseSection"]',
      leaseDescriptionTxt: '[data-id="leaseDescription"]',
      memberTypeRowIndex: '[data-id="memberTypeRowIndex"]',
      signerNameTxt: '[data-id="signerName"]',
      signatureStatusTxt: '[data-id="signatureStatus"]',
      sendEmailLeaseBtn: '[data-id="sendEmailLeaseButton"]',
      pickParkingItemBtn: '#parkingCovered_pickItemSelector',
      inventorySelectorItem: '[data-id="inventoryItem_index"]',
      inventorySelectorBtn: '[data-id="inventorySelectorBtn"]',
      quoteSummaryCard: '#quoteSummaryCard',
      summaryComplimentaryItemsTxt: '#summaryComplimentaryItemsTxt',
      summaryLeaseStartDateTxt: '#summaryLeaseStartDateTxt',
      summaryLeaseEndDateTxt: '#summaryLeaseEndDateTxt',
      complimentaryTxt: '[data-id="complimentaryItemsTxt"]',
      inventorySelectorFirstLine: '#inventorySelectorFirstLine',
      inspectionChecklistAddendumDocumentCheck: '#inspection_checklist_addendum_check',
      screeningIncompleteDialogOkBtn: '[data-id="screeningIncompleteDialog_dialogOverlay"] button[data-command="OK"]',
      approveApplicationDialogOkBtn: '#dialog-overlay button[data-action="OK"]',
      dialogNotesInput: '[type="text"]',
      declineDialog: '#declineDialog',
      leaseStartDateInput: '#leaseStartDateTxt',
      leaseMoveInDateInput: '#moveInDateTxt',
      leaseEndDateInput: '#leaseEndDateTxt',
      leaseUnitLayoutTxt: '[data-id="leaseUnitLayoutTxt"]',
      baseRentAmountTxt: '[data-id="editorAmountbaseRentLeaseTerm_lengthText"]',
      flyoutDialogDoneBtn: '[data-id="flyoutDoneBtn"]',
      oneTimeFeeAmount: '[data-id="editorAmountFeeNameText"]',
      oneTimeFeeTxt: '[data-id="oneTimeFeeFeeNameTxt"]',
      concessionCheckBox: '[data-id="concessionName_concessionCheckBox"]',
      concessionAmount: '[data-id="concessionName_concessionAmount"]',
      additionalMonthlyFeeCheckBox: '[data-id="feeName_additionalMonthlyFeeCheckBox"]',
      additionalMonthlyFeeAmount: '[data-id="editorAmountFeeName_additionalMonthlyFeeAmountText"]',
      additionalChargesSection: '[data-id="additionalChargesSection"]',
      signatureButton: '[data-id="signatureButton"]',
      signLeaseCheckbox: '#signLeaseCheckbox',
      startSignatureBtn: '#startSignatureBtn',
      signButton: '[data-id="signButton"]',
      counterSignatureBtn: '[data-id="counterSignatureButton"]',
      downloadLeaseBtn: '#downloadLeaseBtn',
      leaseSummarySection: '[data-id="leaseSummarySection"]',
      leaseWarningMsg: '[data-id="leaseWarningMsg"]',
      unitHoldingWarningDialog: '[data-id="inventory-holding-warning-dialog_dialogOverlay"]',
      pickItemFlyOutContainer: '[data-id="overlay-parkingCoveredTextInput"]',
      voidLeaseDialog: '#voidLeaseDialog',
      concessionsSectionBtn: '[data-id="concessionsSectionBtn"]',
      additionalChargesSectionBtn: '[data-id="additionalChargesSectionBtn"]',
      oneTimeChargesSectionBtn: '[data-id="oneTimeChargesSectionBtn"]',
      specialOneTimeConcessionAmountEditor: '#flyoutAmountspecialOneTimeIncentive_concessionAmountText',
      airConditionerFeeAmount: '[data-id="editorAmountairConditionerWindowUnit_additionalMonthlyFeeAmountText"]',
      airConditionerFeeAmountEditor: '#flyoutAmountairConditionerWindowUnit_additionalMonthlyFeeAmountText',
      airConditionerCheckBox: '#airConditionerWindowUnit_additionalMonthlyFeeCheckBox',
      airFeeDropdownButton: '#airConditionerWindowUnit_additionalMonthlyQuantityDropdown',
      airFeeQuantityItems: '[data-component="main-section"]',
      washDryerFeeCheckBox: '#washerDryerCombo_additionalMonthlyFeeCheckBox',
      petLargeFeeAmount: '[data-id="editorAmountpetLarge2660Lb_additionalMonthlyFeeAmountText"]',
      petLargeFeeAmountEditor: '#flyoutAmountpetLarge2660Lb_additionalMonthlyFeeAmountText',
      petLargeFeeAountCheckBox: '#petLarge2660Lb_additionalMonthlyFeeCheckBox',
      petSmallFeeAmount: '#editorAmountpetSmall25LbOrLess_additionalMonthlyFeeAmountText',
      petSmallFeeCheckBox: '#petSmall25LbOrLess_additionalMonthlyFeeCheckBox',
      contractDocumentsRow: '[data-id="summary-document-row"]',
      feeCheckBoxButton: '[id$="additionalMonthlyFeeCheckBox"]',
      markedCheckBox: '#checkbox-marked',
      unmarkedCheckBox: '#checkbox-blank-outline',
      feeQuantityDropdownButton: '[id$="additionalMonthlyQuantityDropdown"]',
      editableAmount: '[data-id^="editorAmount"]',
      noneditableAmount: '[data-component="money"]',
      petSmallOrLessFeeCheckBox: '#petSmall25LbOrLess_additionalMonthlyFeeCheckBox',
      petSmallOrLessFeeAmountTxt: '[data-id="petSmall25LbOrLess_amount"]',
      editorPetSmallFeeAmountTxT: '[data-id="editorAmountpetSmall25LbOrLess_additionalMonthlyFeeAmountText"]',
      petSectionLeaseRightPanel: '#petsandassistanceanimals_categoryTxt',
    };

    this.partyDetailPage = new PartyDetailPage(t);
  }

  getInventoryItemSelector(index) {
    return this.selectors.inventorySelectorItem.replace('index', index);
  }

  getApproveLeaseAppBtnSelector() {
    const selectorTpl = `[data-id="${this.selectors.approveLeaseAppBtn}"]`;
    return selectorTpl;
  }

  getPublishLeaseBtnSelector(sendLater = false) {
    const command = !sendLater ? 'OK' : 'CANCEL';
    return `${this.selectors.publishLeaseDialog} [data-command="${command}"]`;
  }

  getSendLaterLeaseSelector() {
    return `${this.selectors.publishLeaseDialog} ${this.selectors.cancelBtn}`;
  }

  async clickConfirmDialogBtn() {
    await clickOnElement(this.t, { selector: this.selectors.okBtn });
  }

  async closeLeasePage() {
    await clickOnElement(this.t, { selector: this.selectors.leaseFormCloseBtn });
  }

  getRowLeaseSelector(memberType, rowIndex) {
    return this.selectors.memberTypeRowIndex.replace('memberType', memberType.toLowerCase()).replace('Index', rowIndex);
  }

  checkPersonLeaseStatus = async (memberType, { rowIndex, status, legalName }) => {
    const { signerNameTxt, signatureStatusTxt } = this.selectors;
    const rowSelector = this.getRowLeaseSelector(memberType, rowIndex);

    legalName && (await expectTextIsEqual(this.t, { selector: `${rowSelector} ${signerNameTxt}`, text: legalName }));

    await expectTextIsEqual(this.t, { selector: `${rowSelector} ${signatureStatusTxt}`, text: status });
  };

  sendEmailLease = async (memberType, { rowIndex }) => {
    const { sendEmailLeaseBtn } = this.selectors;
    const rowSelector = this.getRowLeaseSelector(memberType, rowIndex);

    await clickOnElement(this.t, { selector: `${rowSelector} ${sendEmailLeaseBtn}` });
  };

  async clickOkBtnDialog() {
    const selectorTpl = `${this.selectors.approveApplicationDialog} ${this.selectors.dataActionOkBtn}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async clickOkScreeningIncompleteDialog() {
    const selectorTpl = `${this.selectors.dialogOverlay} ${this.selectors.okBtn}`;
    await clickOnElement(this.t, { selector: selectorTpl });
  }

  async closeLeaseFormPage() {
    await clickOnElement(this.t, { selector: this.selectors.leaseFormCloseBtn });
  }

  async clickOnPublishLeaseBtn() {
    await clickOnElement(this.t, { selector: this.selectors.publishLeaseBtn });
  }

  async clickOnPickItemSelector() {
    await clickOnElement(this.t, { selector: this.selectors.pickParkingItemBtn });
  }

  async clickOnFirstPickItem() {
    await clickOnElement(this.t, { selector: `${this.selectors.pickItemFlyOutContainer} ${this.selectors.dropDown}` });
    await clickOnElement(this.t, { selector: this.selectors.inventorySelectorFirstLine });
  }

  async clickOnInventorySelectorDoneBtn() {
    await clickOnElement(this.t, { selector: this.selectors.inventorySelectorBtn });
  }

  async checkInspectionChecklistAddendumNotIncluded() {
    await expectNotPresent(this.t, { selector: this.selectors.inspectionChecklistAddendumDocumentCheck });
  }

  createLease = async () => {
    const { t, partyDetailPage } = this;

    await clickOnElement(t, { selector: $(partyDetailPage.selectors.overflowMenuQuoteSection) });
    await clickOnElement(t, { selector: $(partyDetailPage.selectors.reviewScreeningButton) });
    await clickOnElement(t, { selector: $(partyDetailPage.selectors.approveApplicationButton) });
    await clickOnElement(t, { selector: $(partyDetailPage.selectors.confirmButtonScreeningIncompleteDialog) });
    await clickOnElement(t, { selector: $(partyDetailPage.selectors.dialogApproveApplicationButton) });
  };

  checkFeesInLeaseForm = async (feeDetails, options = { isFeeAmountEditable: true, checkUnselectedFees: false }) => {
    const { partyDetailPage, t: tst } = this;
    await mapSeries(feeDetails, async element => {
      const feeRow = $(partyDetailPage.selectors.FeeRowContainer).withText(element.title).with({ boundTestRun: tst });
      await tst.expect(feeRow.exists).ok();
      const checkBoxSelector = options.checkUnselectedFees ? this.selectors.unmarkedCheckBox : this.selectors.markedCheckBox;
      const checkedFees = feeRow.find(checkBoxSelector).with({ boundTestRun: tst });

      if (element.quantity) {
        await tst.expect(checkedFees.exists).ok();
        const feeQuantity = feeRow.find('[data-id^="selectedLabelTxt_"]').filterVisible().with({ boundTestRun: tst });
        await tst.expect(feeQuantity.exists).ok();
        await tst.expect(await feeQuantity.textContent).eql(element.quantity);
      }

      const amountSelector = options.isFeeAmountEditable ? this.selectors.editableAmount : this.selectors.noneditableAmount;
      const feeAmount = await feeRow.find(amountSelector).filterVisible().with({ boundTestRun: tst });
      await tst.expect(feeAmount.exists).ok();
      await tst.expect(await feeAmount.textContent).eql(element.amount);
    });
  };

  checkFeesAreReadOnly = async feeDetails => {
    const { partyDetailPage, t: tst } = this;
    await mapSeries(feeDetails, async element => {
      const feeRow = $(partyDetailPage.selectors.FeeRowContainer).withText(element.title).with({ boundTestRun: tst });
      await tst.expect(feeRow.exists).ok();
      const disabledCheckBoxButton = await feeRow.find(this.selectors.feeCheckBoxButton).with({ boundTestRun: tst }).withAttribute('disabled');
      await tst.expect(disabledCheckBoxButton.exists).ok();
      if (element.quantity) {
        const disabledQuantityDropdownButton = feeRow
          .find(this.selectors.feeQuantityDropdownButton)
          .filterVisible()
          .with({ boundTestRun: tst })
          .withAttribute('disabled');
        await tst.expect(disabledQuantityDropdownButton.exists).ok();
      }
      const feeAmount = await feeRow.find(this.selectors.noneditableAmount).filterVisible().with({ boundTestRun: tst });
      await tst.expect(feeAmount.exists).ok();
      await tst.expect(await feeAmount.textContent).eql(element.amount);
    });
  };

  checkPublishLeaseDialogIsDisplayed = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.publishLeaseBtn });
    await expectVisible(t, { selector: this.selectors.publishLeaseDialog });
  };

  pickLeaseItems = async fees => {
    const { t: tst, partyDetailPage } = this;
    await mapSeries(fees, async fee => {
      const feeRow = $(partyDetailPage.selectors.FeeRowContainer).withText(fee.title).with({ boundTestRun: tst });

      await tst.expect(feeRow.exists).ok();
      await clickOnElement(tst, { selector: $(`#${fee.pickItem}_pickItemSelector`), boundTestRun: tst });
      await clickOnElement(tst, { selector: $(`#${fee.pickItem}TextInput`), boundTestRun: tst });
      await clickOnElement(tst, {
        selector: $(`[data-id="overlay-${fee.pickItem}TextInput"] ${this.selectors.inventorySelectorFirstLine}`),
        boundTestRun: tst,
      });
    });
  };

  async expectPublishAndSendLeaseDialogVisible() {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.publishLeaseDialog });
    await expectVisible(t, { selector: this.selectors.publishLeaseDialogOverlay });
  }

  selectFeesInLeaseForm = async (feeDetails, editAmount = false) => {
    const { partyDetailPage, t: tst } = this;
    await mapSeries(feeDetails, async element => {
      const feeRow = $(partyDetailPage.selectors.FeeRowContainer).withText(element.title).with({ boundTestRun: tst });
      await clickOnElement(tst, { selector: $(`#${element.name}_additionalMonthlyFeeCheckBox`), boundTestRun: tst });
      feeRow.find('#checkbox-marked').with({ boundTestRun: tst });
      if (element.quantity) {
        const feeQuantity = feeRow.find('[data-id^="selectedLabelTxt_"]').filterVisible().with({ boundTestRun: tst });
        await clickOnElement(tst, { selector: feeQuantity, boundTestRun: tst });
        const quantityItem = feeRow.find('[data-component="flyout-content"] [data-component="list-item"]').with({ boundTestRun: tst });
        await clickOnElement(tst, { selector: quantityItem.withText(element.quantity), boundTestRun: tst });
      }
      if (editAmount) {
        const feeAmount = feeRow.find('[data-id^="editorAmount"]').with({ boundTestRun: tst });
        await clickOnElement(tst, { selector: feeAmount, boundTestRun: tst });
        const feeAmountTextInput = feeRow.find('[data-component="textbox"]');
        await tst.typeText(feeAmountTextInput, element.amount, {
          replace: true,
          boundTestRun: tst,
        });
        await clickOnElement(tst, { selector: this.selectors.flyoutDialogDoneBtn, boundTestRun: tst });
      }
    });
  };

  checkConcessionInContractDocuments = async (contractDocumentDetails, selectedContractDocument) => {
    const { t: tst } = this;

    await mapSeries(contractDocumentDetails, async element => {
      const contractRow = $(this.selectors.contractDocumentsRow).withText(element.title).with({ boundTestRun: tst });
      await tst.expect(contractRow.exists).ok();
      const checkBoxMarked = contractRow.find('[name="check"]').filterVisible().with({ boundTestRun: tst });
      if (selectedContractDocument) {
        await tst.expect(checkBoxMarked.exists).ok();
      } else {
        await tst.expect(checkBoxMarked.exists).eql(false);
      }
    });
  };

  checkLeasePageActiveButtons = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.downloadLeaseBtn });
    await expectVisible(t, { selector: this.selectors.viewRelatedQuoteBtn });
    await clickOnElement(t, { selector: this.selectors.viewRelatedQuoteBtn });
  };

  async checkASingleFeeFromAdditionalMonthlyCharges(fee) {
    const { t } = this;
    const selectorToCheck = `#${convertToCamelCaseAndRemoveBrackets(fee)}_additionalMonthlyFeeCheckBox`;
    await clickOnElement(t, { selector: selectorToCheck });
  }

  async checkFeePriceUpdated(newAmount) {
    const { t } = this;
    await expectTextIsEqual(t, { selector: this.selectors.editorPetSmallFeeAmountTxT, text: `$${newAmount}.00` });
  }

  checkPetIsServiceAnimal = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.petSectionLeaseRightPanel, text: 'service animal' });
  };

  checkComplimentaryParking = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.complimentaryTxt, text: 'Complimentary garage parking' });
  };

  checkParkingAddendum = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.rightPanel, text: 'Parking Policies and Vehicle Identification Addendum' });
  };

  async checkVariableFees(t, feesVariable, selectFeeCheckBox) {
    for (const fee of feesVariable) {
      const feeTitle = convertToCamelCaseAndRemoveBrackets(fee.title);
      const defaultAmountSelector = `[data-id="editorAmount${feeTitle}_additionalMonthlyFeeAmountText"]`;
      await expectVisible(t, { selector: defaultAmountSelector });
      const defaultAmount = await getText(t, { selector: defaultAmountSelector });
      await clickOnElement(t, { selector: defaultAmountSelector });
      const elementMinAmountInFlyout = await getText(t, { selector: `[data-id="flyOutAmount${feeTitle}_additionalMonthlyFeeAmountminText"]` });
      const elementMaxAmountInFlyout = await getText(t, { selector: `[data-id="flyOutAmount${feeTitle}_additionalMonthlyFeeAmountmaxText"]` });
      await clickOnElement(t, { selector: `#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText` });
      await clearTextElement(t, { selector: `#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText` });
      await t.typeText(`#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText`, fee.newMaxAmount);
      await expectVisible(t, {
        selector: $(`#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText-err-msg`).withText(trans('THE_AMOUNT_YOU_ENTERED_IS_GREATER_THAN_MAX')),
      });
      const minAmount = elementMinAmountInFlyout.split(' ')[1];
      const maxAmount = elementMaxAmountInFlyout.split(' ')[1];
      await t.expect(fee.defaultAmount).eql(defaultAmount);
      await t.expect(fee.minAmountInFlyout).eql(minAmount);
      await t.expect(fee.maxAmountInFlyout).eql(maxAmount);
      if (selectFeeCheckBox) {
        await clickOnElement(t, { selector: `#${feeTitle}_additionalMonthlyFeeCheckBox` });
      }
    }
  }

  async checkNonVariableFees(t, feesVariable, selectFeeCheckBox) {
    for (const fee of feesVariable) {
      const feeTitle = convertToCamelCaseAndRemoveBrackets(fee.title);
      const defaultAmountSelector = `[data-id="editorAmount${feeTitle}_additionalMonthlyFeeAmountText"]`;
      await expectVisible(t, { selector: defaultAmountSelector });
      const defaultAmount = await getText(t, { selector: defaultAmountSelector });
      await clickOnElement(t, { selector: defaultAmountSelector });
      const elementMinAmountInFlyout = await getText(t, { selector: `[data-id="flyOutAmount${feeTitle}_additionalMonthlyFeeAmountminText"]` });
      await clickOnElement(t, { selector: `#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText` });
      await clearTextElement(t, { selector: `#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText` });
      await t.typeText(`#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText`, fee.newMaxAmount);
      await expectNotVisible(t, {
        selector: $(`#flyoutAmount${feeTitle}_additionalMonthlyFeeAmountText-err-msg`).withText(trans('THE_AMOUNT_YOU_ENTERED_IS_GREATER_THAN_MAX')),
      });
      const minAmount = elementMinAmountInFlyout.split(' ')[1];
      await t.expect(fee.defaultAmount).eql(defaultAmount);
      await t.expect(fee.minAmountInFlyout).eql(minAmount);
      if (selectFeeCheckBox) {
        await clickOnElement(t, { selector: `#${feeTitle}_additionalMonthlyFeeCheckBox` });
      }
    }
  }
}
