/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Group } from '@redisrupt/datapumps';
import csv from 'fast-csv';
import fs from 'fs';
import values from 'lodash/values';
import XLSX from '@redisrupt/xlsx';
import { excelHandlerMixin } from './excelHandlerMixin';
import { isValidDecimal } from '../../../common/regex';
import { createExcelFile } from '../helpers/workbook';
import { createBufferFromArr } from '../helpers/converters';
import { buildRowObject, isYardiImportUpdateFileHeader, getMissingColumns } from '../updates/csvHelper';

/**
 * readCsvFile
 * This method will use the information that we already had configured in the setting object
 * to read the file using the csvHeaders and converted into a new object using the fields (which belong to the xlsx file)
 * @param {object} setting - An object with all required configuration to read an csv file and convert it into a new object with a "data" property
 *                           which have all the original data already converted by a specific mapping converter
 * @return {object} An objects which have a key, sheetname and the processed data based on its specific mapping converter.
 *                  If the setting has a parentKey then its parents properties will be included too.
 */
const readCsvFile = setting => {
  const resultData = new Promise(resolve => {
    const stream = fs.createReadStream(setting.filePath);
    const convertedData = [];
    let fileHeaders;
    let missingColumns;
    let checkedHeaders = false;

    csv
      .fromStream(stream)
      .validate(data => {
        if (!setting.csvHeaders || checkedHeaders) {
          if (!fileHeaders) fileHeaders = data;
          return true;
        }
        const csvHeadersInFile = values(data);
        if (isYardiImportUpdateFileHeader(setting.csvHeaders, csvHeadersInFile)) return true;

        checkedHeaders = true;
        fileHeaders = csvHeadersInFile;

        missingColumns = getMissingColumns(setting.csvHeaders, fileHeaders);
        return missingColumns.length === 0;
      })
      .on('data', data => {
        if (fileHeaders) {
          const row = buildRowObject(fileHeaders, data);
          const result = setting.converter(row, setting.fields);

          if (result.valid) {
            convertedData.push(result.data);
          }
        }
      })
      .on('end', () => {
        const csvData = {
          key: setting.key,
          sheetName: setting.sheetName,
          data: convertedData,
        };
        if (setting.parentKey) {
          csvData.parentKey = setting.parentKey;
          csvData.parentMatchColumnIndex = setting.parentMatchColumnIndex;
          csvData.parentDestinyColumnIndex = setting.parentDestinyColumnIndex;
          csvData.childValueColumnIndex = setting.childValueColumnIndex;
        }
        resolve(csvData);
      });
  });
  return resultData;
};

const configurePump = (etl, workbook, setting, usingBaseFile) => {
  const buffer = createBufferFromArr(setting);
  const pump = etl.addPump(setting.sheetName);
  pump
    .from(buffer)
    .mixin(excelHandlerMixin())
    .workbook(workbook)
    .createOrUseWorksheet(setting.sheetName, usingBaseFile)
    .writeHeaders(setting.fields)
    .process(data => {
      const vals = Object.keys(data).map(key => (isValidDecimal(data[key]) ? parseFloat(data[key]) : data[key])); // eslint-disable-line no-confusing-arrow
      return pump.writeRow(vals);
    })
    .logErrorsToConsole();
};

/**
 * CONFIGURED_NESTED_SHEET_LIST
 * This list provides information about which sheets use more than one mapper converter to fill its data up
 * e.g.
 * Inventory Groups use two mapper converters (identified by its key in mappingConverters): ResUnitTypes and ResRentableItemsTypes
 * Inventory use two mapper converters: CommUnits and ResRentableItems
 */
const CONFIGURED_NESTED_SHEET_LIST = [
  {
    key: 'ResUnitTypes',
    sheetName: 'Inventory Groups',
    dependencies: [{ key: 'ResRentableItemsTypes' }],
  },
  { key: 'ResRentableItemsTypes', sheetName: 'Inventory Groups' },
  {
    key: 'CommUnits',
    sheetName: 'Inventory',
    dependencies: [{ key: 'ResRentableItems' }],
  },
  { key: 'ResRentableItems', sheetName: 'Inventory' },
];

/**
 * concatenateSheets
 * This method concatenate into a single object the data which come from differents mapping converters but belongs to the same sheet
 * @param {Array} requiredNestedSheetList - this array was filtered from CONFIGURED_NESTED_SHEET_LIST based on the uploaded csv files
 * @param {Array} sheetsRawData - this array have the data which already was processed by all the mapper converters
 * @return {Array} An array of objects with data combined based on the sheet name
 */
const concatenateSheets = (requiredNestedSheetList, sheetsRawData) => {
  const groupsSheet = [];
  requiredNestedSheetList.forEach(rns => {
    let groupSheet;
    const groupSheetExists = groupsSheet.some(gs => gs.sheetName === rns.sheetName);
    if (!groupSheetExists) {
      groupSheet = { key: rns.key, sheetName: rns.sheetName, data: [] };
    } else {
      groupSheet = groupsSheet.find(gs => gs.sheetName === rns.sheetName);
    }
    const tempSheets = sheetsRawData.filter(sheet => sheet.key === rns.key && sheet.sheetName === rns.sheetName);
    const groupData = [];
    for (const sheet of tempSheets) {
      for (const row of sheet.data) {
        groupData.push(row);
      }
    }
    if (groupSheetExists) {
      groupSheet.data = groupSheet.data.concat(groupData);
    } else {
      groupSheet.data = groupData;
      groupsSheet.push(groupSheet);
    }
  });
  return groupsSheet;
};

/**
 * getChildData
 * This method concatenate data which come from an array based on the column index and a match value
 * @param {Array} childData - this array contains data which already was processed by a mapping converter
 * @param {integer} parentMatchColumnIndex - this param specified which column we will use to match the value we are looking for
 * @param {string} matchValue - the value we will use to filter the childData array
 * @param {integer} childValueColumnIndex - this param specified which column we will use to get the data which we will concatenate
 * @return {string} a concatenated string with all values which matched the filter
 */
const getChildData = (childData, parentMatchColumnIndex, matchValue, childValueColumnIndex) => {
  const data = childData
    .filter(row => row[parentMatchColumnIndex] === matchValue)
    .sort((a, b) => a[childValueColumnIndex].localeCompare(b[childValueColumnIndex]));

  if (!data.length) return '';
  const result = data.reduce((acc, item, currIndex) => {
    acc += `${item[childValueColumnIndex]}${data.length - 1 !== currIndex ? ', ' : ''}`;
    return acc;
  }, '');
  return result;
};

const processFiles = async (settings, baseFilePath = '') => {
  if (!(settings && settings.length)) return null;

  const requiredNestedSheetList = [];
  const files = settings.map(setting => {
    if (CONFIGURED_NESTED_SHEET_LIST.map(nestedSheet => nestedSheet.key).includes(setting.key)) {
      const nestedSheet = CONFIGURED_NESTED_SHEET_LIST.find(cns => cns.key === setting.key && cns.sheetName === setting.sheetName);
      if (nestedSheet && !requiredNestedSheetList.map(rns => rns.key).includes(nestedSheet.key)) {
        requiredNestedSheetList.push({
          key: nestedSheet.key,
          sheetName: nestedSheet.sheetName,
        });
      }
    }
    return readCsvFile(setting);
  });

  // In childsData we will put all the data which come from mapping converters which are child from another mapping converter
  // e.g.: CommUnits has a childMapper property, this mean it has a child which name is ResUnitAmenities
  const parentsSetting = settings.filter(file => file.childMapper);
  const childsData = parentsSetting.map(parentSetting => {
    const childSetting = parentSetting.childMapper;
    if (!childSetting.filePath) return [];
    childSetting.sheetName = parentSetting.sheetName;
    childSetting.parentKey = parentSetting.key;
    return readCsvFile(childSetting);
  });

  const sheetsRawData = await Promise.all(files);
  const childsRawData = await Promise.all(childsData);

  const singleSheetsRawData = sheetsRawData.filter(data => !requiredNestedSheetList.map(rns => rns.sheetName).includes(data.sheetName));
  const multipleSheetsRawData = concatenateSheets(requiredNestedSheetList, sheetsRawData);

  // for each setting (mapping converter) we will add them the data property based on
  // if they have more than one mapping converter for a single sheet.
  // e.g.: Inventory Groups: ResUnitTypes and ResRentableItemsTypes, Inventory: CommUnits and ResRentableItems
  settings.forEach(setting => {
    if (singleSheetsRawData.map(ssr => ssr.sheetName).includes(setting.sheetName)) {
      const rawData = singleSheetsRawData.find(ssr => ssr.key === setting.key && ssr.sheetName === setting.sheetName);
      if (rawData) setting.data = rawData.data;
    } else if (multipleSheetsRawData.map(ssr => ssr.sheetName).includes(setting.sheetName)) {
      const rawData = multipleSheetsRawData.find(ssr => ssr.key === setting.key && ssr.sheetName === setting.sheetName);
      if (rawData) setting.data = rawData.data;
    }
  });
  settings = settings.filter(setting => setting.data);

  const excelInventory = (await createExcelFile(baseFilePath))._excel;

  const etlInventory = new Group();

  // update parent's sheet data with its corresponding child's data
  childsRawData.forEach(childRawData => {
    const parent = settings.find(sheet => sheet.key === childRawData.parentKey);
    if (parent) {
      parent.data.forEach(row => {
        const matchValue = row[childRawData.parentMatchColumnIndex];
        const childData = getChildData(childRawData.data, childRawData.parentMatchColumnIndex, matchValue, childRawData.childValueColumnIndex);
        row[childRawData.parentDestinyColumnIndex] = childData;
      });
    }
  });

  await settings.forEach(setting => {
    configurePump(etlInventory, excelInventory.workbook, setting, !!excelInventory.path);
  });

  await etlInventory.start().whenFinished();

  const workbook = XLSX.write(excelInventory.workbook, {
    bookType: 'xlsx',
    bookSST: false,
    type: 'binary',
  });

  return workbook;
};

export { processFiles };
