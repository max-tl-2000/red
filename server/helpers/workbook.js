/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import XLSX from '@redisrupt/xlsx';
import logger from '../../common/helpers/logger';

import { FIND_PARENTHESES_AND_ALL_INSIDE, FIND_STARS, FIRST_ROW_IN_EXCEL, FIND_ALL_CHARACTERS_AFTER_FIRST_PARENTHESIS } from '../../common/regex';

export const ERROR_BACKGROUND = {
  fill: {
    patternType: 'solid',
    fgColor: {
      rgb: 'FFC7CE',
    },
  },
};

export const COMMENT_STYLE = '<rPr><sz val="12"/><rFont val="Verdana"/><family val="2"/><charset val="1"/></rPr>';

const LAST_COLUMN_REGEXP = /[a-z]+\d+:([a-z]+)\d+/i;
const SHEET_REF_REGEXP = /([a-z]+)(\d+):([a-z]+)(\d+)/i;
export const COMMENT_COLUMN_TITLE = '__COMMENTS__';

const READ_OPTIONS = {
  cellStyles: true,
  cellComments: true,
};

export const toExcelAddress = (x, y) => `${XLSX.utils.encode_col(x)}${XLSX.utils.encode_row(y)}`;

/**
 * assumption: first column (A) always has values
 * WARNING: returns a 1-based value
 */
export const findLastRowWithValue = sheet => {
  const { decode_cell } = XLSX.utils;
  const { r } = decode_cell(sheet['!ref'].split(':')[1]);

  const isEmpty = x => {
    const cell = sheet[`A${x}`];
    if (!cell) {
      return true;
    }
    return new Set(['', undefined, null]).has(cell.v);
  };

  let start = 1;
  let end = r + 1;
  let pivot = Math.round((end - start) / 2);

  // empty sheets
  if (isEmpty(start) && isEmpty(end)) {
    return null;
  }

  // ideal sheets
  if (!isEmpty(end)) {
    return end;
  }

  if (pivot === 0) {
    return !isEmpty(start) ? start : null;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // base condition
    if (pivot === end && !isEmpty(pivot - 1) && isEmpty(pivot)) {
      return pivot - 1;
    }

    if (isEmpty(pivot)) {
      end = pivot;
      pivot = Math.round((pivot + start) / 2);
    } else {
      start = pivot;
      pivot = Math.round((end + pivot) / 2);
    }
  }
};

const findLastColumn = sheet => {
  // simple, we do a linear search till find the last column with a header
  // Q: why just not take the "!ref"?
  // A: for some reason, there are extra columns filled with zeros and with
  // no header, they are not used.
  const { decode_col, encode_col } = XLSX.utils;
  const lastColIndex = decode_col(sheet['!ref'].match(LAST_COLUMN_REGEXP)[1]);
  let column = '';

  for (let colIndex = 0, address; colIndex <= lastColIndex; colIndex++) {
    address = toExcelAddress(colIndex, 0);
    if (!sheet[address] || !sheet[address].v) {
      return column;
    }
    column = encode_col(colIndex);
  }

  return column;
};

export const fixedRange = sheet => {
  if (!Object.keys(sheet).length) {
    return null;
  }

  const { decode_range, decode_col, decode_row } = XLSX.utils;
  const { s } = decode_range(sheet['!ref']);
  const lastRow = findLastRowWithValue(sheet);
  const lastColumn = findLastColumn(sheet);

  if (!lastRow) {
    return null;
  }

  return {
    s,
    e: {
      c: decode_col(lastColumn),
      r: decode_row(lastRow.toString()),
    },
  };
};

const isCell = x => !!x && x[0] !== '!';

const replaceSpecialCharFromColumnName = (sheet, maxColumnIndex) => {
  for (const [index, cell] of Object.keys(sheet).entries()) {
    if (cell === '!ref') maxColumnIndex += 1;
    if (isCell(cell) && FIRST_ROW_IN_EXCEL.test(cell) && index <= maxColumnIndex) {
      sheet[cell].w = sheet[cell].v = sheet[cell].v.replace(FIND_STARS, '').trim();
      sheet[cell].w = sheet[cell].v = sheet[cell].v.replace(FIND_PARENTHESES_AND_ALL_INSIDE, '').trim();
    }
  }
};

// This function has been overwritten from the XLSX library in order to be able
// to handle dates values from the Excel file.
// The dates are taken as numbers and then, they are parsed using XLSX.SSF.parse_date_code.
// In order to be able to override the function, we are now using our own fork of
// the library (https://www.npmjs.com/package/@redisrupt/xlsx) because the function
// can not be overwritten from the original library due to a bug.
// eslint-disable-next-line camelcase
XLSX.utils.format_cell = (cell, v) => {
  if (cell == null || cell.t == null) {
    return '';
  }
  if (cell.t === 'n' && cell.v !== undefined && cell.w !== undefined && cell.w.includes('/')) {
    const p = XLSX.SSF.parse_date_code(cell.v, { date1904: false });
    return `${p.y}-${p.m}-${p.d}`; // ISO date format
  }
  if (cell.t === 's' && cell.v !== undefined) {
    return cell.v.trim();
  }
  if (cell.v !== undefined) {
    return cell.v;
  }
  if (cell.w !== undefined) {
    return cell.w;
  }
  return XLSX.safe_format_cell(cell, v);
};

const getSheetNameFormatted = sheetName => {
  const sheetNameWithoutBlankSpaces = sheetName.replace(/ /g, '');
  return sheetNameWithoutBlankSpaces.replace(FIND_ALL_CHARACTERS_AFTER_FIRST_PARENTHESIS, '');
};

// converts XLSX file located at _path_ into a map of JSON objects
// each key represents one sheet in the file, and each value is the
// parsed version of that sheet

const getHeaderRow = worksheet => {
  const headers = [];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const firstRow = range.s.r;
  const firstColumn = range.s.c;
  const lastColumn = range.e.c;

  for (let C = firstColumn; C <= lastColumn; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: firstRow })];
    const header = cell && cell.t ? XLSX.utils.format_cell(cell) : null;

    if (header) headers.push(header);
  }
  return headers;
};

const FORMAT_DATE_REGEX = /^\d{2}[/-]\d{2}[/-]\d{4}$/;
const isANumberTypeAndSeemsLikeADate = val => val.t === 'n' && FORMAT_DATE_REGEX.test(val.w);

const formatValue = val => {
  if (typeof val.v === 'string') return val.v.trim();
  if (val.w.includes('%')) return val.v * 100;
  if (isANumberTypeAndSeemsLikeADate(val)) return val.w.trim();

  return val.v;
};

export const parse = async (path, options = {}) => {
  logger.info({ path }, 'xls helper starting parsing');
  const workbook = XLSX.readFile(path, options);
  const result = {};

  workbook.SheetNames.forEach(sheet => {
    let data;
    const worksheet = workbook.Sheets[sheet];
    const range = fixedRange(worksheet);

    if (range) {
      const maxColumnIndex = range.e.c;
      replaceSpecialCharFromColumnName(worksheet, maxColumnIndex);
    }

    const columnHeaders = worksheet['!ref'] ? getHeaderRow(worksheet) : [];

    if (range) {
      data = XLSX.utils.sheet_to_json(worksheet, {
        range,
        defval: '',
        blankrows: false,
        formatCellValue: val => formatValue(val),
      });
    } else {
      // empty sheet
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    result[getSheetNameFormatted(sheet)] = {
      data,
      columnHeaders,
    };

    // TODO: assure the key generation trim cell values.
  });

  return result;
};

function getOrCreateCommentsColumn(sheet) {
  const lastColumn = findLastColumn(sheet);

  if (sheet[`${lastColumn}1`].v === COMMENT_COLUMN_TITLE) {
    return lastColumn;
  }

  // update sheet ref if needed
  const [, colStart, rowStart, colEnd, rowEnd] = sheet['!ref'].match(SHEET_REF_REGEXP);
  const index = XLSX.utils.decode_col(lastColumn) + 1;
  const column = XLSX.utils.encode_col(index);

  if (index >= XLSX.utils.decode_col(colEnd)) {
    sheet['!ref'] = `${colStart}${rowStart}:${column}${rowEnd}`; // eslint-disable-line no-param-reassign
  }

  // create the col's header
  sheet[`${column}1`] = {
    // eslint-disable-line no-param-reassign
    t: 's',
    v: COMMENT_COLUMN_TITLE,
    h: COMMENT_COLUMN_TITLE,
    w: COMMENT_COLUMN_TITLE,
  };

  return column;
}

function createCommentObject(comment) {
  return [
    {
      t: comment,
      r: `<r>${COMMENT_STYLE}<t>${comment}</t></r>`,
      h: `<span style="">${comment}</span>`,
    },
  ];
}

export const addCommentsToWorkbook = (wb, comments) => {
  Object.keys(comments).forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const column = getOrCreateCommentsColumn(sheet);
    const [, , , , rowEnd] = sheet['!ref'].match(SHEET_REF_REGEXP);

    // skip the first row
    for (let row = 2; row <= +rowEnd; row++) {
      const text = comments[sheetName][row] ? comments[sheetName][row].join(' \n') : '';
      sheet[`${column}${row}`] = {
        t: 's',
        v: text,
        h: text,
        w: text,
      };
    }
  });
};

export const fixSheetsRefs = wb => {
  // assumption: sheets start at A1
  // TODO use findLastRowWithValue
  wb.SheetNames.forEach(name => {
    const sheet = wb.Sheets[name];
    const cellAddress = Object.keys(sheet)
      .filter(key => key.match(/^A\d+/))
      .find(key => sheet[key].v === '');

    if (cellAddress) {
      const row = cellAddress.match(/\d+/);
      const column = findLastColumn(sheet);
      sheet['!ref'] = `A1:${column}${+row - 1}`;
    }
  });
};

export async function highlight(path, cells) {
  const workbook = XLSX.readFile(path);
  fixSheetsRefs(workbook);

  const comments = {};

  cells.forEach(cell => {
    const cellAddress = toExcelAddress(cell.column, cell.row);
    const sheetName = workbook.SheetNames.find(sheeName => getSheetNameFormatted(sheeName) === getSheetNameFormatted(cell.sheetName));
    const data = (workbook.Sheets[sheetName] || {})[cellAddress];

    // When the cell value has a null or undefined value the readfile ignore that cell
    // for that reason the data is undefined and is not possible to add the comment
    // but, we can add the cell at the end with the validations.
    if (data) {
      data.s = { ...data.s, ...ERROR_BACKGROUND };
      data.c = createCommentObject(cell.comment);
    }

    const row = XLSX.utils.encode_row(cell.row);
    comments[sheetName] = comments[sheetName] || {};
    comments[sheetName][row] = comments[sheetName][row] || [];
    comments[sheetName][row].push(cell.comment);
  });

  addCommentsToWorkbook(workbook, comments);

  return workbook;
}

export async function open(stream) {
  return XLSX.read(stream, READ_OPTIONS);
}

export async function writeToFile(workbook, path) {
  XLSX.writeFile(workbook, path);
  return path;
}

const ec = (r, c) => XLSX.utils.encode_cell({ r, c });

export const deleteRow = (sheet, rowIndex) => {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = rowIndex; r < range.e.r; ++r) {
    for (let c = range.s.c; c <= range.e.c; ++c) {
      sheet[ec(r, c)] = sheet[ec(r + 1, c)];
    }
  }
  range.e.r--;
  sheet['!ref'] = XLSX.utils.encode_range(range.s, range.e);
};

export const getRowsCount = sheet => {
  if (!sheet['!ref']) return 0;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  return range.e.r;
};
