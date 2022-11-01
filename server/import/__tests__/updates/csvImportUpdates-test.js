/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { del } from '../../../../common/helpers/xfs';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);
import newId from 'uuid/v4';
import path from 'path';

describe('CSV Import Updates', () => {
  let processFiles;
  const TENANT_ID = newId();
  const PROCESS_FILE_CONF = {
    tempFolder: path.join(__dirname, 'resources/'),
  };

  const tenant = {
    settings: {
      customImport: {
        residentLegalStipColumn: 'General_Info_12',
      },
    },
  };

  const properties = {
    rows: [
      { name: 'lark', externalId: 'lark', timezone: 'America/Los_Angeles' },
      { name: 'cove', externalId: 'cove', timezone: 'America/Los_Angeles' },
    ],
  };

  const defaultMocks = () => ({
    updateInventory: jest.fn(() => {}),
    updateResidents: jest.fn(() => {}),
    updateRoommates: jest.fn(() => {}),
    getTenant: jest.fn(() => tenant),
    rawStatement: jest.fn(() => properties),
    getTimezoneByPropertyColumn: jest.fn(() => 'America/Los_Angeles'),
    getPropertiesToImport: jest.fn(() => [
      { externalId: 'lark', timezone: 'America/Los_Angeles' },
      { externalId: 'cove', timezone: 'America/Los_Angeles' },
    ]),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../updates/updatesHandler': {
        updateInventory: mocks.updateInventory,
        updateResidents: mocks.updateResidents,
        updateRoommates: mocks.updateRoommates,
      },
      '../../updates/updatesHelper': {
        getTimezoneByPropertyColumn: mocks.getTimezoneByPropertyColumn,
      },
      '../../../workers/importActiveLeases/importActiveLeasesHandler': {
        getPropertiesToImport: mocks.getPropertiesToImport,
      },
      '../../../services/tenantService': {
        getTenant: mocks.getTenant,
      },
      '../../../database/factory': {
        rawStatement: mocks.rawStatement,
      },
    });
    const csvImportUpdates = require('../../updates/csvImportUpdates'); // eslint-disable-line global-require
    processFiles = csvImportUpdates.processFiles;
  };

  describe('processFiles', () => {
    let mocks;

    it('Should call updateInventory when there is row to update', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      const files = [
        {
          originalName: 'ResUnitStatus_304.Csv',
          filePath: path.join(__dirname, 'resources/ResUnitStatus_304.Csv'),
        },
        {
          originalName: 'ResManageRentableItems_304.Csv',
          filePath: path.join(__dirname, 'resources/ResManageRentableItems_304.Csv'),
        },
        {
          originalName: 'ResTenants_304.csv',
          filePath: path.join(__dirname, 'resources/ResTenants_304.csv'),
        },
        {
          originalName: 'ResRoommates_304.csv',
          filePath: path.join(__dirname, 'resources/ResRoommates_304.csv'),
        },
      ];
      const result = await processFiles({ tenantId: TENANT_ID }, files, {}, PROCESS_FILE_CONF);

      expect(mocks.updateInventory.mock.calls.length).toBe(1);

      // remove generated files
      if (result && result.resultFiles) {
        const temporalFiles = Object.keys(result.resultFiles).reduce((acc, item) => {
          acc.push({ filePath: result.resultFiles[item] });
          return acc;
        }, []);
        await del(temporalFiles.map(f => f.filePath));
      }
    }, 10000);

    xit('should process two yardi files with more than 40K rows in less than 5 seconds', async () => {
      jest.resetModules();
      const updateInventoryMock = jest.fn(() => {});
      mockModules({
        '../../../dal/inventoryRepo.js': {
          updateInventory: updateInventoryMock,
          getInventoryByExternalId: jest.fn(() => {}),
          getInventoriesByExternalId: jest.fn((ctx, externalIds) => externalIds.map(externalId => ({ id: newId(), externalId }))),
          bulkUpsertInventories: jest.fn(() => {}),
        },
      });
      const csvImportUpdates = require('../../updates/csvImportUpdates'); // eslint-disable-line global-require
      processFiles = csvImportUpdates.processFiles;

      const files = [
        {
          originalName: 'ResUnitStatus_3305.csv',
          filePath: path.join(__dirname, 'resources/ResUnitStatus_3305.csv'),
        },
      ];

      const lastUploads = {};
      await processFiles({ tenantId: TENANT_ID }, files, lastUploads, PROCESS_FILE_CONF);
    }, 5000);
  });
});
