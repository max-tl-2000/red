/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { isDate, isBoolean } from '../../../common/helpers/type-of';
import { toMoment } from '../../../common/helpers/moment-utils';
import { standarizeSheetName } from '../../helpers/importUtils';
import { parse } from '../../helpers/workbook';

export const formatPhoneNumberForExport = phoneNo => {
  if (!phoneNo) return '';
  // remove first character (country code = '1')
  return phoneNo[0] === '1' ? phoneNo.slice(1) : phoneNo;
};

export const getForeignKeysColumns = foreignKeys => foreignKeys.reduce((acc, foreignKey) => acc.concat(foreignKey.fields.map(field => field.columnHeader)), []);

export const getSimpleFieldsColumns = (columnHeaders, dbForeigKeys = []) => columnHeaders.filter(column => !dbForeigKeys.includes(column));

export const buildDataPumpFormat = (objects, columnHeaders) =>
  objects.reduce((acc, obj) => {
    const values = columnHeaders.map(header => {
      if (obj[header] === null || obj[header] === undefined) return '';
      if (isDate(obj[header])) return toMoment(obj[header], { timezone: obj.timezone }).format('MM/DD/YYYY');
      if (isBoolean(obj[header])) {
        if (obj[header]) return 'TRUE';
        return 'FALSE';
      }
      return obj[header];
    });
    acc.push(values);
    return acc;
  }, []);

export const getColumnHeadersMappedWithDB = (columnHeaders, dbMappers) =>
  columnHeaders.map(column => {
    const mapperFound = dbMappers.find(mapper => mapper.columnHeader === column);
    if (mapperFound) return mapperFound.dbField;
    return column;
  });

export const mapToExportSheet = (teams, mappers) =>
  teams.map(team => {
    mappers.forEach(mapper => {
      team[mapper.columnHeader] = team[mapper.dbField];
      delete team[mapper.dbField];
    });
    return team;
  });

export const getColumnsInTheImportOrder = (sheetName, inventoryWorbook) => {
  const { columnHeaders } = inventoryWorbook.find(sheet => standarizeSheetName(sheet.sheetName) === standarizeSheetName(sheetName));
  return columnHeaders;
};

export const getSheetsAndColumnHeadersInTheImportOrder = async sheetNamesToExport => {
  const inventoryPath = path.join(__dirname, '../../import/__tests__/resources/Inventory.xlsx');
  const inventoryFile = await parse(inventoryPath, {
    cellStyles: false,
    cellHTML: false,
  });

  return Object.keys(inventoryFile).reduce((acc, sheetNameFromInventory) => {
    const doesSheetExist = sheetNamesToExport.find(sheetName => standarizeSheetName(sheetNameFromInventory) === standarizeSheetName(sheetName));
    if (!doesSheetExist) return acc;

    acc.push({
      sheetName: sheetNameFromInventory,
      columnHeaders: inventoryFile[sheetNameFromInventory].columnHeaders,
    });
    return acc;
  }, []);
};
