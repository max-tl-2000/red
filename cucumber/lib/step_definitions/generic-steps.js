/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import logger from 'helpers/logger';
import { expect } from 'chai';
import BasePage from '../BasePage';
import sleep from '../../../common/helpers/sleep';
import preprocessValue from '../utils/preprocess-value';

/* eslint-disable red/no-find-element */
module.exports = function genericStepDefs() {
  const base = new BasePage();

  const urls = {
    Login: '/',
    Search: '/search',
  };

  this.Given(/^User types in field "([^"]*)" : "([^"]*)"$/, async (arg1, arg2) => {
    await base.setValue(`#${arg1}`, arg2);
  });

  this.Given(/^User types "([^"]*)" in field "([^"]*)"$/, async (value, selector) => {
    await base.setValue(selector, value);
  });

  this.Given(/^User types preprocessed value "([^"]*)" in field "([^"]*)"$/, async (value, selector) => {
    await base.setValue(selector, preprocessValue(value, this.testId));
  });

  this.Given(/^User navigates back$/, async () => {
    await base.back();
  });

  this.Given(/^Focus is set on "([^"]*)"/, async selector => {
    await base.setFocus(selector);
  });

  this.Given(/^"([^"]*)" page is open$/, async page => {
    await base.navigateTo(urls[page]);
  });

  this.Then(/^page "([^"]*)" should be displayed$/, async page => {
    await base.waitForCondition(`page ${page} should be displayed`, async () => await base.checkCurrentLocationIs(urls[page]));
  });

  this.When(/^Clicks "([^"]*)" button$/, async arg1 => {
    logger.trace(`attempt to click on ${arg1}`);
    await base.clickOnButtonId(arg1);
    logger.trace(`click is done by this point and we just move ${arg1}`);
  });

  this.When(/^User clicks: "([^"]*)"$/, async selector => {
    await base.clickOnElement(selector);
  });

  this.When(/^Clicks step with id "([^"]*)"$/, async arg1 => {
    logger.trace(`attempt to click on step ${arg1}`);
    await base.clickOnElement(`[data-idx='${arg1}']`);
    logger.trace(`click is done by this point and we just open step ${arg1}`);
  });

  // It is sad that cucumber complains because it believe the second capture group
  // is a parameter. It is actually used to be able to write the step in plural/singular
  // eslint-disable-next-line no-unused-vars
  this.Then(/^Just wait for "([^"]*)" second(s*)$/, async (timeout, plural) => {
    const num = parseInt(timeout, 10) * 1000;
    await sleep(num);
  });

  this.Given(/^Open a new browser tab$/, async () => await base.openNewTab());

  this.Given(/^Switch to tab number "([^"]*)"$/, async arg1 => await base.switchToTab(arg1));

  this.Then(/^Wait for "([^"]*)" element to appear$/, async selector => {
    await base.findElement(selector);
    await base.isVisible(selector);
  });

  this.Then(/^The count of "([^"]*)" elements is "([^"]*)"$/, async (selector, count) => {
    const countNum = parseInt(count, 10);

    await base.waitForCondition('count is the expected one', async () => {
      const elements = await base.findElements(selector);
      return elements.length === countNum;
    });
  });

  this.Then(/^The count of "([^"]*)" elements is greater than "([^"]*)"$/, async (selector, count) => {
    const countNum = parseInt(count, 10);

    await base.waitForCondition('count is greater than', async () => {
      const elements = await base.findElements(selector);
      return elements.length > countNum;
    });
  });

  this.Then(/^Element "([^"]*)" text content is "([^"]*)"$/, async (selector, expected) => {
    const text = await base.getText(selector);
    expect(text).to.equal(expected);
  });

  this.Then(/^Element "([^"]*)" contains text "([^"]*)"$/, async (selector, expected) => {
    const text = await base.getText(selector);
    expect(text).to.have.string(expected);
  });

  this.Then(/^TextBox "([^"]*)" value is "([^"]*)"$/, async (selector, expected) => {
    const value = await base.getValue(selector);
    expect(value).to.equal(expected);
  });

  this.Then(/^Select ButtonBar "([^"]*)" values to "([^"]*)"$/, async (selector, value) => {
    const values = value.split(/,\s*/);

    await base.setButtonBarValues(selector, values);
  });

  this.Then(/^The current tab is closed$/, async () => {
    await base.closeCurrentTab();
  });

  this.When(/^Clicks "([^"]*)" dropdown$/, async arg1 => {
    await base.clickOnElement(`[data-id="${arg1}"]`);
  });

  this.Then(/^The user closes the second tab$/, async () => {
    await base.switchToTab(2);
    await base.closeCurrentTab();
  });
};
