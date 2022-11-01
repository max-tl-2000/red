/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import groupBy from 'lodash/groupBy';
import loggerModule from '../../../common/helpers/logger';
import { mappingFileHandlers } from './mappingFileHandlers';
import { writeCsvFile, getPreviousUpdate, getResultFilePath, parseThirdPartyInventory } from './csvHelper';
import { updateInventory, updatePropertySettingsWithSpecials, updateRentableItemsStates, updateInventoryLossLearderUnit } from './updatesHandler';
import { notifyChangingPrice } from './notifyUpdatesHandler';
import { updateAmenityAndInventoryAmenity } from './updateAmenityAndInventoryAmenity';
import { prospectUpdates } from './prospectUpdatesHandler';
import { processHistoricalCommunications } from './historicalCommunicationsHandler';
import { ImportMappersEntityTypes, YardiResidentImportFiles } from '../../../common/enums/enums';

const logger = loggerModule.child({ subType: 'importUpdates' });

const NO_HANDLERS_ADDED = 'NO_HANDLERS_ADDED';
const NO_FILES_ADDED = 'NO_FILES_ADDED';

// TODO: this export should be moved to its own file to avoid importing all this module just to read this export
export const MISSING_HANDLERS = 'MISSING_HANDLERS';

const mappers = [
  [ImportMappersEntityTypes.MriProperties, updatePropertySettingsWithSpecials],
  [ImportMappersEntityTypes.UnitStatusMapper, updateInventory],
  [ImportMappersEntityTypes.MriRentableItems, updateRentableItemsStates],
  [ImportMappersEntityTypes.UnitAmenitiesMapper, notifyChangingPrice],
  [ImportMappersEntityTypes.MriUnitAmenitiesMapper, updateAmenityAndInventoryAmenity],
  [ImportMappersEntityTypes.ProspectsMapper, prospectUpdates],
  [ImportMappersEntityTypes.HistoricalCommunicationMapper, processHistoricalCommunications],
  [ImportMappersEntityTypes.CommUnitsMapper, updateInventoryLossLearderUnit],
];

/**
 * Processes the third party updates
 *
 * @param {Object} ctx tenant context
 * @param {Object} entity contains the parsed file updates where the keys match the csv resultPrefix
 * @param {Object} lastUploads the last uploaded files of the same entity type
 */
const processThirdPartyUpdates = async (ctx, entity, lastUploads) => {
  const errors = [];
  await mapSeries(mappers, async ([entityType, updateFn]) => {
    // remove possible entity type resultPrefix suffix (ie. inventory-n) when processing multiple files of the same type so they all match the entityType
    const matchingEntityKeys = Object.keys(entity).filter(key => key.replace(/-\d+$/, '') === entityType);

    if (!matchingEntityKeys.length) return undefined;

    return await mapSeries(matchingEntityKeys, async matchingKey => {
      const { buffer: actualEntities, resultHeaders, thirdPartySystem, key } = entity[matchingKey];
      logger.info({ ctx, entityType, thirdPartySystem, converterName: key, lastUploads }, 'process third party updates');
      const previousEntities = await getPreviousUpdate(lastUploads[entityType]);
      const updateFnErrors = await updateFn(ctx, actualEntities, previousEntities, resultHeaders, entityType, thirdPartySystem);
      if (updateFnErrors?.length) {
        errors.push(updateFnErrors);
      }
    });
  });
  return errors.filter(error => error);
};

const hasHandler = (fileHandlers, file) => fileHandlers.some(handler => handler.filePath === file.filePath);

/**
 * Process update csv files
 *
 * @param {guid} tenantId tenantId
 * @param {Array} files list of files
 * @param {object} lastUploads object key last uploads files
 * @param {object} conf extra configuration
 * @param {Object} result.erros array of errors
 * @param {Object} result.processed number of files processed

 */
export const processFiles = async (ctx, files, lastUploads, conf) => {
  logger.info({ ctx, files }, 'processFiles');
  let validTenantCodes = [];

  const result = { errors: [], processed: 0, resultFiles: {} };
  if (!files || !files.length) {
    result.errors.push(NO_FILES_ADDED);
    return result;
  }

  const fileHandlers = mappingFileHandlers(files);
  if (!fileHandlers || !fileHandlers.length) {
    logger.warn({ ctx, files }, 'No handlers were found for processing the import updates');
    result.errors.push({ files: files.map(f => f.originalName), error: NO_HANDLERS_ADDED });

    return result;
  }

  if (files.length !== fileHandlers.length) {
    const filesWithoutHandlers = files.filter(file => !hasHandler(fileHandlers, file)).map(fwh => fwh.originalName);
    result.errors.push({ files: filesWithoutHandlers, error: MISSING_HANDLERS });
  }

  const resTenantsFileHandler = fileHandlers.filter(handler => handler.key === YardiResidentImportFiles.ResTenants);
  if (resTenantsFileHandler.length) {
    const { parsedImportUpdatesFiles: resTenantsInventory, importUpdatesFilesWithErrors } = await parseThirdPartyInventory(ctx, {
      csvHandlers: resTenantsFileHandler,
    });
    if (importUpdatesFilesWithErrors.length) {
      const groupedFilesWithErrors = groupBy(importUpdatesFilesWithErrors, 'token');
      const errorMessages = Object.keys(groupedFilesWithErrors).map(key => ({
        error: key,
        files: groupedFilesWithErrors[key].map(f => f.originalName),
      }));
      result.errors.push(...errorMessages);
    }

    for (const prefix of Object.keys(resTenantsInventory)) {
      result.resultFiles[prefix] = getResultFilePath(conf.tempFolder, prefix);
      const { buffer, resultHeaders, thirdPartySystem } = resTenantsInventory[prefix];

      logger.debug({ ctx, result: result.resultFiles[prefix], thirdPartySystem }, 'result file');
      validTenantCodes = [...new Set(buffer.map(entry => entry[1]))];

      await writeCsvFile({
        filePath: result.resultFiles[prefix],
        csvHeaders: resultHeaders,
        data: buffer,
      });
    }
  }

  const handlersToProcess = resTenantsFileHandler.length ? fileHandlers.filter(handler => handler.key !== YardiResidentImportFiles.ResTenants) : fileHandlers;

  result.processed = fileHandlers.length;
  const { parsedImportUpdatesFiles: inventory, importUpdatesFilesWithErrors } = await parseThirdPartyInventory(ctx, {
    csvHandlers: handlersToProcess,
    validTenantCodes,
  });

  if (importUpdatesFilesWithErrors.length) {
    const groupedFilesWithErrors = groupBy(importUpdatesFilesWithErrors, 'token');
    const errorMessages = Object.keys(groupedFilesWithErrors).map(key => ({
      error: key,
      files: groupedFilesWithErrors[key].map(f => f.originalName),
    }));
    result.errors.push(...errorMessages);
  }

  for (const prefix of Object.keys(inventory)) {
    result.resultFiles[prefix] = getResultFilePath(conf.tempFolder, prefix);
    const { buffer, resultHeaders, thirdPartySystem } = inventory[prefix];

    logger.debug({ ctx, result: result.resultFiles[prefix], thirdPartySystem }, 'result file');

    await writeCsvFile({
      filePath: result.resultFiles[prefix],
      csvHeaders: resultHeaders,
      data: buffer,
    });
  }

  const errors = await processThirdPartyUpdates(ctx, inventory, lastUploads);
  if (errors?.length) {
    result.errors = result.errors.concat(errors).flat();
  }
  return result;
};
