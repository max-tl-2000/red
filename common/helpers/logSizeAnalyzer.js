/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import path from 'path';
import minimist from 'minimist';
import readline from 'readline';
import { ok, error, warn, subtle, log } from 'clix-logger/logger';
import { size as sizeOfObj } from './object-utils';
import { stat, deleteFile } from './xfs';
import { expand } from '../../resources/expand';
import tryParse from './try-parse';

const DEFAULT_MAX_LOG_OBJ_SIZE_BYTES = 10000;
let REPORT_FILE_PATH;

const analyzeLogs = async (logFile, maxLogObjSize = DEFAULT_MAX_LOG_OBJ_SIZE_BYTES) =>
  new Promise((resolve, reject) => {
    let totalLogLines = 0;
    let totalLogLinesOverMaxSize = 0;
    const logLineResults = new Map();

    const read = readline.createInterface({
      input: fs.createReadStream(logFile),
    });

    read
      .on('line', line => {
        totalLogLines++;
        const logObj = tryParse(line, {});
        const logObjSize = sizeOfObj(logObj);
        const { time, msg, level, name: loggerName } = logObj;
        let { message, subType } = logObj;

        message = message || msg;
        subType = subType || loggerName;

        if (logObjSize > maxLogObjSize) {
          totalLogLinesOverMaxSize++;

          if (!logLineResults.has(subType)) {
            logLineResults.set(subType, []);
          }

          const linesOverMaxSize = logLineResults.get(subType);
          linesOverMaxSize.push({ message, level, logObj, time, logObjSize });
          logLineResults.set(subType, linesOverMaxSize);
        }
      })
      .on('close', () => {
        resolve({ logLineResults, totalLogLines, totalLogLinesOverMaxSize });
      })
      .on('error', () => {
        reject(new Error('An error occured reading the log file'));
      });
  });

const logToReportFileOutput = async line =>
  new Promise((resolve, reject) => {
    if (REPORT_FILE_PATH) {
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
    } else {
      resolve();
    }
  });

const getFileName = filePath => path.basename(filePath);

const fileExists = async filePath => {
  let filePathExists = false;
  try {
    filePathExists = await stat(filePath);
  } catch (err) {
    subtle(`Report output file: ${filePath} does not exist`);
  }
  return filePathExists;
};

const getArgs = async args => {
  const argv = minimist(args.slice(2));

  if (!argv.files) {
    throw new Error('No input log file set. Hint: --files=logs/*.log');
  }

  if (argv.reportFilePath) {
    REPORT_FILE_PATH = argv.reportFilePath;
    if (await fileExists(REPORT_FILE_PATH)) {
      await deleteFile(REPORT_FILE_PATH);
    }
  }

  const logFiles = await expand({ patterns: argv.files });

  subtle('>> files to analyze', logFiles);

  return {
    logFiles,
    maxLogObjSize: argv.maxLogObjSize || DEFAULT_MAX_LOG_OBJ_SIZE_BYTES,
    verbose: argv.verbose,
    noFail: argv.noFail,
  };
};

const logToStdOut = (msg, level) => level(msg);

const logResult = async (msg, level) => {
  await logToReportFileOutput(msg);
  logToStdOut(msg, level);
};

const printLogResultsHeader = async logFile => await logResult(`Log file: ${logFile}`, ok);

const getMessage = (message, verbose = false) => {
  let msg = message || '';

  if (!verbose) {
    msg = msg.length > 30 ? `${msg.substr(0, 30)} ...` : msg;
  }

  return msg;
};

const printLogResultsDetails = async (subType, linesOverMaxSize, verbose = false) => {
  const subTypeHeader = `Logger subType: ${subType}`;
  await logResult(subTypeHeader, log);

  for (const line of linesOverMaxSize) {
    const logDetail = `Message: ${getMessage(line.message, verbose)} | Level: ${line.level} | Time: ${line.time} | Size: ${line.logObjSize}`;
    await logResult(logDetail, warn);

    if (verbose) {
      await logToReportFileOutput(`${JSON.stringify(line.logObj)}`);
    }
  }
};

const printLogResultsFooter = async (logFile, totalLogLinesOverMaxSize, totalLogLines) => {
  const footer = `Log file: ${logFile} - Total Analyzed Lines: ${totalLogLines} - Total Lines Over Max Size: ${totalLogLinesOverMaxSize}\n`;
  if (totalLogLinesOverMaxSize > 0) {
    await logResult(footer, error);
  } else {
    await logResult(footer, ok);
  }
};

const main = async args => {
  const { logFiles, maxLogObjSize, verbose, noFail } = await getArgs(args);
  let hasLogsOverMaxSize = false;

  for (const logFile of logFiles) {
    await printLogResultsHeader(getFileName(logFile));
    const { logLineResults, totalLogLines, totalLogLinesOverMaxSize } = await analyzeLogs(logFile, maxLogObjSize);

    if (totalLogLinesOverMaxSize > 0) hasLogsOverMaxSize = true;

    for (const [subType, linesOverMaxSize] of logLineResults) {
      await printLogResultsDetails(subType, linesOverMaxSize, verbose);
    }

    await printLogResultsFooter(getFileName(logFile), totalLogLinesOverMaxSize, totalLogLines);
  }

  if (hasLogsOverMaxSize && !noFail) {
    process.exit(1); // eslint-disable-line
  }
};

main(process.argv)
  .then(process.exit)
  .catch(err => {
    error({ err }, 'An error ocurred');
    process.exit(1); // eslint-disable-line
  });
