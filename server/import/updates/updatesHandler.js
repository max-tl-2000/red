/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import groupBy from 'lodash/groupBy';
import chunk from 'lodash/chunk';
import differenceWith from 'lodash/differenceWith';
import isEmpty from 'lodash/isEmpty';
import uniqWith from 'lodash/uniqWith';
import {
  bulkUpsertInventories,
  getInventoriesByComputedExternalId,
  getExportableRentableItemsByExternalIds,
  getInventoriesByExternalIds,
} from '../../dal/inventoryRepo.js';
import { getPartyMemberByEmailAddress, updatePartyMember, getPartyMembersByExternalIds } from '../../dal/partyRepo.js';
import {
  getPropertySettingsAndTimezone,
  getPropertiesWhereNameIn,
  getPropertiesToUpdateFromDB,
  updatePropertiesSettingsWithSpecials,
  updatePropertySettingsWithSpecialsById,
  getProperties,
} from '../../dal/propertyRepo';
import {
  updateAmenitiesEndDate,
  updateInventoryAmenitiesEndDate,
  getPropertyByInventoryAmenity,
  getAllInventoryAmenities,
  saveAmenity,
  getAllActiveInventoryAmenities,
  bulkUpsertAmenityFromUpdate,
  saveInventoryAmenity,
} from '../../dal/amenityRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { now, parseAsInTimezone, toMoment } from '../../../common/helpers/moment-utils';
import { DATE_US_FORMAT, UTC_TIMEZONE } from '../../../common/date-constants';
import moment from 'moment'; // eslint-disable-line
import { handleUpdateResidents } from './residentUpdatesHandler';
import { handleCreateParty } from './updatesHelper';
import { DIFF_ACTION_TAG, getDifferences, mapDifferences, mapEntity, getUpdatedDiffValue } from './daff-helpers';
import { execConcurrent } from '../../../common/helpers/exec-concurrent.js';
import nullish from '../../../common/helpers/nullish';
import { convertToBoolean } from '../../../common/helpers/strings';
import { MAPPING_AMENITIES, MAPPING_INVENTORY_AMENITY, DEFAULT_AMENITY_VALUES, EXCLUDE_AMENITY_COLUMNS } from './mri_mappers/mriUnitAmenitiesCsvMapper';

const logger = loggerModule.child({ subType: 'updatesHandler' });

const newAmenitiesMsg = 'new amenities found in file for property';

const getStateStartDate = (row, timezone) => {
  if (!row.startDate) {
    return now({ timezone }).startOf('day').toJSON();
  }
  return parseAsInTimezone(row.startDate, { format: DATE_US_FORMAT, timezone }).toJSON();
};

export const isMriIntegration = thirdPartySystem => thirdPartySystem === DALTypes.BackendMode.MRI || thirdPartySystem === DALTypes.BackendMode.MRI_NO_EXPORT;

const getAvailabilityDate = (row, timezone, availabilityDateSource) =>
  availabilityDateSource === DALTypes.AvailabilityDateSourceType.EXTERNAL
    ? parseAsInTimezone(row.availabilityDate, { format: DATE_US_FORMAT, timezone }).toJSON()
    : null;

export const shouldMapInventoryState = (row, timezone, backendMode) => {
  if (!isMriIntegration(backendMode)) return false;

  if (!row.availabilityDate || ![DALTypes.InventoryState.VACANT_READY, DALTypes.InventoryState.VACANT_READY_RESERVED].some(state => state === row.state)) {
    return false;
  }

  const currentDate = now({ timezone });
  const endOfLabourDate = currentDate.clone().startOf('day').add(18, 'h');

  const daysToAdd = currentDate.isAfter(endOfLabourDate, 'time') ? 1 : 0;
  const availabilityDate = parseAsInTimezone(row.availabilityDate, { format: DATE_US_FORMAT, timezone });

  return availabilityDate.isAfter(currentDate.clone().add(daysToAdd, 'd'), 'day');
};

export const getInventoryState = (row, timezone, backendMode) => {
  if (!shouldMapInventoryState(row, timezone, backendMode)) return row.state;

  switch (row.state) {
    case DALTypes.InventoryState.VACANT_READY:
      return DALTypes.InventoryState.VACANT_MAKE_READY;
    case DALTypes.InventoryState.VACANT_READY_RESERVED:
      return DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED;
    default:
      return row.state;
  }
};

const warnAboutMissingInventoriesInDb = (ctx, inventories, changedInventories, externalFieldName = 'externalId') => {
  const missingInventories = changedInventories
    .reduce((acc, item) => {
      if (!inventories[item[externalFieldName]]) acc.push(item[externalFieldName]);
      return acc;
    }, [])
    .join(', ');
  missingInventories && logger.error({ ctx, missingInventories }, 'warnAboutMissingInventoriesInDb');
};

const getPropertyIds = (inventories, changedInventories, externalFieldName = 'externalId') => {
  const properties = changedInventories.reduce((acc, ci) => {
    const { propertyId } = inventories[ci[externalFieldName]] || {};

    if (propertyId && !acc[propertyId]) acc[propertyId] = true;
    return acc;
  }, {});

  return Object.keys(properties);
};

const getPropertySettingsAndTimezoneByPropertyId = async (ctx, inventories, changedInventories, externalFieldName = 'externalId') => {
  const propertyIds = getPropertyIds(inventories, changedInventories, externalFieldName);
  const properties = await getPropertySettingsAndTimezone(ctx, propertyIds);

  return properties.reduce((acc, property) => {
    acc[property.id] = {
      settings: property.settings,
      timezone: property.timezone,
    };
    return acc;
  }, {});
};

const bulkInventoryUpdate = async (ctx, changedInventories, thirdPartySystem) => {
  const inventories = await getInventoriesByComputedExternalId(
    ctx,
    changedInventories.map(i => i.computedExternalId),
  );

  const externalFieldName = 'computedExternalId';
  warnAboutMissingInventoriesInDb(ctx, inventories, changedInventories, externalFieldName);

  const propertySettingsAndTimeZone = await getPropertySettingsAndTimezoneByPropertyId(ctx, inventories, changedInventories, externalFieldName);

  const recordsToUpdate = await mapSeries(changedInventories, async ci => {
    const inventory = inventories[ci[externalFieldName]];
    if (!inventory) return null;

    if (!ci.state) {
      logger.error({ ctx, row: ci }, 'unknown unit status');
      return null;
    }

    const { timezone, settings = {} } = propertySettingsAndTimeZone[inventory.propertyId];
    const { inventoryAvailabilityDate } = (settings.integration || {}).import || {};
    const inventoryState = getInventoryState(ci, timezone, thirdPartySystem);
    const ciAvailabilityDate = getAvailabilityDate(ci, timezone, inventoryAvailabilityDate);
    const nullAvailabilityDate = nullish(ciAvailabilityDate) && nullish(inventory.availabilityDate);

    if (inventory.state === inventoryState && (nullAvailabilityDate || moment(ciAvailabilityDate).isSame(inventory.availabilityDate))) return null;

    return {
      ...inventory,
      state: inventoryState,
      stateStartDate: getStateStartDate(ci, timezone),
      availabilityDate: ciAvailabilityDate,
    };
  }).filter(result => result);

  return await bulkUpsertInventories(ctx, recordsToUpdate);
};

const reduceUpdateInventoryDiffHandler = (headers, action = DIFF_ACTION_TAG.insert, actionsFilter = []) => (acc, row) => {
  if (actionsFilter.includes(action)) {
    const data = mapEntity(headers, row, (key, value) => [key, value]);
    acc.push(data);
    return acc;
  }

  switch (action) {
    case DIFF_ACTION_TAG.update:
    case DIFF_ACTION_TAG.insert: {
      const data = mapEntity(headers, row, (key, value) => [key, value]);
      acc.push(data);
      break;
    }
    default:
      break;
  }
  return acc;
};

export const getUpdatedInventory = (ctx, { actual, previous, headers, actionsFilter }) => {
  logger.debug({ ctx, rows: actual && actual.length }, 'update inventory');

  if (!previous?.length) {
    if (!actionsFilter?.includes(DIFF_ACTION_TAG.delete)) {
      return actual.reduce(reduceUpdateInventoryDiffHandler(headers), []);
    }
    return [];
  }

  const diff = getDifferences(headers, previous, actual);
  logger.debug({ ctx, diff }, 'update inventory - diff');
  if (!(diff && diff.data && diff.data.length)) return [];

  return mapDifferences(diff.data, action => reduceUpdateInventoryDiffHandler(headers, action, actionsFilter));
};

const mapHeadersWithRows = (headers, rows) => rows.map(row => mapEntity(headers, row, (key, value) => [key, value]));

const getPropertyNamesInFile = (headers, rows) => {
  const data = mapHeadersWithRows(headers, rows);

  return data.reduce((acc, row) => {
    if (acc.includes(row.property)) return acc;

    return [...acc, row.property];
  }, []);
};

const getMissingProperties = (propertyNamesToUpdateInDB, propertyNamesInFile) =>
  propertyNamesToUpdateInDB.reduce((acc, property) => {
    if (!propertyNamesInFile.includes(property)) return [...acc, property];
    return acc;
  }, []);

const checkForMissingProperties = async (ctx, headers, actual) => {
  const propertiesToUpdateFromDB = await getPropertiesToUpdateFromDB(ctx);
  const propertyNamesToUpdateInDB = propertiesToUpdateFromDB.map(property => property.name);
  const propertyNamesInFile = getPropertyNamesInFile(headers, actual);

  const missingProperties = getMissingProperties(propertyNamesToUpdateInDB, propertyNamesInFile);
  missingProperties.length && logger.error({ ctx, missingProperties }, 'Missing properties to update unit states');
};

export const updateInventory = async (ctx, actual, previous, headers, entityType, thirdPartySystem = DALTypes.BackendMode.NONE) => {
  const delta = getUpdatedInventory(ctx, { actual, previous, headers });
  logger.debug({ ctx, rows: delta && delta.length, entityType, thirdPartySystem }, 'updated inventories');
  if (!(delta && delta.length)) return;

  await bulkInventoryUpdate(ctx, delta, thirdPartySystem);
  await checkForMissingProperties(ctx, headers, actual);
};

const getRentableItemState = (rentableItemState, availabilityDate, timezone) => {
  const isFutureDate = availabilityDate && toMoment(availabilityDate).isAfter(now({ timezone }));
  if (!isFutureDate) return rentableItemState;

  const state = DALTypes.InventoryState;

  switch (rentableItemState) {
    case state.VACANT_READY:
      return state.VACANT_MAKE_READY;
    case state.OCCUPIED:
    case state.DOWN:
      return state.OCCUPIED_NOTICE;
    default:
      return rentableItemState;
  }
};

const getInventoriesLossLeaderUnitFlagToUpdate = (dbInventories, updatedInventories) => {
  const inventoriesToUpdate = updatedInventories.map(importedInventory => {
    const dbInventory = dbInventories.find(inv => inv.externalId === importedInventory.externalId);
    if (!dbInventory) return {};

    const { timezone, ...inventory } = dbInventory;
    const importedLossLeaderUnitFlag = convertToBoolean(importedInventory.lossLeaderUnitFlag);

    if (importedLossLeaderUnitFlag && !dbInventory.lossLeaderUnit) {
      return { ...inventory, lossLeaderUnit: now({ timezone }).startOf('day').toJSON() };
    }
    if (!importedLossLeaderUnitFlag && !!dbInventory.lossLeaderUnit) return { ...inventory, lossLeaderUnit: null };
    return {};
  });

  return inventoriesToUpdate.filter(inv => inv?.id);
};

export const updateInventoryLossLearderUnit = async (ctx, actual, previous, headers, entityType) => {
  const changedInventories = getUpdatedInventory(ctx, { actual, previous, headers });
  logger.debug({ ctx, rows: changedInventories?.length, entityType }, 'updated inventories loss leader unit flag');

  if (!changedInventories?.length) return;

  const inventories = await getInventoriesByExternalIds(
    ctx,
    changedInventories.map(i => i.externalId),
  );

  const inventoriesToUpdate = getInventoriesLossLeaderUnitFlagToUpdate(inventories, changedInventories);
  await bulkUpsertInventories(ctx, inventoriesToUpdate);
};

/*
 * This function compares the inventories we have on the database against the inventories coming on the csv file.
 * As a result we have =
 * inventoriesToUpdate: Inventories that are valid
 * missingInventories: Inventories(different than DOWN) that are in the csv file but not in our database
 * inactiveWithStateChangeInventories: Inventories that are inactive in our database but we are still receiving state changes on the csv file
 */
const groupChangedInventories = (changedInventories, inventories) =>
  changedInventories.reduce(
    (acc, item) => {
      const { externalId } = item;
      const dbInventory = inventories.find(i => i.computedExternalId === externalId);

      if (item.state !== DALTypes.InventoryState.DOWN && !dbInventory) {
        acc.missingInventories.push(externalId);
      } else if (item.state !== DALTypes.InventoryState.DOWN && dbInventory?.inactive) {
        acc.inactiveWithStateChangeInventories.push(externalId);
      } else if (dbInventory) {
        const { computedExternalId, timezone, ...rest } = dbInventory;
        const availabilityDate = item.stateStartDate ? parseAsInTimezone(item.stateStartDate, { format: DATE_US_FORMAT, timezone }).toJSON() : '';
        acc.inventoriesToUpdate.push({
          ...rest,
          state: getRentableItemState(item.state, availabilityDate, timezone),
          ...(availabilityDate && { stateStartDate: availabilityDate }),
        });
      }

      return acc;
    },
    { inventoriesToUpdate: [], missingInventories: [], inactiveWithStateChangeInventories: [] },
  );

const warnAboutInconsistenciesOnInventories = (ctx, { missingInventories, inactiveWithStateChangeInventories }) => {
  missingInventories.length && logger.error({ ctx, missingInventories: missingInventories.join(',') }, 'warnAboutMissingInventoriesInDb');

  inactiveWithStateChangeInventories.length &&
    logger.error({ ctx, inactiveWithStateChangeInventories: inactiveWithStateChangeInventories.join(',') }, 'warnAboutInactiveWithStateChangeInventoriesInDb');
};

const warnAboutDeletedInventories = (ctx, deletedInventories, inventories) => {
  if (!deletedInventories.length) return;

  const deletedAndActiveInventories = deletedInventories
    .reduce((acc, item) => {
      const { externalId } = item;
      if (inventories.some(i => i.computedExternalId === externalId && !i.inactive)) acc.push(externalId);
      return acc;
    }, [])
    .join(', ');
  deletedAndActiveInventories && logger.error({ ctx, deletedAndActiveInventories }, 'warnAboutStillActiveInventoriesInDb');

  return;
};

export const updateRentableItemsStates = async (ctx, actual, previous, headers, entityType) => {
  const changedInventories = getUpdatedInventory(ctx, { actual, previous, headers });
  logger.debug({ ctx, rows: changedInventories && changedInventories.length, entityType }, 'updated inventories states');
  if (!(changedInventories && changedInventories.length)) return;

  changedInventories.shift();

  const inventories = await getExportableRentableItemsByExternalIds(
    ctx,
    changedInventories.map(i => i.externalId),
    true, // checkImportSetting
  );

  const { inventoriesToUpdate, missingInventories, inactiveWithStateChangeInventories } = groupChangedInventories(changedInventories, inventories);

  warnAboutInconsistenciesOnInventories(ctx, { missingInventories, inactiveWithStateChangeInventories });

  const deletedInventories = getUpdatedInventory(ctx, { actual, previous, headers, actionsFilter: [DIFF_ACTION_TAG.delete] });
  warnAboutDeletedInventories(ctx, deletedInventories, inventories);

  await bulkUpsertInventories(ctx, inventoriesToUpdate);
};

export const updateResidents = async (ctx, actual, previous, headers) => {
  logger.debug({ ctx, rows: actual && actual.length }, 'update residents');

  let errors = [];
  let indexObject = {};

  if (previous && previous.length) {
    const diff = getDifferences(headers, previous, actual);
    logger.debug({ diff }, 'Update residents - diff');
    const diffRows = [];
    let newRow;
    diff.data.forEach(row => {
      switch (row[0]) {
        case DIFF_ACTION_TAG.header:
          indexObject = row.reduce((acc, item) => {
            if (item.trim()) acc[item] = row.indexOf(item);
            return acc;
          }, {});
          break;
        case DIFF_ACTION_TAG.insert:
          diffRows.push(row);
          break;
        case DIFF_ACTION_TAG.update:
          if (row[indexObject.partyStatus].indexOf(DIFF_ACTION_TAG.update) > -1) {
            // Only consider changes on status
            newRow = row.map(getUpdatedDiffValue);
            diffRows.push(newRow);
          }
          break;
        default:
          break;
      }
    });
    errors = await handleUpdateResidents(ctx, diffRows, indexObject);
  } else {
    indexObject = headers.reduce((acc, item) => {
      acc[item] = headers.indexOf(item);
      return acc;
    }, {});

    errors = await handleUpdateResidents(ctx, actual, indexObject, true);
  }

  return errors;
};

const handleUpdateRoommates = async (ctx, rows, indexObject) => {
  const errors = [];
  const tenantCodes = rows.map(x => x[indexObject.tenantCode]);
  const partyMembers = await getPartyMembersByExternalIds(ctx, tenantCodes);
  logger.debug({ ctx, partyMembers }, 'handleUpdateRoommates partyMembers');

  const matchesTenantCode = rows.reduce((acc, item) => {
    const list = partyMembers.filter(x => x.externalId === item[indexObject.tenantCode]);
    if (list && list.length) {
      acc.push([...item, list[0].partyId]);
    } else {
      errors.push(`MISSING TENANTCODE: ${item[indexObject.tenantCode]}`);
    }
    return acc;
  }, []);

  logger.debug({ ctx, matchesTenantCode }, 'handleUpdateRoommates - matchesTenantCode');
  const roommateCodes = matchesTenantCode.map(x => x[indexObject.roommateCode]);
  const matchesRoommates = await getPartyMembersByExternalIds(ctx, roommateCodes);
  logger.debug({ ctx, matchesRoommates }, 'handleUpdateRoommates - matchesRoommates');

  const missingRoommateCodes = matchesTenantCode.reduce((acc, item) => {
    if (!matchesRoommates.some(x => x.externalId === item[indexObject.roommateCode])) {
      acc.push(item);
    }
    return acc;
  }, []);
  logger.debug({ ctx, missingRoommateCodes }, 'handleUpdateRoommates - missingRoommateCodes');

  const matchesEmail = await execConcurrent(missingRoommateCodes, async x => await getPartyMemberByEmailAddress(ctx, x[indexObject.email]));
  logger.debug({ ctx, matchesEmail, test: matchesEmail[0] }, 'matchesEmail');

  const updates = [];
  const inserts = [];
  missingRoommateCodes.forEach(x => {
    const list = matchesEmail.filter(
      e => e && e.partyId === x[indexObject.roommateCode + 1] && e.contactInfo && e.contactInfo.defaultEmail === x[indexObject.email],
    );
    if (list && list.length) {
      const partyMemberToUpdate = list[0];
      partyMemberToUpdate.externalId = x[indexObject.roommateCode];
      updates.push(partyMemberToUpdate);
    } else {
      inserts.push(x);
    }
  });

  logger.debug({ ctx, length: updates.length }, 'handleUpdateRoommates - rows to update');
  logger.debug({ ctx, length: inserts.length }, 'handleUpdateRoommates - rows to insert');

  for (const item of updates) {
    logger.debug({ ctx, item }, 'handleUpdateRoommates - updating partyMember');
    await updatePartyMember(ctx, item.id, item);
  }

  for (const item of inserts) {
    logger.debug({ ctx, item }, 'handleUpdateRoommates - creating partyMember');
    await handleCreateParty({
      ctx,
      partyState: DALTypes.PartyStateType.RESIDENT,
      fullName: `${item[indexObject.firstName]} ${item[indexObject.lastName]}`,
      preferredName: item[indexObject.firstName],
      memberType: DALTypes.MemberType.OCCUPANT,
      externalId: item[indexObject.roommateCode],
      email: item[indexObject.email],
      phone: item[indexObject.phoneNumber],
      cellPhone: item[indexObject.cellPhoneNumber],
      partyId: item[indexObject.roommateCode + 1],
    });
  }
  return errors;
};

export const updateRoommates = async (ctx, actual, previous, headers) => {
  logger.debug({ ctx, rows: actual && actual.length }, 'update roommates');

  let errors = [];
  let indexObject = {};

  if (previous && previous.length) {
    const diff = getDifferences(headers, previous, actual);
    logger.debug({ ctx, diff }, 'Update roommates - diff');

    const diffRows = [];
    let newRow;

    diff.data.forEach(row => {
      switch (row[0]) {
        case DIFF_ACTION_TAG.header:
          indexObject = row.reduce((acc, item) => {
            if (item.trim()) acc[item] = row.indexOf(item);
            return acc;
          }, {});
          break;
        case DIFF_ACTION_TAG.insert:
          diffRows.push(row);
          break;
        case DIFF_ACTION_TAG.update:
          newRow = row.map(getUpdatedDiffValue);
          diffRows.push(newRow);
          break;
        default:
          break;
      }
    });
    errors = await handleUpdateRoommates(ctx, diffRows, indexObject);
  } else {
    indexObject = headers.reduce((acc, item) => {
      acc[item] = headers.indexOf(item);
      return acc;
    }, {});

    errors = await handleUpdateRoommates(ctx, actual, indexObject);
  }
  return errors;
};

const sanitizeSpecials = specials => specials.replace(/'/g, "''").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');

const getPropertyIdsWithSpecials = async (ctx, properties) => {
  const newPropertiesSpecials = properties.filter(p => !!p.property);
  const newPropertiesNames = newPropertiesSpecials?.map(p => p.property);
  if (!newPropertiesNames) return [];
  const propertiesToSanitize = await getPropertiesWhereNameIn(ctx, newPropertiesNames);
  if (!propertiesToSanitize) return [];

  return propertiesToSanitize.map(propertyToSanitize => {
    const newSpecial = newPropertiesSpecials.find(elem => elem.property === propertyToSanitize.name).specials || '';
    return { id: propertyToSanitize.id, specials: sanitizeSpecials(newSpecial) };
  });
};

const getPropertiesToUpdate = (ctx, { actual, previous, headers }) => {
  let propertiesToUpdate;
  if (!previous || !previous.length) {
    propertiesToUpdate = actual.reduce(reduceUpdateInventoryDiffHandler(headers), []);
    return getPropertyIdsWithSpecials(ctx, propertiesToUpdate);
  }

  const diff = getDifferences(headers, previous, actual);
  logger.debug({ ctx, diff }, 'update inventory - diff');
  if (!(diff && diff.data && diff.data.length)) return [];
  propertiesToUpdate = mapDifferences(diff.data, action => reduceUpdateInventoryDiffHandler(headers, action));

  return getPropertyIdsWithSpecials(ctx, propertiesToUpdate);
};

const removeCsvHeaders = actual => {
  actual.shift();
  return actual;
};

export const updatePropertySettingsWithSpecials = async (ctx, actual, previous, headers) => {
  const propertiesToUpdate = await getPropertiesToUpdate(ctx, {
    actual: removeCsvHeaders(actual),
    previous,
    headers,
  });
  if (propertiesToUpdate && propertiesToUpdate.length) {
    try {
      await updatePropertiesSettingsWithSpecials(ctx, propertiesToUpdate);
    } catch (err) {
      logger.warn({ ctx, err }, 'Error updating multiple property specials');

      const failingProperties = [];
      await mapSeries(propertiesToUpdate, async propertyToUpdate => {
        try {
          await updatePropertySettingsWithSpecialsById(ctx, propertyToUpdate);
        } catch (error) {
          failingProperties.push(propertyToUpdate);
        }
      });
      failingProperties.length && logger.error({ ctx, failingProperties }, 'Error updating property specials');
    }
  }
};

const bulkUpdateAmenity = async (ctx, amenities) => {
  const amenitiesWithoutDuplicates = amenities.reduce((acc, current) => {
    const amenity = acc.find(item => item.id === current.id);
    if (!amenity) {
      acc.push(current);
    }
    return acc;
  }, []);

  const { updateEndDateAmenityIds, updateAmenitiesWithNoEndDate } = amenitiesWithoutDuplicates.reduce(
    (acc, item) => {
      if (item.endDate) {
        acc.updateEndDateAmenityIds.push(item.id);
        item.endDate = null;
      }
      acc.updateAmenitiesWithNoEndDate.push(item);
      return acc;
    },
    { updateEndDateAmenityIds: [], updateAmenitiesWithNoEndDate: [] },
  );
  logger.info({ ctx, updatedRows: updateAmenitiesWithNoEndDate.length }, 'updating amenities from file');
  await updateAmenitiesEndDate(ctx, updateEndDateAmenityIds, null);

  return await bulkUpsertAmenityFromUpdate(ctx, updateAmenitiesWithNoEndDate, EXCLUDE_AMENITY_COLUMNS);
};

const insertNewInventoryAmenities = async (ctx, inventoryAmenities) => {
  await mapSeries(inventoryAmenities, async InventoryAmenity => {
    await saveInventoryAmenity(ctx, InventoryAmenity);
  });
};

const getNewAmenitiesWarningAndLogThem = (ctx, amenities, propertiesWithNames) => {
  const amenitiesByPropertyId = groupBy(amenities, 'propertyId');
  const properties = Object.keys(amenitiesByPropertyId);
  const warnMessages = [];
  properties.forEach(propertyId => {
    const propertyName = propertiesWithNames[propertyId];
    const message = `${newAmenitiesMsg} ${propertyName}-> `;
    const amenitiesFormatedMessage = [];
    amenitiesByPropertyId[propertyId].forEach((amenity, index) => {
      amenitiesFormatedMessage.push(`${index}- name: ${amenity.name}, absolutePrice: ${amenity.absolutePrice} externalId: ${amenity.externalId}`);
    });
    const warnMessage = `${message} ${amenitiesFormatedMessage.join(', ')}`;
    logger.warn({ ctx }, warnMessage);
    warnMessages.push(warnMessage);
  });
  return warnMessages;
};

const insertNewAmenities = async (ctx, amenities) =>
  await mapSeries(amenities, async amenity => {
    await saveAmenity(ctx, amenity);
  });

const processUpdateOrInsertAmenities = async (ctx, amenityInformation, properties) => {
  const { insert: insertAmenities = [], update: updateAmenities = [] } = amenityInformation;
  await bulkUpdateAmenity(ctx, updateAmenities);
  if (insertAmenities.length > 0) {
    const newAmenitiesMessages = getNewAmenitiesWarningAndLogThem(ctx, insertAmenities, properties);
    await insertNewAmenities(ctx, insertAmenities);
    return newAmenitiesMessages;
  }
  return null;
};

const filterDuplicateAmenities = amenities => {
  const uniqueAmenities = uniqWith(
    amenities,
    (amenityA, amenityB) => amenityA.propertyId === amenityB.propertyId && amenityA.name === amenityB.name && amenityA.externalId === amenityB.externalId,
  );

  return uniqueAmenities.filter(amenity => !amenity.endDate && !amenity.exists);
};

const isdisplayNameValid = displayName => isEmpty(displayName);

const prepareBulkAmenity = (changedAmenities, amenities) => {
  const filteredDuplicateAmenities = filterDuplicateAmenities(changedAmenities);
  const amenitiesHash = new Map(amenities.map(amenity => [`${amenity.propertyId}_${amenity.name}_${amenity.externalId}`, amenity]));
  return filteredDuplicateAmenities.reduce(
    (acc, item) => {
      const amenity = amenitiesHash.get(`${item.propertyId}_${item.name}_${item.externalId}`);
      const displayNameError = isdisplayNameValid(item.displayName);
      if (displayNameError) {
        logger.error({ ctx: item }, 'Invalid displayName found for amenity');
        acc.errors.push(`Invalid displayName found for amenity ${JSON.stringify(item)}`);
        item.displayName = item.externalId;
      }
      if (!amenity) {
        acc.insert.push({
          ...item,
          ...DEFAULT_AMENITY_VALUES,
        });
      } else {
        acc.update.push({
          ...amenity,
          absolutePrice: item.absolutePrice,
          displayName: item.displayName,
        });
      }
      return acc;
    },
    { insert: [], update: [], errors: [] },
  );
};

const prepareInventoryAmenity = async (ctx, amenities, changedAmenities, inventoryAmenities) => {
  const errors = [];
  const preparedInfo = [];
  await mapSeries(changedAmenities, async changedAmenity => {
    const amenity = amenities.find(
      a => a.propertyId === changedAmenity?.propertyExternalId && a.name === changedAmenity.amenityName && a.externalId === changedAmenity.amenityExternalId,
    );
    if (!amenity) {
      const error = `No amenity match for InventoryAmenity propertyId:${changedAmenity?.propertyExternalId}, amenityName:${changedAmenity.amenityName}, amenityExternalId:${changedAmenity.amenityExternalId}`;
      logger.error({ ctx, changedAmenity }, error);
      errors.push(error);
    }
    const existinginventoryAmenity = inventoryAmenities.find(
      inventoryAmenity => inventoryAmenity.amenityId === amenity?.id && inventoryAmenity.inventoryId === changedAmenity.inventoryId,
    );
    if (amenity && changedAmenity.inventoryId) {
      preparedInfo.push({
        propertyId: changedAmenity.propertyExternalId,
        inventoryId: changedAmenity.inventoryId,
        amenityId: amenity.id,
        endDate: null,
        exists: !!existinginventoryAmenity,
      });
    }
  });
  return { preparedInventoryAmenities: preparedInfo, errors };
};

const getOnlyAmenitiesWithSettingEnable = async (ctx, amenities) => {
  const properties = await getProperties(ctx);
  const propertiesById = properties.reduce((acc, property) => {
    acc[property.id] = { settings: property.settings };
    return acc;
  }, {});

  return amenities.filter(amenity => {
    const {
      settings: { integration },
    } = propertiesById[amenity.propertyId];

    return integration.import.amenities;
  });
};

const compareInventoryAmenityIterator = (a, b) => a.inventoryId === b.inventoryId && a.amenityId === b.amenityId;

const updateMissingInventoryAmenities = async (ctx, inventoryAmenities, inventoryAmenitiesInFile) => {
  logger.trace({ ctx }, 'checking missing inventory amenities in file');
  const missingInventoryAmenityIds = differenceWith(inventoryAmenities, inventoryAmenitiesInFile, compareInventoryAmenityIterator)?.map(
    missingInventoryAmenity => missingInventoryAmenity.id,
  );
  if (missingInventoryAmenityIds?.length) {
    const missingInventoriesWithPropertyId = await getPropertyByInventoryAmenity(ctx, missingInventoryAmenityIds);
    const validMissingInventoryAmenities = await getOnlyAmenitiesWithSettingEnable(ctx, missingInventoriesWithPropertyId);
    if (validMissingInventoryAmenities?.length) {
      const validMissingAmenitiesIds = await validMissingInventoryAmenities.map(inventoryAmenity => inventoryAmenity.id);
      logger.trace({ ctx, validMissingAmenitiesIds }, 'missing DB inventory amenities in file');
      try {
        const batchOfMissingInventoryAmenities = chunk(validMissingAmenitiesIds, 1000);
        await mapSeries(batchOfMissingInventoryAmenities, async batch => await updateInventoryAmenitiesEndDate(ctx, batch, now(UTC_TIMEZONE)));
      } catch (err) {
        logger.error({ ctx, err }, 'Error updating inventory_amenity endDate');
        return 'Error updating inventory_amenity endDate';
      }
    }
  }
  return null;
};

const mapUnitAmenitiesToAmenities = (unitAmenities, areChangedNeeded = true) => {
  const filterUnitsAmenitiesByChangedFlag = unitAmenities.filter(unitAmenity => (!areChangedNeeded ? unitAmenity : unitAmenity.isUnchanged === false));
  return filterUnitsAmenitiesByChangedFlag.map(unitAmenity =>
    Object.keys(unitAmenity).reduce((acc, key) => {
      if (MAPPING_AMENITIES[key]) {
        acc[MAPPING_AMENITIES[key]] = unitAmenity[key];
      }
      return acc;
    }, {}),
  );
};

const compareAmenityIterator = (a, b) => a.propertyId === b.propertyId && a.name === b.name && a.externalId === b.externalId;

const updateMissingAmenitiesInFile = async (ctx, amenities, changedAmenities) => {
  logger.trace({ ctx }, 'updating missing amenities in file');
  const missingAmenities = differenceWith(amenities, changedAmenities, compareAmenityIterator);
  const validMissingAmenities = await getOnlyAmenitiesWithSettingEnable(ctx, missingAmenities);
  if (validMissingAmenities?.length) {
    const validMissingAmenitiesIds = validMissingAmenities.map(amenity => amenity.id);
    try {
      const batchOfMissingAmenities = chunk(validMissingAmenitiesIds, 1000);
      await mapSeries(batchOfMissingAmenities, async batch => await updateAmenitiesEndDate(ctx, batch, now(UTC_TIMEZONE)));
    } catch (err) {
      logger.error({ ctx, err }, 'Error updating amenity endDate');
      return 'Error updating amenity endDate';
    }
  }
  return null;
};

export const updateOrInsertAmenities = async (ctx, changedUnitAmenities, properties) => {
  logger.trace({ ctx }, 'updateOrInsertAmenities');
  const errors = [];
  const changedMappedAmenities = mapUnitAmenitiesToAmenities(changedUnitAmenities, false);
  try {
    if (!changedMappedAmenities?.length) return errors;
    const DBamenities = await getAllInventoryAmenities(ctx);
    const updateMissingAmenitiesError = await updateMissingAmenitiesInFile(ctx, DBamenities, changedMappedAmenities);
    if (updateMissingAmenitiesError) {
      errors.push(updateMissingAmenitiesError);
    }
    const bulkAmenityInformation = prepareBulkAmenity(changedMappedAmenities, DBamenities);
    const insertError = await processUpdateOrInsertAmenities(ctx, bulkAmenityInformation, properties);
    if (insertError) {
      errors.push(insertError);
    }
  } catch (error) {
    logger.error({ ctx, error }, 'error on updateOrInsertAmenities');
    errors.push(error.message);
  }
  return errors;
};

const filterActiveInventoryAmenities = inventoryAmenities =>
  inventoryAmenities.reduce((acc, inventoryAmenity) => {
    const duplicatedAmenity = acc.find(item => item.inventoryId === inventoryAmenity.inventoryId && item.amenityId === inventoryAmenity.amenityId);
    if (!duplicatedAmenity && !inventoryAmenity.endDate && !inventoryAmenity.exists) {
      acc.push(inventoryAmenity);
    }
    return acc;
  }, []);

const mapInventoryAmenitiesToDBInventoryAmenity = inventoryAmenities =>
  inventoryAmenities.map(inventoryAmenity =>
    Object.keys(inventoryAmenity).reduce((acc, key) => {
      if (MAPPING_INVENTORY_AMENITY[key]) {
        acc[MAPPING_INVENTORY_AMENITY[key]] = inventoryAmenity[key];
      }
      return acc;
    }, {}),
  );

export const updateOrInsertInventoryAmenities = async (ctx, changedUnitAmenities) => {
  logger.info({ ctx }, 'insert new inventoryAmenities');
  let errors = [];
  try {
    const DBAamenities = await getAllInventoryAmenities(ctx);
    const inventoryAmenities = await getAllActiveInventoryAmenities(ctx);
    const { preparedInventoryAmenities, errors: prepareInventoryAmenityErrors } = await prepareInventoryAmenity(
      ctx,
      DBAamenities,
      changedUnitAmenities,
      inventoryAmenities,
    );
    if (prepareInventoryAmenityErrors?.length) {
      errors = errors.concat(prepareInventoryAmenityErrors);
    }
    if (!preparedInventoryAmenities?.length) return errors;
    const filteredInventoryAmenities = filterActiveInventoryAmenities(preparedInventoryAmenities);
    const mappedInventoryAmenitiesToDB = mapInventoryAmenitiesToDBInventoryAmenity(filteredInventoryAmenities);
    const updateMissingAmenitiesInFileError = await updateMissingInventoryAmenities(ctx, inventoryAmenities, preparedInventoryAmenities);
    if (updateMissingAmenitiesInFileError) {
      errors.push(updateMissingAmenitiesInFileError);
    }
    await insertNewInventoryAmenities(ctx, mappedInventoryAmenitiesToDB);
  } catch (error) {
    logger.error({ ctx, error }, 'error on updateOrInsertInventoryAmenities');
    errors.push(error.message);
  }
  return errors;
};
