/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import diff from 'deep-diff';
import path from 'path';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { updateTenant } from '../../services/tenantService';
import { importTenantData } from '../../workers/upload/uploadInventoryHandler.js';
import loggerModule from '../../../common/helpers/logger';
import { parse } from '../../helpers/workbook';

const logger = loggerModule.child({ subType: 'import' });

/*
In case you want to test specific sheets the array should be like:
const testSheets = ['Business Entities', 'Concessions'];
*/

const getSomefakeNumbers = () => {
  const fakeNumberPrefix = '12025550';
  const numbers = Array.from(new Array(100).keys()).map(seq => `${fakeNumberPrefix}${seq + 100}`);
  return numbers.map(pNumber => ({ phoneNumber: pNumber }));
};

describe('Excel Data Import', () => {
  it('should process the import file and get the output result equal to the baseline', async () => {
    const testFilePath = path.join(__dirname, '../__tests__/resources/Inventory.xlsx');
    const ctx = { tenantId: tenant.id };

    // make sure we have enough phone numbers for all teams
    await updateTenant(ctx.tenantId, {
      metadata: {
        ...tenant.metadata,
        phoneNumbers: getSomefakeNumbers(),
      },
    });

    // in tests we don't send the message to AMPQ since this mess things up with setupTestGlobalContext
    const { processed, invalidCells = [] } = await importTenantData({
      tenantId: tenant.id,
      inputWorkbookPath: testFilePath,
      removeInputFile: false,
      notifyDataChanged: false,
    });

    expect(processed).to.be.true;
    expect(invalidCells, 'There should be no invalid cells').to.have.length(0);
    if (invalidCells.length > 0) {
      logger.error({ invalidCells }, 'ERROR: Invalid cells found');
    }

    const baselineFile = await parse('baseline.xlsx', {
      cellStyles: true,
      cellHTML: false,
    });
    const outputFile = await parse(testFilePath, {
      cellStyles: true,
      cellHTML: false,
    });

    const diffResult = diff(baselineFile, outputFile);

    if (diffResult) {
      logger.error({ diffResult }, 'ERROR: baselineFile and outputFile are different');
    }

    expect(diffResult).to.be.undefined;

    const testFileWithDateCellWithTypeNumber = path.join(__dirname, './resources/programs_with_date_cell_type_number.xlsx');
    const { invalidCells: invalidPrograms = [] } = await importTenantData({
      tenantId: tenant.id,
      inputWorkbookPath: testFileWithDateCellWithTypeNumber,
      removeInputFile: false,
      notifyDataChanged: false,
    });

    expect(invalidPrograms.length).to.equal(0);
  });

  it('should be equals the Inventory_without_spaces.xlsx and Inventory_with_spaces.xlsx', async () => {
    const testFilePath = path.join(__dirname, '../__tests__/resources/Inventory_without_spaces.xlsx');
    const testFilePathWithSpaces = path.join(__dirname, '../__tests__/resources/Inventory_with_spaces.xlsx');

    const outputFile = await parse(testFilePath, {
      cellStyles: true,
      cellHTML: false,
    });

    const outputFileWithSpaces = await parse(testFilePathWithSpaces, {
      cellStyles: true,
      cellHTML: false,
    });

    const diffResult = diff(outputFile, outputFileWithSpaces);
    if (diffResult) {
      logger.error({ diffResult }, 'ERROR: outputFile and outputFileWithSpaces are different');
    }
    expect(diffResult).to.be.undefined;
  });
});
