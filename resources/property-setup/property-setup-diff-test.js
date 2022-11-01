/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import minimist from 'minimist';
import { mapSeries } from 'bluebird';
import { error, log } from 'clix-logger/logger';
import { spawn } from 'child_process';
import { exists, mkdirp, deleteFile } from '../../common/helpers/xfs';
import {
  getSheetNameFromPath,
  downloadPropertySetupSheets,
  getDownloadedSheetPaths,
  baseLinePropertySetupSheet,
  allPropertySetupSheets,
  DOWNLOADS_DIR,
  ERROR_EXIT_CODE,
  SUCCESS_EXIT_CODE,
} from './helpers/property-setup-sheet-tests.js';

const { name: baseLineSheetName } = baseLinePropertySetupSheet;
const baseLineSheetPath = `${DOWNLOADS_DIR}/${baseLineSheetName}`;

const getIgnoredSheetsParam = ignoreSheets => {
  if (!ignoreSheets) return ignoreSheets;
  const sheets = ignoreSheets.split(',');
  const ignoredSheets = sheets.map(sheet => `'${sheet.trim()}'`);
  return `--ignoreSheets=--ignore1 ${ignoredSheets.join(' ')} --ignore2 ${ignoredSheets.join(' ')}`;
};

const getSheetDiffCmdParams = (baseLineSheet, sheetToCompare, { ignoreColMetadata, ignoreSheets }) => [
  'compose-property-setup-diff-test',
  ...(ignoreColMetadata ? ['--ignoreColMetadata'] : []),
  ...(ignoreSheets ? [getIgnoredSheetsParam(ignoreSheets)] : []),
  `--baseLineSheet=${baseLineSheet}`,
  `--sheetToCompare=${sheetToCompare}`,
];

const getExitCode = (resultsExitCodes = []) => (resultsExitCodes.some(exitCode => exitCode !== SUCCESS_EXIT_CODE) ? ERROR_EXIT_CODE : SUCCESS_EXIT_CODE);

const execDiff = async (params, outputFileName) => {
  const outputFilePath = `${DOWNLOADS_DIR}/${outputFileName}-results.txt`;
  (await exists(outputFilePath)) && (await deleteFile(outputFilePath));

  return new Promise((resolve, reject) => {
    const childProc = spawn('./bnr', params);
    const outputFileStream = fs.createWriteStream(outputFilePath);

    childProc.stdout.pipe(process.stdout);
    childProc.stderr.pipe(process.stdout);

    childProc.stdout.on('data', data => {
      outputFileStream.write(data);
    });

    childProc.stderr.on('data', data => {
      outputFileStream.write(data);
    });

    childProc.on('exit', code => {
      const logger = code === SUCCESS_EXIT_CODE ? log : error;
      logger('Diff exited with', code);
      resolve(code);
    });

    childProc.on('error', err => {
      reject(err);
    });
  });
};

const diffPropertySetupSheet = async ({ fileId, filePath }, options) => {
  log('Execute diff on', fileId, filePath, 'against', baseLineSheetPath, 'baseline sheet');
  const testParams = getSheetDiffCmdParams(getSheetNameFromPath(baseLineSheetPath), getSheetNameFromPath(filePath), options);
  return await execDiff(testParams, getSheetNameFromPath(filePath));
};

const validate = async () => {
  if (!(await exists(baseLineSheetPath))) throw Error(`Base line sheet ${baseLineSheetPath} not found. Be sure to include it in the --fileIds argument.`);
};

const getArgs = args => {
  const { fileIds, ignoreColMetadata, ignoreSheets } = minimist(args.slice(2));

  return {
    fileIds: fileIds ? fileIds.split(',') : allPropertySetupSheets.map(({ id }) => id),
    ignoreColMetadata,
    ignoreSheets,
  };
};

const init = async args => {
  await mkdirp(DOWNLOADS_DIR);
  return getArgs(args);
};

/*
  Usage: ./bnr property-setup-diff-test
  Options:
    --fileIds=<sheetId1,sheetId2,...>          set specific property sheets to test defaults to all available sheets
    --ignoreColMetadata                        run diff ignoring column name metadata
    --ignoreSheets=<sheetName1,sheetName2,...> run diff ignoring specific sheets
*/
const main = async args => {
  const { fileIds, ignoreColMetadata, ignoreSheets } = await init(args);

  await downloadPropertySetupSheets(fileIds);
  await validate();

  const filterBaseLineSheet = true;
  const sheetPaths = await getDownloadedSheetPaths({ filterBaseLineSheet });
  const resultsExitCodes = await mapSeries(sheetPaths, async sheetPath => await diffPropertySetupSheet(sheetPath, { ignoreColMetadata, ignoreSheets }));

  return getExitCode(resultsExitCodes);
};

main(process.argv)
  .then(exitCode => process.exit(exitCode)) // eslint-disable-line no-process-exit
  .catch(err => {
    error({ err }, 'An error ocurred');
    process.exit(1); // eslint-disable-line no-process-exit
  });
