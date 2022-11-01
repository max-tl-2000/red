/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import logger from 'helpers/logger';
import config from 'config';
import { expect } from 'chai';

const { cucumber } = config;

export default class GoogleVoice extends BasePage {
  constructor() {
    super();
    this.url = 'https://www.google.com/voice#inbox';
  }

  async checkForInboxPage() {
    try {
      await this.findElement('[class=gc]');
      logger.trace('found inbox page - waiting for loading to go away');
      await this.waitForElementNotVisible('.gc-loading-area');
    } catch (err) {
      logger.error(err, 'Error waiting for inbox page');
      return Promise.reject(err);
    }
    return Promise.resolve();
  }

  async clickTextButton() {
    logger.trace('clickTextButton');
    await this.takeScreenshot('beforeClickTextButton');
    logger.trace('clicking TEXT button');
    await this.clickOnElement('div[id=gc-sidebar-jfk-container] div[role=button]:nth-child(2)');
    logger.trace('back from clicking TEXT button');
    await this.takeScreenshot('afterClickTextButton');
  }

  async setSearchPhoneNumber(phoneNumber) {
    await this.setValue('#gbqfq', phoneNumber);
  }

  async doSearch() {
    await this.clickOnElement('#gbqfb > span');

    const condFunc = async () => {
      const text = await this.getText('.gc-appbar-message-area.goog-inline-block>span');
      return await Promise.all(text).then(r => r.indexOf('0-0 of 0') === -1);
    };

    await this.waitForCondition('time to check if messages were showed', condFunc, cucumber.selenium.defaultTimeout);
  }

  async getResults() {
    const elems = await this.findElements('.gc-nobold');
    await expect(elems).to.have.length.above(0);
  }

  async clickCheckBoxAll() {
    await this.clickOnElement('.jfk-checkbox-checkmark');
    await this.waitForCondition('time to see for the checked messages', () =>
      this.isVisible('#gc-appbar > div > div.gc-appbar-buttons-left.goog-inline-block > div:nth-child(6)'),
    );
  }

  async doDelete() {
    await this.clickOnElement('#gc-appbar > div > div.gc-appbar-buttons-left.goog-inline-block > div:nth-child(6)');
    await this.waitForCondition('time to see for the deleted message', () =>
      this.isVisible('#gc-view-notification > table > tbody > tr:nth-child(2) > td.gc-rounded-mm.gc-rounded-bg.gc-status-text'),
    );
  }

  async validateDeleteMessage() {
    const text = await this.getText('#gc-view-notification > table > tbody > tr:nth-child(2) > td.gc-rounded-mm.gc-rounded-bg.gc-status-text');
    expect(text).to.contain('moved to trash.');
  }

  async doLogout() {
    await this.clickOnElement(
      '#gb > div.gb_ve.gb_wf > div.gb_hb.gb_wf.gb_R.gb_vf.gb_T > div.gb_hc.gb_wf.gb_R > div.gb_eb.gb_Hc.gb_wf.gb_R > div.gb_sc.gb_gb.gb_wf.gb_R > a > span',
    );
    await this.clickOnElement('#gb_71');
  }

  async checkLastSMSreceived(message, phone) {
    logger.trace('Check if google voice inbox page is displayed');
    await this.findElement('[id=gc-view-main]');
    logger.trace('Inbox is displayed');

    const condFunc = async () => {
      await this.refresh();

      logger.trace(`Check for message '${message}' is the last message received from ${phone} `);

      const threadsFromElm = await this.findElements(
        'div[class=gc-message-message-display] > div[class=gc-message-sms-row]:last-child span[class=gc-message-sms-from]',
      );
      const threadsFromTxt = await Promise.all(threadsFromElm.map(e => e.getText()));

      const threadsMsgsElm = await this.findElements(
        'div[class=gc-message-message-display] > div[class=gc-message-sms-row]:last-child span[class=gc-message-sms-text]',
      );
      const threadsMsgTxt = await Promise.all(threadsMsgsElm.map(e => e.getText()));

      return threadsMsgTxt.some((cur, index) => cur && cur.indexOf(message) !== -1 && threadsFromTxt[index] && threadsFromTxt[index].indexOf(phone) !== -1);
    };

    await this.waitForCondition(`time to check if message: '${message}' was received has expired`, condFunc, cucumber.selenium.defaultTimeout);
  }
}
