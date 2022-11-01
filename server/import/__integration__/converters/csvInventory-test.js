/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import diff from 'deep-diff';
import path from 'path';
import fs from 'fs';
import { processFiles } from '../../converters/csvInventory';
import { mappingConverters } from '../../converters/mappingConverters';
import sleep from '../../../../common/helpers/sleep';
import loggerModule from '../../../../common/helpers/logger';
import { parse } from '../../../helpers/workbook';

const logger = loggerModule.child({ subType: 'converter' });

const mapCsvToSetting = filePath => ({
  originalName: path.basename(filePath),
  filePath,
});

const SAVE_PATH = path.join(__dirname, 'resources/inventory');
const XLSX_EXTENSION = '.xlsx';
const BASEFILE_CONVERSION_PATH = path.join(__dirname, 'resources/InventoryBase.xlsx');
const BASELINE_PATH_FOR_BASEFILE_CONVERSION = path.join(__dirname, 'resources/baseline-inventorybase.xlsx');
const BASELINE_PATH = path.join(__dirname, 'resources/baseline.xlsx');
const BASELINE_PATH_FOR_SINGLE_SHEET = path.join(__dirname, 'resources/baseline-single-sheet.xlsx');
const BASELINE_PATH_FOR_NO_RESRENTALABLEITEMSTYPE = path.join(__dirname, 'resources/baseline-no-resrentableitemstypes.xlsx');
const BASELINE_PATH_FOR_RESRENTABLEITEMS_SOLO = path.join(__dirname, 'resources/baseline-resrentableitems-solo.xlsx');
const BASELINE_PATH_FOR_COMMUNITS_RESUNITAMENITIES = path.join(__dirname, 'resources/baseline-communits-resunitamenities.xlsx');
const BASELINE_PATH_FOR_RESRENTABLEITEMS_RESUNITAMENITIES = path.join(__dirname, 'resources/baseline-resrentableitems-resunitamenities.xlsx');
const TEST_TIMEOUT_BEFORE_VERIFY_FILES = 0; // It seems it just need to run on the next tick to work
const TEST_TIMEOUT = 14000;

describe('CSV Inventory Converter', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-1${XLSX_EXTENSION}`;
  it(
    'Should create an excel file from csv files',
    async () => {
      const fileSettings = [
        mapCsvToSetting(path.join(__dirname, 'resources/CommProperties_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/CommBuildings_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResPropertyAmenities_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResAgentNames_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResUnitTypes_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResRentableItemsTypes_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/CommUnits_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResUnitAmenities_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResRentableItems_304.Csv')),
      ];

      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings);
      fs.writeFileSync(LOCAL_SAVE_PATH, buffer, 'binary');

      expect(fs.existsSync(LOCAL_SAVE_PATH)).to.equal(true);

      // why is this needed I'm not really that sure, but
      // it has to be with the file existing in the filesystem
      // somehow mocha was not having this issue, but jest does
      // it might be because jest attempt to execute tests
      // with maximum concurrency
      await sleep(TEST_TIMEOUT_BEFORE_VERIFY_FILES);
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel content must to be equal to the baseline',
    async () => {
      const baselineFile = await parse(BASELINE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });
      const outputFile = await parse(LOCAL_SAVE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });

      const diffResult = diff(baselineFile, outputFile);

      if (diffResult) {
        logger.error({ diffResult }, 'ERROR: baseline and output are different in the csv converter');
      }

      expect(diffResult).to.be.undefined;
      fs.unlinkSync(LOCAL_SAVE_PATH); // Remove file after testing
    },
    TEST_TIMEOUT,
  );
});

describe('CSV Inventory Converter', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-2${XLSX_EXTENSION}`;
  it(
    'Should create an excel file from csv files which only bind a single sheet(ResUnitTypes_304 file was not included since it binds inventory groups and layout sheet)',
    async () => {
      const fileSettings = [
        mapCsvToSetting(path.join(__dirname, 'resources/CommProperties_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/CommBuildings_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResPropertyAmenities_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResAgentNames_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResRentableItemsTypes_304.Csv')),
      ];

      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings);
      fs.writeFileSync(LOCAL_SAVE_PATH, buffer, 'binary');
      expect(fs.existsSync(LOCAL_SAVE_PATH)).to.equal(true);

      await sleep(TEST_TIMEOUT_BEFORE_VERIFY_FILES);
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel content must to be equal to the baseline',
    async () => {
      const baselineFile = await parse(BASELINE_PATH_FOR_SINGLE_SHEET, {
        cellStyles: true,
        cellHTML: false,
      });
      const outputFile = await parse(LOCAL_SAVE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });

      const diffResult = diff(baselineFile, outputFile);

      if (diffResult) {
        logger.error({ diffResult }, 'ERROR: baseline and output are different in the csv converter');
      }

      expect(diffResult).to.be.undefined;
      fs.unlinkSync(LOCAL_SAVE_PATH); // Remove file after testing
    },
    TEST_TIMEOUT,
  );
});

describe('CSV Inventory Converter', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-3${XLSX_EXTENSION}`;
  it(
    'Should create an excel file from csv files (ResRentableItemsTypes_304 file is not include in this scenario)',
    async () => {
      const fileSettings = [
        mapCsvToSetting(path.join(__dirname, 'resources/CommProperties_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/CommBuildings_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResPropertyAmenities_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResAgentNames_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResUnitTypes_304.Csv')),
      ];

      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings);
      fs.writeFileSync(LOCAL_SAVE_PATH, buffer, 'binary');
      expect(fs.existsSync(LOCAL_SAVE_PATH)).to.equal(true);
      await sleep(TEST_TIMEOUT_BEFORE_VERIFY_FILES);
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel content must to be equal to the baseline',
    async () => {
      const baselineFile = await parse(BASELINE_PATH_FOR_NO_RESRENTALABLEITEMSTYPE, { cellStyles: true, cellHTML: false });
      const outputFile = await parse(LOCAL_SAVE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });

      const diffResult = diff(baselineFile, outputFile);

      if (diffResult) {
        logger.error({ diffResult }, 'ERROR: baseline and output are different in the csv converter');
      }

      expect(diffResult).to.be.undefined;
      fs.unlinkSync(LOCAL_SAVE_PATH); // Remove file after testing
    },
    TEST_TIMEOUT,
  );
});

describe('CSV Inventory Converter', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-4${XLSX_EXTENSION}`;
  it(
    'Should create an xlsx file with Inventory sheet using only ResRentableItems_304.csv file',
    async () => {
      const fileSettings = [mapCsvToSetting(path.join(__dirname, 'resources/ResRentableItems_304.Csv'))];
      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings);
      fs.writeFileSync(LOCAL_SAVE_PATH, buffer, 'binary');
      expect(fs.existsSync(LOCAL_SAVE_PATH)).to.equal(true);

      await sleep(TEST_TIMEOUT_BEFORE_VERIFY_FILES);
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel content must to be equal to the baseline',
    async () => {
      const baselineFile = await parse(BASELINE_PATH_FOR_RESRENTABLEITEMS_SOLO, { cellStyles: true, cellHTML: false });
      const outputFile = await parse(LOCAL_SAVE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });

      const diffResult = diff(baselineFile, outputFile);

      if (diffResult) {
        logger.error({ diffResult }, 'ERROR: baseline and output are different in the csv converter');
      }

      expect(diffResult).to.be.undefined;
      fs.unlinkSync(LOCAL_SAVE_PATH); // Remove file after testing
    },
    TEST_TIMEOUT,
  );
});

describe('CSV Inventory Converter', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-5${XLSX_EXTENSION}`;
  it(
    'Should not create an xlsx file because it is using ResUnitAmenities_304.csv file which is a child mapper of CommUnits mapper',
    async () => {
      const fileSettings = [mapCsvToSetting(path.join(__dirname, 'resources/ResUnitAmenities_304.Csv'))];
      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings);
      expect(buffer).to.not.exist;
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel does not exists',
    () => {
      const fileExists = fs.existsSync(LOCAL_SAVE_PATH);
      expect(fileExists).to.be.equal(false);
    },
    TEST_TIMEOUT,
  );
});

describe('CSV Inventory Converter', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-6${XLSX_EXTENSION}`;
  it(
    'Should create an xlsx file with Inventory sheet using CommUnits_304.csv and ResUnitAmenities_304.csv files',
    async () => {
      const fileSettings = [
        mapCsvToSetting(path.join(__dirname, 'resources/CommUnits_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResUnitAmenities_304.Csv')),
      ];
      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings);
      fs.writeFileSync(LOCAL_SAVE_PATH, buffer, 'binary');
      expect(fs.existsSync(LOCAL_SAVE_PATH)).to.equal(true);

      await sleep(TEST_TIMEOUT_BEFORE_VERIFY_FILES);
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel content must to be equal to the baseline',
    async () => {
      const baselineFile = await parse(BASELINE_PATH_FOR_COMMUNITS_RESUNITAMENITIES, { cellStyles: true, cellHTML: false });
      const outputFile = await parse(LOCAL_SAVE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });

      const diffResult = diff(baselineFile, outputFile);

      if (diffResult) {
        logger.error({ diffResult }, 'ERROR: baseline and output are different in the csv converter');
      }

      expect(diffResult).to.be.undefined;
      fs.unlinkSync(LOCAL_SAVE_PATH); // Remove file after testing
    },
    TEST_TIMEOUT,
  );
});

describe('CSV Inventory Converter', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-7${XLSX_EXTENSION}`;
  it(
    'Should create an xlsx file with Inventory sheet using ResRentableItems_304.csv and ResUnitAmenities_304.csv files',
    async () => {
      const fileSettings = [
        mapCsvToSetting(path.join(__dirname, 'resources/ResRentableItems_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResUnitAmenities_304.Csv')),
      ];
      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings);
      fs.writeFileSync(LOCAL_SAVE_PATH, buffer, 'binary');
      expect(fs.existsSync(LOCAL_SAVE_PATH)).to.equal(true);

      await sleep(TEST_TIMEOUT_BEFORE_VERIFY_FILES);
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel content must to be equal to the baseline',
    async () => {
      const baselineFile = await parse(BASELINE_PATH_FOR_RESRENTABLEITEMS_RESUNITAMENITIES, { cellStyles: true, cellHTML: false });
      const outputFile = await parse(LOCAL_SAVE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });

      const diffResult = diff(baselineFile, outputFile);

      if (diffResult) {
        logger.error({ diffResult }, 'ERROR: baseline and output are different in the csv converter');
      }

      expect(diffResult).to.be.undefined;
      fs.unlinkSync(LOCAL_SAVE_PATH); // Remove file after testing
    },
    TEST_TIMEOUT,
  );
});

describe('CSV Inventory Converter using base file', () => {
  const LOCAL_SAVE_PATH = `${SAVE_PATH}-1${XLSX_EXTENSION}`;
  it(
    'Should create an excel file from csv files',
    async () => {
      const fileSettings = [
        mapCsvToSetting(path.join(__dirname, 'resources/CommBuildings_304.Csv')),
        mapCsvToSetting(path.join(__dirname, 'resources/ResPropertyAmenities_304.Csv')),
      ];

      const converterSettings = mappingConverters(fileSettings);
      const buffer = await processFiles(converterSettings, BASEFILE_CONVERSION_PATH);
      fs.writeFileSync(LOCAL_SAVE_PATH, buffer, 'binary');

      expect(fs.existsSync(LOCAL_SAVE_PATH)).to.equal(true);

      // why is this needed I'm not really that sure, but
      // it has to be with the file existing in the filesystem
      // somehow mocha was not having this issue, but jest does
      // it might be because jest attempt to execute tests
      // with maximum concurrency
      await sleep(TEST_TIMEOUT_BEFORE_VERIFY_FILES);
    },
    TEST_TIMEOUT,
  );

  it(
    'Should verify the excel content must be equal to the InventoryBase',
    async () => {
      const baselineFile = await parse(BASELINE_PATH_FOR_BASEFILE_CONVERSION, { cellStyles: true, cellHTML: false });
      const outputFile = await parse(LOCAL_SAVE_PATH, {
        cellStyles: true,
        cellHTML: false,
      });

      const diffResult = diff(baselineFile, outputFile);

      if (diffResult) {
        logger.error({ diffResult }, 'ERROR: InventoryBase and output are different in the csv converter');
      }

      expect(diffResult).to.be.undefined;
      fs.unlinkSync(LOCAL_SAVE_PATH); // Remove file after testing
    },
    TEST_TIMEOUT,
  );
});
