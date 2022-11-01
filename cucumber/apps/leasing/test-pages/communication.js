/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import { execWithRetry } from 'lib/exec-with-retry';
import { expect } from 'chai';
import logger from 'helpers/logger';
import config from 'config'; // this will resolve to cucumber/config.js

const { cucumber } = config;

export default class Communication extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async checkSmsMsg(msgText) {
    const smsMsg = await this.getText('[data-id="smsText"]');
    return expect(msgText).to.equal(smsMsg);
  }

  async checkEmailMsg(subject) {
    const condFunc = async () => {
      logger.trace(`Check for subject '${subject}' in email thread`);
      const emailMsgSubject = await this.getText('[data-id="emailSubject"]');
      return expect(subject).to.equal(emailMsgSubject);
    };
    await this.waitForCondition(`time to check if email with subject: '${subject}' exists has expired`, condFunc, cucumber.selenium.defaultTimeout);
  }

  clickOnSmsThread() {
    return this.clickOnElement('[id^="smsThread_"]');
  }

  async clickNewEmailButton() {
    return this.clickOnElement('[data-id="appBar"]  [data-red-icon][name="email"]');
  }

  async checkSmsFlyoutOpen() {
    const smsThread = await this.findElement('#smsFlyOut');
    return smsThread.isDisplayed().then(d => expect(d).to.equal(true));
  }

  closeSMSFlyOut() {
    return this.clickOnElement('#smsFlyOut [data-red-icon][name=close]');
  }

  async checkMsgInSmsFlyout(smsMessage) {
    const condFunc = async () => {
      logger.trace(`Check for message '${smsMessage}' in SMS flyout`);
      const commsWindow = await this.findElement('#smsFlyOut #commsId');
      const divsElm = await this.findElements('div', commsWindow);
      const messages = divsElm.map(e => e.getText());
      return await Promise.all(messages).then(r => r.indexOf(smsMessage) !== -1);
    };
    await this.waitForCondition(`time to check if message: '${smsMessage}' was received has expired`, condFunc, cucumber.selenium.defaultTimeout);
  }

  async checkTitleInSmsFlyout(title) {
    const condFunc = async () => {
      logger.trace(`Check for title '${title}' in SMS flyout`);
      const titleText = await this.getText('#smsFlyOut [data-component="title"]');
      return titleText.includes(title);
    };
    await this.waitForCondition(`time to check if smsFlyOut title is: '${title}' has expired`, condFunc, cucumber.selenium.defaultTimeout);
  }

  async checkSmsThreadNo(expectedThreadsNo) {
    const smsThreads = await this.findElements('[id^="smsThread_"]');
    return expect(smsThreads.length).to.equal(Number(expectedThreadsNo));
  }

  async checkEmailFlyoutOpen() {
    await this.findElement('#emailFlyout');
  }

  closeEmailFlyout() {
    return this.clickOnElement('#emailFlyout [data-red-icon][name=close]');
  }

  async _checkEmailThreadNo(expectedThreadsNo) {
    const emailThreads = await this.findElements('[data-id="emailThread"]');
    expect(emailThreads.length).to.equal(Number(expectedThreadsNo));
  }

  async checkEmailThreadNo(expectedThreadsNo) {
    return await execWithRetry(() => this._checkEmailThreadNo(expectedThreadsNo), { logger, fnName: 'checkEmailThreadNo' });
  }
}
