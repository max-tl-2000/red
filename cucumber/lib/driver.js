/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import webDriver from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import path from 'path';
import config from '../config';
import clsc from '../../common/helpers/coalescy';
import { execWithRetry } from './exec-with-retry';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ type: '[DRIVER]' });

const selenium = config.cucumber.selenium;

const platform = selenium.platform;
const browser = selenium.browser;
const wd = `${selenium.protocol}${selenium.domain}:${selenium.port}/wd/hub`;

let capabilities;

// this is needed because SELENIUM expects SELENIUM_BROWSER env variable
// to be set to a browser name they understad and since we construct
// the driver manually and also use this variable below things
// are messed up
//
// Since at this point we already read the variable value
// it is safe to just unset it so with don't confuse SELENIUM
delete process.env.SELENIUM_BROWSER;

const getOptions = () => {
  let options;

  if (platform === 'ANDROID' && browser.name === 'CHROME') {
    options = {
      platformName: 'Android',
      platformVersion: '4.4',
      deviceName: 'Android Emulator',
      browserName: 'Chrome',
    };
  } else if (platform === 'WINDOWS' && browser.name === 'CHROME') {
    // other browser
    options = {
      browserName: 'chrome',
      path: browser.path,
      port: '4444',
    };
  } else if (platform === 'WINDOWS' && browser.name === 'FIREFOX') {
    // other browser
    options = {
      platformName: 'Windows',
      platformVersion: 'XX',
      browserName: 'Firefox',
    };
  } else if (platform === 'WINDOWS' && browser.name === 'PHANTOMJS') {
    // other browser
    options = {
      browserName: 'phantomjs',
    };
  } else if (platform === 'LINUX' && browser.name === 'PHANTOMJS') {
    // other browser
    options = {
      browserName: 'phantomjs',
    };
  } else if (platform === 'WINDOWS' && browser.name === 'IE') {
    // other browser
    options = {
      browserName: 'ie',
    };
  }
  return options;
};

const buildAndroidDriver = () => new webDriver.Builder().usingServer(wd).withCapabilities(getOptions()).build();

const buildChromeDriver = () => {
  capabilities = webDriver.Capabilities.chrome();
  const options = new chrome.Options().windowSize({ width: 1920, height: 1080 }).addArguments('--start-maximized');
  const cObj = capabilities.merge(options.toCapabilities());
  cObj.set('idleTimeout', 600);
  return new webDriver.Builder().usingServer(wd).withCapabilities(cObj).build();
};

// Selenium firefox
const buildFirefoxDriver = () => new webDriver.Builder().usingServer(wd).withCapabilities(webDriver.Capabilities.firefox()).build();

const buildLocalChromeDriver = () => {
  try {
    capabilities = webDriver.Capabilities.chrome();
    const options = new chrome.Options().windowSize({ width: 1920, height: 1080 }).addArguments('--start-maximized');
    const capabilitiesObj = capabilities.merge(options.toCapabilities());

    return new webDriver.Builder().forBrowser('chrome').withCapabilities(capabilitiesObj).build();
  } catch (err) {
    console.error(err.message);
    if (err.message.indexOf('could not be found') >= 0) {
      console.error('======================================================================\n');
      console.error('  CHROMEDRIVER BINARY IS NOT FOUND IN YOUR PATH.\n');
      console.error('  chromedriver is not longer installed as dev dependency');
      console.error('  to save time during yarn install.\n\n  Please install it manually executing:\n');
      console.error('    npm i chromedriver@2.40\n');
      console.error('======================================================================');
      process.exit(1); // eslint-disable-line
    }
    throw err;
  }
};

const buildLocalFirefoxDriver = () => {
  capabilities = webDriver.Capabilities.firefox();

  return new webDriver.Builder().forBrowser('firefox').withCapabilities(capabilities).build();
};

// PhantomJS
const buildPhantomJSDriver = () => {
  // the following is done using a require to avoid bundle the
  // phantomjs as a dependency as now we mostly use chrome to
  // execute the cucumber tests
  // since for client tests now we use jest we were able to remove a bunch of
  // karma related code
  const phantomjs = require('phantomjs-prebuilt'); // eslint-disable-line global-require

  const browserPath = clsc(browser.path, phantomjs.path);
  process.env.PATH += path.delimiter + path.dirname(browserPath);

  capabilities = webDriver.Capabilities.phantomjs();
  capabilities.set('phantomjs.binary.path', browserPath);
  capabilities.set('phantomjs.cli.args', [
    '--ignore-ssl-errors=true',
    '--ssl-protocol=any',
    '--web-security=false',
    '--proxy-type=none',
    '--disk-cache=true',
    '--webdriver-loglevel=DEBUG',
    '--webdriver-logfile=cucumber/output/phantomjs.log',
  ]);

  // Not sure if needed. with this enabled we can get
  // logs using driver.manager().logs().get('browser');
  // but that approach is collecting duplicated logs.
  //
  const pref = new webDriver.logging.Preferences();
  pref.setLevel('browser', webDriver.logging.Level.DEBUG);
  pref.setLevel('driver', webDriver.logging.Level.INFO);

  return new webDriver.Builder().withCapabilities(capabilities).setLoggingPrefs(pref).build();
};

const buildDriver = () => {
  let _driver;
  // Platform
  switch (browser.name) {
    case 'ANDROID':
      _driver = buildAndroidDriver();
      break;
    case 'CHROME':
      _driver = buildChromeDriver();
      break;
    case 'CHROME_LOCAL':
      _driver = buildLocalChromeDriver();
      break;
    case 'PHANTOMJS':
      _driver = buildPhantomJSDriver();
      break;
    case 'FIREFOX_LOCAL':
      _driver = buildLocalFirefoxDriver();
      break;
    default:
      // Firefox
      _driver = buildFirefoxDriver();
  }

  const manage = _driver.manage();
  const timeouts = manage.timeouts();

  // prevent google voice for stay logged in
  manage.deleteAllCookies();
  manage.window().maximize();

  // pageLoadTimeout
  timeouts.pageLoadTimeout(selenium.pageLoadTimeout);

  // setScriptTimeout
  timeouts.setScriptTimeout(selenium.setScriptTimeout);

  return _driver;
};

let driver = buildDriver();

// getDriver
export const getDriver = () => driver;

export const rebuild = () => {
  driver = buildDriver();
  return driver;
};

export const maximize = async () => {
  const win = getDriver().manage().window();
  await win.maximize();
};

const _getCurrentUrl = async () => {
  const fnName = '_getCurrentUrl';
  logger.trace(`${fnName} start`);

  return await execWithRetry(async () => await getDriver().getCurrentUrl(), { logger, fnName });
};

export const getCurrentUrl = async () => {
  const fnName = 'getCurrentUrl';
  logger.trace(`${fnName} start`);
  return await execWithRetry(
    async () => {
      try {
        return await _getCurrentUrl();
      } catch (err) {
        await rebuild();
        throw err;
      }
    },
    { logger, fnName },
  );
};

export const closeDriver = async () => {
  await getDriver().close();
  await getDriver().quit();
};

export const clearBrowserContext = async () => {
  const currentURL = await getCurrentUrl();

  if (currentURL.startsWith('http')) {
    logger.trace(`Clearing localStorage in BeforeScenario Hook. CurrentURL ${currentURL}`);
    await getDriver().manage().deleteAllCookies();
    await getDriver().executeScript('window.localStorage.clear();');
    await getDriver().executeScript('window.sessionStorage.clear();');
  } else {
    logger.trace('not clearing because we are not in an http url');
  }
};

export const getScreenshot = async () => {
  const data = await getDriver().takeScreenshot();
  const base64Data = data.replace(/^data:image\/png;base64,/, '');
  const decodedImage = Buffer.from(data, 'base64');

  return { decodedImage, base64Data };
};

export const getBrowserLogs = async () => await getDriver().manage().logs().get('browser');

export { webDriver };
