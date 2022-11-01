/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { APP_EXCHANGE, CONVERT_MESSAGE_TYPE, IMPORT_UPDATES_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { DALTypes } from '../../../common/enums/DALTypes';
import { createJob } from '../../services/jobs';
import { CSV_FILE, XML_FILE } from '../../../common/regex';

const sendMigrationMessage = async (req, migrationFiles, job, metadata) => {
  const payload = {
    jobDetails: {
      id: job.id,
      step: metadata.step,
      name: metadata.name,
      createdBy: (req.authUser || {}).id,
    },
    tenantId: req.tenantId,
    isUIImport: (req.body || {}).isUIImport,
    files: migrationFiles.map(file => ({
      ...file,
      filePath: file.path,
    })),
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: metadata.messageKey,
    message: payload,
    ctx: req,
  });
};

const processMigrations = async (ctx, metadata, acceptedFileType) => {
  const migrationFiles = ctx.files.filter(file => file.originalName.match(acceptedFileType));

  if (!migrationFiles) return;
  const migrationFilesEnhancedWithFilePath = migrationFiles.map(file => ({
    ...file,
    filePath: file.path,
  }));
  const createdJob = await createJob(ctx, migrationFilesEnhancedWithFilePath, metadata);
  await sendMigrationMessage(ctx, migrationFiles, createdJob, metadata);
};

export const uploadAndConvertFiles = async req => {
  const metadata = {
    name: DALTypes.Jobs.MigrateDataFiles,
    step: DALTypes.MigrateDataFilesSteps.YardiMigration,
    messageKey: CONVERT_MESSAGE_TYPE.PROCESS_INPUT,
    category: DALTypes.JobCategory.MigrateData,
  };

  processMigrations(req, metadata, CSV_FILE);
};

export const uploadUpdates = async req => {
  const metadata = {
    name: DALTypes.Jobs.ImportUpdateDataFiles,
    step: DALTypes.ImportUpdateDataFilesSteps.ImportUpdates,
    messageKey: IMPORT_UPDATES_MESSAGE_TYPE.IMPORT_FILES,
    category: DALTypes.JobCategory.MigrateData,
  };

  processMigrations(req, metadata, CSV_FILE);
};

export const importRms = req => {
  const metadata = {
    name: DALTypes.Jobs.ImportRmsFiles,
    step: DALTypes.ImportRmsFilesSteps.RmsUpdates,
    messageKey: IMPORT_UPDATES_MESSAGE_TYPE.IMPORT_FILES,
    category: DALTypes.JobCategory.MigrateData,
  };

  processMigrations(req, metadata, XML_FILE);
};
