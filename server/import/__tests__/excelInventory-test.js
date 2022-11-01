/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getEntitiesFromSheet, processWorkbook, enforceInventoryFileNameAndEnvironmentInProd } from '../excelInventory';

const DUMMY_JSON_WORKBOOK = {
  sheet: {
    data: [
      {
        name: 'Name',
        type: 'Type',
      },
      {
        name: 'Another Name',
        type: 'Another Type',
      },
    ],
    columnHeaders: ['name', 'type'],
  },
};

const DUMMY_ENTITIES = [
  {
    index: 1,
    data: {
      name: 'Name',
      type: 'Type',
    },
  },
  {
    index: 2,
    data: {
      name: 'Another Name',
      type: 'Another Type',
    },
  },
];

const DUMMY_SHEET_OBJECT = [
  {
    workbookSheetName: 'sheet',
    headers: [
      { header: 'name', type: 'string' },
      { header: 'type', type: 'string' },
    ],
    getEntities() {
      return DUMMY_ENTITIES;
    },
    importEntities() {
      return {
        invalidFields: [
          {
            index: 2,
            invalidFields: [
              {
                name: 'type',
                message: 'ERROR',
              },
            ],
          },
        ],
      };
    },
  },
];

describe('Excel Inventory', () => {
  describe('Get Entities from row', () => {
    it('should use internal function to transform entities', async () => {
      const entities = getEntitiesFromSheet(DUMMY_JSON_WORKBOOK.sheet.data, 0, 2, row => ({
        name: row.name,
        type: row.type,
      }));
      expect(entities).toBeDefined();
      expect(entities.length).toEqual(DUMMY_ENTITIES.length);
      expect(entities).toEqual(DUMMY_ENTITIES);
    });
  });

  describe('Process Workbook', () => {
    it('should process a workbook and get invalid cell values', async () => {
      const { invalidCells, entityCounts } = await processWorkbook(null, DUMMY_JSON_WORKBOOK, DUMMY_SHEET_OBJECT);
      expect(invalidCells).toBeDefined();
      const invalidCellResultExpected = {
        column: 1,
        row: 2,
        sheetName: 'sheet',
        fieldName: 'type',
        comment: 'ERROR',
      };
      expect(invalidCells[0]).toEqual(invalidCellResultExpected);

      expect(entityCounts).toBeDefined();
      expect(entityCounts.length).toEqual(1);
      expect(entityCounts[0].sheetName).toEqual(DUMMY_SHEET_OBJECT[0].workbookSheetName);
      expect(entityCounts[0].count).toEqual(2);
    });
  });

  describe('Ensure inventory fileName is used in Prod', () => {
    [
      {
        filePath: '/dev/redisrupt/red/baseline.xlsx',
        tenantName: 'maximus',
        throwError: true,
      },
      {
        filePath: '/dev/redisrupt/red/maximus-baseline.xlsx',
        tenantName: 'max',
        throwError: true,
      },
      {
        filePath: '/dev/redisrupt/red/maximus-baseline.xlsx',
        tenantName: 'maximus',
        throwError: true,
      },
      {
        filePath: '/dev/redisrupt/red/maximus baseline.xlsx',
        tenantName: 'maximus',
        throwError: true,
      },
      {
        filePath: '/dev/redisrupt/red/Maximus Staging - Cove+Serenity+Wood+Parkmerced+Sharon Green+Shore.xlsx',
        tenantName: 'maximus',
        throwError: true,
      },
      {
        filePath: '/dev/redisrupt/red/Maximus Prod - Cove+Serenity+Wood+Parkmerced+Sharon Green+Shore.xlsx',
        tenantName: 'maximus',
        throwError: false,
      },
      {
        filePath: 'CUSTOMEROLD Staging - Commons-Landing+Chateau+South Pointe+Plaza.xlsx',
        tenantName: 'customerold',
        throwError: true,
      },
      {
        filePath: 'customerold-sal prod - Commons-Landing+Chateau+South Pointe+Plaza.xlsx',
        tenantName: 'customerold-sal',
        throwError: false,
      },
      {
        filePath: 'customerold-sal.xlsx',
        tenantName: 'customerold-sal',
        throwError: true,
      },
      {
        filePath: 'customerold-sal prod.xlsx',
        tenantName: 'customerold-sal',
        throwError: false,
      },
    ].forEach(({ filePath, tenantName, throwError }) => {
      it(`Should ${throwError ? 'not' : ''} process workbook`, () => {
        const assertion = expect(() => enforceInventoryFileNameAndEnvironmentInProd(filePath, tenantName));
        !throwError && assertion.not.toThrow();
        throwError && assertion.toThrow(`Spreadsheets uploaded must have the prefix: ${tenantName} Prod`);
      });
    });
  });
});
