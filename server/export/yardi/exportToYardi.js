/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';
import groupBy from 'lodash/groupBy';

import { write } from '../../../common/helpers/xfs';
import { toMoment } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPendingExportLogs, isRoommateRemoved, markExportLogsAsProcessed, markExportLogEntriesAsSkipped } from '../../dal/exportRepo';
import { getAssignedPropertyNameByPartyId } from '../../dal/partyRepo';
import { runInTransaction } from '../../database/factory';
import { getTenant } from '../../services/tenantService';
import { ExportType, getYardiExportFilePath, copyFileToEfs, triggerUploadToS3, removeFileFromEfs, renameFile } from './export';
import { generateTimestamp, transformMapsToCSV } from './csvUtils';
import { OccupantType } from './helpers';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

const shouldTakeLatestRecord = type =>
  type === ExportType.ResTenants.fileType ||
  type === ExportType.ResProspects.fileType ||
  type === ExportType.ResRoommates.fileType ||
  type === ExportType.ResLeaseCharges.fileType;

const markAsProcessed = async (ctx, pendingData) => {
  const exportLogIds = uniq(flatten(pendingData.map(record => record.groupedLogs)).map(exportLog => exportLog.id));
  if (!exportLogIds.length) return;

  await markExportLogsAsProcessed(ctx, exportLogIds);
};

const excludeRemovedRoommates = async (ctx, parsedEntries) => {
  const filteredEntries = await mapSeries(parsedEntries, async e => {
    const isMinor = e.OccupantType === OccupantType.Minor;
    const wasRemoved = await isRoommateRemoved(ctx, e.Roommate_Code, isMinor);
    return wasRemoved ? null : e;
  });

  return filteredEntries.filter(e => e);
};

const getLatestRecords = async (ctx, groupedLogs, type, propertyName) => {
  const exportLog = groupedLogs.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)))[0];
  let parsedEntries = JSON.parse(exportLog.entries);

  if (type === ExportType.ResRoommates.fileType) {
    parsedEntries = await excludeRemovedRoommates(ctx, parsedEntries);
  }

  if (!parsedEntries.length) return [];

  return [
    {
      fileType: type,
      entries: parsedEntries,
      exportLogIds: [exportLog.id],
      propertyName,
    },
  ];
};

const writeExportFile = async (tenantId, dataByProperty, key, timestamp) => {
  const [propertyName, fileType] = key.split('-');
  const fileData = dataByProperty[key];

  let entries;

  if (fileType === 'FinReceipts') {
    const records = flatten(fileData.map(e => e.entries));
    entries = records.map((rec, index) => ({ ...rec, TRANNUM: index + 1 }));
  } else {
    entries = flatten(fileData.map(e => e.entries));
  }

  entries.forEach(e =>
    Object.entries(e).forEach(([entryKey, entryValue]) => {
      if (typeof entryValue === 'string') e[entryKey] = entryValue.replace(/"/g, '""');
    }),
  );

  const csvFileContent = await transformMapsToCSV(fileType, entries);
  if (!csvFileContent) return {};

  const exportFilePath = getYardiExportFilePath(tenantId, fileType, timestamp, propertyName);
  await write(exportFilePath, csvFileContent);

  const exportLogIds = flatten(fileData.map(fd => fd.exportLogIds));

  return {
    exportFilePath,
    exportLogIds,
  };
};

const writeExportFiles = async (tenantId, filesData, timestamp) => {
  const dataByProperty = groupBy(flatten(filesData), fileData => `${fileData.propertyName}-${fileData.fileType}`);
  const keys = Object.keys(dataByProperty);

  return await mapSeries(keys, async key => await writeExportFile(tenantId, dataByProperty, key, timestamp));
};

const cleanAlreadyCopiedFiles = async (ctx, files) => await mapSeries(files, async ({ exportFilePath }) => await removeFileFromEfs(ctx, exportFilePath));

export const exportToYardi = async payload => {
  const { msgCtx: ctx, tenantId } = payload;
  let files;

  try {
    const tenant = await getTenant(ctx, tenantId);
    const { backendIntegration } = tenant.metadata;

    if (!backendIntegration || backendIntegration.name !== DALTypes.BackendMode.YARDI) {
      logger.trace({ ctx }, 'Backend mode not set to Yardi, skipping export.');
      return { processed: true };
    }

    logger.time({ ctx, payload }, 'Recurring Jobs - Export to Yardi duration');

    const skipSameDayLeases = tenant.settings?.export?.skipSameDayLeases;
    skipSameDayLeases && (await markExportLogEntriesAsSkipped(ctx));

    const pendingData = await getPendingExportLogs(ctx);

    const timestamp = generateTimestamp();

    const filesData = await mapSeries(pendingData, async record => {
      const { partyId, type, groupedLogs } = record;
      const propertyName = await getAssignedPropertyNameByPartyId(ctx, partyId);

      if (shouldTakeLatestRecord(type)) {
        return await getLatestRecords(ctx, groupedLogs, type, propertyName);
      }

      // export all entries (FinCharges, FinReceipts)
      const entries = flatten(groupedLogs.map(exportLog => JSON.parse(exportLog.entries)));
      const exportLogIds = flatten(groupedLogs.map(gl => gl.id));

      return [
        {
          fileType: type,
          entries,
          exportLogIds,
          propertyName,
        },
      ];
    });

    files = await writeExportFiles(tenantId, filesData, timestamp); // write in the uploads folder

    await runInTransaction(async trx => {
      const newCtx = { ...ctx, trx };

      const filenames = await mapSeries(files, async ({ exportFilePath, exportLogIds }) => {
        const filename = await copyFileToEfs(newCtx, exportFilePath, 'export'); // copy the files from the uploads folder to the export folder
        return { exportLogIds, filename };
      });

      // if the copy to EFS was successful, rename the file with the filepart extension from both uploads and export
      const renamedFiles = await mapSeries(files, async ({ exportFilePath, exportLogIds }) => {
        const renamedFile = await renameFile(newCtx, exportFilePath, 'uploads');
        return { exportLogIds, renamedFile };
      });

      await mapSeries(filenames, async ({ filename }) => await renameFile(ctx, filename, 'export'));

      await mapSeries(renamedFiles, async ({ exportLogIds, renamedFile }) => renamedFile && (await triggerUploadToS3(newCtx, renamedFile, exportLogIds)));
      await markAsProcessed(newCtx, pendingData);
    }, ctx);

    logger.timeEnd({ ctx, files }, 'Recurring Jobs - Export to Yardi duration');

    return { processed: true };
  } catch (error) {
    logger.error({ ctx, error }, 'Export to Yardi - error');
    await cleanAlreadyCopiedFiles(ctx, files);
    throw error;
  }
};
