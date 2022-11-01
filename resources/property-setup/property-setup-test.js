/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import fs from 'fs';
import path from 'path';
import minimist from 'minimist';
import { mapSeries } from 'bluebird';
import { error, success, log } from 'clix-logger/logger';
import eventTypes from '../../common/enums/eventTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import { request } from '../../common/helpers/httpUtils';
import { deferred } from '../../common/helpers/deferred';
import { connect as connectSocketClient, disconnect as disconnectSocketClient, subscribe as subscribeSocketClient } from '../../common/helpers/socketClient';
import envVal from '../../common/helpers/env-val';
import { deleteFile, exists, mkdirp, tryReadJSON } from '../../common/helpers/xfs';
import { toMoment } from '../../common/helpers/moment-utils';
import {
  getSheetNameFromPath,
  downloadPropertySetupSheets,
  importTestPropertySetupSheets,
  getDownloadedSheetPaths,
  ERROR_EXIT_CODE,
  SUCCESS_EXIT_CODE,
  DOWNLOADS_DIR,
  DOWNLOADED_GDRIVE_FILES_FILE_PATH,
} from './helpers/property-setup-sheet-tests';

const { JobStatus, Jobs } = DALTypes;

const DEFAULT_TESTING_ENVS = ['dev', 'staging', 'staging-blue', 'staging-green'];
const IMPORT_TIMEOUT = envVal('IMPORT_TIMEOUT', 1200000); // 20 mins
const CLEAR_TENANT_SCHEMA_TIMEOUT = envVal('CLEAR_TENANT_SCHEMA_TIMEOUT', 180000); // 3 min
const DEFAULT_TEST_TENANT = 'sheet-testing';
const REPORT_FILE_PATH = `${DOWNLOADS_DIR}/property-setup-test-results.txt`;
const ImportStatus = {
  FAILED: 'failed',
  SUCCESS: 'success',
  SKIPPED: 'skipped',
};
const NO_AUTH_HEADERS = {};
const getSocketServerUrl = env => `wss://ws.${env}.env.reva.tech`;
const getEnvTestingTenantBaseUrl = (env, testTenant = DEFAULT_TEST_TENANT) => `https://${testTenant}.${env}.env.reva.tech`;
const isDataFileImportJob = jobName => jobName === Jobs.ImportDataFiles;
const isImportDone = ({ name, status }) => isDataFileImportJob(name) && [JobStatus.FAILED, JobStatus.PROCESSED].includes(status);
const isTestSuccessful = status => [ImportStatus.SUCCESS, ImportStatus.SKIPPED].includes(status);
const getExitCode = allImportResults =>
  allImportResults.reduce((a, b) => a.concat(b), []).some(({ status }) => (!isTestSuccessful(status) ? ERROR_EXIT_CODE : SUCCESS_EXIT_CODE));

const getRequestOpts = (method, headers, options = {}) => {
  const { filePath, data = {} } = options;
  const { bodyData = {}, formData = [] } = data;

  return {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    timeout: 40000,
    data: bodyData,
    fields: formData,
    filePath,
  };
};

const getAuthHeader = token => ({ Authorization: `Bearer ${token}` });

const login = async (env, testTenant) => {
  log('Login into', env, 'test tenant', testTenant);
  const loginUrl = `${getEnvTestingTenantBaseUrl(env, testTenant)}/api/login`;

  const reqData = {
    bodyData: {
      email: 'admin',
      password: envVal('TEST_TENANT_PASSWORD'),
    },
  };

  return await request(loginUrl, getRequestOpts('post', NO_AUTH_HEADERS, { data: reqData }));
};

const clearTenantSchema = async (env, { testTenant, tenantId }, token) => {
  log('Clearing', env, 'tenant schema');
  const clearTenantSchemaUrl = `${getEnvTestingTenantBaseUrl(env, testTenant)}/api/tenants/${tenantId}/clearTenantSchema`;

  return await request(clearTenantSchemaUrl, getRequestOpts('post', getAuthHeader(token)));
};

const getTenantMigrateDataJob = async (env, testTenant, token, jobId) => {
  log('Get', env, 'tenant migrate data job', jobId);
  const getTenantMigrateDataJobUrl = `${getEnvTestingTenantBaseUrl(env, testTenant)}/api/jobs/${jobId}`;

  return await request(getTenantMigrateDataJobUrl, getRequestOpts('get', getAuthHeader(token)));
};

const importSheet = async (env, testTenant, token, sheetPath) => {
  log('Importing sheet', getSheetNameFromPath(sheetPath), 'into', env);
  const seedDataUrl = `${getEnvTestingTenantBaseUrl(env, testTenant)}/api/seedData`;
  const formData = { formData: [{ name: 'files', value: sheetPath, isFile: true }] };

  return await request(seedDataUrl, getRequestOpts('post', getAuthHeader(token), { data: formData }));
};

const getImportJobFromNotifyData = data => ({
  id: data?.id || data,
  ...((data?.id && data) || {}),
});

const importPropertySetupSheet = async (env, testTenant, token, sheetPath) => {
  let jobId;

  try {
    await connectSocketClient(testTenant, getSocketServerUrl(env), token);

    await importSheet(env, testTenant, token, sheetPath);

    const notificationPromise = deferred({ timeout: IMPORT_TIMEOUT, id: 'importPropertySetup' });
    subscribeSocketClient(eventTypes.JOB_UPDATED, async data => {
      try {
        let importJob = getImportJobFromNotifyData(data);

        if (isImportDone(importJob)) {
          notificationPromise.resolve(importJob.id);
          return;
        }

        // fallback to querying import job
        if (!importJob.status) {
          importJob = await getTenantMigrateDataJob(env, testTenant, token, importJob.id);

          if (isImportDone(importJob)) {
            notificationPromise.resolve(importJob.id);
            return;
          }
        }

        isDataFileImportJob(importJob) && log(importJob.name, importJob.id, 'job has not finished');
      } catch (listenerError) {
        notificationPromise.reject(listenerError);
      }
    });

    const sheetName = getSheetNameFromPath(sheetPath);
    log('Waiting up to', IMPORT_TIMEOUT / 1000, 'seconds to import', sheetName, 'into', env);
    jobId = await notificationPromise;
    log('Import job', jobId, 'finished importing sheet', sheetName, 'in', env);
  } catch (err) {
    throw err;
  } finally {
    await disconnectSocketClient();
  }

  return await getTenantMigrateDataJob(env, testTenant, token, jobId);
};

/* Note: when there are no errors loading a sheet the first element in the errors array is being set to null */
const getImportResult = (errors = []) => (!errors.length || errors[0] === null ? ImportStatus.SUCCESS : ImportStatus.FAILED);

const logToReportFile = async line =>
  new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(REPORT_FILE_PATH, { flags: 'a' });
    writeStream
      .once('open', () => {
        writeStream.write(`${line}\n`);
        writeStream.end();
      })
      .on('close', () => {
        resolve(line);
      })
      .on('error', err => {
        reject(err);
      });
  });

const logResults = async (importResults, includeErrors = false) => {
  if (!includeErrors) log('Summary of import results:\n');
  await mapSeries(importResults, envImportResult =>
    mapSeries(envImportResult, async ({ env, sheetPath, status, errors }) => {
      const sheetName = getSheetNameFromPath(sheetPath);
      const logger = isTestSuccessful(status) ? success : error;
      if (includeErrors) {
        logger(env, sheetName, errors[0] !== null ? errors : []);
        return;
      }
      logger(env, sheetName, status);
      await logToReportFile(`${env} - ${sheetName} - ${status}`);
    }),
  );
};

const logImportResults = async importResults => {
  const includeErrors = true;
  await logResults(importResults, includeErrors);
  await logResults(importResults);
};

const initTenant = async (env, tenant, token) => {
  const { testTenant } = tenant;
  try {
    await connectSocketClient(testTenant, getSocketServerUrl(env), token);
    await clearTenantSchema(env, tenant, token);

    const notificationPromise = deferred({ timeout: CLEAR_TENANT_SCHEMA_TIMEOUT, id: 'clearTenantSchema' });
    subscribeSocketClient(eventTypes.CLEAR_TENANT_SCHEMA_DONE, async data => {
      if (data.successfully) {
        notificationPromise.resolve();
        return;
      }

      notificationPromise.reject();
    });

    log('Waiting up to', CLEAR_TENANT_SCHEMA_TIMEOUT / 1000, 'seconds to clear the tenant schema in', env);
    await notificationPromise;
    log('Clearing tenant schema finished in', env);
  } catch (err) {
    throw err;
  } finally {
    await disconnectSocketClient();
  }
};

const getDownloadedSheetModifiedTime = async fileId => {
  if (!fileId) return fileId;
  const downloadedFiles = await tryReadJSON(DOWNLOADED_GDRIVE_FILES_FILE_PATH, {});
  const downloadedSheet = downloadedFiles?.files?.filter(file => file.fileId === fileId);
  return get(downloadedSheet, '[0].modifiedTime');
};

const shouldRunTest = async (fileId, { lastTestTime, force, lastTestResult }) => {
  const runTest = true;
  if (!lastTestTime && !force) return runTest;

  if (force) {
    log('Forcing test on', fileId);
    return runTest;
  }

  const lastSheetTestTime = toMoment(lastTestTime);

  const modifiedTime = await getDownloadedSheetModifiedTime(fileId);
  if (!modifiedTime) return runTest;

  const lastSheetModificationTime = toMoment(modifiedTime);

  log('Sheet', fileId, 'last modification was', lastSheetModificationTime.toJSON(), 'and last test was carried out on', lastSheetTestTime.toJSON());

  const wasSheetModifiedSinceLastTest = lastSheetModificationTime.isAfter(lastSheetTestTime);
  wasSheetModifiedSinceLastTest && log('Sheet', fileId, 'was modified since last test run!');

  let shouldRunSheetTest = wasSheetModifiedSinceLastTest;
  if (!wasSheetModifiedSinceLastTest && lastTestResult) {
    shouldRunSheetTest = lastTestResult.toLowerCase() !== ImportStatus.SUCCESS;
    shouldRunSheetTest && log('Sheet', fileId, 'did not change since last test, but running the test anyways since the last test result was', lastTestResult);
  }

  return shouldRunSheetTest;
};

const processPropertySetupSheet = async (env, testTenant, { fileId, filePath: sheetPath }, options = {}) => {
  let status = ImportStatus.FAILED;
  let errors = [];

  if (!(await shouldRunTest(fileId, options))) {
    log('Skipping property sheet test', sheetPath);
    return {
      env,
      sheetPath,
      status: ImportStatus.SKIPPED,
      errors: [],
    };
  }

  try {
    let loginData = await login(env, testTenant);
    let { token } = loginData;
    const { tenantId } = loginData.user;

    await initTenant(env, { testTenant, tenantId }, token);

    loginData = await login(env, testTenant);
    token = loginData.token;

    const importResult = await importPropertySetupSheet(env, testTenant, token, sheetPath);

    if (options.downloadResults) {
      const { resultUrl } = importResult?.metadata;
      const [sheetName] = path.basename(sheetPath).split('.');
      const resultFilePath = `${DOWNLOADS_DIR}/${sheetName}-result.xlsx`;
      log('Downloading import result file to', resultFilePath);
      await request(resultUrl, getRequestOpts('get', NO_AUTH_HEADERS, { filePath: resultFilePath }));
    }

    errors = get(importResult, 'steps.ImportInventory.errors', []);
    status = getImportResult(errors);
  } catch (importError) {
    errors.push(importError);
  }

  return {
    env,
    sheetPath,
    status,
    errors,
  };
};

const validate = () => {
  if (!envVal('TEST_TENANT_PASSWORD')) throw Error('TEST_TENANT_PASSWORD environment variable not set!');
};

const argValToArray = (arg = '') => arg.split(',');

const getArgs = args => {
  const { envs, fileIds, testTenant, lastTestTime, lastTestResult, force, downloadResults } = minimist(args.slice(2));

  return {
    envs: envs ? argValToArray(envs) : DEFAULT_TESTING_ENVS,
    fileIds: fileIds ? argValToArray(fileIds) : importTestPropertySetupSheets.map(({ id }) => id),
    testTenant: testTenant || DEFAULT_TEST_TENANT,
    lastTestTime,
    lastTestResult,
    force,
    downloadResults,
  };
};

const init = async args => {
  validate();
  await mkdirp(DOWNLOADS_DIR);
  (await exists(REPORT_FILE_PATH)) && (await deleteFile(REPORT_FILE_PATH));
  return getArgs(args);
};

/*
  Usage: ./bnr property-setup-test
  Options:
    --fileIds=<sheetId1,sheetId2,...>  set specific property sheets to test
                                       defaults to: Property Setup.xlsx, Maximus Staging, CUSTOMEROLD-SAL Staging, CUSTOMEROLD Staging
    --envs=<local,dev,staging,...>     set specific environments to test the sheet import
                                       defaults to: dev, staging, staging-green, staging-blue
    --testTenant=<mytenant>            override default test tenant 'sheet-testing'
    --lastTestTime=<1547753308>        set to unix epoch time of last test run
    --lastTestResult=<SUCCESS,FAILURE> set to determine if sheet should be tested, requires --lastTestTime to be set to take effect
    --force                            set to force the test even if property sheet did not change since last test run
    --downloadResults                  download the import result files
*/
const main = async args => {
  const { envs, fileIds, testTenant, lastTestTime, lastTestResult, force, downloadResults } = await init(args);
  log('Testing environments', envs, 'in tenant', testTenant, 'with sheets', fileIds);

  await downloadPropertySetupSheets(fileIds);
  const sheetPaths = await getDownloadedSheetPaths();

  const allImportResults = await mapSeries(
    envs,
    async env =>
      await mapSeries(
        sheetPaths,
        async sheetPath => await processPropertySetupSheet(env, testTenant, sheetPath, { lastTestTime, lastTestResult, force, downloadResults }),
      ),
  );

  await logImportResults(allImportResults);

  return getExitCode(allImportResults);
};

main(process.argv)
  .then(exitCode => process.exit(exitCode)) // eslint-disable-line no-process-exit
  .catch(err => {
    error({ err }, 'An error ocurred');
    process.exit(1); // eslint-disable-line no-process-exit
  });
