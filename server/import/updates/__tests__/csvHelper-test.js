/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import path from 'path';
import { ImportMappersEntityTypes } from '../../../../common/enums/enums';
import { parseThirdPartyInventory } from '../csvHelper';
import { mappingFileHandlers } from '../mappingFileHandlers';

describe('csvHelper', () => {
  const getCsvFileInfo = fileName => {
    const originalName = fileName.indexOf(path.sep) > -1 ? fileName.split(path.sep)[1] : fileName;
    return {
      filePath: path.resolve(path.dirname(__dirname), '__tests__', 'resources', fileName),
      originalName,
    };
  };

  const parseIncomingFile = async fileNames => {
    const fileHandlers = mappingFileHandlers(fileNames.map(getCsvFileInfo));
    return await parseThirdPartyInventory({ tenantId: getUUID() }, { csvHandlers: fileHandlers });
  };

  describe('When multiple files of one type are received', () => {
    it('should sort them by alphabetical order before processing', () => {
      const fileNames = ['ResUnitAmenities_12890.csv', 'ResUnitAmenities_12883.csv', 'ResUnitStatus_12890.csv', 'ResUnitStatus_12883.csv'];
      const expectedFileNames = ['ResUnitAmenities_12883.csv', 'ResUnitAmenities_12890.csv', 'ResUnitStatus_12883.csv', 'ResUnitStatus_12890.csv'];
      const fileHandlers = mappingFileHandlers(fileNames.map(getCsvFileInfo));
      const handledFilenames = fileHandlers.map(fh => fh.originalName);
      expect(handledFilenames).toEqual(expectedFileNames);
    });
  });

  describe('when one incoming file has an error in a row', () => {
    it('should process the valid ones and ignore the file with problems', async () => {
      const { parsedImportUpdatesFiles, importUpdatesFilesWithErrors } = await parseIncomingFile([
        'unit-status/ResUnitStatus_5216.csv',
        'unit-amenities/MriUnitAmenities-initial.csv',
      ]);

      expect(parsedImportUpdatesFiles[ImportMappersEntityTypes.MriUnitAmenitiesMapper]).toBeDefined();
      expect(parsedImportUpdatesFiles[ImportMappersEntityTypes.UnitStatusMapper]).not.toBeDefined();

      expect(importUpdatesFilesWithErrors).toHaveLength(1);
      expect(importUpdatesFilesWithErrors[0].resultPrefix).toEqual(ImportMappersEntityTypes.UnitStatusMapper);
      expect(importUpdatesFilesWithErrors[0].hasError).toEqual(true);
      expect(importUpdatesFilesWithErrors[0].token).toEqual('PARSE_ERROR_AT_LINE_10');
    });
  });

  describe('when one incoming file has an error in a row', () => {
    it('should process the valid ones and ignore the file with problems', async () => {
      const { parsedImportUpdatesFiles, importUpdatesFilesWithErrors } = await parseIncomingFile([
        'unit-status/ResUnitStatus_5216.csv',
        'unit-amenities/MriUnitAmenities-initial.csv',
      ]);

      expect(parsedImportUpdatesFiles[ImportMappersEntityTypes.MriUnitAmenitiesMapper]).toBeDefined();
      expect(parsedImportUpdatesFiles[ImportMappersEntityTypes.UnitStatusMapper]).not.toBeDefined();

      expect(importUpdatesFilesWithErrors).toHaveLength(1);
      expect(importUpdatesFilesWithErrors[0].resultPrefix).toEqual(ImportMappersEntityTypes.UnitStatusMapper);
      expect(importUpdatesFilesWithErrors[0].hasError).toEqual(true);
      expect(importUpdatesFilesWithErrors[0].token).toEqual('PARSE_ERROR_AT_LINE_10');
    });
  });
});
