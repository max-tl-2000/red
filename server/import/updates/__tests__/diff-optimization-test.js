/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import path from 'path';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { DATE_US_FORMAT, LA_TIMEZONE } from '../../../../common/date-constants';
import { parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { ImportMappersEntityTypes } from '../../../../common/enums/enums';
import { parseThirdPartyInventory, getPreviousUpdate } from '../csvHelper';
import { mappingFileHandlers } from '../mappingFileHandlers';
import { getUpdatedInventory } from '../updatesHandler';

const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

describe('diff-optimization', () => {
  const parseMockCurrentDate = mockDate => parseAsInTimezone(mockDate, { format: DATE_US_FORMAT, timezone: LA_TIMEZONE }).startOf('day');

  const getCsvFileInfo = fileName => {
    const originalName = fileName.indexOf(path.sep) > -1 ? fileName.split(path.sep)[1] : fileName;
    return {
      filePath: path.resolve(path.dirname(__dirname), '__tests__', 'resources', fileName),
      originalName,
    };
  };

  const parseIncomingFile = async (entityType, fileName) => {
    const incomingFile = getCsvFileInfo(fileName);
    const fileHandlers = mappingFileHandlers([incomingFile]);
    const { parsedImportUpdatesFiles: inventory } = await parseThirdPartyInventory({ tenantId: getUUID() }, { csvHandlers: fileHandlers });
    return inventory[entityType];
  };

  describe('notifyUpdatesHandler', () => {
    let getUpdatedUnitAmenities;
    const getMocks = (currentDate, propertiesWithRmsSetting = []) => ({
      now: jest.fn(() => currentDate.clone()),
      parseAsInTimezone: jest.fn((evt, handler) => {
        if (!evt) return currentDate.startOf('day');
        return parseAsInTimezone(evt, handler);
      }),
      getRowsProperties: jest.fn(),
      getPropertyByNameIndex: jest.fn((evt, handler) => ({
        timezone: LA_TIMEZONE,
        settings: {
          integration: {
            import: {
              unitPricing: !!propertiesWithRmsSetting.includes(handler.row[0]),
            },
          },
        },
      })),
    });

    const setupMocks = mocks => {
      jest.resetModules();
      mockModules({
        '../updatesHelper': {
          getRowsProperties: mocks.getRowsProperties,
          getPropertyByNameIndex: mocks.getPropertyByNameIndex,
        },
        '../../../../common/helpers/moment-utils': {
          now: mocks.now,
          parseAsInTimezone: mocks.parseAsInTimezone,
        },
      });
      const notifyUpdatesHandler = require('../notifyUpdatesHandler'); // eslint-disable-line global-require
      getUpdatedUnitAmenities = notifyUpdatesHandler.getUpdatedUnitAmenities;
    };

    const processIncomingMriUnitAmenitiesFile = async (mockDate, { incomingFileName, propertiesWithRmsSetting = [], prevFileName = '' }) => {
      const mocks = getMocks(parseMockCurrentDate(mockDate), propertiesWithRmsSetting);
      setupMocks(mocks);

      const entityType = ImportMappersEntityTypes.MriUnitAmenitiesMapper;
      const { buffer: incomingRecords, resultHeaders } = await parseIncomingFile(entityType, `unit-amenities/${incomingFileName}`);

      let previousContent = [];
      if (prevFileName) {
        const { filePath } = getCsvFileInfo(`unit-amenities/${prevFileName}`);
        previousContent = await getPreviousUpdate(filePath);
      }

      return await getUpdatedUnitAmenities(getUUID(), {
        actual: incomingRecords,
        previous: previousContent,
        headers: resultHeaders,
        entityType,
      });
    };

    describe('when there is not any previous MriUnitAmenities file', () => {
      describe('and one property (externalid: 11190) has set LRO pricing', () => {
        it('should return 1 record associated to the property 11500', async () => {
          const unitAmenitites = await processIncomingMriUnitAmenitiesFile('08/29/2018', {
            incomingFileName: 'MriUnitAmenities-initial.csv',
            propertiesWithRmsSetting: ['11190'],
          });

          expect(unitAmenitites).toHaveLength(1);
          expect(unitAmenitites[0].propertyExternalId).toEqual('11500');
        });
      });

      describe('and there is no properties with LRO pricing', () => {
        it('should return 2 records associated to the properties 11500 and 11190', async () => {
          const unitAmenitites = await processIncomingMriUnitAmenitiesFile('08/29/2018', {
            incomingFileName: 'MriUnitAmenities-initial.csv',
          });

          expect(unitAmenitites).toHaveLength(2);
          expect(unitAmenitites.every(({ propertyExternalId }) => ['11500', '11190'].includes(propertyExternalId))).toEqual(true);
        });
      });
    });

    describe('when there is a previous MriUnitAmenities file', () => {
      describe('and the incoming file is the same', () => {
        it('should return zero records associated', async () => {
          const unitAmenitites = await processIncomingMriUnitAmenitiesFile('08/29/2018', {
            incomingFileName: 'MriUnitAmenities-initial.csv',
            prevFileName: 'MriUnitAmenities-previous.csv',
          });

          expect(unitAmenitites).toHaveLength(0);
        });
      });

      describe('and the incoming file has added, modified and deleted records', () => {
        it('should return only added and modified records', async () => {
          const unitAmenitites = await processIncomingMriUnitAmenitiesFile('08/29/2018', {
            incomingFileName: 'MriUnitAmenities-added-modified-deleted-records.csv',
            prevFileName: 'MriUnitAmenities-previous.csv',
          });

          expect(unitAmenitites).toHaveLength(2);
          expect(unitAmenitites.every(({ description }) => ['added', 'modified'].includes(description))).toEqual(true);
        });
      });
    });
  });

  describe('updatesHandler', () => {
    const initialExternalIds = ['100-0101', '100-0102', '100-0103', '100-0104', '001-BARB', '001-CAPT', '001-CHAN', '001-SALT'];

    const processIncomingUnitStatusFile = async ({ incomingFileName, prevFileName = '' }) => {
      const entityType = ImportMappersEntityTypes.UnitStatusMapper;
      const { buffer: incomingRecords, resultHeaders } = await parseIncomingFile(entityType, `unit-status/${incomingFileName}`);

      let previousContent = [];
      if (prevFileName) {
        const { filePath } = getCsvFileInfo(`unit-status/${prevFileName}`);
        previousContent = await getPreviousUpdate(filePath);
        previousContent.map((row, i) => previousContent[i].push(`${row[1]}-${row[2]}`));
      }
      return await getUpdatedInventory(
        { tenantId: getUUID() },
        {
          actual: incomingRecords,
          previous: previousContent,
          headers: resultHeaders,
        },
      );
    };

    describe('when there is not any previous RestUnitstatus file', () => {
      it('should return all the incoming records in the file', async () => {
        const unitStatuses = await processIncomingUnitStatusFile({
          incomingFileName: 'ResUnitStatus-initial.csv',
        });

        expect(unitStatuses).toHaveLength(8);
        expect(initialExternalIds.every(id => unitStatuses.some(unit => unit.externalId === id))).toEqual(true);
        expect(unitStatuses.find(({ externalId }) => externalId === '100-0101').state).toEqual(DALTypes.InventoryState.OCCUPIED_NOTICE);
      });
    });

    describe('when there is a previous RestUnitstatus file', () => {
      describe('and the incoming file is the same', () => {
        it('should return zero records associated', async () => {
          const unitStatuses = await processIncomingUnitStatusFile({
            incomingFileName: 'ResUnitStatus-initial.csv',
            prevFileName: 'inventory-previous.csv',
          });

          expect(unitStatuses).toHaveLength(0);
        });
      });

      describe('and the incoming file has added, modified and deleted records', () => {
        it('should return only added and modified records', async () => {
          const unitStatuses = await processIncomingUnitStatusFile({
            incomingFileName: 'ResUnitStatus-added-modified-deleted-records.csv',
            prevFileName: 'inventory-previous.csv',
          });

          const modifiedIds = ['100-0101'];
          const addedIds = ['001-XXXX'];
          const ids = [...addedIds, ...modifiedIds];
          expect(unitStatuses).toHaveLength(ids.length);
          expect(ids.every(id => unitStatuses.some(unit => unit.externalId === id))).toEqual(true);
          expect(unitStatuses.find(({ externalId }) => externalId === modifiedIds[0]).state).toEqual(DALTypes.InventoryState.VACANT_READY_RESERVED);
        });
      });
    });
  });
});
