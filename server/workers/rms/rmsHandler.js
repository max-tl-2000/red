/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import get from 'lodash/get';
import groupBy from 'lodash/groupBy';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import RMSProviderFactory from './providers/rmsProviderFactory';
import RevaRmsTestProvider from './providers/revaRmsTestProvider';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { RmsImportError, RmsPricingEvents } from '../../../common/enums/enums';
import { getInventoriesByExternalIds, getPricingSetting } from '../../dal/rmsPricingRepo';
import { getPropertyByRmsExternalId, getProperties } from '../../dal/propertyRepo';
import { removeTimestampPrefixFromFileName } from '../../helpers/importUtils';
import { getPropertiesWherePricingRelatedTablesChanged, getInventoriesUpdatedAfterLastPriceUpdate } from '../../dal/revaPricingRepo';
import RevaProvider from './providers/revaProvider';
import { getTenant } from '../../services/tenantService';

const logger = loggerModule.child({ subType: 'rmsHandler' });

const getRmsImportError = error => error.rmsErrorType || RmsImportError.PARSING_FAILED_ERROR;

export const isRmsImportError = error => Object.keys(RmsImportError).find(key => RmsImportError[key] === error);
export const isRmsJob = job => job.name === DALTypes.Jobs.ImportRmsFiles;

const rmsProviderFactory = new RMSProviderFactory();
const PARSING_ERROR_ALERT_MSG = 'The parsing of the RMS file failed';

const handleParsingErrorAlerts = async (ctx, errors, otherInfoToLog = {}) => {
  if (!errors || !errors.length) return;

  const externalIds = errors.map(e => e.externalId);

  if (!externalIds[0]) {
    logger.error({ ctx, errorMessage: get(errors, '[0].messages[0]'), ...otherInfoToLog }, PARSING_ERROR_ALERT_MSG);
    return;
  }

  const { rmsPropertyId } = otherInfoToLog;
  if (!rmsPropertyId) return;

  const { id: propertyId } = (await getPropertyByRmsExternalId(ctx, rmsPropertyId)) || {};
  const inventories = await getInventoriesByExternalIds(ctx, externalIds, propertyId);

  errors.forEach(e => {
    const inventoryId = (inventories.find(i => i.rmsExternalId === e.externalId) || {}).id;
    if (!inventoryId) return;

    e.messages.forEach(msg => logger.error({ ctx, inventoryId, errorMessage: msg, ...otherInfoToLog }, PARSING_ERROR_ALERT_MSG));
  });
};

const handleErrors = (rmsErrors, result, originalName) =>
  rmsErrors.forEach(e => result.errors.push({ message: e.jobErrorMessage || get(e, 'messages[0]'), error: getRmsImportError(e), file: originalName }));

const processRmsFile = async (ctx, file) => {
  const result = { errors: [], processed: 0 };

  const { originalName, originalPath } = file;
  logger.trace({ ctx, originalName }, 'handling RMS file received');
  const originalNameWithoutPrefix = removeTimestampPrefixFromFileName(originalName);
  const rmsProvider = rmsProviderFactory.getProvider(originalNameWithoutPrefix, originalPath);
  if (!rmsProvider) {
    logger.error({ ctx, originalName }, 'The RMS file is not recognized');
    result.errors.push({ error: RmsImportError.FILE_NOT_RECOGNIZED_ERROR, file: originalName });
    return result;
  }

  let rmsPropertyId;
  try {
    const { units: unitsPrices, errors, propertyExternalId } = await rmsProvider.getRMSPrices(ctx, file);
    rmsPropertyId = propertyExternalId;

    const property = await getPropertyByRmsExternalId(ctx, rmsPropertyId);
    if (!property) {
      logger.error({ ctx, originalName, rmsPropertyId }, 'rmsHandler: Property found in RMS file could not be found in DB');
      return result;
    }
    const pricingSetting = getPricingSetting(ctx, { propertyId: rmsPropertyId, settings: property.settings });

    if (!pricingSetting) {
      logger.trace({ ctx, originalName }, 'The RMS file is ignored because import/unitPricing is false');
      result.processed = 1; // Considering the file as processed even if ignored as it should not be marked as an error
      return result;
    }

    await handleParsingErrorAlerts(ctx, errors, { originalName, rmsPropertyId });
    const saveRMSPricesErrors = await rmsProvider.saveRMSPrices(ctx, {
      unitsPrices,
      propertyExternalId,
      rmsPricingEvent: RmsPricingEvents.EXTERNAL_RMS_IMPORT,
    });

    if (saveRMSPricesErrors.length) {
      handleErrors(saveRMSPricesErrors, result, originalName);
    }

    if (!errors.length && !saveRMSPricesErrors.length) {
      result.processed = 1;
    }
  } catch (error) {
    logger.error({ ctx, originalName, error }, 'handling RMS file failed');

    const err = Array.isArray(error) ? error : [error];
    await handleParsingErrorAlerts(ctx, err, { originalName, rmsPropertyId });

    const errorType = get(err, '[0].messages[0].rmsErrorType');
    if (errorType !== RmsImportError.PROPERTY_NOT_FOUND_IN_DB_ERROR) {
      handleErrors(err, result, originalName);
    }
  }

  logger.trace({ ctx, originalName }, 'handling RMS file done');

  return result;
};

/*
  This function returns an object with the following properties:

  errors: A list of errors while processing the rms files
  processed: The number of successfully processed files
  uploaded: The number of files to process
  failingFiles: The list of failing files


  Do not change the name of these properties, because they are being used to display the results, these are generic across several types of files.
*/
export const handleRmsFilesReceived = async (ctx, files) => {
  const result = { errors: [], processed: 0, uploaded: files.length, failingFiles: [] };
  if (!files || !files.length) {
    logger.error({ ctx }, 'No RMS files added');
    result.errors.push(RmsImportError.NO_FILES_ADDED_ERROR);
    return result;
  }

  // This code perform each operation in series, if the rms file is empty, it will not be processed and will continue with the next one
  await mapSeries(files, async file => {
    if (!file && !file.filePath) {
      result.errors.push(RmsImportError.EMPTY_FILE_ERROR);
      return true;
    }

    const rmsFileResult = await processRmsFile(ctx, file);
    const { errors, processed } = rmsFileResult;
    result.errors.push(...errors);
    result.file = file;
    result.processed += processed;
    if (!processed) result.failingFiles.push(file);

    return true;
  });

  const { failingFiles } = result;
  if (failingFiles.length) {
    logger.error({ ctx, failingFiles }, 'Error while importing RMS files');
  }

  return result;
};

const REVA_PARSING_ERROR_ALERT_MSG = 'The parsing of the Reva price failed';

const handleParsingErrorLogging = (ctx, errors, otherInfoToLog = {}) => {
  if (!errors || !errors.length) return;
  errors.forEach(e => {
    e.messages.forEach(msg => logger.error({ ctx, errorMessage: msg, ...otherInfoToLog }, REVA_PARSING_ERROR_ALERT_MSG));
  });
};

const processRevaPrices = async (ctx, { revaProvider, result, rmsPricingEvent, propertyId, inventoryIds, pricing }) => {
  const { units: unitsPrices, errors } = await revaProvider.getRMSPrices(ctx, { propertyId, inventoryIds, pricing });
  handleParsingErrorLogging(ctx, errors, { propertyId });
  const saveRMSPricesErrors = await revaProvider.saveRMSPrices(ctx, { unitsPrices, propertyId, rmsPricingEvent });

  if (result && saveRMSPricesErrors.length) {
    handleErrors(saveRMSPricesErrors, result);
  }
};

const handleCatchedErrors = (ctx, message, result, error) => {
  logger.error({ ctx, errorMsg: error }, message);
  const err = Array.isArray(error) ? error : [error];
  handleParsingErrorLogging(ctx, err);
  handleErrors(err, result);
};

export const handleRevaImportFilesReceived = async (ctx, fileName) => {
  const startTime = new Date();

  const result = { errors: [], processed: 0 };
  const { metadata } = await getTenant(ctx);

  const revaProvider = metadata?.revaPricingAsRms ? new RevaRmsTestProvider() : rmsProviderFactory.getProvider(fileName);
  if (!revaProvider) {
    logger.error({ ctx }, 'No provider for Reva found');
    return result;
  }

  try {
    const propertyIdsToUpdate = await getPropertiesWherePricingRelatedTablesChanged(ctx);
    if (!propertyIdsToUpdate) return result;

    const tenantPricing = await revaProvider.getPricing(ctx);

    await execConcurrent(
      propertyIdsToUpdate,
      async ({ propertyId }) => {
        const propertyPricing = tenantPricing.filter(p => p.propertyId === propertyId);
        await processRevaPrices(ctx, { revaProvider, result, rmsPricingEvent: RmsPricingEvents.REVA_IMPORT, propertyId, pricing: propertyPricing });
        result.processed += 1;
      },
      10,
    );
  } catch (error) {
    const message = 'handling Reva price update after property setup import failed';
    handleCatchedErrors(ctx, message, result, error);
  }

  const endTime = new Date();

  logger.trace({ ctx, millis: endTime - startTime }, 'handleRevaImportFilesReceived - handling Reva price update done');
  return result;
};

export const handleInventoryUpdateReceived = async ctx => {
  const startTime = new Date();
  const result = { errors: [], processed: 0 };
  const revaProvider = new RevaProvider();

  try {
    const inventories = await getInventoriesUpdatedAfterLastPriceUpdate(ctx);
    if (!inventories || !inventories.length) return result;
    logger.info({ ctx, inventories }, 'InventoryUpdatedAfterLastPriceUpdate');

    const inventoriesGroupedByProperty = groupBy(inventories, ({ propertyId }) => propertyId);

    await execConcurrent(
      Object.keys(inventoriesGroupedByProperty),
      async propertyId => {
        const inventoryIds = (inventoriesGroupedByProperty[propertyId] || []).map(({ id }) => id);

        await processRevaPrices(ctx, { revaProvider, result, rmsPricingEvent: RmsPricingEvents.INVENTORY_STATE_CHANGE, propertyId, inventoryIds });
        result.processed += inventoryIds.length;
      },
      10,
    );
  } catch (error) {
    const message = 'handling Reva price update after inventory status change failed';
    handleCatchedErrors(ctx, message, result, error);
  }
  const endTime = new Date();
  logger.trace({ ctx, millis: endTime - startTime }, 'handleInventoryUpdateReceived - handling Reva price update done');
  return result;
};

export const generateRevaPricing = async (ctx, revaPricingAsRms) => {
  const dataToLog = { ctx, revaPricingAsRms };
  logger.trace(dataToLog, 'generateRevaAsRmsPricing - Started');

  const revaProvider = revaPricingAsRms ? new RevaRmsTestProvider() : new RevaProvider();

  try {
    const propertyIdsToUpdate = (await getProperties(ctx)).filter(({ settings }) => settings?.integration?.import?.unitPricing === false).map(({ id }) => id);

    if (!propertyIdsToUpdate) {
      logger.trace(dataToLog, 'generateRevaAsRmsPricing - No properties to update');
      return;
    }

    await mapSeries(
      propertyIdsToUpdate,
      async propertyId => await processRevaPrices(ctx, { revaProvider, rmsPricingEvent: RmsPricingEvents.REVA_IMPORT, propertyId }),
    );
  } catch (error) {
    logger.error({ ...dataToLog, error }, 'generateRevaAsRmsPricing - Failed');
  }

  logger.trace(dataToLog, 'generateRevaAsRmsPricing - Done');
  return;
};
