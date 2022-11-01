/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { mapSeries } from 'bluebird';
import BasePage from 'lib/BasePage';
import { applyTestIdToEmail } from 'lib/mail';
import config from 'config';

const { cucumber } = config;
const { expect } = chai;

chai.use(chaiAsPromised);

export default class applicantDetails extends BasePage {
  constructor() {
    super();
    this.url = `https://${cucumber.rentappSubdomainName}.${cucumber.domain}`;
  }

  async checkForApplicantDetails() {
    return expect(this.isVisible('[data-step-name="Your basic info"]')).to.eventually.equal(true);
  }

  async checkForPaymentDialog() {
    return expect(this.isVisible('#paymentDialog')).to.eventually.equal(true);
  }

  async checkForPaymentConfirmation(confirmation) {
    const text = await this.getText('[align="center"]');
    expect(text).to.equal(confirmation);
  }

  async applicantFirstStepCheck(applicantData, testId = '') {
    // clone data since we need to mutate it
    const expectedApplicant = applicantData.rows()[0].slice(0);

    const EMAIL_IDX = 2; // email is last column of table
    expectedApplicant[EMAIL_IDX] = applyTestIdToEmail(expectedApplicant[EMAIL_IDX], testId);
    const firstName = await this.getValue('#firstName');
    const lastName = await this.getValue('#lastName');
    const emailAddress = await this.getValue('#email');
    expect(expectedApplicant).to.deep.equal([firstName, lastName, emailAddress]);
  }

  async applicantSecondStepCheck() {
    // TODO CPM-5652 update this to validate application fees
    return expect(this.isVisible('[data-component="table"]')).to.eventually.equal(true);
    // const condFunc = async () => {
    //   const rows = await this.findElements('[data-component="table"] [data-component="row"]');
    //   return rows.length > 2;
    // };
    // await this.waitForCondition('time to check for rows', condFunc, cucumber.selenium.defaultTimeout);
    //
    // const rows = await this.findElements('[data-component="table"] [data-component="row"]');
    //
    // const feeArray =  feeData.raw();
    //
    // // Remove first row because of label
    // feeArray.shift();
    //
    // // Charges
    // const charges = await Promise.all(rows.map(async row => this.findElement('[data-component="cell"] div p', row)));
    // const chargeInfo = await Promise.all(charges.map(charge => charge.getText()));
    //
    // const chargesColumn = await feeArray.map(feeCharge => feeCharge[0]);
    // expect(chargesColumn).to.deep.equal(chargeInfo);
    //
    // // Amounts
    // const amounts = await Promise.all(rows.map(async row => this.findElement('[data-component="money"]', row)));
    // const amountInfo = await Promise.all(amounts.map(amount => amount.getText()));
    //
    // const amountsColumn = await feeArray.map(feeAmount => feeAmount[1]);
    // expect(amountsColumn).to.deep.equal(amountInfo);
  }

  async selectStateDropdown(state) {
    const searchPath = `//div[contains(text(),"${state}")]`;
    await this.clickOnElement('#state');
    const listItems = await this.findElements('[data-component="list-item"]');
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    await this.clickOnWebdriverElement(items[0]);
  }

  async selectCardExpirationDate(expiration) {
    const [month, year] = expiration.split('/');

    // Select Month
    await this.clickOnOption('month', month);

    // Select Year
    await this.clickOnOption('year', year);
  }

  async clickOnOption(name, option) {
    const path = `//option[text()="${option}"]`;
    await this.clickOnElement(`select[name="${name}"]`);
    await this.selectElementByXpath(path);
  }

  async setFields(arrayMap, selectorPrefix, selectorSuffix = '') {
    return await mapSeries(arrayMap, async fields => {
      const [id, value, type] = fields;

      if (id && value) {
        const selector = selectorPrefix + id + selectorSuffix;
        if (type && (type === 'maskedInput' || type === 'phone')) {
          await this.setValueWithDelay(selector, value);
        } else {
          await this.setValue(selector, value);
        }
      }
    });
  }

  async completeApplicantForm(fieldData) {
    const fieldsArray = fieldData.raw();

    // Remove first row because of label
    fieldsArray.shift();

    // Fill out all the required fields
    await this.setFields(fieldsArray, '[data-id="', '"]');
  }

  async completePaymentForm(paymentData) {
    const frame = await this.findElement('[data-component="dialog-body"] iframe');
    await this.switchToFrame(frame);

    const paymentArray = paymentData.raw();

    // Remove first row because of label
    paymentArray.shift();

    // Fill out all the payment fields
    await this.setFields(paymentArray, '#form input[name=', ']');
  }

  async continueButtonFromYourBasicInfo() {
    return this.clickOnElement('#nextStep');
  }

  async checkForPaymentStepper() {
    return expect(this.isVisible('[data-step-name="Payment"]')).to.eventually.equal(true);
  }

  async payAndContinueButton() {
    return this.clickOnElement('#doneStep');
  }

  async payFakeButton() {
    return this.clickOnElement('#btnReviewPayment');
  }
}
