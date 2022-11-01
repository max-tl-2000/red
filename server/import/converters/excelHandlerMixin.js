/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import XLSX from '@redisrupt/xlsx';
import fs from 'fs';
import { fixedRange, toExcelAddress } from '../../helpers/workbook';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { isNumber } from '../../../common/helpers/type-of';

const SHEETS_TO_ALLOW_ZEROS = [spreadsheet.VoiceMenuItems.workbookSheetName];

export const excelHandlerMixin = () => {
  const excelHandler = target => {
    const ctx = target;
    const DataTypes = ['b', 'n', 's', 'd', 'e', 't'];

    target._excel = {
      columnTypes: [],
      path: null,
      range: { s: { c: 10000000, r: 10000000 }, e: { c: 0, r: 0 } },
    };

    target.createOrUseWorkbook = async path => {
      if (ctx._excel.workbook) {
        throw new Error('Workbook already created');
      }

      let workbook;
      if (path && fs.existsSync(path)) {
        workbook = await XLSX.readFile(path);
        ctx.workbook(workbook);
      } else {
        workbook = {
          SheetNames: [],
          Sheets: [],
        };
        ctx.workbook(workbook);
      }

      ctx._excel.path = path;

      return ctx;
    };

    target.workbook = workbook => {
      if (!workbook) {
        return ctx._excel.workbook;
      }

      ctx._excel.workbook = workbook;

      return ctx;
    };

    target.createOrUseWorksheet = (name, usingBaseFile = false) => {
      if (!ctx._excel.workbook) {
        throw new Error('Use createOrUseWorkbook before creating worksheet');
      }

      ctx._excel.currentSheet = name;
      ctx._excel.usingBaseFile = usingBaseFile;

      const worksheet = ctx._excel.workbook.Sheets[name];
      if (worksheet) {
        ctx._excel.worksheet = worksheet;
        const range = fixedRange(worksheet);

        ctx._excel.currentRow = range.e.r + 1;
      } else {
        ctx._excel.workbook.Sheets[name] = {};
        ctx._excel.workbook.SheetNames.push(name);
        ctx._excel.worksheet = ctx._excel.workbook.Sheets[name];
        ctx._excel.currentRow = 0;
      }

      for (let i = 0; i <= ctx._excel.currentRow; i++) {
        ctx._updateSpreadSheetRange(i, 0);
      }

      return ctx;
    };

    target.writeHeaders = (headers, types = []) => {
      if (ctx._excel.currentRow >= 1) {
        return ctx;
      }

      if (!ctx._excel.worksheet) {
        throw new Error('Use createOrUseWorksheet before writing headers');
      }
      if (ctx._excel.currentRow !== 0) {
        throw new Error('Use writeHeaders before writing any rows to the worksheet');
      }

      headers.forEach((header, index) => {
        ctx._writeHeader(index, header);
        ctx.columnType(index, types[index] || 's');
      });

      ctx._excel.currentRow = 1;
      return ctx;
    };

    target.columnType = (index, type) => {
      if (!type) {
        return ctx._excel.columnTypes[index];
      }

      if (DataTypes.indexOf(type) === -1) {
        throw new Error(`Invalid column type '${type}'. Only String, Number or Formula is allowed`);
      }
      ctx._excel.columnTypes[index] = type;
      return ctx;
    };

    target.writeRow = (columns, sheetName) => {
      if (!ctx._excel.worksheet) {
        throw new Error('Use createOrUseWorksheet before writing rows');
      }

      if (ctx._excel.usingBaseFile) {
        columns.forEach((value, index) => ctx._writeCell(value, index));
      } else {
        columns.forEach((value, index) => (SHEETS_TO_ALLOW_ZEROS.includes(sheetName) || value) && ctx._writeCell(value, index));
      }

      ctx._excel.currentRow++;
      return Promise.resolve();
    };

    target._writeHeader = (index, header) => {
      ctx._writeCell(header, index);
      return ctx;
    };

    target._writeCell = (value, index) => {
      const addressCell = toExcelAddress(index, ctx._excel.currentRow);
      const valueIsNumber = isNumber(value);

      ctx._excel.worksheet[addressCell] = {
        t: valueIsNumber ? 'n' : 's',
        v: value,
        h: value,
        w: value,
      };

      if (ctx._excel.currentSheet === spreadsheet.OfficeHour.workbookSheetName && valueIsNumber) {
        ctx._excel.worksheet[addressCell].z = 'h:mm';
      }

      ctx._updateSpreadSheetRange(ctx._excel.currentRow, index);
    };

    target._updateSpreadSheetRange = (row, col) => {
      const range = ctx._excel.range;

      if (range.s.r > row) {
        range.s.r = row;
      }
      if (range.s.c > col) {
        range.s.c = col;
      }
      if (range.e.r < row) {
        range.e.r = row;
      }
      if (range.e.c < col) {
        range.e.c = col;
      }

      ctx._excel.worksheet['!ref'] = XLSX.utils.encode_range(range);

      return ctx;
    };
  };

  return excelHandler;
};
