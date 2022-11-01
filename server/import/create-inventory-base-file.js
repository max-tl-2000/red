/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import XLSX from '@redisrupt/xlsx';
import logger from '../../common/helpers/logger';
import { writeToFile, deleteRow, getRowsCount } from '../helpers/workbook.js';

const getNewWorkbookPath = folderPath => {
  const NAME = 'InventoryBase';
  const SUFFIX = 'xlsx';
  return path.join(folderPath, `${NAME}.${SUFFIX}`);
};

export const processFile = async (inputFile, outputPath) => {
  const excludeList = ['Data Dictionary (-)', 'Qualification Questions (-)', 'Disclosures'];
  const outputFilePath = getNewWorkbookPath(outputPath);
  const workbook = XLSX.readFile(inputFile);
  workbook.SheetNames.forEach(sheetName => {
    if (!excludeList.includes(sheetName)) {
      const count = getRowsCount(workbook.Sheets[sheetName]);
      for (let i = 0; i < count; i++) {
        deleteRow(workbook.Sheets[sheetName], 1);
      }
    }
  });
  await writeToFile(workbook, outputFilePath);
  return outputFilePath;
};
const main = async () => {
  const inputFile = process.argv[2];
  const outputPath = process.argv[3];
  return processFile(inputFile, outputPath);
};

if (require.main === module) {
  main()
    .then(process.exit)
    .catch(error => {
      logger.error({ error }, 'An error ocurred while creating inventory base');
      process.exit(1); // eslint-disable-line
    });
}
