/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import csv from 'fast-csv';
import fs from 'fs';
import path from 'path';
import values from 'lodash/values';
import partition from 'lodash/partition';
import { write } from '../../../common/helpers/xfs';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'importUpdates' });

export const isYardiImportUpdateFileHeader = (csvHeaders, csvHeadersInFile) =>
  csvHeadersInFile[0] !== '' && csvHeadersInFile.slice(1).every(item => item === '');

export const buildRowObject = (fileHeaders, data) =>
  fileHeaders.reduce((acc, header, index) => {
    acc[header] = data[index];
    return acc;
  }, {});

export const getMissingColumns = (requiredHeaders, fileHeaders) =>
  requiredHeaders.filter(requiredHeader => !fileHeaders.find(fileHeader => fileHeader === requiredHeader));

export const readCsvFile = (
  ctx,
  {
    key,
    filePath,
    csvHeaders,
    mapper,
    preComputedData,
    requiredHeaders,
    resultHeaders,
    originalName,
    resultPrefix = 'default',
    thirdPartySystem = DALTypes.BackendMode.NONE,
  },
  validTenantCodes,
) =>
  new Promise(async (resolve, reject) => {
    let checkedHeaders = false;
    let hasCsvHeadersError = false;
    const stream = fs.createReadStream(filePath);

    const buffer = [];
    let fileHeaders;
    let missingColumns;
    let rowIndex = 0;

    const requiredData = preComputedData && (await preComputedData(ctx));

    await csv
      .fromStream(stream)
      .validate(data => {
        rowIndex++;
        if (!csvHeaders || checkedHeaders) {
          if (!fileHeaders) fileHeaders = data;
          return true;
        }
        const csvHeadersInFile = values(data);

        if (isYardiImportUpdateFileHeader(csvHeaders, csvHeadersInFile)) return true;

        checkedHeaders = true;
        fileHeaders = csvHeadersInFile;
        missingColumns = getMissingColumns(requiredHeaders, fileHeaders);
        return missingColumns.length === 0;
      })
      .on('data-invalid', data => {
        logger.error(
          {
            ctx,
            csvHeaders,
            csvHeadersInFile: values(data),
            csvConverterName: key,
            prefix: resultPrefix,
            csvFilePath: filePath,
            csvOriginalFileName: originalName,
            missingColumns,
            thirdPartySystem,
          },
          'Missing columns',
        );
        hasCsvHeadersError = true;
      })
      .on('data', data => {
        if (fileHeaders) {
          const row = buildRowObject(fileHeaders, data);

          if (mapper) {
            const result = mapper(row, { ...requiredData, validTenantCodes });

            if (result.valid) {
              buffer.push(result.data);
            }
          } else {
            buffer.push(data);
          }
        }
      })
      .on('error', error => {
        logger.error(
          {
            ctx,
            csvConverterName: key,
            prefix: resultPrefix,
            csvFilePath: filePath,
            csvOriginalFileName: originalName,
            thirdPartySystem,
            rowIndex: rowIndex + 1,
            error,
          },
          'Csv parse error',
        );
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({
          token: `PARSE_ERROR_AT_LINE_${rowIndex + 1}`,
          error,
        });
      })
      .on('end', () => {
        const errorInfo = hasCsvHeadersError ? { hasError: true, token: 'HEADERS_MISMATCH' } : {};
        resolve({
          key,
          prefix: resultPrefix,
          csvHeaders,
          buffer,
          resultHeaders,
          thirdPartySystem,
          originalName,
          fileHeaders,
          missingColumns,
          ...errorInfo,
        });
      });
  });

export const writeCsvFile = async ({ filePath, csvHeaders, data }) => {
  const header = csvHeaders.join(',');
  const csvFileContent = [header].concat(data.map(row => `"${row.join('","')}"`)).join('\n');
  return await write(filePath, csvFileContent);
};

export const getResultFilePath = (resultFolder, prefix) => path.join(resultFolder, `${prefix}-${Date.now()}.csv`);

// Read the csv files based on file metadata (handlers, mappers, headers) and parse the
// result object using the metadata prefix to differentiate each file.
export const parseThirdPartyInventory = async (ctx, { csvHandlers, validTenantCodes = [] }) => {
  const rows = await Promise.all(
    csvHandlers.map(
      async fileMetadata =>
        await readCsvFile(ctx, fileMetadata, validTenantCodes).catch(error => ({
          ...fileMetadata,
          prefix: fileMetadata.resultPrefix,
          hasError: true,
          token: error.token || 'GENERIC_CSV_ERROR',
        })),
    ),
  );

  const [importUpdatesFilesWithErrors, importUpdatesFilesWithoutErrors] = partition(rows, 'hasError');

  const parsedImportUpdatesFiles = importUpdatesFilesWithoutErrors.reduce((acc, item) => {
    if (acc[item.prefix]) {
      acc[item.prefix].buffer = acc[item.prefix].buffer.concat(item.buffer);
    } else {
      acc[item.prefix] = { ...item };
    }
    return acc;
  }, {}); // join common mappers
  return {
    parsedImportUpdatesFiles,
    importUpdatesFilesWithErrors,
  };
};

export const getPreviousUpdate = async filePath => {
  if (!filePath) return null;

  const previousUpdate = (await readCsvFile({}, { filePath })).buffer;
  if (previousUpdate) previousUpdate.shift(); // remove csv headers
  return previousUpdate;
};
