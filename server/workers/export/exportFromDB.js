/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import XLSX from '@redisrupt/xlsx';
import { Group } from '@redisrupt/datapumps';
import loggerModule from '../../../common/helpers/logger';
import { createJob, updateJob } from '../../services/jobs';
import { DALTypes } from '../../../common/enums/DALTypes';
import { createExcelFile, saveWorkbook, uploadWorkbookToS3 } from '../../import/helpers/workbook';
import { getProperties } from '../../dal/propertyRepo';
import { spreadsheet, getSheetNames } from '../../../common/helpers/spreadsheet';
import { excelHandlerMixin } from '../../import/converters/excelHandlerMixin';
import { createBufferFromArr } from '../../import/helpers/converters';
import { getSheetsAndColumnHeadersInTheImportOrder } from '../../export/helpers/export';
import { exportDataByWorkbookSheet } from '../../export/database/export';
import { getTenantData } from '../../dal/tenantsRepo';

const logger = loggerModule.child({ subType: 'exportFromDB' });

const DIRECTORY = 'exportation';

const configurePump = (etl, workbook, setting) => {
  const buffer = createBufferFromArr(setting);
  const pump = etl.addPump(setting.sheetName);
  pump
    .from(buffer)
    .mixin(excelHandlerMixin())
    .workbook(workbook)
    .createOrUseWorksheet(setting.sheetName)
    .writeHeaders(setting.columnHeaders)
    .process(data => pump.writeRow(data, setting.sheetName))
    .logErrorsToConsole();
};

const setUpAndFillUpTheWorkbook = async settings => {
  const excelInventory = (await createExcelFile())._excel;
  const etlInventory = new Group();

  await settings.forEach(setting => {
    configurePump(etlInventory, excelInventory.workbook, setting);
  });
  await etlInventory.start().whenFinished();

  return XLSX.write(excelInventory.workbook, {
    bookType: 'xlsx',
    bookSST: false,
    type: 'binary',
  });
};

export const createWorkbookWithDataExported = async (ctx, sheetNames, properties) => {
  try {
    const sheetsAndColumnHeadersInTheImportOrder = await getSheetsAndColumnHeadersInTheImportOrder(sheetNames);
    const propertyIds = properties.map(property => property.id);

    const { dataPumps: settings = [], errors } = await exportDataByWorkbookSheet(ctx, sheetsAndColumnHeadersInTheImportOrder, propertyIds);
    if (settings.length === 0) return { errors };

    return {
      workbook: await setUpAndFillUpTheWorkbook(settings),
      errors,
    };
  } catch (error) {
    logger.error({ ctx, error }, error.message);
    return {
      errors: [
        {
          error: error.message,
        },
      ],
    };
  }
};

const createJobEntry = async (tenantId, authUser) => {
  const jobDetails = {
    name: DALTypes.Jobs.ExportDatabase,
    category: DALTypes.JobCategory.ExportDatabase,
    step: DALTypes.ExportDataSteps.ExportDatabase,
  };

  const job = await createJob({ tenantId, authUser }, [], jobDetails);
  jobDetails.id = job.id;
  jobDetails.createdBy = job.createdBy;
  await updateJob(tenantId, jobDetails, DALTypes.JobStatus.IN_PROGRESS);

  return jobDetails;
};

export const getAllProperties = async ctx => {
  const properties = await getProperties(ctx);
  return properties.map(property => ({
    id: property.id,
    name: property.name,
  }));
};

const getPropertiesPrefix = (tenantName, properties, allProperties) => {
  if (allProperties) return `${tenantName}-all-properties`;

  const maxPropertiesOnFileName = 3;
  let propertiesPrefix = properties
    .reduce((acc, property) => {
      if (acc.length === maxPropertiesOnFileName) return acc;
      return acc.concat(property.name);
    }, [])
    .join('-');
  if (properties.length > 3) propertiesPrefix += `_+${properties.length - 3}`;
  return `${tenantName}-${propertiesPrefix}`;
};

const getExportedFileName = (tenantName, properties, allProperties, exportDateTime) =>
  `${getPropertiesPrefix(tenantName, properties, allProperties)}-${exportDateTime}.xlsx`;

export const exportFromDB = async ctx => {
  const { tenantId, authUser } = ctx;
  let { workbookSheets: sheetNames = [], properties = [], exportDateTime } = ctx;
  let allProperties = false;
  const { name: tenantName } = await getTenantData(ctx);

  if (sheetNames.length === 0) {
    sheetNames = getSheetNames(Object.values(spreadsheet));
  }
  if (properties.length === 0) {
    properties = await getAllProperties(ctx);
    allProperties = true;
  }

  logger.info({ ctx, properties, sheetNames }, 'export tenant data');
  const jobDetails = await createJobEntry(tenantId, authUser);

  logger.info({ ctx, jobDetails, properties, sheetNames }, 'Starting to export database.');

  let { workbook, errors } = await createWorkbookWithDataExported(ctx, sheetNames, properties);

  logger.info({ ctx, jobDetails, properties, sheetNames }, 'Database export finished.');

  if (!workbook) {
    logger.error({ ctx, jobDetails, properties, sheetNames }, 'Database export had no output');
    if (!errors) errors = [];
    await updateJob(tenantId, jobDetails, DALTypes.JobStatus.FAILED, '', [
      ...errors,
      {
        message: `No workbook was created for the given properties ${properties.map(property => property.name)} and sheetNames ${sheetNames}`,
      },
    ]);
    return { processed: true };
  }

  const exportedFileName = getExportedFileName(tenantName, properties, allProperties, exportDateTime);

  const exportedFilePath = await saveWorkbook(workbook, DIRECTORY, exportedFileName);
  if (exportedFilePath) {
    await uploadWorkbookToS3(ctx, exportedFilePath, exportedFileName);

    jobDetails.metadata = {
      ...jobDetails.metadata,
      filename: exportedFileName,
    };
  }

  await updateJob(tenantId, jobDetails, DALTypes.JobStatus.PROCESSED, '', [errors]);

  return { processed: true };
};
