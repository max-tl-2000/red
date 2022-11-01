/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { expectTextIsEqual, expectVisible, expectNotPresent, clickOnElement } from '../helpers/helpers';
import sleep from '../../common/helpers/sleep';

export default class ApplicationPage {
  constructor(t) {
    this.selectors = {
      firstNameTxt: '[data-id="firstName"]',
      lastNameTxt: '[data-id="lastName"]',
      dateOfBirthTxt: '[data-id="dateOfBirth"]',
      grossIncomeTxt: '[data-id="grossIncome"]',
      incomeFrequencyDropdown: 'incomeFrequencyDropdown',
      addressLine1Txt: '[data-id="addressLine1"]',
      cityTxt: '[data-id="city"]',
      stateDropdown: 'state',
      zipCodeTxt: '[data-id="zipCode"]',
      rentOrOwnDropdown: 'rentOrOwnDropdown',
      ownerName: '[data-id="ownerName"]',
      nextStepBtn: '#nextStep',
      doneStepBtn: '#doneStep',
      iAmDoneBtn: '#btnIAmDone',
      paymentDialog: '#paymentDialog',
      paymentFrame: '#paymentFrame',
      fullNameTxt: '#fullName',
      cardNumberTxt: '#cardNumber',
      cvvTxt: '#cvv',
      cardExpirationDateDropdown: '#cardExpirationDate',
      cardExpirationYearDropdown: '#cardExpirationYear',
      reviewPaymentBtn: '#btnReviewPayment',
      haveChildCheckbox: '#haveChildCheckbox',
      childDoNotHaveCheckbox: '#doNotHaveChildCheckbox',
      petDoNotHaveCheckbox: '#doNotHavePetCheckbox',
      vehicleDoNotHaveCheckbox: '#doNotHaveVehicleCheckbox',
      option1RenterInsuranceCheckbox: '#erenterPlan',
      option2RenterInsuranceCheckbox: '#renterAnotherCompany',
      incompleteRequiredSectionDialog: '#incompleteRequiredSectionDialog',
      requiredSectionDialogOkBtn: '#dialog-overlay [data-command="OK"]',
      incomeSourcesSection: '#incomeSourcesSection',
      addressHistorySection: '#addressHistorySection',
      privateDocumentsSection: '#privateDocumentsSection',
      disclosuresSection: '#disclosuresSection',
      childrenSection: '#childrenSection',
      petsSection: '#petsSection',
      vehiclesSection: '#vehiclesSection',
      sharedDocumentsSection: '#sharedDocumentsSection',
      rentersInsuranceSection: '#rentersInsuranceSection',
      notificationBanner: '[data-component="notification-banner"]',
      feeName1: '[data-id="feeName1"]',
      feeName2: '[data-id="feeName2"]',
      feeAmount1: '[data-id="feeAmount1"]',
      feeAmount2: '[data-id="feeAmount2"]',
      accountMessage: '#accountMessage',
      additionalInfoStepper: '[data-id="residentStepper"]',
      privateFileUploader: '[data-id="privateFileUploader"]',
      sharedFileUploader: '[data-id="sharedFileUploader"]',
    };

    this.t = t;

    this.sections = [
      this.selectors.incomeSourcesSection,
      this.selectors.addressHistorySection,
      this.selectors.privateDocumentsSection,
      this.selectors.disclosuresSection,
      this.selectors.childrenSection,
      this.selectors.petsSection,
      this.selectors.vehiclesSection,
      this.selectors.sharedDocumentsSection,
      this.selectors.rentersInsuranceSection,
    ];
  }

  async clickOkBtnRequiredSectionDialog() {
    await clickOnElement(this.t, { selector: this.selectors.requiredSectionDialogOkBtn });
  }

  async clickIAmDoneBtn() {
    await clickOnElement(this.t, { selector: this.selectors.iAmDoneBtn });
  }

  async clickOnDisclosureCheckbox(index, disclosureDescription, check = false) {
    const { t } = this;
    const { checkboxTitle, checkboxCaption, checkboxText } = disclosureDescription;
    const selectorTplCheckboxBtn = '#disclosureCheckboxIndex';
    const selectorTplCaption = '#disclosureCaptionIndex';
    const selectorTplText = '#disclosureTxtIndex';
    await expectTextIsEqual(t, { selector: selectorTplCheckboxBtn.replace('Index', index), text: checkboxTitle });
    await expectTextIsEqual(t, { selector: selectorTplCaption.replace('Index', index), text: checkboxCaption });
    if (check) {
      await clickOnElement(t, { selector: selectorTplCheckboxBtn.replace('Index', index) });
      await t.typeText(selectorTplText.replace('Index', index), checkboxText);
    }
  }

  async verifyCheckedDisclosures(index, disclosureDescription) {
    const { t } = this;
    const { checkboxTitle, checkboxText } = disclosureDescription;
    const selectorTplTitle = '#disclosureSummaryTitleIndex';
    const selectorTplText = '#disclosureSummaryTxtIndex';
    await expectTextIsEqual(t, { selector: selectorTplTitle.replace('Index', index), text: checkboxTitle });
    await expectTextIsEqual(t, { selector: selectorTplText.replace('Index', index), text: checkboxText });
  }

  async openAdditionalInfoStep(stepName) {
    const { t } = this;
    await clickOnElement(t, { selector: $(`${this.selectors.additionalInfoStepper} ${stepName} [data-step-header="true"]`) });
  }

  async verifyUploadDocument(fileUploaderId, { iconName, removeIconName, category, statusMessage, filePath, fileName }) {
    const { t } = this;
    const hiddenInput = $(`${fileUploaderId} [data-id="uploadFileInput"]`, { visibilityCheck: false });

    await t.hover(`${fileUploaderId} [data-id="dropzone"]`);
    await t.setFilesToUpload(hiddenInput, filePath);

    const fileQueueItem = `${fileUploaderId} [data-component="fileQueueItem"] [data-id="${fileName.replace(/\s/g, '_')}"]`;
    await expectVisible(t, { selector: fileQueueItem });
    await expectVisible(t, { selector: `${fileQueueItem} #${iconName}` });
    await expectTextIsEqual(t, { selector: `${fileQueueItem} [data-id="fileNameText"]`, text: fileName });

    const selectCategory = async value => {
      await clickOnElement(t, { selector: `${fileQueueItem} [data-id="dd-categoriesDropdown"] [data-trigger="true"]` });
      await clickOnElement(t, { selector: $(`${fileQueueItem} [data-id="overlay-categoriesDropdown"] [data-component="list-item"]`).withText(value) });
    };

    if (removeIconName) {
      await expectVisible(t, { selector: `${fileQueueItem} #${removeIconName}` });
      await sleep(5000);
      await selectCategory(category);
    } else {
      await expectTextIsEqual(t, { selector: `${fileQueueItem} [data-id="statusText"]`, text: statusMessage });

      await expectNotPresent(t, { selector: `${fileQueueItem} #close-circle` });
      await expectNotPresent(t, { selector: `${fileQueueItem} [data-id="dd-categoriesDropdown"]` });
    }
  }

  async verifyDocumentDataStored(fileUploaderId, { iconName, removeIconName, category, fileName }) {
    const { t } = this;
    const fileQueueItem = `${fileUploaderId} [data-component="fileQueueItem"] [data-id="${fileName.replace(/\s/g, '_')}"]`;
    await expectVisible(t, { selector: fileQueueItem });
    await expectVisible(t, { selector: `${fileQueueItem} #${iconName}` });
    await expectTextIsEqual(t, { selector: `${fileQueueItem} [data-id="fileNameText"]`, text: fileName });

    await expectVisible(t, { selector: `${fileQueueItem} #${removeIconName}` });
    await expectVisible(t, { selector: `${fileQueueItem} [data-id="selectedLabelTxt_categoriesDropdown"]` });
    await expectTextIsEqual(t, {
      selector: `${fileQueueItem} [data-id="selectedLabelTxt_categoriesDropdown"]`,
      text: category,
    });
  }
}
