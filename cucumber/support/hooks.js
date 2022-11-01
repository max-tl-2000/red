/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

require('../../common/catchUncaughtException');
import path from 'path';
import sanitize from 'sanitize-filename';
import crypto from 'crypto';

import logger from '../../common/helpers/logger';
import config from '../config';
import { getHookWrapper } from '../lib/hook-utils';
import { getScreenshot, closeDriver, maximize, getCurrentUrl, clearBrowserContext, getBrowserLogs } from '../lib/driver';
import { initDB, refreshTenantBetweenScenarios, tenant, teardownDB, initSocketConn, CUCUMBER_DEFAULT_TEST_ID } from './dbHelper';
import { deferred } from '../../common/helpers/deferred';
import { write } from '../../common/helpers/xfs';

const { cloudEnv, cucumber } = config;

const selenium = cucumber.selenium;

const hookWrapper = getHookWrapper(logger, selenium.defaultTimeout);

const myHooks = function myHooks() {
  let failedScenario = false;

  if (typeof this.setDefaultTimeout === 'function') {
    this.setDefaultTimeout(selenium.defaultTimeout);
  } else {
    this.setDefaultTimeout = selenium.defaultTimeout;
  }

  this.BeforeFeatures(
    hookWrapper('BeforeFeatures', async () => {
      const currentURL = await getCurrentUrl();
      logger.trace(`BeforeFeatures Hook. CurrentURL ${currentURL}`);

      await maximize();
      await initSocketConn();

      logger.trace('BeforeFeatures done!');
    }),
  );

  let firstTime = true;
  const beforeScenario = async (scenario, isDemoFlow) => {
    logger.info(`Before Scenario ${scenario.name} => cloudEnv: ${cloudEnv}`);

    const doNotRecreateDB = process.env.RESTORE_DB_FROM_BACKUP === 'true';

    const currentURL = await getCurrentUrl();
    this.testId = doNotRecreateDB ? CUCUMBER_DEFAULT_TEST_ID : crypto.randomBytes(5).toString('hex');

    logger.trace(`Before Scenario: ${scenario.getName()}. testId: ${this.testId}. currentURL: ${currentURL}.`);

    clearBrowserContext();

    const doNotRefresh = process.env.DO_NOT_REFRESH_TENANT === 'true';

    if (doNotRefresh) return;

    if (firstTime) {
      await initDB(this.testId);
      firstTime = false;
      // the first time the tenant is already refreshed. No need to do it again
      return;
    }

    await refreshTenantBetweenScenarios(
      isDemoFlow,
      scenario.getTags().map(tag => tag.getName()),
      this.testId,
    );
  };

  this.Before(
    { tags: ['@Demo'] },
    hookWrapper('Before', scenario => beforeScenario(scenario, true)),
  );
  this.Before(
    { tags: ['~@Demo'] },
    hookWrapper('Before', scenario => beforeScenario(scenario, false)),
  );

  this.After(
    hookWrapper('After', async scenario => {
      const isFailed = scenario.isFailed();
      let driverFailed = false;
      let browserLogsHadError = false;
      try {
        const currentURL = await getCurrentUrl();
        logger.trace(`After Hook. ${currentURL}. Scenario: ${scenario.getName()} ${isFailed}. testId ${this.testId}`);
        const logs = await getBrowserLogs();
        logs.length > 0 && logger.trace('Browser logs received');
        logs.forEach(log => {
          const {
            timestamp,
            message,
            level: { name: logLevelName },
          } = log;
          if (logLevelName === 'ERROR') {
            browserLogsHadError = true;
            logger.error({ timestamp, message }, 'Error from browser');
          } else if (logLevelName === 'WARNING') {
            logger.warn({ timestamp, message }, 'Warning from browser');
          } else {
            logger.trace({ timestamp, message }, `${logLevelName} from browser`);
          }
        });
        if (browserLogsHadError) logger.warn('Browser logs containerd error -- test will be failed!');
      } catch (err) {
        driverFailed = true;
        logger.warn({ err }, 'Error connecting to Selenium - this is probably due to 30s idle timeout');
      }
      if (isFailed || browserLogsHadError) {
        failedScenario = true;

        if (!driverFailed) {
          const { decodedImage, base64Data } = await getScreenshot();

          const imagePromise = deferred({ timeout: 2000, id: 'imageGenerationDeferred' });
          scenario.attach(decodedImage, 'image/png', err => (err ? imagePromise.reject(err) : imagePromise.resolve()));
          await imagePromise;

          await write(path.join('./cucumber/output/screenshots', sanitize(`${scenario.getName()}.png`).replace(/ /g, '_')), base64Data, 'base64');
        } else {
          logger.warn('Skipping screenshot save because Selenium session is no longer valid');
        }
      }
    }),
  );

  this.AfterFeatures(
    hookWrapper('AfterFeatures', async () => {
      const currentURL = await getCurrentUrl();
      logger.trace(`AfterFeatures Hook. CurrentURL ${currentURL}`);

      logger.trace('About to attempt to close Selenium');
      await closeDriver();

      if (process.env.KEEP_DB_AFTER_TESTS !== 'true') {
        await teardownDB();
      }

      logger.debug('About to attempt to delete cucumber tenant');

      if (failedScenario) {
        logger.fatal('>>> errors detected, exiting');
        // TODO: investigate while fail-fast not working here
        process.exit(1); // eslint-disable-line
      }
    }),
  );
};

myHooks.tenant = tenant;
// this is a normal export because this file is required by cucumber
module.exports = myHooks;
