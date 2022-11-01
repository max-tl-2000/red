/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import get from 'lodash/get';
import { getPropertiesByQuotePricingSetting, existPropertyWithInventoryStateEnabled } from '../../dal/propertyRepo';
import { getProcessedJobsAfterTimeInterval } from '../../dal/jobsRepo';
import { getTenantData } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now, toMoment } from '../../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'jobs' });
const { Jobs, BackendMode } = DALTypes;

const MRI_INTEGRATION_FILES_PREFIXES = ['MriUnits'];
const YARDI_INTEGRATION_FILES_PREFIXES = ['ResUnitAmenities', 'ResUnitStatus'];

// expect rms import filenames to use naming convention: LROPricing_13780_20180702.XML
const getPropertyNameFromRmsImportFile = fileName => {
  const splitName = (fileName && fileName.split('_')) || [];

  if (splitName.length !== 3) {
    throw new Error(`Unexpected file name: ${fileName}`);
  }

  return (splitName.length === 3 && splitName[1]) || '';
};

const getProperyNamesFromImportFiles = (files, extractPropertyNameFn) => uniq(files.map(file => extractPropertyNameFn(file.originalName)));

const getFilesFromFailedImport = fileImport => {
  const { files: filesToBeImported } = fileImport.metadata;
  const { failingFiles } = fileImport.steps.RmsUpdates.result;

  return filesToBeImported.filter(fileToBeImported => !failingFiles.find(failedFile => failedFile.originalName === fileToBeImported.originalName));
};

const getPropertyNamesWithImportFiles = (fileImports, extractPropertyNameFn) => {
  const isImportWithFiles = fileImport => (fileImport.metadata && fileImport.metadata.files) || false;

  const propertiesWithProcessedRmsFiles = fileImports.reduce((accum, fileImport) => {
    const files = fileImport.status === DALTypes.JobStatus.PROCESSED ? fileImport.metadata.files : getFilesFromFailedImport(fileImport);

    const propertiesWithImports = (isImportWithFiles(fileImport) && getProperyNamesFromImportFiles(files, extractPropertyNameFn)) || [];
    return [...accum, ...propertiesWithImports];
  }, []);

  return uniq(propertiesWithProcessedRmsFiles);
};

export const checkForMissingRmsFiles = async ctx => {
  let propertiesWithoutFileImports = [];

  try {
    logger.info({ ctx }, 'Checking for unreceived files from RMS');

    const rmsPricingProperties = await getPropertiesByQuotePricingSetting(ctx, true);
    if (!rmsPricingProperties.length) {
      logger.trace({ ctx }, 'Tenant has no properties with RMS pricing');
      return propertiesWithoutFileImports;
    }

    const rmsFileImports = await getProcessedJobsAfterTimeInterval(ctx, Jobs.ImportRmsFiles, { interval: 30, timeframe: 'HOURS', failedJobs: true });

    !rmsFileImports.length && logger.error({ ctx }, 'Missing files from RMS in the last 30 hours');

    if (rmsFileImports.length) {
      const propertiesWithRmsImportFiles = getPropertyNamesWithImportFiles(rmsFileImports, getPropertyNameFromRmsImportFile);
      const propertiesWithRmsPricing = rmsPricingProperties
        .filter(p => !p.endDate || now().isBefore(toMoment(p.endDate)))
        .map(property => property.rmsExternalId);

      propertiesWithoutFileImports = propertiesWithRmsPricing.filter(prop => !propertiesWithRmsImportFiles.includes(prop));

      !!propertiesWithoutFileImports.length &&
        logger.error({ ctx, propertyNames: propertiesWithoutFileImports.join(', ') }, 'Missing files from RMS in the last 30 hours for subset of properties');
    }
  } catch (error) {
    logger.error({ ctx, error }, 'Error while checking for unreceived files from RMS');
  }

  return propertiesWithoutFileImports;
};

const getTenantBackendMode = tenant => get(tenant, 'metadata.backendIntegration.name');
const isTenantBackendEnabled = async tenant =>
  (getTenantBackendMode(tenant) && (await existPropertyWithInventoryStateEnabled({ tenantId: tenant.id }))) || false;

const getListOfImportFiles = (jobs = []) =>
  uniq(
    jobs.reduce((acc, job) => {
      const { metadata } = job;
      const { files } = metadata;

      const jobFiles = (files && files.map(file => file.originalName)) || [];

      return [...acc, ...jobFiles];
    }, []),
  );

const getBackendModeFileNameSplitter = backendMode => (backendMode === BackendMode.YARDI ? '_' : '-');
const getExpectedBackendFilePrefixes = backendMode => (backendMode === BackendMode.YARDI ? YARDI_INTEGRATION_FILES_PREFIXES : MRI_INTEGRATION_FILES_PREFIXES);

const getImportFilesPrefixes = (backendMode, files = []) => {
  const splitter = getBackendModeFileNameSplitter(backendMode);
  const expectedFilePrefixes = getExpectedBackendFilePrefixes(backendMode);

  return files.reduce((acc, file) => {
    const [filePrefix] = file.split(splitter);
    const shouldIncludePrefix = expectedFilePrefixes.some(expectedPrefix => expectedPrefix === filePrefix);
    shouldIncludePrefix && acc.push(filePrefix);
    return acc;
  }, []);
};

export const checkForMissingBackendImportFiles = (backendMode, importedFiles) => {
  let hasMissingImportFiles = !importedFiles.length;
  let missingFiles = [];

  if (!hasMissingImportFiles) {
    const expectedFilePrefixes = getExpectedBackendFilePrefixes(backendMode);
    const importedFilesPrefixes = getImportFilesPrefixes(backendMode, importedFiles);

    missingFiles = expectedFilePrefixes.filter(expectedPrefix => !importedFilesPrefixes.includes(expectedPrefix));
    hasMissingImportFiles = !!missingFiles.length;
  }

  return {
    hasMissingImportFiles,
    missingFiles,
  };
};

export const checkForMissingTenantBackendImportFiles = async ctx => {
  let hasMissingImportFiles = false;

  try {
    logger.info({ ctx }, 'Checking for unreceived files from tenant backend');

    const tenant = await getTenantData(ctx);
    const isBackendEnabled = await isTenantBackendEnabled(tenant);
    if (isBackendEnabled) {
      const backendMode = getTenantBackendMode(tenant);

      const importUpdateDataFilesJobs = await getProcessedJobsAfterTimeInterval(ctx, Jobs.ImportUpdateDataFiles);
      const importedfiles = getListOfImportFiles(importUpdateDataFilesJobs);

      const { hasMissingImportFiles: hasMissingFiles, missingFiles } = checkForMissingBackendImportFiles(backendMode, importedfiles);
      hasMissingImportFiles = hasMissingFiles;

      hasMissingImportFiles &&
        logger.error({ ctx, tenantBackend: backendMode, missingFiles: missingFiles.join(', ') }, 'Missing files from tenant backend in the last 24 hours');
    }
  } catch (error) {
    logger.error({ ctx, error }, 'Error while checking for unreceived files from tenant backend');
  }

  return hasMissingImportFiles;
};

export const checkIncomingFiles = async payload => {
  const { msgCtx: ctx } = payload;

  logger.time({ ctx }, 'Recurring Jobs - checkIncomingFiles duration');

  await checkForMissingRmsFiles(ctx);
  await checkForMissingTenantBackendImportFiles(ctx);

  logger.timeEnd({ ctx }, 'Recurring Jobs - checkIncomingFiles duration');
  return { processed: true };
};
