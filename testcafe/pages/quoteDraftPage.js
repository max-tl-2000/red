/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { mapSeries } from 'bluebird';
import { Selector as $ } from 'testcafe';
import {
  expectTextIsEqual,
  expectVisible,
  getText,
  clickOnElement,
  executeSequentially,
  elementExists,
  clearTextElement,
  elementNotExist,
} from '../helpers/helpers';
import BasePage from './basePage';
import { convertToCamelCaseAndRemoveBrackets } from '../../common/helpers/strings';
import { formatMoney } from '../../common/money-formatter';
import loggerInstance from '../../common/helpers/logger';
import { now } from '../../common/helpers/moment-utils';

const logger = loggerInstance.child({ subType: 'quoteDraftPage' });

export default class QuoteDraftPage extends BasePage {
  constructor(t) {
    super(t);

    this.selectors = {
      ...this.selectors,
      quoteDialog: '#quote-dialog',
      quoteDraftDialog: '#quote-dialog',
      quoteTitleDialog: '#quoteTitleDialog',
      quoteTitleStatusText: '#quoteTitleStatusText',
      headerDialog: '#dialog-header',
      leaseTermsDropdown: '#dropdownLeaseTerms',
      leaseTermsDropdownDoneBtn: '#dropdownLeaseTerms_doneBtn',
      leaseTermsDropdownSelectedLabelText: '[data-id="selectedLabelTxt_dropdownLeaseTerms"]',
      publishButton: '#publishButton',
      deleteButton: '#deleteQuoteBtn',
      sendPublishedQuoteDialog: '#sendPublishedQuoteDialog',
      baseRentLeaseTerm: '[data-id="editorAmountbaseRentLeaseTerm_lengthText"]',
      increaseLeaseInput: '#flyoutAmountbaseRentLeaseTerm_lengthText',
      leaseTerms12OneMonthFree: '[data-id="leaseTerms12_1monthfree"]',
      leaseTerms12EmployeeRentCredit: '[data-id="leaseTerms12_Employeerentcredit"]',
      leaseTerms12SpecialMonthIncentive: '[data-id="leaseTerms12_Specialmonthincentive"]',
      leaseTerms12SpecialOneTimeIncentive: '[data-id="leaseTerms12_Specialonetimeincentive"]',
      titleCardByLeaseTerm12: '[data-id="12_months_lease_term"]',
      listTermsLength: '[data-component="list-item"]',
      quoteExpirationLabelText: '[data-id="quoteExpirationLabelTxt"]',
      inventoryStateText: '[data-id="inventoryStateTxt"]',
      inventoryNameText: '[data-id="inventoryNameTxt"]',
      inventoryLayoutText: '[data-id="inventoryLayoutTxt"]',
      includesComplimentaryItemText: '[data-id="includesComplimentaryItemTxt"]',
      complimentaryItems: '[data-id="complimentaryItemsTxt"]',
      expandCollapseButton: '[data-id="expandButton"]',
      monthFreeConcessionCheckBox: '#concession1MonthFree_checkBox',
      largePetFeeCheckBox: '#fee_petLarge2660Lb_checkComp',
      smallPetFeeCheckBox: '#fee_petSmall25LbOrLess_checkComp',
      employeeRentCreditConcessionCheckBox: '#concessionemployeeRentCredit_checkBox',
      specialMonthIncentiveConcessionCheckBox: '#concessionspecialMonthIncentive_checkBox',
      specialOneTimeIncentiveConcessionCheckBox: '#concessionspecialOneTimeIncentive_checkBox',
      heroesProgramConcessionCheckBox: '#concessionheroesProgramDiscount_checkBox',
      heroesProgramConcessionAmount: '[data-id="editorAmountheroesProgramDiscount_concessionAmountText"]',
      closeLeaseTermsDropDownBtn: '[data-id="dropdownLeaseTerms_DoneBtn"]',
      flyoutAmountForSpecialMonthIncentiveTxt: '#flyoutAmountspecialMonthIncentiveText',
      flyoutAmountForSpecialOnetimeIncentiveTxt: '#flyoutAmountspecialOneTimeIncentiveText',
      highValueAmenities: '#highValueAmenitiesTxt',
      propertyAmenities: '#propertyAmenitiesTxt',
      checkBox1monthFreeConcession: '#checkBox1monthfreeConcession',
      checkBoxEmployeeRentCreditConcession: '#checkBoxEmployeerentcreditConcession',
      checkBoxSpecialMonthIncentiveConcession: '#checkBoxSpecialmonthincentive-Concession',
      checkBoxSpecialOneTimeIncentiveConcession: '#checkBoxSpecialonetimeincentiveConcession',
      amountForSpecialmonthincentiveTxt: '#textBoxFlyoutAmountForSpecialmonthincentive',
      amountForSpecialOnetimeIncentiveTxt: '#textBoxFlyoutAmountForSpecialonetimeincentive',
      leaseStartDateTxt: '#leaseStartDateTxt',
      leaseStartDateCalendarRightBtn: '[data-id="dateSelectorRightBtn"]',
      leaseStartDateCalendarOkBtn: '[data-id="dateSelectorOkBtn"]',
      calendarDay: '[data-id="calendarDay"]',
      additionalChargesTable: '[data-id="additionalChargesTable"]',
      oneTimeChargesTable: '[data-id="oneTimeChargesTable"]',
      createdQuoteUnitName: '#summaryUnitNameTxt',
      concessionTable: '[data-id="concessionTable"]',
      totalMonthlyChargesAmount: '[data-id="totalMonthlyChargesAmount"]',
      totalSpecialConcessionAmount: '[data-id="totalSpecialConcessionAmount"]',
      detailMonthlyChargesTable: '[data-id="detailsOnMonthlyCharges_table"]',
      additionalOneTimeChargesable: '[data-id="additionalOneTimeCharges_table"]',
      leaseTermsDropdownItem: '[data-id="length_months_leaseTerm"]',
      createdQuoteLeasePrice: '#adjustedMarketRent',
      sendPublishedQuoteBtn: `#sendPublishedQuoteDialog ${this.selectors.okBtn}`,
      sendPublishedQuoteLaterBtn: `#sendPublishedQuoteDialog ${this.selectors.cancelBtn}`,
      monthlyLeaseIncentiveCheckBox: '#concessionmonthlyLeaseIncentive_checkBox',
      selectAllFeesCheckBox: '#selectAllFeesCheckBox',
      leaseAmenitiesTxt: '.leaseAmenitiesTxtId',
      createdQuoteLeaseTerm: '.leaseTermTxtId',
      leaseUnitDescriptionTxt: '.leaseUnitDescriptionTextId',
      leasePriceTxt: '[data-id="leasePriceTxtId"]',
      paymentScheduleSelectedLeaseTermTxt: '[data-id="leaseTerm"]',
      quoteDraftCloseBtn: '#quote-dialog_closeBtn',
      leaseTermPaymentScheduleTable: '[data-id="leaseTerm_table"]',
      calendarDayOfMonth: '[data-id="dayOfMonth_day"]',
      leaseTermDropDownItemEndDate: '[data-id="leaseTermName_leaseTerm_endDate"]',
      largePetDeposit: '[data-id="petDepositPetLarge2660Lb"]',
      smallPetDeposit: '[data-id="petDepositPetSmall25LbOrLess"]',
      securityDeposit: '[data-id="securityDeposit"]',
      leaseTermsList: '[data-id="LeaseTermsList"]',
      parckingCoveredCheckBox: '#fee_parkingCovered_checkComp',
      storageCheckBox: '#fee_storage_checkComp',
      specialOneTimeConcessionAmountEditor: '#flyoutAmountspecialOneTimeIncentiveText',
      specialOneTimeConcessionAmount: '[data-id="editorAmountspecialOneTimeIncentiveText"]',
      feeDepositAdminFeeCheckBox: '#adminFee_oneTimeFeeCheckComp',
      rentAmountDropDownItem: '[data-id="length_months_leaseTerm_rentAmount"]',
    };
  }

  async checkVisibilityQuoteHeader(titleStatusText, isRenewal = false) {
    const { t } = this;
    await t.wait(2000); // so the dialog is fully shown
    await expectVisible(t, { selector: this.selectors.quoteDraftDialog });
    await expectVisible(t, { selector: this.selectors.quoteTitleDialog });
    !isRenewal && (await expectVisible(t, { selector: this.selectors.inventoryStateText }));
    await expectVisible(t, { selector: this.selectors.quoteTitleStatusText });
    await expectTextIsEqual(t, { selector: this.selectors.quoteTitleStatusText, text: titleStatusText });
  }

  async checkLeaseTermVisibility(leaseTerms) {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.leaseTermsDropdown });

    for (let i = 0; i < leaseTerms.length; i++) {
      const leaseTerm = leaseTerms[i];
      const { term, hasSpecials, rentAmount } = leaseTerm;
      const leaseTermBaseSelector = `${term.replace(/\s/g, '_')}_leaseTerm`;
      const termSelector = `[data-id="${leaseTermBaseSelector}"]`;
      const termRentAmountSelector = `[data-id="${leaseTermBaseSelector}_rentAmount"]`;
      const termText = [term, hasSpecials ? '(specials)' : ''].filter(x => x).join(' ');
      await expectTextIsEqual(t, { selector: termSelector, text: termText, message: `checkLeaseTermVisiblity: expected text not found ${termText}` });
      // TEST-1216: Create a quote for a unit available in a party type of "New lease"
      await expectTextIsEqual(t, {
        selector: termRentAmountSelector,
        text: rentAmount,
        message: `checkLeaseTermVisiblity: expected rent not found ${rentAmount}`,
      });
    }

    await clickOnElement(t, { selector: this.selectors.leaseTermsDropdownDoneBtn });
  }

  async selectLeaseTerms(leaseTerms) {
    const { t } = this;

    await clickOnElement(t, { selector: this.selectors.leaseTermsDropdown });
    await t.wait(2000); // so the flyout is fully shown

    for (let i = 0; i < leaseTerms.length; i++) {
      const leaseTerm = leaseTerms[i];
      logger.trace(`>>> about to select "${leaseTerm}"`);

      await t.wait(500); // give it some time for React to render the new state
      const selector = $(this.selectors.listTermsLength).withText(leaseTerm);
      await clickOnElement(t, { selector, ensureInView: true });
    }

    await clickOnElement(t, { selector: this.selectors.leaseTermsDropdownDoneBtn });
  }

  async verifyFeeToCheck(selectorCheckBox) {
    return await $(selectorCheckBox).hasAttribute('data-fee-enabled');
  }

  async selectAGroupFeePerSection(feeStorage) {
    const { t } = this;

    for (let i = 0; i < feeStorage.feeName.length; i++) {
      await t.wait(300); // give react some time to render the new state in the UI
      const selectorToCheck = `#fee_${convertToCamelCaseAndRemoveBrackets(feeStorage.feeName[i])}_checkComp`;
      const isFeeEnabled = await this.verifyFeeToCheck(selectorToCheck);
      isFeeEnabled && (await clickOnElement(t, { selector: selectorToCheck }));
    }
  }

  async checkAFeeFromAdditionalMonthlyCharges(fee) {
    const { t } = this;
    const selectorToCheck = `${this.selectors.additionalChargesTable} [data-id="${fee.feeSection}"] #fee_${convertToCamelCaseAndRemoveBrackets(
      fee.feeName,
    )}_checkComp`;
    await clickOnElement(t, { selector: selectorToCheck });
  }

  async setFeeAmount(fee) {
    const { t } = this;
    const selectorToOpenFeeFlyout = `${this.selectors.additionalChargesTable} [data-id="${
      fee.feeSection
    }"] [data-id="editorAmount${convertToCamelCaseAndRemoveBrackets(fee.feeName)}Text"]`;
    const selectorToInputText = `[data-id="${fee.feeSection}"] #flyoutAmount${convertToCamelCaseAndRemoveBrackets(fee.feeName)}Text`;
    await clickOnElement(t, { selector: selectorToOpenFeeFlyout });
    await t.typeText(selectorToInputText, fee.feeAmount);
    await clickOnElement(t, { selector: this.selectors.flyoutDialogDoneBtn });
  }

  async checkAmountEntered(fee) {
    const { t } = this;
    const feeAmountSelector = `[data-id="${fee.feeSection}"] [data-id="editorAmount${convertToCamelCaseAndRemoveBrackets(fee.feeName)}Text"]`;
    const { result: baseRentFormatted } = formatMoney({ amount: fee.feeAmount, currency: 'USD' });
    return await expectTextIsEqual(t, { selector: feeAmountSelector, text: baseRentFormatted });
  }

  getFeeAmountOfOneTimeCharges = async feeOneTimeCharges =>
    await executeSequentially(feeOneTimeCharges.feeName, async feeAmountDeposit => {
      const feeSelector =
        feeAmountDeposit === 'Security deposit'
          ? `${this.selectors.oneTimeChargesTable} [data-id="${convertToCamelCaseAndRemoveBrackets(
              feeOneTimeCharges.feeNameSection,
            )}"] [data-id="${convertToCamelCaseAndRemoveBrackets(feeOneTimeCharges.leaseTermsLength)}_amount"]`
          : `${this.selectors.oneTimeChargesTable} [data-id="${feeOneTimeCharges.feeNameSection}"] [data-id="${convertToCamelCaseAndRemoveBrackets(
              feeAmountDeposit,
            )}_amount"]`;
      return (await getText(this.t, { selector: feeSelector })).replace('$', '');
    });

  getFeeNameOfOneTimeCharges = async feeOneTimeCharges =>
    await executeSequentially(feeOneTimeCharges.feeName, async feeNameDeposit => {
      const feeNameSelector =
        feeNameDeposit === 'Security deposit'
          ? `${this.selectors.oneTimeChargesTable} [data-id="${feeOneTimeCharges.feeNameSection}"] [data-id="${convertToCamelCaseAndRemoveBrackets(
              feeNameDeposit,
            )}"] [data-id="${convertToCamelCaseAndRemoveBrackets(feeNameDeposit)}"]`
          : `${this.selectors.oneTimeChargesTable} [data-id="${feeOneTimeCharges.feeNameSection}"] [data-id="${convertToCamelCaseAndRemoveBrackets(
              feeNameDeposit,
            )}"]`;
      return await getText(this.t, { selector: feeNameSelector });
    });

  async getValidSelectorForConcessionName(t, element) {
    const concessionSelector = element ? `[data-id="${convertToCamelCaseAndRemoveBrackets(element)}_amount"]` : undefined;
    return await getText(t, { selector: concessionSelector });
  }

  getConcessionValueOfQuotePublishedSummarySection = async quotePublishConcessionsSummary => {
    const { t } = this;
    return await executeSequentially(quotePublishConcessionsSummary.concessionsName, async _element => {
      const expectedConcessionTableLength = quotePublishConcessionsSummary.concessionsName.length;
      const currentConcessionTableLength = await $(
        `[data-id="${convertToCamelCaseAndRemoveBrackets(quotePublishConcessionsSummary.leaseTermsLength)}"] ${this.selectors.concessionTable}`,
      ).childElementCount;
      return expectedConcessionTableLength === currentConcessionTableLength
        ? await this.getValidSelectorForConcessionName(t, _element)
        : await t.expect(true).eql(false, `The result found ${currentConcessionTableLength} not equal to ${expectedConcessionTableLength}`);
    });
  };

  getFeeAmountOfDetailsOnMonthlyChargesSection = async feeSection => {
    const { t } = this;
    return await executeSequentially(
      feeSection,
      async feeName =>
        await getText(t, { selector: `${this.selectors.detailMonthlyChargesTable} [data-id="${convertToCamelCaseAndRemoveBrackets(feeName)}_amount"]` }),
    );
  };

  getFeeAmountOfAdditionalOneTimeCharges = async feeOneTimeCharges => {
    const { t } = this;
    return await executeSequentially(feeOneTimeCharges, async feeAmountOneTimeCharges => {
      const feeOneTimeChargesValue = await getText(t, {
        selector: `${this.selectors.additionalOneTimeChargesable} [data-id="${convertToCamelCaseAndRemoveBrackets(feeAmountOneTimeCharges)}_amount"]`,
      });
      return feeOneTimeChargesValue.replace('$', '');
    });
  };

  getAmountForEachLeaseTerm = async leaseTermsSelectors => {
    const amounts = [];
    for (let i = 0; i < leaseTermsSelectors.length; i++) {
      const leaseTerm = leaseTermsSelectors[i];
      const baseRentAmount = await getText(this.t, { selector: leaseTerm });
      if (baseRentAmount) {
        amounts.push(baseRentAmount.replace('$', ''));
      }
    }
    logger.trace('found amounts ', amounts);
    return amounts;
  };

  checkAmountInPaymentScheduleCard = async (paymentScheduleTitleInfo, paymentScheduleAmounts) => {
    const { t } = this;
    const getTitleScheduleCard = convertToCamelCaseAndRemoveBrackets(paymentScheduleTitleInfo);
    const tableSelector = `[data-id="${getTitleScheduleCard}_table"]`;
    const lengthTable = await $(tableSelector).childElementCount;
    await t.expect(lengthTable).eql(paymentScheduleAmounts.length);
    await mapSeries(paymentScheduleAmounts, async amount => {
      const { result: amountFormatted } = formatMoney({ amount, currency: 'USD' });
      await expectTextIsEqual(t, { selector: `${tableSelector} [data-id="${paymentScheduleAmounts.indexOf(amount)}"]`, text: amountFormatted });
    });
  };

  async close() {
    const closeDialogBtnSelector = `${this.selectors.quoteDialog} [data-component="icon-button"][data-action="closeFullscreenDialog"]`;
    await clickOnElement(this.t, { selector: closeDialogBtnSelector });
  }

  async clickOkBtnOnDialog() {
    await clickOnElement(this.t, { selector: $(`${this.selectors.dialogOverlay} ${this.selectors.okBtn}`) });
  }

  async clickCancelOnDialog() {
    await clickOnElement(this.t, { selector: $(`${this.selectors.dialogOverlay} ${this.selectors.cancelBtn}`) });
  }

  async clickOkBtnPublishQuoteDialog() {
    await clickOnElement(this.t, { selector: this.selectors.sendPublishedQuoteBtn });
  }

  async clickCancelBtnPublishQuoteDialog() {
    await clickOnElement(this.t, { selector: this.selectors.sendPublishedQuoteLaterBtn });
  }

  async compareActualResultGottenWithExpectedResult(expectedResult, currentResult) {
    if (expectedResult.length === currentResult.length && !expectedResult.some((val, index) => currentResult[index] !== val)) {
      return true;
    }
    return await this.t.expect(true).eql(false, `The result found ${currentResult} not equal to ${expectedResult}`);
  }

  async clickOnExpandAndCollapseButton() {
    await clickOnElement(this.t, { selector: this.selectors.expandCollapseButton });
  }

  async clickPublishQuoteButton() {
    await clickOnElement(this.t, { selector: this.selectors.publishButton });
  }

  async selectSpecialConcession(concessions, concessionSpecialAmount) {
    const { t } = this;
    for (let i = 0; i < concessions.length; i++) {
      await t.wait(300); // give React some time to render the new UI state
      await clickOnElement(t, { selector: concessions[i] });
      switch (i) {
        case 0:
          await this.editValueOnAmountEditor(t, this.selectors.flyoutAmountForSpecialMonthIncentiveTxt, concessionSpecialAmount.specialMonthIncentiveAmount);
          break;
        case 1:
          await this.editValueOnAmountEditor(t, this.selectors.flyoutAmountForSpecialOnetimeIncentiveTxt, concessionSpecialAmount.specialOneTimeIncentive);
          break;
        default:
      }
    }
  }

  async selectConcession(leaseTerms) {
    await executeSequentially(leaseTerms, async _leaseTerm => {
      await clickOnElement(this.t, { selector: _leaseTerm });
    });
  }

  async closeQuoteDraft() {
    await clickOnElement(this.t, { selector: this.selectors.quoteDraftCloseBtn });
  }

  async publishRenewalLetter() {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.leaseStartDateTxt });
    await expectVisible(t, { selector: this.selectors.leaseTermsList });

    // publish and send renewal letter
    await this.checkVisibilityQuoteHeader(`(${trans('DRAFT')})`, true);
    await expectVisible(t, { selector: this.selectors.publishButton, text: trans('PUBLISH').toUpperCase() });
    await clickOnElement(t, { selector: this.selectors.publishButton });

    await expectVisible(t, { selector: this.selectors.sendPublishedQuoteDialog });
    await expectVisible(t, { selector: this.selectors.sendPublishedQuoteBtn, text: trans('SEND_NOW').toUpperCase() });
    await clickOnElement(t, { selector: this.selectors.sendPublishedQuoteBtn });
  }

  changeBaseRentInQuote = async quoteData => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.baseRentLeaseTerm.replace('length', quoteData.lengthTerm) });
    await t.typeText(this.selectors.increaseLeaseInput.replace('length', quoteData.lengthTerm), quoteData.baseRent, { replace: true });
    await clickOnElement(t, { selector: this.selectors.flyoutDialogDoneBtn });
  };

  checkBaseRentValue = async quoteData => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.baseRentLeaseTerm.replace('length', quoteData.lengthTerm), text: `${quoteData.baseRentFormated}` });
  };

  async selectASingleFeeFromOneTimeCharges(fee) {
    const { t } = this;
    const selectorToCheck = `#${convertToCamelCaseAndRemoveBrackets(fee)}_oneTimeFeeCheckComp`;
    await clickOnElement(t, { selector: selectorToCheck });
  }

  getFirstDayOfNextMonth = async (addNumber, timezone) => {
    const currentDate = now({ timezone }).startOf('day').startOf('month');
    return currentDate.add(addNumber, 'month');
  };

  getRent = (rentPerMonth, moveDate) => {
    const selectedKey = Object.keys(rentPerMonth).find(key => moveDate.isAfter(key) && moveDate.isBefore(rentPerMonth[key].endDate));
    return rentPerMonth[selectedKey].rent;
  };

  formatMoney = async amount => `$${Math.round(amount).toLocaleString()}`;

  checkBaseRentPerLength = async (inventoryRentMatrix, leaseTerm, timezone) => {
    const { t } = this;
    await this.selectLeaseDate(t, this.selectors.leaseStartDateTxt, await this.getFirstDayOfNextMonth(2, timezone), timezone);
    await clickOnElement(t, { selector: this.selectors.leaseTermsDropdown });
    const rentPerMonth = inventoryRentMatrix[leaseTerm];
    const rent = await this.getRent(rentPerMonth, await this.getFirstDayOfNextMonth(1, timezone));
    const rentFormated = await this.formatMoney(rent);
    await clickOnElement(t, { selector: this.selectors.leaseTermsDropdown });
    await expectVisible(t, { selector: this.selectors.rentAmountDropDownItem.replace('length', leaseTerm), text: rentFormated });
    await clickOnElement(t, { selector: '[data-component="flyout-actions"] #dropdownLeaseTerms_doneBtn' });
    await expectVisible(t, {
      selector: `${this.selectors.leaseTermPaymentScheduleTable.replace('leaseTerm', `${leaseTerm}Months`)} [data-component="row"] [data-part="integer"]`,
    });
    await this.closeQuoteDraft();
  };

  async checkVariableFees(t, feesVariable) {
    for (const fee of feesVariable) {
      const feeTitle = convertToCamelCaseAndRemoveBrackets(fee.title);
      await expectVisible(t, { selector: `[data-id="${feeTitle}"]` });
      const defaultAmount = await getText(t, { selector: `[data-id="${feeTitle}_amount"]` });
      await elementExists(t, { selector: `[data-id="editorAmount${feeTitle}Text"]` });
      await clickOnElement(t, { selector: `[data-id="editorAmount${feeTitle}Text"]` });
      const elementMinAmountInFlyout = await getText(t, { selector: `[data-id="flyOutAmount${feeTitle}minText"]` });
      const elementMaxAmountInFlyout = await getText(t, { selector: `[data-id="flyOutAmount${feeTitle}maxText"]` });
      await clickOnElement(t, { selector: `#flyoutAmount${feeTitle}Text` });
      await clearTextElement(t, { selector: `#flyoutAmount${feeTitle}Text` });
      await t.typeText(`#flyoutAmount${feeTitle}Text`, fee.newMaxAmount);
      await expectVisible(t, { selector: $('div').withText(trans('THIS_AMOUNT_EXCEEDS_THE_MAX_LIMIT')) });
      const minAmount = elementMinAmountInFlyout.split(' ')[1];
      const maxAmount = elementMaxAmountInFlyout.split(' ')[1];
      await t.expect(fee.defaultAmount).eql(defaultAmount);
      await t.expect(fee.minAmountInFlyout).eql(minAmount);
      await t.expect(fee.maxAmountInFlyout).eql(maxAmount);
    }
  }

  async checkNonVariableFees(t, feesNonVariable) {
    for (const fee of feesNonVariable) {
      const feeTitle = convertToCamelCaseAndRemoveBrackets(fee.title);
      await expectVisible(t, { selector: `[data-id="${feeTitle}"]` });
      const defaultAmount = await getText(t, { selector: `[data-id="${feeTitle}_amount"]` });
      await elementNotExist(t, { selector: `[data-id="${feeTitle}_editable"]` });
      await t.expect(fee.defaultAmount).eql(defaultAmount);
    }
  }
}
