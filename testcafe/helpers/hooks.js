/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { mkdirp } from 'mkdirp';
import i18next from 'i18next';
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { RequestLogger, Selector } from 'testcafe';
import sanitize from 'sanitize-filename';
import { restoreFromBackup } from '../../cucumber/support/dbHelper';
import genShortId from '../../cucumber/lib/utils/gen-short-id';
import { initI18N } from '../../common/server/i18n';
import envVal from '../../common/helpers/env-val';
import { withCachedPromise } from '../../common/helpers/with-cached-promise';
import loggerInstance from '../../common/helpers/logger';
import sleep from '../../common/helpers/sleep';

const logger = loggerInstance.child({ subType: 'hooks' });
const requestLogger = RequestLogger({ options: { logRequestHeaders: true, logResponseHeaders: true } }); // eslint-disable-line new-cap

export const initLanguages = withCachedPromise(async () => {
  await initI18N({
    namespaceDir: path.resolve(__dirname, '../../trans/en/'),
    loadPath: path.resolve(__dirname, '../../trans/{{lng}}/{{ns}}.yml'),
  });
  const consumerTrans = yaml.load(await readFileSync(path.resolve(__dirname, '../../consumer/trans/en/trans.yml')), { encoding: 'utf-8' });
  const { trans } = i18next.store.data.en;
  i18next.store.data.en.trans = { ...consumerTrans, ...trans };
});

// TODO: given that the db BNR task leaves the triggers in a disabled state, and
// tests are expected to have them on, we should check that they are enabled
// before trying to run a test.
let skipDBRestoreOnFirstExecution = envVal('SKIP_DB_RESTORE_ON_FIRST_EXEC', true);

const restoreDB = async () => {
  let lastErr;
  const maxAttempts = 10;
  let attempts = maxAttempts;
  const delayBetweenRetries = 500;

  logger.info('>>> restoreDB start');

  while (attempts > 0) {
    if (attempts !== maxAttempts) {
      await sleep(delayBetweenRetries);
    }
    attempts--;

    try {
      await restoreFromBackup(['./bks/commonbk.sql', './bks/e2e-tenant.sql']);
      break;
    } catch (err) {
      logger.error({ err }, `>>> failed to restore the db. Retries left ${attempts}`);
      lastErr = err;
    }
  }

  if (lastErr && attempts === 0) {
    logger.error({ err: lastErr }, '>>> restoreDB failed.');
    throw lastErr;
  }

  logger.info('>>> restoreDB done');
};

const dumpBrowserLogs = async t => {
  logger.info('Dumping browser logs');
  if (!t) {
    logger.warn('Could not dump browser logs - no t reference');
    return;
  }
  const msgs = await t.getBrowserConsoleMessages();
  Object.keys(msgs).forEach(level => {
    const msgsForLevel = msgs[level];
    msgsForLevel.forEach(msg => logger.info(`${level}: ${msg}`));
  });
};

const dumpRequests = async t => {
  if (!t) {
    logger.warn('Could not dump requests - no t reference');
    return;
  }
  const testName = t?.testRun?.test?.name || 'UNKNOWN TEST';
  const fixtureName = t?.testRun?.test?.fixture?.name || 'UNKNOWN FIXTURE';
  const requestsFilename = 'logs/testcafe-requests.json';
  writeFileSync(
    requestsFilename,
    JSON.stringify(
      requestLogger.requests.map(r => ({ ...r, testName, fixtureName })),
      null,
      2,
    ),
    {
      encoding: 'utf8',
      flag: 'a+', // append to file
      mode: 0o666,
    },
  );
};

const getTimeZone = async t =>
  await t.eval(() => {
    const offset = new Date().getTimezoneOffset();
    const o = Math.abs(offset);
    return `${(offset < 0 ? '+' : '-') + `00${Math.floor(o / 60)}`.slice(-2)}:${`00${o % 60}`.slice(-2)}`;
  });

const bodySelector = Selector('body').addCustomDOMProperties({
  innerHTML: el => el.innerHTML,
}); // eslint-disable-line new-cap

const dumpBodyIfErrors = async t => {
  const { errs: testErrs } = t.testRun || {};
  if (testErrs) {
    const testName = t?.testRun?.test?.name;
    const fixtureName = t?.testRun?.test?.fixture?.name;
    const currentUrl = await t?.testRun?.getCurrentUrl();
    logger.info({ testName, fixtureName, testErrs, currentUrl }, 'dumping body because errors were present');
    const dumpDir = 'logs/htmlErrors/';
    await mkdirp(dumpDir);
    const dumpFileName = sanitize(`${fixtureName}_${testName}_failure.html`);
    const dumpFilePath = `${dumpDir}${dumpFileName}`;

    logger.error({ testErrs, fixtureName, testName, dumpFilePath }, '*** dumping body');
    const body = await bodySelector.innerHTML;
    writeFileSync(dumpFilePath, body);
  }
};

/**
 * add the beforeEach hook to restore the database to a known state
 * @param {Fixture} fx the fixture instance
 * @param {object} options
 *   - skipDatabaseRestore: set as true to skip over the data reload before the fixture is run
 */
export const setHooks = (fx, options = { skipDatabaseRestore: false, fixtureName: '' }) => {
  fx.requestHooks(requestLogger);
  fx.beforeEach(async t => {
    t.fixtureCtx.testcafeFixtureId = genShortId();
    logger.trace('*** beforeEach for fixture', options.fixtureName, ' skipDatabaseRestore is ', options.skipDatabaseRestore);
    logger.info(`*** test ${t.testRun.test.name} start`);
    const browserTimezone = await getTimeZone(t);
    logger.trace(`*** browser timezone is ${browserTimezone}`);

    await initLanguages();
    if (!options.skipDatabaseRestore) {
      if (skipDBRestoreOnFirstExecution) {
        skipDBRestoreOnFirstExecution = false;
        logger.trace('>>> skipping restore on the first execution');
      } else {
        await restoreDB();
        logger.trace('>>> db restore done for', options.fixtureName);
        logger.trace('>>> db restore done');
      }
    } else {
      logger.trace('>>> skipped db restore for', options.fixtureName);
      logger.trace('>>> skipped db restore');
    }

    // this label will be used by the timeEnd
    logger.time(`*** test ${t?.testRun?.test?.name} end`);

    if (options.beforeEach) {
      await options.beforeEach(t);
    }
  });

  fx.afterEach(async t => {
    try {
      if (!t) {
        logger.warn('*** afterEach for fixture', options.fixtureName, ' found no test reference!');
      }
      const testName = t?.testRun?.test?.name || 'UNKNOWN TEST NAME';
      const fixtureName = t?.testRun?.test?.fixture?.name || 'UNKNOWN FIXTURE NAME';

      const sanitizedFixtureName = sanitize(fixtureName);
      const sanitizedTestName = sanitize(testName);
      const screenshotFileName = `${sanitizedFixtureName}/${sanitizedTestName}.png`;
      logger.trace('*** afterEach for fixture', options.fixtureName);

      // always take screenshot after a test so we know state
      await t?.takeScreenshot(screenshotFileName);

      if (options.afterEach) {
        logger.trace('*** calling fixture-specific afterEach for fixture', options.fixtureName);
        await options.afterEach(t);
      }

      if (t) {
        await dumpRequests(t);
        await dumpBodyIfErrors(t);
        await dumpBrowserLogs(t);
      } else {
        logger.warn('unable to dump browser info because there is no test reference');
      }

      logger.timeEnd(`*** test ${t?.testRun?.test?.name} end`);
    } catch (err) {
      logger.error({ err }, `*** afterEach threw error for fixture ${options.fixtureName} - will rethrow`);
      throw err;
    }
  });

  return fx;
};
