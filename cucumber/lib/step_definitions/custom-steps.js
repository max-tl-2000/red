/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * This file contains custom steps that can be used on other tests
 */
import { expect } from 'chai';
import BasePage from '../BasePage';
import sleep from '../../../common/helpers/sleep';
import { asyncIterate as iterate } from '../../../common/helpers/async-iterate';
import { deferred } from '../../../common/helpers/deferred';
import logger from '../../../common/helpers/logger';
import preprocessValue from '../utils/preprocess-value';

// needed because we do want to use findElement
// in a generic way from the base instance
/* eslint-disable red/no-find-element */
module.exports = function customSteps() {
  const base = new BasePage();

  const currentlyInDashboard = async () => {
    const url = await base.getCurrentUrl();
    return url === base.baseURL || url === `${base.baseURL}/`;
  };

  const isAppBarBackButtonPresent = async () => {
    const elements = await base.findElements('#navigateBack');
    return elements.length === 1;
  };

  const goBackUsingAppBarBackButton = async () => {
    await base.clickOnElement('#navigateBack');
  };

  const goBackUsingBrowserBack = async () => {
    // one attempt using the back button
    await base.back();

    const inDashboard = await currentlyInDashboard();

    if (!inDashboard) {
      // we don't do this directly because this one is costly
      // (it reloads the page instead of just navigate with html5 navigation)
      await base.navigateTo('/');
    }
  };

  const userIsLoggedIn = async () => {
    const currentUrl = await base.getCurrentUrl();
    const isInDataUrlPage = currentUrl.match(/data:/);

    if (isInDataUrlPage) return false;
    // eslint-disable-next-line
    const script = cb => {
      // eslint-disable-next-line
      var hasLocalStorageToken = function checkUrl() {
        const auth = window.lsGet('revatech-auth', {});
        return auth.loggedIn;
      };

      try {
        var isLoggedIn = hasLocalStorageToken(); // eslint-disable-line
        cb(!!isLoggedIn);
      } catch (err) {
        cb(err);
      }
    };

    const conditionCheck = result => {
      logger.info({ result }, 'userIsLoggedIn: checking condition');
      return typeof result === 'boolean';
    };

    const loggedIn = await base.executeAsyncScriptWithRetries(script, { conditionCheck });

    return loggedIn;
  };

  const doLogout = async () => {
    const inDashboard = await currentlyInDashboard();

    if (!inDashboard) {
      const backButtonPresent = await isAppBarBackButtonPresent();
      if (backButtonPresent) {
        await goBackUsingAppBarBackButton();
      } else {
        await goBackUsingBrowserBack();
      }
    }

    await base.clickOnElement('#side-nav');
    await base.clickOnElement('#logout');
    const signInTitle = await base.getText('#signInTitle');

    expect(signInTitle).to.equal('Sign in');
  };

  const performLogin = async (email, password) => {
    await sleep(1000);
    await base.setValue('#txtEmail', email);
    await sleep(1000);
    await base.setValue('#txtPassword', password);
    await sleep(1000);
    await base.clickOnElement('#btnLogin');
  };

  this.Given(/^User do login as "([^"]*)" and password "([^"]*)"$/, async (email, password) => {
    await performLogin(email, password);
  });

  this.Given(/^User logs in as "([^"]*)" with password "([^"]*)"$/, async (email, password) => {
    await base.navigateTo('/');
    await performLogin(email, password);
    await base.findElement('.dashboard-view');
  });

  this.Given(/^User logs out if needed$/, async () => {
    const loggedIn = await userIsLoggedIn();
    if (loggedIn) {
      await doLogout();
    }
  });

  this.Given(/^User logs out$/, async () => {
    await doLogout();
  });

  this.Then(/^The "([^"]*)" dialog should open$/, async arg1 => {
    await base.isVisible(`[id="${arg1}"]`).then(d => expect(d).to.equal(true));
  });

  // generic step to set values on any multiTextBox
  this.Then(/^User types on MultiTextBox "([^"]*)"$/, async (selector, table) => {
    // NOTE: this for now assumes there are not other values in the multiTextBox
    const rows = table.rows();
    const values = rows.reduce((seq, row) => {
      seq.push(row[0]); // values column
      return seq;
    }, []);

    const total = values.length;
    const theSelector = `#${selector} input[type="text"]`;
    await base.clickOnElement(theSelector);

    const dfd = deferred({ id: 'multiTextBoxSet' });
    iterate(values, {
      itemCb: async ({ item, index }, cb) => {
        const elements = await base.findElements(theSelector);
        const textBox = elements[elements.length - 1];

        await base.setFocus(`#${selector} :text:last`);

        const value = preprocessValue(item, this.testId);

        await sleep(1000); // Sadly needed to simulate a real user interaction

        await textBox.sendKeys(value);

        await sleep(1000); // Sadly needed to simulate a real user interaction

        await base.raiseBlur(`#${selector} :text:last`);

        if (index < total) {
          await sleep(500); // Sadly needed to simulate a real user interaction
          base.clickOnElement(`#${selector} [data-part="add-trigger"]`);
          await sleep(500); // Sadly needed to simulate a real user interaction
        }

        cb();
      },
      // resolve when done so the tests can continue
      done: dfd.resolve,
    });

    return dfd;
  });

  this.When(/^The user clicks 'Back' button in AppBar$/, async () => {
    const isBackButtonPresent = await isAppBarBackButtonPresent();
    if (isBackButtonPresent) await goBackUsingAppBarBackButton();
  });
};
