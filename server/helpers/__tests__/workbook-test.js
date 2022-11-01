/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import path from 'path';

import _ from 'lodash'; // eslint-disable-line red/no-lodash
import * as workbookHelper from '../workbook';

const TEST_EXCEL_SIMPLE = path.join(__dirname, 'test.xlsx');
const TEST_EXCEL_INVENTORY = path.join(__dirname, 'inventory_missing_required.xlsx');
const TEMP_EXCEL_FILE_PATH = path.join(__dirname, 'temp.xlsx');
const ERROR_COMMENT = 'Error';

const CELLS = [
  {
    sheetName: 'Property',
    row: 1,
    column: 0,
    comment: ERROR_COMMENT,
  },
  {
    sheetName: 'Property',
    row: 3,
    column: 0,
    comment: ERROR_COMMENT,
  },
  {
    sheetName: 'Property',
    row: 6,
    column: 1,
    comment: ERROR_COMMENT,
  },
];

describe('workbook-utils', () => {
  const sheetBuilder = (numRows, rowsLimit, numCols = 4) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const cols = _.take(letters, numCols);
    const sheet = { '!ref': `A1:${_.last(cols)}${numRows}` };
    for (const col of cols) {
      for (let i = 1; i <= numRows; i++) {
        sheet[`${col}${i}`] = (i <= rowsLimit && { v: i }) || {};
      }
    }
    return sheet;
  };

  describe('parse', () => {
    it('Should fail for invalid arguments', done => {
      workbookHelper
        .parse()
        .then(done.bind(null, 'should have failed'))
        .catch(error => {
          expect(error).not.toBeUndefined();
          done();
        })
        .catch(done);
    });

    it('Pass for simple file', done => {
      workbookHelper
        .parse(TEST_EXCEL_SIMPLE)
        .then(response => {
          expect(response).toMatchSnapshot();
          done();
        })
        .catch(done);
    });

    it('Pass for simple file with special char (* and ()) in column name', done => {
      workbookHelper
        .parse(TEST_EXCEL_SIMPLE)
        .then(response => {
          const sheet1 = response.Sheet1;
          expect(sheet1.data).toMatchSnapshot();
          done();
        })
        .catch(done);
    });
  });

  describe('addCommentsToWorkbook', () => {
    let wbMock;
    const comment = 'valar morghulis';
    const oldComment = 'Skoriot ñuhyz zaldrīzesse ilzi?';

    beforeEach(() => {
      wbMock = {
        Sheets: {
          sheet0: {
            '!ref': 'A1:B3',
            A1: { v: 'Phrase' },
            A2: { v: 'Hash yer ray tih zhavors chiorisi anni?' },
            A3: { v: 'Hash yer ray tih zhavors chiorisi anni?' },
            B1: { v: workbookHelper.COMMENT_COLUMN_TITLE },
            B2: { v: oldComment },
            B3: { v: oldComment },
          },
        },
      };
    });

    describe('given a new workboox', () => {
      it('should create a new column and update the sheet ref', () => {
        wbMock.Sheets.sheet0.B1.v = 'Name';
        wbMock.Sheets.sheet0.B2.v = 'Eric Cartman';

        const comments = { sheet0: { 2: [comment] } };
        workbookHelper.addCommentsToWorkbook(wbMock, comments);

        expect(wbMock.Sheets.sheet0['!ref']).toEqual('A1:C3');
        expect(wbMock.Sheets.sheet0.C1.v).toEqual(workbookHelper.COMMENT_COLUMN_TITLE);
        expect(wbMock.Sheets.sheet0.C2.v).toEqual(comment);
      });
    });

    describe('given multiple comments for the same row', () => {
      it('should concatenate the comments', () => {
        const comments = { sheet0: { 2: [comment, comment, comment] } };
        workbookHelper.addCommentsToWorkbook(wbMock, comments);

        expect(wbMock.Sheets.sheet0.B1.v).toEqual(workbookHelper.COMMENT_COLUMN_TITLE);
        expect(wbMock.Sheets.sheet0.B2.v).toEqual(`${comment} \n${comment} \n${comment}`);
      });
    });

    describe('given new comments', () => {
      it('should overwrite the existing comments', () => {
        const comments = { sheet0: { 2: [comment] } };
        workbookHelper.addCommentsToWorkbook(wbMock, comments);

        expect(wbMock.Sheets.sheet0.B1.v).toEqual(workbookHelper.COMMENT_COLUMN_TITLE);
        expect(wbMock.Sheets.sheet0.B2.v).toEqual(comment);
      });

      it('sheet should not have previous comments', () => {
        const comments = { sheet0: { 3: [comment] } };
        workbookHelper.addCommentsToWorkbook(wbMock, comments);

        expect(wbMock.Sheets.sheet0.B1.v).toEqual(workbookHelper.COMMENT_COLUMN_TITLE);
        expect(wbMock.Sheets.sheet0.B2.v).toEqual('');
        expect(wbMock.Sheets.sheet0.B3.v).toEqual(comment);
      });
    });
  });

  describe('highlight', () => {
    it('Should color hightlighed cells and rows', done => {
      workbookHelper
        .highlight(TEST_EXCEL_INVENTORY, CELLS)
        .then(workbook => {
          CELLS.forEach(cell => {
            const cellData = workbook.Sheets[cell.sheetName][workbookHelper.toExcelAddress(cell.column, cell.row)];
            expect(cellData.s).toEqual(workbookHelper.ERROR_BACKGROUND);
            expect(cellData.c[0].t).toEqual(ERROR_COMMENT);
            expect(cellData.c[0].r).toEqual(`<r><rPr><sz val="12"/><rFont val="Verdana"/><family val="2"/><charset val="1"/></rPr><t>${ERROR_COMMENT}</t></r>`);
            expect(cellData.c[0].h).toEqual(`<span style="">${ERROR_COMMENT}</span>`);
          });

          done();
        })
        .catch(done);
    });
  });

  describe('open/write', () => {
    it('Should open workbook from xlsx file', done => {
      workbookHelper
        .open(fs.readFileSync(TEST_EXCEL_SIMPLE))
        .then(workbook => {
          expect(workbook).not.toBeUndefined();
          done();
        })
        .catch(done);
    });

    it('Should save workbook', done => {
      const workbook = {
        SheetNames: ['Sheet1'],
        Sheets: [
          {
            Sheet1: [],
          },
        ],
      };

      workbookHelper
        .writeToFile(workbook, TEMP_EXCEL_FILE_PATH)
        .then(() => {
          fs.accessSync(TEMP_EXCEL_FILE_PATH);
          fs.unlinkSync(TEMP_EXCEL_FILE_PATH);
          done();
        })
        .catch(done);
    });
  });

  describe('fixSheetsRefs', () => {
    let wbMock;

    beforeEach(() => {
      wbMock = {
        SheetNames: ['sheet0'],
        Sheets: {
          sheet0: {
            '!ref': 'A1:C3',
            A1: { v: 'foo' },
            A2: { v: 'bar' },
            A3: { v: '' },
            B1: { v: 'baz' },
            B2: { v: 'qux' },
            B3: { v: '' },
            C1: { v: '' },
            C2: { v: '' },
            C3: { v: '' },
          },
        },
      };
    });

    describe('sheets with empty cells ', () => {
      it('should update the sheet ref', () => {
        workbookHelper.fixSheetsRefs(wbMock);
        expect(wbMock.Sheets.sheet0['!ref']).toEqual('A1:B2');
      });
    });
  });

  describe('findLastRowWithValue', () => {
    [
      [sheetBuilder(4, 0), null],
      [sheetBuilder(10, 3), 3],
      [sheetBuilder(10, 2), 2],
      [sheetBuilder(11, 2), 2],
      [sheetBuilder(11, 3), 3],
      [sheetBuilder(1, 1), 1],
      [sheetBuilder(10, 1), 1],
      [sheetBuilder(4, 2), 2],
    ].forEach(([sheet, expected]) => {
      it(`with ${JSON.stringify(sheet)} should return ${JSON.stringify(expected)}`, () => {
        expect(workbookHelper.findLastRowWithValue(sheet)).toEqual(expected);
      });
    });
  });

  describe('fixedRange', () => {
    [
      [{}, null],
      [sheetBuilder(3, 3, 3), { s: { r: 0, c: 0 }, e: { r: 2, c: 2 } }],
      [sheetBuilder(3, 1, 3), { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }],
    ].forEach(([sheet, expected]) => {
      it(`with ${JSON.stringify(sheet)} should return ${JSON.stringify(expected)}`, () => {
        expect(workbookHelper.fixedRange(sheet)).toEqual(expected);
      });
    });
  });
});
