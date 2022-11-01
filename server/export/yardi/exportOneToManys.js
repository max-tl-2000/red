/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { write } from '../../../common/helpers/xfs';
import { retrieveDataForOneToManyExport } from '../../dal/exportRepo';
import JobEntry from '../../services/jobEntry';
import { generateTimestamp, transformMapsToCSV } from './csvUtils';
import { getOneToManysExportFilePath, uploadExportFileToS3 } from './export';
import { createOneToManysMapper } from './mappers/oneToManys';
import { knexReadOnly } from '../../database/knex';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'exportOneToManysWorker' });

const generateOneToManysCSVContent = async (ctx, data) => {
  const mappedData = createOneToManysMapper(data);

  const exportFilePath = getOneToManysExportFilePath(ctx.tenantId, 'OneToManys', generateTimestamp());
  await write(exportFilePath, transformMapsToCSV('OneToManys', mappedData));

  logger.info({ ctx }, 'Generated one to manys csv file for tenant');

  await uploadExportFileToS3(ctx, exportFilePath);
};

export const exportOneToManysCSV = async (conn, ctx) => {
  const data = await retrieveDataForOneToManyExport(conn, ctx.tenantId);

  if (data.rows.length) {
    await generateOneToManysCSVContent(ctx, data.rows);
  } else {
    logger.info({ ctx }, 'No data to export for tenant');
  }

  return data;
};

export const runExportOneToManys = async req => {
  const { tenantId } = req;
  const { jobInfo } = req.body;

  logger.time({ tenantId }, 'Recurring Jobs - ExportOneToManys duration');

  const jobEntry = new JobEntry(tenantId, jobInfo);

  try {
    await jobEntry.markAsStarted();

    await exportOneToManysCSV(knexReadOnly, req);

    logger.timeEnd({ tenantId }, 'Recurring Jobs - ExportOneToManys duration');

    await jobEntry.markAsProcessed();
  } catch (e) {
    logger.error({ tenantId, e }, 'Error while running one to manys export');
    await jobEntry.markAsFailed(e);
  }
};
