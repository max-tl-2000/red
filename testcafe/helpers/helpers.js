/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $, ClientFunction } from 'testcafe';
import config from '../../cucumber/config';
import { addAlias } from '../../cucumber/lib/utils/addAlias';
import { setQuery } from '../../client/helpers/url';
import { FIND_BLANK_SPACES } from '../../common/regex';
import { now } from '../../common/helpers/moment-utils';
import { RmsPricingEvents } from '../../common/enums/enums';
import { getPropertyByName, saveUnitsPricingByPropertyId, getProgramByName, updateFeePricingByPropertyId } from '../../cucumber/lib/utils/apiHelper';
import { tenant } from '../../cucumber/support/dbHelper';
import { parsePhone } from '../../common/helpers/phone/phone-helper';

import LoginPage from '../pages/loginPage';
import loggerInstance from '../../common/helpers/logger';

const { cucumber } = config;

const logger = loggerInstance.child({ subType: 'helpers' });

export const elementNotInPage = async (t, { selector }) => {
  const $ele = $(selector);
  return (await $ele.exists) === false;
};

const raiseClick = ClientFunction(selector => {
  const ele = document.querySelector(selector);
  if (ele) {
    ele.click(); // eslint-disable-line red/no-tc-click
  }
});

const scrollIntoView = ClientFunction(selector => {
  const ele = document.querySelector(selector);
  if (ele.scrollIntoViewIfNeeded) {
    ele.scrollIntoViewIfNeeded();
    return;
  }
  ele.scrollIntoView();
});

export const scrollElementIntoView = async (t, { selector }) => {
  if (typeof selector === 'string') {
    await scrollIntoView(selector);
    return;
  }

  const doScroll = ClientFunction(
    () => {
      const ele = selector();
      if (ele.scrollIntoViewIfNeeded) {
        ele.scrollIntoViewIfNeeded();
        return;
      }
      ele.scrollIntoView();
    },
    {
      dependencies: { selector },
    },
  );

  await doScroll();
};

/**
 * helper function to detect if user is logged in
 */
export const isUserLoggedIn = ClientFunction(
  () =>
    new Promise((resolve, reject) => {
      try {
        if (!window.lsGet) resolve(false);
        const authInfo = window.lsGet('revatech-auth', {});
        resolve(!!authInfo.loggedIn);
      } catch (err) {
        reject(err);
      }
    }),
);

/**
 * helper function to get the current pathName from the location
 */
export const getPathName = ClientFunction(() => window.location.pathname);

export const getLocation = ClientFunction(() => document.location.href);

const printSelector = selector => (typeof selector === 'string' ? selector : '[Selector FN]');

export const expectVisible = async (t, { selector, text, maxAttempts = 25, delayBetweenRetries = 500 }) => {
  logger.info(`>>> expectVisible: ${printSelector(selector)}. start ${maxAttempts} text ${text}`);
  let visible = false;
  let attemptsLeft = maxAttempts;
  let lastErr;
  if (!t) throw new Error('no t passed to expectVisible!');

  while (!visible && attemptsLeft > 0) {
    try {
      logger.info(`>>> expectVisible: ${attemptsLeft} out of ${maxAttempts}`);
      if (attemptsLeft !== maxAttempts) {
        // do not display on the first attempt
        logger.info(`>>> expectVisible waiting for ${delayBetweenRetries} before retrying`);
        await t.wait(delayBetweenRetries);
        logger.info('>>> expectVisible back from wait');
      }

      const resultNode = text ? await $(selector).withText(text).with({ boundTestRun: t }) : await $(selector).with({ boundTestRun: t });

      if (!(await resultNode.exists)) {
        logger.trace(`>>> expectVisible: ${printSelector(selector)} does not exist. Retries left ${attemptsLeft}`);
      } else {
        visible = await resultNode.visible;

        if (!visible) {
          logger.trace(`>>> expectVisible: ${printSelector(selector)} not visible. Retries left ${attemptsLeft}`);
        }
      }
    } catch (err) {
      logger.warn({ err }, '>>> expectVisible: caught error - saving in case this is the last retry');
      lastErr = err;
    }
    attemptsLeft--;
  }

  if (lastErr && attemptsLeft === 0) {
    logger.warn(`>>> expectVisible: not attempts left, retrhowing err ${lastErr}`);
    throw lastErr;
  }

  await t.expect(visible).ok(`${printSelector(selector)} not visible in expectVisible`);

  logger.info(`>>> expectVisible: ${printSelector(selector)} is visible. attempts left: ${attemptsLeft}`);
};

export const withRetries = async (t, fn, { fnName, delayBetweenRetries = 200, maxAttempts = 20 }) => {
  let lastErr;
  const attempts = maxAttempts;

  logger.info(`>>> withRetries ${fnName} start`);

  while (attempts > 0) {
    if (attempts !== maxAttempts) {
      logger.info(`>>> expectTextIsEqual waiting for ${delayBetweenRetries}`);
      await t.wait(delayBetweenRetries);
    }

    try {
      await fn();
      break;
    } catch (err) {
      logger.error({ err }, `>>> failed attempt to execute ${fnName}. Retries left ${attempts}`);
      lastErr = err;
    }
  }

  if (attempts === 0 && lastErr) {
    logger.error({ err: lastErr }, `>>> withRetries ${fnName} failed.`);
    throw lastErr;
  }

  logger.info(`>>> withRetries ${fnName} done`);
};

/**
 * helper function to get the text of a node
 */

export const getText = async (t, { selector } = {}) => {
  logger.info(`>>> getText: ${printSelector(selector)}`);
  const textContainingNode = $(selector);

  await t.expect(textContainingNode.visible).eql(true);
  const text = ((await textContainingNode.textContent) || '').trim();
  logger.info(`>>> getText: foundText... ${text}`);
  return text;
};

export const getPlaceholder = ClientFunction(selector => ((document.querySelector(selector) || {}).placeholder || '').trim());

export const getValue = ClientFunction(selector => ((document.querySelector(selector) || {}).value || '').trim());

export const getUserPassword = () => 'red&reva#';

export const getSuperAdminUserPassword = () => 'R#va@SFO&SJO&CLJ';

export const isDisabledOrLoading = async (t, { selector }) => {
  const state = () => $(selector);
  const snapshot = await state();
  const isLoading = await snapshot.hasAttribute('data-loading');
  const isDisabled = await snapshot.hasAttribute('disabled');

  const result = isLoading || isDisabled;
  if (result) {
    logger.trace(`>>> isDisabledOrLoading. "isLoading: ${isLoading}, isDisabled: ${isDisabled}"`);
  }
  return result;
};

export const clickOnElement = async (
  t,
  { selector, delay = 100, waitForLoadingState = 500, requireVisibility = true, maxAttempts = 25, ensureInView, useJSClick, ...restOptions } = {},
) => {
  logger.info(`>>> clickOnElement: ${printSelector(selector)} start ${delay} ${maxAttempts} ${requireVisibility}`);
  if (!selector) {
    throw new Error('clickOnElement called with no selector');
  }

  let attemptsLeft = maxAttempts;
  let lastError;

  const boundRaiseClick = raiseClick.with({ boundTestRun: t });
  selector = $(selector).with({ boundTestRun: t });

  while (attemptsLeft > 0) {
    try {
      attemptsLeft--;
      if (requireVisibility) {
        await expectVisible(t, { selector, maxAttempts: 5 });
      }

      if (ensureInView) {
        logger.trace(`>>> ensuring "${printSelector(selector)}" is in view `);
        await scrollElementIntoView(t, { selector });
      }

      await t.wait(delay);

      if (await isDisabledOrLoading(t, { selector })) {
        logger.trace(`>>> clickOnElement: waiting ${waitForLoadingState} for the button to exit the disable or loading state`);
        await t.wait(waitForLoadingState);
      } else {
        if (useJSClick) {
          if (typeof selector === 'string') {
            logger.trace('>>> using boundRaiseClik');
            await boundRaiseClick(selector);
          } else {
            logger.trace('>>> using client click');
            const doClick = ClientFunction(
              () => {
                const ele = selector();
                ele.click(); // eslint-disable-line red/no-tc-click
              },
              {
                dependencies: { selector },
              },
            );

            await doClick();
          }
        } else {
          logger.trace('>>> using t.click');
          await t.click(selector, restOptions); // eslint-disable-line red/no-tc-click
        }
        break;
      }
    } catch (err) {
      logger.warn({ err }, '*** error during click');
      logger.trace(`>>> clickOnElement: Cannot click on the provided ${printSelector(selector)}. Retries left ${attemptsLeft}`);
      lastError = err;
    }
  }

  if (lastError && attemptsLeft === 0) {
    logger.error({ err: lastError }, `>>> clickOnElement: Error clicking on element: ${printSelector(selector)} with delay: ${delay}`, lastError.message);
    throw lastError;
  }

  logger.info(`>>> clickOnElement: ${printSelector(selector)} done!`);
};

export const doLogoutIfNeeded = async t => {
  await t.switchToMainWindow();
  if (await isUserLoggedIn()) {
    if ((await getPathName()) !== '/' || !(await $('.dashboard-view').visible)) {
      await t.navigateTo('/');
    }

    await clickOnElement(t, { selector: '#side-nav' });
    await clickOnElement(t, { selector: '#logout' });
  }
};

export const loginAs = async (t, { user, password }) => {
  const loginPage = new LoginPage(t);
  await loginPage.writeEmail(user);
  await loginPage.writePassword(password);
  await clickOnElement(t, { selector: $(loginPage.selectors.loginBtn) });
};

export const sanitizedTextIsEqual = async (t, { selector, text, message }) => {
  const selectorText = await getText(t, { selector });
  const regExpression = /([\r\n]+|\n+|\r+|\s+)/gi;
  const cleanedText = await selectorText.replace(regExpression, '');
  await t.expect(cleanedText).eql(text.replace(regExpression, ''), message);
};

export const expectTextIsEqual = async (t, { selector, text, message, maxAttempts = 25 }) => {
  let equal = false;
  let attemptsLeft = maxAttempts;
  let textContent;

  logger.info('>>> expectTextIsEqual start');

  while (!equal && attemptsLeft > 0) {
    if (attemptsLeft !== maxAttempts) {
      logger.trace('>>> expectTextIsEqual waiting for 400');
      await t.wait(400);
    }
    textContent = await getText(t, { selector });

    attemptsLeft--;

    equal = textContent === text;

    if (!equal) {
      logger.trace(`>>> expectTextIsEqual: ${printSelector(selector)} text is not equal to text provided. Retries left ${attemptsLeft}`);
    }
  }

  if (!equal) {
    throw new Error(message || `textContent: ${textContent} is expected to be equal to ${text}`);
  }

  logger.info('>>> expectTextIsEqual done');
};

export const expectTextIsNotEqual = async (t, { selector, text, message, maxAttempts = 25 }) => {
  logger.info('>>> expectTextIsNotEqual start');
  const textContent = await getText(t, { selector });

  let different = false;
  let attemptsLeft = maxAttempts;

  while (!different && attemptsLeft > 0) {
    if (attemptsLeft !== maxAttempts) {
      logger.info('>>> expectTextIsNotEqual waiting for 400');
      await t.wait(400);
    }

    different = textContent !== text;
    attemptsLeft--;

    if (!different) {
      logger.trace(`>>> expectTextIsNotEqual: ${printSelector(selector)} text should not be equal to text provided. Retries left ${attemptsLeft}`);
    }
  }

  if (!different) {
    logger.error(`>>> expectTextIsNotEqual: ${printSelector(selector)}. textContent: "${textContent}" is not expected to be equal to "${text}"`);
    throw new Error(message || `textContent: ${textContent} is not expected to be equal to ${text}`);
  }
  logger.info(`>>> expectTextIsNotEqual: ${printSelector(selector)} done`);
};

export const expectTextContains = async (t, { selector, text, message }) => t.expect(await getText(t, { selector })).contains(text, message);

export const expectPlaceholderIsEqual = async (t, { selector, text, message }) => t.expect(getPlaceholder(selector)).eql(text, message);

export const expectInputIsEqual = async (t, { selector, text }) => t.expect(getValue(selector)).eql(text);

export const elementHasClass = async (selector, className) => await $(selector).hasClass(className);

export const expectBtnDisabled = async (t, { selector }) => t.expect(await elementHasClass(selector, 'disabled')).eql(true);

export const expectBtnEnabled = async (t, { selector }) => t.expect(await elementHasClass(selector, 'disabled')).eql(false);

export const expectCheckboxState = async (t, { selector, selected = true }) => {
  const checkboxIcon = selected ? 'checkbox-marked' : 'checkbox-blank-outline';
  await t.expect(await $(`${selector} #${checkboxIcon}`).exists).ok();
};

const formatURL = (pathname, url) => (process.env.MIN === 'false' ? setQuery(url, { min: false }) : url);

export const getTenantURL = (pathname = '') => formatURL(pathname, `https://${cucumber.tenantName}.${cucumber.domain}${pathname}`);

export const getWebsiteURL = pathname => formatURL(pathname, `https://${cucumber.websiteName}.${cucumber.domain}${pathname}`);

export const getSuperAdminURL = pathname => formatURL(pathname, `https://admin.${cucumber.domain}${pathname}`);

export const isElementVisible = async (t, { selector }) => {
  if (!(await $(selector).exists)) return false;
  return await $(selector).visible;
};

export const expectNotVisible = async (t, { selector, text }) => {
  const resultNode = text ? await $(selector).withText(text) : await $(selector);
  return (await resultNode.exists) && (await t.expect(resultNode.visible).notOk());
};

export const elementNotExist = async (t, { selector }) => await t.expect($(selector).exists).eql(false);

export const elementExists = async (t, { selector }) => await t.expect($(selector).exists).eql(true);

export const reloadURL = ClientFunction(() => window.location.reload());

export const expectDashboardLaneContains = async (t, { lane, cardText }) => {
  const dom = await $(`${lane} [data-id="card"]`).withText(cardText);
  await t.expect(dom.visible).eql(true);
};

const expectDashboardLaneContainsPartyWithType = async (t, { lane, cardText, partyType }) => {
  await expectDashboardLaneContains(t, { lane, cardText });

  const dom = await $(`${lane} .${partyType}`);
  await t.expect(dom.visible).eql(true);
};

export const expectDashboardLaneContainsCorporateParty = async (t, { lane, cardText }) => {
  await expectDashboardLaneContainsPartyWithType(t, { lane, cardText, partyType: 'corporatePartyType' });
};

export const clickOnCard = async (t, { lane, cardText }) => {
  logger.info({ lane, cardText }, '>>> clickOnCard start');
  await withRetries(
    t,
    async () => {
      const selector = $(`${lane} [data-id="card"]`).withText(cardText);
      await clickOnElement(t, { selector });
    },
    { fnName: 'clickOnCard' },
  );

  logger.info({ lane, cardText }, '>>> clickOnCard done');
};

export const addUniqueIdToEmail = (t, email) => {
  const { testcafeFixtureId } = t.fixtureCtx;

  return addAlias(email, testcafeFixtureId);
};

export const setButtonBarValues = async (t, { selector, values = [] } = {}) => {
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const dom = `${selector} #${value}`;

    await clickOnElement(t, { selector: dom });
  }
};

export const setRadioGroupValues = async (t, { selector, value } = {}) => {
  const dom = $(`${selector} button`).withText(value);
  await clickOnElement(t, { selector: dom });
};

export const setDropdownValues = async (t, { id, values = [] } = {}) => {
  await clickOnElement(t, { selector: `#${id}` });

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    await clickOnElement(t, { selector: $(`[data-id="overlay-${id}"] [data-component="list-item"]`).withText(value) });
  }
};

export const replaceBlankSpaceWithCharacter = (selectorName, character) => selectorName.replace(FIND_BLANK_SPACES, character);

export const clearTextElement = async (t, { selector }) => {
  await t.selectText(selector).pressKey('delete');
};

export const expectNotPresent = async (t, { selector, text }) => {
  if (text) {
    await t.expect(await $(selector).withText(text).exists).notOk();
    return;
  }

  await t.expect(await $(selector).exists).notOk();
};

export const switchAvailability = async t => {
  await clickOnElement(t, { selector: '#side-nav' });
  await clickOnElement(t, { selector: '#availability-switch' });
  await t.pressKey('esc');
};

export const clearLocalStorage = async t => await t.eval(() => localStorage.clear());

export const verifyEmptyCheckbox = async (t, { selector, checkboxName }) => {
  await t.expect($(selector).getAttribute('name')).eql(checkboxName);
};

export const createTwoWeekRentMatrix = () => {
  const oneWeekFromNowMoment = now({ timezone: 'America/Los_Angeles' }).add(7, 'days');

  const oneWeekFromNow = oneWeekFromNowMoment.format('YYYY-MM-DD');
  const twoWeeksFromNow = now({ timezone: 'America/Los_Angeles' }).add(14, 'days').format('YYYY-MM-DD');
  const twoWeeksFromNowPlus1Day = now({ timezone: 'America/Los_Angeles' }).add(15, 'days').format('YYYY-MM-DD');
  const threeWeeksFromNow = now({ timezone: 'America/Los_Angeles' }).add(21, 'days').format('YYYY-MM-DD');

  const rentMatrix = {
    6: {
      [`${oneWeekFromNow}`]: { rent: '1665.00', endDate: twoWeeksFromNow },
      [`${twoWeeksFromNowPlus1Day}`]: { rent: '1777.00', endDate: threeWeeksFromNow },
    },
    12: {
      [`${oneWeekFromNow}`]: { rent: '1565.00', endDate: twoWeeksFromNow },
      [`${twoWeeksFromNowPlus1Day}`]: { rent: '1677.00', endDate: threeWeeksFromNow },
    },
  };

  return {
    startDate: oneWeekFromNowMoment,
    rentMatrix,
  };
};

export const updateInventoryPricing = async (propertyName, unit, rentMatrix) => {
  const property = await getPropertyByName(tenant, propertyName);
  const unitPriceToUpdate = {
    externalId: unit.externalId,
    availDate: now({ timezone: 'America/Los_Angeles' }).startOf('day').toISOString(),
    status: unit.state || '',
    amenityValue: 0,
    rmsProvider: 'LRO',
    fileName: 'LRO.xml',
    rentMatrix,
    standardLeaseLength: 12,
    standardRent: 1200,
    minRentLeaseLength: 12,
    minRentStartDate: now(),
    minRentEndDate: now(),
    minRent: 1200,
    type: unit.type,
  };
  await saveUnitsPricingByPropertyId(tenant, property.id, {
    unitsPricing: [unitPriceToUpdate],
    rmsPricingEvent: RmsPricingEvents.INVENTORY_STATE_CHANGE,
  });
};

export const updatingFeePrice = async (propertyObject, inventoryFeeNameToUpdatePrice, feePricing) => {
  const property = await getPropertyByName(tenant, propertyObject.name);
  await updateFeePricingByPropertyId(tenant, property.id, inventoryFeeNameToUpdatePrice, feePricing);
};

export const getSelectorWithIndex = (selector, index) => selector.replace('Index', index);

export const getLowestLeaseTermAmount = leaseTerms =>
  leaseTerms.reduce((acc, { term, rentAmount }) => {
    if (!acc.rentAmount) return { term, rentAmount };
    if (rentAmount < acc.rentAmount) {
      return { term, rentAmount };
    }

    return acc;
  }, {});

export const expectElementHasAttribute = async (t, { selector, attribute, attributeValue, message }) =>
  await t.expect($(selector).withAttribute(attribute, attributeValue).exists).ok(message);

export const expectElementDoesNotHaveAttribute = async (t, { selector, attribute, attributeValue, message }) =>
  await t.expect($(selector).withAttribute(attribute, attributeValue).exists).notOk(message);

export const doesElementExists = async selector => await $(selector).exists;

export const executeSequentially = async (list, handler) => {
  const results = [];
  for (let i = 0; i < list.length; i++) {
    results.push(await handler(list[i], i));
  }
  return results;
};

export const doElementsExist = async selectors => {
  const elementsExist = await executeSequentially(selectors, doesElementExists);

  return elementsExist.every(e => !!e);
};

export const getPartyIdFromUrl = async () => {
  const partyLocation = await getPathName();

  const [, partyId] = partyLocation.split('party/');
  return partyId;
};

export const phoneNumberFormat = /^.(\d{3})(\d{3})(\d{4})$/;

export const formatPhoneNumber = phoneNumber => ({
  propertyPageFormat: phoneNumber.replace(phoneNumberFormat, '$1-$2-$3'),
  internationalFormat: (parsePhone(phoneNumber) || {}).international,
});

export const getPhoneNumberByProgramName = async programName => {
  const programInfo = await getProgramByName(tenant, programName);
  return programInfo.displayPhoneNumber || programInfo.directPhoneIdentifier;
};

export const getAuthInfo = ClientFunction(
  () =>
    new Promise((resolve, reject) => {
      try {
        const authInfo = window.lsGet('revatech-auth', {});
        resolve(authInfo);
      } catch (err) {
        reject(err);
      }
    }),
);
