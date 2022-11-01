/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { elements } from 'selenium-pageobject';
import path from 'path';
import sanitize from 'sanitize-filename';
import { expect } from 'chai';
import { mapSeries } from 'bluebird';
import { webDriver, getDriver, rebuild, getCurrentUrl } from './driver';
import config from '../config';
import loggerModule from '../../common/helpers/logger';
import sleep from '../../common/helpers/sleep';
import { write } from '../../common/helpers/xfs';
import trim from '../../common/helpers/trim';
import { execWithRetry } from './exec-with-retry';

const logger = loggerModule.child({ type: '[BASE_PAGE]' });

const { By, until, Key } = webDriver;
const { TextBox, Element } = elements;
const { cucumber } = config;
const { selenium } = cucumber;

const MAX_ATTEMPTS_PER_METHOD = 10;

export default class BasePage {
  constructor() {
    this.baseURL = `https://${cucumber.tenantName}.${cucumber.domain}`;
    this.logger = logger;
  }

  getLogger() {
    return logger;
  }

  get _driver() {
    return getDriver();
  }

  waitForElement(locator, waitTime = selenium.activeWaitTimeout) {
    logger.trace(`waiting for element using locator ${locator}, timeout: ${waitTime}`);
    const ret = this._driver.wait(until.elementLocated(this.convertToByLocator(locator)), waitTime);

    if (!ret) {
      // I don't think this will ever get called, since Selenium should throw if it times out above
      // But I'd rather log here just in case...
      logger.warn({ locator }, 'Could not find element! using locator');
    }

    expect(ret).not.to.be.null; // And then this will definitely throw otherwise.
    return ret;
  }

  async _scrollTop(selector, value) {
    const scroll = await this.findElement(selector);
    return this.executeScript(`arguments[0].scrollTop=${value};`, scroll);
  }

  async scrollTop(selector, value) {
    const fnName = 'scrollTop';
    logger.trace(`${fnName} start`);
    return await execWithRetry(() => this._scrollTop(selector, value), { logger, fnName });
  }

  async _getElement(locator) {
    // first make sure we absolutely have the element in the page
    await this.waitForElement(locator);
    return new Element(this._driver, locator);
  }

  async _findElement(selector, ctx) {
    if (ctx) {
      return ctx.findElement(By.css(selector));
    }

    const elem = await this._getElement(By.css(selector));
    return elem['element']; // eslint-disable-line
  }

  async _findElementByXpath(xpath, ctx) {
    if (ctx) {
      return ctx.findElement(By.xpath(xpath));
    }

    const elem = await this._getElement(By.xpath(xpath));
    return elem['element']; // eslint-disable-line
  }

  async getTextBox(locator) {
    await this.waitForElement(locator);
    return new TextBox(this._driver, locator);
  }

  async findElementByXpath(xpath, ctx) {
    const fnName = 'findElementByXpath';
    logger.trace(`${fnName} start: "${xpath}" ${ctx ? ', using context' : ''}`);
    return await execWithRetry(() => this._findElementByXpath(xpath, ctx), { logger, fnName });
  }

  async findElement(selector, ctx) {
    const fnName = 'findElement';
    logger.trace(`${fnName} start: "${selector}" ${ctx ? ', using context' : ''}`);
    return await execWithRetry(() => this._findElement(selector, ctx), { logger, fnName });
  }

  async getAttribute(cssSelector, attributeName) {
    const elem = await this.findElement(cssSelector);
    const attr = await elem.getAttribute(attributeName);
    return attr;
  }

  _findTextBox(selector) {
    return this.getTextBox(By.css(selector));
  }

  async _getText(selector) {
    const ele = await this.findElement(selector);
    await this._driver.executeScript('document.querySelector(arguments[0]).scrollIntoView();', selector);
    logger.trace(`_getText(${selector}): found element!`);
    return await ele.getText();
  }

  async findTextBox(selector) {
    const fnName = 'findTextBox';
    logger.trace(`${fnName} start: "${selector}"`);
    return await execWithRetry(() => this._findTextBox(selector), { logger, fnName });
  }

  async setValueWithDelay(selector, text) {
    logger.trace(`setValueWithDelay. selector: ${selector}, ${text}`);
    const textParts = text.split('');
    const THRESHOLD_BETWEEN_KEYS = 500;

    const txt = await this.findTextBox(selector);
    await txt.element.clear();

    for (let i = 0; i < textParts.length; i++) {
      const key = textParts[i];
      logger.trace(`setting value ${key}`);
      await txt.element.sendKeys(key);
      await sleep(THRESHOLD_BETWEEN_KEYS);
    }

    const value = await txt.getValue();
    logger.trace(`value in textbox: ${value}`);
  }

  async setValue(selector, text) {
    const fnName = 'setValue';
    logger.trace(`${fnName} start`);

    return await execWithRetry(async () => this._setValue(selector, text), { logger, fnName });
  }

  async _setValue(selector, text) {
    logger.trace(`setValue(${selector}): start, text: ${text}`);
    const txt = await this.findTextBox(selector);
    logger.trace(`setValue(${selector}): element found, text: ${text}`);

    await txt.setValue(text);
  }

  async selectElementByXpath(xpath) {
    logger.trace(`selectElement(${xpath}): start`);
    const txt = await this._findElementByXpath(xpath);
    logger.trace(`selectElement(${xpath}): element found`);
    await this.clickOnWebdriverElement(txt);
  }

  async selectElement(selector) {
    logger.trace(`selectElement(${selector}): start`);
    const txt = await this._findElement(selector);
    logger.trace(`selectElement(${selector}): element found`);
    await this.clickOnWebdriverElement(txt);
  }

  async getValue(selector) {
    logger.trace(`getValue(${selector}): start`);
    const txt = await this.findTextBox(selector);
    logger.trace(`getValue(${selector}): element found`);
    return await txt.getValue();
  }

  async getText(selector, allowEmpty = false) {
    const fnName = 'getText';
    logger.trace(`${fnName} start`);
    return await execWithRetry(
      async () => {
        let text = await this._getText(selector);
        text = trim(text);

        if (text === '' && !allowEmpty) {
          throw new Error(`${fnName} empty string not allowed as a result of getText from ${selector}`);
        }

        return text;
      },
      { logger, fnName },
    );
  }

  async elementContainsText(selector, text) {
    const fnName = 'elementContainsText';
    logger.trace(`${fnName} start: looking for text "${text}"`);

    return await execWithRetry(
      async () => {
        const elementText = await this.getText(selector);
        expect(elementText).to.contain(text);
      },
      { logger, fnName },
    );
  }

  async elementTextIsEqual(selector, text) {
    const fnName = 'elementTextIsEqual';
    logger.trace(`${fnName} start`);

    return await execWithRetry(
      async () => {
        const elementText = await this.getText(selector);
        expect(elementText).to.equal(text);
      },
      { logger, fnName },
    );
  }

  async waitForCondition(message, evalFn, waitTime = selenium.activeWaitTimeout) {
    logger.trace(`waitForCondition: Waiting ${waitTime} for condition: ${message}`);
    await this._driver.wait(evalFn, waitTime, message);
  }

  async clickOnElement(selector) {
    const fnName = 'clickOnElement';
    logger.trace(`${fnName} start: ${selector}`);

    return await execWithRetry(async () => this._clickOnElement(selector), { logger, fnName, onFail: () => logger.error(`${fnName} error: ${selector}`) });
  }

  async _setButtonBarValues(selector, values) {
    logger.trace(`_setButtonBarValues start: ${selector}, ${values}`);
    const buttonBar = await this.findElement(selector);

    await mapSeries(values, async value => {
      const ele = await this.findElement(`#${value}`, buttonBar);
      const checkedAttr = await ele.getAttribute('data-checked');
      const checked = checkedAttr === 'true';

      if (!checked) {
        logger.trace(`_setButtonBarValues clicking on: ${selector}, ${value}`);
        await this.clickOnWebdriverElement(ele);
        await sleep(50);
      }
    });

    const selected = await this.findElements(`${selector} [data-checked="true"]`);
    const checkedValues = await Promise.all(selected.map(sel => sel.getAttribute('id')));

    expect(checkedValues).to.deep.equal(values);
  }

  async setButtonBarValues(selector, values) {
    const fnName = 'setButtonBarValues';
    logger.trace(`${fnName} start`);

    return await execWithRetry(async () => this._setButtonBarValues(selector, values), { logger, fnName });
  }

  async _clickOnElement(selector) {
    logger.trace(`clickOnElement(${selector}): attempt to click`);
    const element = await this.findElement(selector);
    logger.trace(`clickOnElement(${selector}): element found`);

    // TODO: factorize this so both the scrolling and moving into view is done from a single place
    await this._driver.executeScript(
      'document.querySelector(arguments[0]).scrollIntoView({behavior: "instant", block: "center", inline: "nearest"});',
      selector,
    );
    logger.trace(`clickOnElement(${selector}): element scrolled into view`);

    await this.waitForCondition('element is visible', async () => await this.isVisible(selector));
    logger.trace(`clickOnElement(${selector}): element should be visible by now`);

    // Warning - this won't work if you use DOM property on element instead of the disabled attribute
    // This only waits until the element  does not have the disabled attribute set
    await this.waitForCondition('element is enabled', async () => await this.isEnabled(selector));
    logger.trace(`clickOnElement(${selector}): element should be enabled by now`);

    // we don't want to catch any error here, as `_clickOnElement` is executed inside an `attempt` call
    await this.clickOnWebdriverElement(element);

    logger.trace(`clickOnElement(${selector}): click command sent success`);
  }

  async webDriverElementIsVisible(element) {
    const fnName = 'webDriverElementIsVisible';
    logger.trace(`${fnName} start`);

    // since webdriver methods might throw
    // we execute them with retries
    return await execWithRetry(
      async () => {
        const isVisible = await element.isDisplayed();
        if (!isVisible) throw new Error('webdriver element is not visible');
        return isVisible;
      },
      { logger, fnName },
    );
  }

  async _isVisible(selector, attemptsLeft) {
    // alternate between the webdriver way of doing find and the
    // jquery approach since it seems that isDisplayed is affected by animations
    if (attemptsLeft % 2 === 0) {
      logger.info(`_isVisible: attempt to check visibility using webdriver on "${selector}"`);

      const element = await this.findElement(selector);
      const isVisible = await this.webDriverElementIsVisible(element);

      logger.info(`_isVisible: visibility of ${selector} is ${isVisible}`);
      return isVisible;
    }

    logger.info(`_isVisible: will try to use jQuery to check for visibility of "${selector}"`);

    const isVisible = await this.executeAsyncScript((theSelector, cb) => {
      cb($(theSelector).is(':visible')); // eslint-disable-line
    }, selector);

    logger.info(`_isVisible: visibility of ${selector} is ${isVisible}`);
    return isVisible;
  }

  async isVisible(selector, maxAttempts, throwErrorIfNotVisible = true) {
    const fnName = 'isVisible';
    logger.trace({ maxAttempts, throwErrorIfNotVisible }, `${fnName} start: "${selector}"`);

    return await execWithRetry(
      async attemptNumber => {
        const isVisible = await this._isVisible(selector, attemptNumber);
        if (!isVisible && throwErrorIfNotVisible) {
          throw new Error(`Element "${selector}" is not visible`);
        }
        return isVisible;
      },
      { logger, fnName, maxAttempts, onFail: () => logger.error(`${fnName} error: "${selector}"`) },
    );
  }

  async isNotVisible(selector) {
    const fnName = 'isNotVisible';
    logger.trace(`${fnName} start: ${selector}`);

    return await execWithRetry(
      async attemptNumber => {
        const isVisible = await this._isVisible(selector, attemptNumber);
        if (isVisible) {
          throw new Error(`Element "${selector}" is visible`);
        }
        return !isVisible;
      },
      { logger, fnName, onFail: () => logger.error(`${fnName} error: ${selector}`) },
    );
  }

  async _isEnabled(selector) {
    const element = await this.findElement(selector);
    return await element.isEnabled();
  }

  async isEnabled(selector) {
    const fnName = 'isEnabled';
    logger.trace(`${fnName} start: ${selector}`);

    return await execWithRetry(
      async () => {
        const isEnabled = await this._isEnabled(selector);
        if (!isEnabled) {
          throw new Error(`Element "${selector}" is not enabled`);
        }
        return isEnabled;
      },
      { logger, fnName, onFail: () => logger.trace(`${fnName} error: ${selector}`) },
    );
  }

  async _findElements(locator, ctx) {
    const theElements = await (ctx || this._driver).findElements(By.css(locator));
    return theElements;
  }

  async findElements(locator, ctx = null) {
    const fnName = 'isVisible';
    logger.trace(`${fnName} start using locator "${locator}"`);

    return await execWithRetry(async () => await this._findElements(locator, ctx), { logger, fnName });
  }

  open() {
    return this.visit(this.url || this.baseURL);
  }

  async _visit(url) {
    const { _driver } = this;
    await _driver.get(url);
    return await this.getCurrentUrl();
  }

  async visit(url) {
    const { _driver } = this;
    const fnName = 'visit';
    logger.trace(`${fnName} start`);

    return await execWithRetry(
      async () => {
        try {
          const currentURL = await this.getCurrentUrl();
          logger.trace(`visit: ${url} from "${currentURL}"`);
          const newURL = await this._visit(url);
          logger.trace(`visit: got newURL "${newURL}"`);
        } catch (error) {
          await rebuild();
          logger.error({ error, url }, `failure trying to visit a new URL "${url}"`);
          throw error;
        }
      },
      { logger, fnName, onFail: () => logger.trace(`${fnName} error. url: ${url}`) },
    );
  }

  navigateTo(url) {
    const theUrl = `${this.baseURL}${url}`;
    return this.visit(theUrl);
  }

  // locator could be a selenium locator (e.g. generated with byCSS) or a String
  // if it is a String, use byCSS to convert
  convertToByLocator(locator) {
    // "using" is a property of the By locators...
    return locator.using ? locator : By.css(locator);
  }

  // Waits for element specified by to become not visible
  waitForElementNotVisible(locator, waitTime = selenium.activeWaitTimeout) {
    logger.trace(`waiting for element not visible using locator ${locator}, timeout: ${waitTime}`);
    // first confirm that the element was found (if not, should throw an error)
    const el = this.waitForElement(locator, waitTime);
    logger.trace('Found el, now waiting for not visible', locator);

    // now wait for it to be hidden
    const ret = this._driver.wait(until.elementIsNotVisible(el), waitTime);
    if (!ret) {
      // I don't think this will ever get called, since Selenium should throw if it times out above
      // But I'd rather log here just in case...
      logger.warn('Element never became invisible!!');
    }
    expect(ret).not.to.be.null; // And then this will definitely throw otherwise.
    return ret;
  }

  async setFocus(selector) {
    // TODO: find why the focus from webdriver didn't work as expected
    return this._driver.executeAsyncScript((theSelector, theCallback) => {
      $(theSelector).focus(); // eslint-disable-line
      theCallback();
    }, selector);
  }

  async raiseBlur(selector) {
    // TODO: find why the blur from webdriver didn't work as expected
    return this._driver.executeAsyncScript((theSelector, theCallback) => {
      $(theSelector).blur(); // eslint-disable-line
      theCallback();
    }, selector);
  }

  executeAsyncScript(...args) {
    return this._driver.executeAsyncScript(...args);
  }

  async executeAsyncScriptWithRetries(script, { attempts = MAX_ATTEMPTS_PER_METHOD, attemptExecutionDelay, conditionCheck } = {}) {
    const fnName = 'executeAsyncScriptWithRetries';
    logger.trace(`${fnName} start`);

    return await execWithRetry(
      async () => {
        const result = await this._driver.executeAsyncScript(script);
        if (conditionCheck) {
          const checkResult = await conditionCheck(result);
          if (!checkResult) {
            throw new Error('Condition not met');
          }
        }
        return result;
      },
      { logger, fnName, maxAttempts: attempts, waitBetweenAttempts: attemptExecutionDelay },
    );
  }

  executeScript(...args) {
    return this._driver.executeScript(...args);
  }

  back() {
    return this._driver.navigate().back();
  }

  forward() {
    return this._driver.navigate().forward();
  }

  clickOnButtonId(buttonId) {
    return this.clickOnElement(`#${buttonId}`);
  }

  async clickOnWebdriverElement(element) {
    const fnName = 'clickOnWebdriverElement';
    logger.trace(`${fnName} start`);

    return await execWithRetry(async () => await element.click(), { logger, fnName, onFail: () => logger.error({ element }, `${fnName} error`) });
  }

  refresh() {
    return this._driver.navigate().refresh();
  }

  async openNewTab() {
    const initialTabNumber = (await this._driver.getAllWindowHandles()).length;

    const condFunc = async () => {
      logger.trace(`Number of open tabs is: ${initialTabNumber}. Try to open a new one.`);
      await this.executeAsyncScript(cb => {
        window.open();
        cb();
      });
      const TabNumber = (await this._driver.getAllWindowHandles()).length;
      return initialTabNumber === TabNumber - 1;
    };

    await this.waitForCondition('time to try to open new tab has expired', condFunc, selenium.setScriptTimeout);
    const handles = await this._driver.getAllWindowHandles();
    await this._driver.switchTo().window(handles[handles.length - 1]);
  }

  async _switchToTab(tabNo) {
    const body = await this.findElement('body');

    await body.sendKeys(Key.chord(Key.ALT, tabNo));

    // This seems to be doing the same as the above code block
    // which is actually working? why are both included?
    const handles = await this._driver.getAllWindowHandles();
    await this._driver.switchTo().window(handles[tabNo - 1]);
  }

  async switchToTab(tabNo) {
    let ret;
    try {
      ret = await this._switchToTab(tabNo);
    } catch (err) {
      logger.error({ err, tabNo }, 'switchToTab error');
    }
    return ret;
  }

  async closeCurrentTab() {
    logger.trace('closing current tab');
    const initialTabNumber = (await this._driver.getAllWindowHandles()).length;

    const condFunc = async () => {
      logger.trace(`Number of open tabs is: ${initialTabNumber}. Try to close the current one.`);
      await this.executeAsyncScript(cb => {
        window.close();
        cb();
      });
      const TabNumber = (await this._driver.getAllWindowHandles()).length;
      return initialTabNumber === TabNumber + 1;
    };

    await this.waitForCondition('time to close current tab has expired', condFunc, selenium.setScriptTimeout);
    const handles = await this._driver.getAllWindowHandles();
    await this._driver.switchTo().window(handles[handles.length - 1]);

    logger.trace('current tab closed');
  }

  async switchToFrame(frame) {
    await this._driver.switchTo().frame(frame);
  }

  async focusIframe(selector) {
    const iframe = await this.findElement(selector || '[data-component="dialog-body"] iframe');
    await this.switchToFrame(iframe);
  }

  async switchToDefault() {
    await this._driver.switchTo().defaultContent();
  }

  async getCurrentUrl() {
    return await getCurrentUrl();
  }

  async takeScreenshot(imgName) {
    logger.info(`taking screenshot ${imgName}`);
    try {
      const data = await this._driver.takeScreenshot();
      const base64Data = data.replace(/^data:image\/png;base64,/, '');

      const fname = path.join('./cucumber/output/screenshots', sanitize(`${imgName}.png`).replace(/ /g, '_'));
      await write(fname, base64Data, 'base64');
      logger.info(`wrote screenshot to ${fname}`);
    } catch (err) {
      logger.error({ err }, 'Unable to write screenshot!');
    }
  }

  async checkCurrentLocationIs(url) {
    const currentUrl = await this.getCurrentUrl();
    const expectedUrl = `${this.baseURL}/${url.replace(/^\//, '')}`;
    return expectedUrl === currentUrl;
  }
}
