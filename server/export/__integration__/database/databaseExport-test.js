/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { parse } from '../../../helpers/workbook';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { spreadsheet, getSheetNames } from '../../../../common/helpers/spreadsheet';
import { exportFromDB, createWorkbookWithDataExported, getAllProperties } from '../../../workers/export/exportFromDB';
import { importTenantData } from '../../../workers/upload/uploadInventoryHandler.js';
import { updateTenant } from '../../../services/tenantService';
import { getSheetsAndColumnHeadersInTheImportOrder } from '../../helpers/export';

const SAVE_PATH = path.join(__dirname, 'InventoryExported.xlsx');

const getSomefakeNumbers = () => {
  const fakeNumberPrefix = '12025550';
  const numbers = Array.from(new Array(100).keys()).map(seq => `${fakeNumberPrefix}${seq + 100}`);
  return numbers.map(pNumber => ({ phoneNumber: pNumber }));
};

describe('Export database', () => {
  beforeEach(async () => {
    await updateTenant(tenant.id, {
      metadata: {
        ...tenant.metadata,
        phoneNumbers: getSomefakeNumbers(),
      },
    });

    await importTenantData({
      tenantId: tenant.id,
      inputWorkbookPath: path.join(__dirname, '../../../import/__tests__/resources/Inventory.xlsx'),
      removeInputFile: false,
      notifyDataChanged: false,
    });
  });

  it('should process the export for all properties and all sheets without issues', async () => {
    const { processed } = await exportFromDB({
      tenantId: tenant.id,
      authUser: '',
      properties: [],
      workbookSheets: [],
    });

    expect(processed).to.be.true;
  });

  it('should process the export for some sheets', async () => {
    const sheetNamesToExport = [
      spreadsheet.Property.workbookSheetName,
      spreadsheet.Inventory.workbookSheetName,
      spreadsheet.Layout.workbookSheetName,
      spreadsheet.Building.workbookSheetName,
    ];
    const properties = await getAllProperties({ tenantId: tenant.id });

    const { workbook: buffer, errors } = await createWorkbookWithDataExported({ tenantId: tenant.id }, sheetNamesToExport, properties);

    fs.writeFileSync(SAVE_PATH, buffer, 'binary');
    expect(fs.existsSync(SAVE_PATH)).to.equal(true);

    const exportedFile = await parse(SAVE_PATH, {
      cellStyles: true,
      cellHTML: false,
    });

    const sheetsExported = Object.keys(exportedFile);

    expect(sheetNamesToExport.length).to.equal(sheetsExported.length);
    expect(errors).to.equal(null);
    fs.unlinkSync(SAVE_PATH); // Remove file after testing
  });

  it('should create an excel file with the data exported and import it again', async () => {
    const workbookSheets = getSheetNames(Object.values(spreadsheet));
    const properties = await getAllProperties({ tenantId: tenant.id });
    const { workbook: buffer, errors } = await createWorkbookWithDataExported({ tenantId: tenant.id }, workbookSheets, properties);

    fs.writeFileSync(SAVE_PATH, buffer, 'binary');
    expect(fs.existsSync(SAVE_PATH)).to.equal(true);

    const exportedFile = await parse(SAVE_PATH, {
      cellStyles: true,
      cellHTML: false,
    });

    const sheetsExported = Object.keys(exportedFile);

    expect(workbookSheets.length).to.equal(sheetsExported.length);
    expect(errors).to.equal(null);

    const { processed } = await importTenantData({
      tenantId: tenant.id,
      inputWorkbookPath: SAVE_PATH,
      removeInputFile: false,
      notifyDataChanged: false,
    });

    expect(processed).to.be.true;

    fs.unlinkSync(SAVE_PATH); // Remove file after testing
  });

  it('should export database with the sheets and column headers in the same order that the file imported', async () => {
    const workbookSheets = getSheetNames(Object.values(spreadsheet));

    const properties = await getAllProperties({ tenantId: tenant.id });

    const { workbook: buffer, errors } = await createWorkbookWithDataExported({ tenantId: tenant.id }, workbookSheets, properties);

    fs.writeFileSync(SAVE_PATH, buffer, 'binary');
    expect(fs.existsSync(SAVE_PATH)).to.equal(true);

    const exportedFile = await parse(SAVE_PATH, {
      cellStyles: true,
      cellHTML: false,
    });

    const sheetsWithColumnHeadersImported = await getSheetsAndColumnHeadersInTheImportOrder(workbookSheets);

    const sheetsWithColumnHeadersExported = Object.keys(exportedFile).map(sheetName => ({
      sheetName,
      columnHeaders: exportedFile[sheetName].columnHeaders,
    }));

    expect(sheetsWithColumnHeadersExported).to.eql(sheetsWithColumnHeadersImported);
    expect(errors).to.equal(null);
    fs.unlinkSync(SAVE_PATH); // Remove file after testing
  });
});
