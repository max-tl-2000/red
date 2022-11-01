/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fse from 'fs-extra';
import fs from 'fs';
import { mapSeries } from 'bluebird';
import get from 'lodash/get';
import newUUID from 'uuid/v4';

import config from '../../config';
import thenify from '../../../common/helpers/thenify';
import { DALTypes } from '../../../common/enums/DALTypes';
import { APP_EXCHANGE, EXPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { getTenant } from '../../services/tenantService';
import { saveExportLog } from '../../services/export';
import { createResTenantsMapper } from './mappers/resTenants';
import { createResProspectsMapper } from './mappers/resProspects';
import { createResRoommatesMapper } from './mappers/resRoommates';
import { createFinChargesMapper } from './mappers/finCharges';
import { createFinReceiptsMapper } from './mappers/finReceipts';
import { createResLeaseChargesMapper } from './mappers/resLeaseCharges';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

export const ExportType = {
  ResTenants: {
    fileType: DALTypes.ExportTypes.RES_TENANTS,
    mapper: createResTenantsMapper,
  },
  ResProspects: {
    fileType: DALTypes.ExportTypes.RES_PROSPECTS,
    mapper: createResProspectsMapper,
  },
  ResRoommates: {
    fileType: DALTypes.ExportTypes.RES_ROOMMATES,
    mapper: createResRoommatesMapper,
  },
  FinCharges: {
    fileType: DALTypes.ExportTypes.FIN_CHARGES,
    mapper: createFinChargesMapper,
  },
  ResLeaseCharges: {
    fileType: DALTypes.ExportTypes.RES_LEASE_CHARGES,
    mapper: createResLeaseChargesMapper,
  },
  FinReceipts: {
    fileType: DALTypes.ExportTypes.FIN_RECEIPTS,
    mapper: createFinReceiptsMapper,
  },
};

export const copyFileToEfs = async (ctx, filePath, directory) => {
  logger.trace({ ctx, filePath }, 'Copy file to EFS');
  const newFilePath = path.resolve(config.aws.efsRootFolder, ctx.tenantId, directory, path.basename(filePath));
  const copy = thenify(fse.copy);
  await copy(filePath, newFilePath);

  return newFilePath;
};

export const renameFile = async (ctx, filePath, directory) => {
  logger.trace({ ctx, filePath, directory }, 'Rename EFS file');

  const pathExists = thenify(fse.pathExists);
  const fileExists = await pathExists(filePath);

  if (!fileExists) {
    logger.trace({ ctx, filePath, directory }, 'File does not exist');
    return null;
  }

  const newFilePath = path.resolve(config.aws.efsRootFolder, ctx.tenantId, directory, path.basename(filePath));
  const renamedFilePath = newFilePath.replace('.filepart', '');
  const rename = thenify(fs.rename);
  await rename(filePath, renamedFilePath);

  return renamedFilePath;
};

const removeFile = async (ctx, filePath) => {
  logger.trace({ ctx, filePath }, 'removeFile - export');

  const remove = thenify(fse.remove);
  const pathExists = thenify(fse.pathExists);
  const fileExists = await pathExists(filePath);

  if (fileExists) {
    await remove(filePath);
    logger.trace({ ctx, filePath }, 'The file was removed');
  }
};

export const removeFileFromEfs = async (ctx, filePath) => {
  logger.trace({ ctx, filePath }, 'Remove file from EFS');
  const uploadsPathWithFilePartExtension = path.resolve(config.aws.efsRootFolder, ctx.tenantId, 'uploads', path.basename(filePath));
  const exportPathWithFilePartExtension = path.resolve(config.aws.efsRootFolder, ctx.tenantId, 'export', path.basename(filePath));
  const uploadsPath = uploadsPathWithFilePartExtension.replace('.filepart', '');
  const exportPath = exportPathWithFilePartExtension.replace('.filepart', '');

  await removeFile(ctx, uploadsPathWithFilePartExtension);
  await removeFile(ctx, uploadsPath);
  await removeFile(ctx, exportPathWithFilePartExtension);
  await removeFile(ctx, exportPath);
};

export const triggerUploadToS3 = async (ctx, filePath, exportLogIds) => {
  logger.trace({ ctx, filePath, exportLogIds }, 'triggerUploadToS3');

  return await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXPORT_MESSAGE_TYPE.UPLOAD_EXPORT_FILE,
    message: { tenantId: ctx.tenantId, filePath, exportLogIds },
    ctx,
  });
};

export const uploadExportFileToS3 = async (ctx, filePath, exportLogIds) => {
  const newFilePath = await copyFileToEfs(ctx, filePath, 'uploads');
  await triggerUploadToS3(ctx, newFilePath, exportLogIds);
};

const getSkippedFileTypes = tenant => {
  const skippedFileTypes = [];
  const { skipResLeaseChargesExport, skipFinReceiptsExport } = get(tenant, 'metadata.backendIntegration') || {};

  skipResLeaseChargesExport && skippedFileTypes.push(DALTypes.ExportTypes.RES_LEASE_CHARGES);
  skipFinReceiptsExport && skippedFileTypes.push(DALTypes.ExportTypes.FIN_RECEIPTS);

  return skippedFileTypes;
};

export const getYardiExportFilePath = (tenantId, fileType, timestamp, propertyName) => {
  const efsRoot = path.resolve(config.aws.efsRootFolder);
  const uuid = newUUID().split('-')[0];

  return path.join(efsRoot, tenantId, 'uploads', `${timestamp}-${fileType}-${uuid}-${propertyName}.csv.filepart`);
};

export const getOneToManysExportFilePath = (tenantId, fileType, timestamp) => {
  const efsRoot = path.resolve(config.aws.efsRootFolder);
  const uuid = newUUID().split('-')[0];

  return path.join(efsRoot, tenantId, 'export', `${timestamp}-${fileType}-${uuid}.csv`);
};

export const exportData = async (ctx, exportTypes, data) => {
  logger.trace({ ctx, exportTypes }, 'exportData');

  const { tenantId, party, lease, inventory, propertyToExport } = data;
  const tenant = await getTenant(ctx, tenantId);
  const skippedFileTypes = getSkippedFileTypes(tenant);

  return await mapSeries(exportTypes, async exportType => {
    const { fileType, mapper } = exportType;
    logger.trace({ ctx, fileType }, 'Generating export file contents');

    if (skippedFileTypes.includes(fileType)) return {};

    const maps = await mapper(data);
    if (!maps || !maps.length) return {};

    const externalId = data.externalInfo.externalId;
    const serialized = JSON.stringify(maps, (k, v) => (v === undefined ? null : v));

    return await saveExportLog(ctx, {
      type: fileType,
      partyId: party.id,
      leaseId: lease && lease.id,
      propertyId: inventory?.property?.id || propertyToExport?.id || party.assignedPropertyId,
      externalId,
      entries: serialized,
      status: DALTypes.EXPORT_LOG_STATUS.PENDING,
      data: {
        entries: maps,
      },
    });
  });
};

export const isExportEnabled = async ctx => {
  const tenant = await getTenant(ctx);
  const name = (tenant.metadata.backendIntegration || {}).name;
  const result = name === DALTypes.BackendMode.YARDI;

  logger.info({ ctx }, `Export is ${result ? 'enabled' : 'disabled'}`);

  return result;
};
