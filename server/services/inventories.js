/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';
import * as inventoryRepo from '../dal/inventoryRepo';
import { getLayouts } from './layouts.js';
import { getBuildings } from './buildings.js';
import { knex } from '../database/factory';
import { ServiceError } from '../common/errors';
import { DALTypes } from '../../common/enums/DALTypes';
import {
  inventoryStateFutureDate,
  inventoryStateTransitionOnLeaseExecuted,
  inventoryStateTransitionOnLeaseVoided,
  getShortFormatRentableItem,
} from '../helpers/inventory';
import { getLifeStylesForProperty } from '../dal/propertyRepo';
import { getLeaseTermsByInventoryId } from '../dal/leaseTermRepo';
import { getInventoryLeasePartyMembers } from '../dal/leaseRepo';
import { loadPartyById, getPartyWorkflowByPartyId } from '../dal/partyRepo';
import { getTasksForPartiesByName } from '../dal/tasksRepo';
import { getActiveConcessionsFromLeaseTerms } from './concessions';
import logger from '../../common/helpers/logger';
import { ActionTypes } from '../../common/enums/actionTypes';
import { logEntity } from './activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { toMoment, now, momentNow } from '../../common/helpers/moment-utils';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { getUserById } from '../dal/usersRepo';
import { getQuotesByInventoryIdForActiveParties, getQuotesByPartyId } from '../dal/quoteRepo';
import { sendMessageToCompletePlaceInventoryOnHoldTask } from '../helpers/taskUtils';
import { isInventoryLeasedOnPartyType } from '../../common/helpers/inventory';
import { getMarketRentInfoForUnit, isSpecial } from './helpers/marketRentHelpers';
import { saveUnitHeldEvent, saveUnitReleasedEvent } from './partyEvent';
import { getPartyById } from './party';

export const getRoomValue = value => (value % 1 === 0 ? Math.floor(value) : parseFloat(value).toFixed(1));

export const getAmenitiesFromInventoryById = async (ctx, inventoryId) => {
  const [inventory] = await knex
    .withSchema(ctx.tenantId)
    .from('Inventory')
    .select('id', 'buildingId', 'propertyId', 'inventoryGroupId', 'layoutId')
    .where({ id: inventoryId });
  return await inventoryRepo.getInventoryAmenities(ctx, inventory);
};

export const getInventoryItem = async (ctx, inventoryId) => {
  try {
    return await inventoryRepo.getInventoryById(ctx, {
      id: inventoryId,
    });
  } catch (error) {
    logger.error({ ctx, error, inventoryId }, 'Error loading inventory item');
    throw new ServiceError('ERROR_LOADING_INVENTORY');
  }
};

export const getInventoryExpanded = (ctx, inventoryId) =>
  inventoryRepo.getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });

export const loadInventoryTypes = object => Object.keys(object).map(key => ({ key, type: object[key] }));

const removeFkField = (obj, relation, fk) => {
  if (obj[relation] && obj[relation].id) {
    delete obj[fk];
  }
};

export const getInventoryItemWithDetailsForSearch = async (ctx, inventoryId) => {
  const inventory = await inventoryRepo.getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });

  const amenities = inventory && (await inventoryRepo.getInventoryAmenities(ctx, inventory));

  return {
    ...inventory,
    amenities,
    address:
      (inventory && inventory.property && inventory.property.address.addressLine1) ||
      (inventory && inventory.building && inventory.building.address.addressLine1) ||
      {},
  };
};

const doesUnitHaveSpecials = async (ctx, amenities, inventory) => {
  const leaseTerms = await getLeaseTermsByInventoryId(ctx, inventory?.id);
  const concessions = await getActiveConcessionsFromLeaseTerms(ctx, leaseTerms, amenities, inventory, momentNow());
  if (concessions.some(concession => isSpecial(concession))) return true;

  return false;
};

export const getInventoryItemWithDetails = async (ctx, inventoryId, { partyId } = {}) => {
  try {
    const inventory = await inventoryRepo.getInventoryById(ctx, {
      id: inventoryId,
      expand: true,
    });

    inventory.property.lifeStyles = await getLifeStylesForProperty(ctx, inventory.propertyId);

    const amenities = await inventoryRepo.getInventoryAmenities(ctx, inventory);
    inventory.building.amenities = amenities.filter(a => a.category === 'building');
    inventory.property.amenities = amenities.filter(a => a.category === 'property');
    const propertySettings = inventory.property.settings || {};
    const { hideStateFlag } = propertySettings.inventory || {};
    const { inventoryAvailabilityDate } = (propertySettings.integration || {}).import || {};
    inventory.availabilityDateSource = inventoryAvailabilityDate;
    inventory.hideStateFlag = hideStateFlag;

    const { adjustedMarketRent, isRenewal } = partyId
      ? await getMarketRentInfoForUnit(ctx, inventory, {
          property: inventory.property,
          partyId,
        })
      : {};

    removeFkField(inventory, 'building', 'buildingId');
    removeFkField(inventory, 'property', 'propertyId');
    removeFkField(inventory, 'layout', 'layoutId');

    removeFkField(inventory.building, 'address', 'addressId');
    removeFkField(inventory.property, 'address', 'addressId');

    const propertyTimezone = inventory.property.timezone;
    const nextStateExpectedDate = inventoryStateFutureDate({
      id: inventoryId,
      propertyTimezone,
      stateStartDate: inventory.stateStartDate,
      availabilityDateSource: inventoryAvailabilityDate,
      availabilityDate: inventory.availabilityDate,
    });

    const inventoryLeaseHolds = await inventoryRepo.getInventoryHolds(ctx, inventoryId, [DALTypes.InventoryOnHoldReason.LEASE]);
    const workflowName = partyId && (await getPartyWorkflowByPartyId(ctx, partyId));
    const inventoryLeased = inventoryLeaseHolds.length || isInventoryLeasedOnPartyType(inventory.state, { workflowName });
    const leaseMembers = inventoryLeased ? await getInventoryLeasePartyMembers(ctx, inventory.id) : [];

    return {
      ...inventory,
      amenities,
      address: (inventory.property && inventory.property.address) || (inventory.building && inventory.building.address) || {},
      inventoryAddress: inventory.address,
      complimentaryItems: await inventoryRepo.getComplimentsForInventory(ctx, inventory),
      layouts: await getLayouts(ctx),
      buildings: await getBuildings(ctx),
      inventoryTypes: loadInventoryTypes(DALTypes.InventoryType),
      nextStateExpectedDate,
      specials: await doesUnitHaveSpecials(ctx, amenities, inventory),
      leasePartyMembers: leaseMembers,
      adjustedMarketRent,
      isRenewal,
    };
  } catch (error) {
    logger.error({ ctx, error, inventoryId }, 'Error loading inventory details');
    throw new ServiceError('ERROR_LOADING_INVENTORY_DETAILS');
  }
};

export const getInventoryItems = async (ctx, query, inventoryGroupId, inventoryToInclude = []) => {
  try {
    let results;
    if (ctx.query && ctx.query.type) {
      results = await inventoryRepo.loadInventoryByType(ctx.tenantId, query, inventoryGroupId, ctx.query.type);
    } else {
      results = await inventoryRepo.loadAllInventory(ctx.tenantId, query, inventoryGroupId, inventoryToInclude);
    }
    return results;
  } catch (error) {
    logger.error({ ctx, error, inventoryGroupId }, 'Error loading inventory items');
    throw new ServiceError('ERROR_LOADING_INVENTORY');
  }
};

export const getComplimentsForInventory = (ctx, inventory, isRenewalQuote = false) => inventoryRepo.getComplimentsForInventory(ctx, inventory, isRenewalQuote);

export const updateStateAfterAction = async (ctx, action, inventoryId) => {
  let newStateFunction = null;
  if (action === ActionTypes.EXECUTE_LEASE) {
    newStateFunction = inventoryStateTransitionOnLeaseExecuted;
  }
  if (action === ActionTypes.VOID_LEASE) {
    newStateFunction = inventoryStateTransitionOnLeaseVoided;
  }
  if (!newStateFunction) throw new ServiceError('MISSING_TRANSITION_FUNCTION');

  logger.trace({ ctx, inventoryId }, 'update inventory state');

  const inventory = await inventoryRepo.getInventoryById(ctx, {
    id: inventoryId,
  });
  const newState = newStateFunction[inventory.state];
  const inventoryStateChanged = inventory.state !== newState;
  if (!newState) {
    logger.error({ ctx, inventoryId, action, inventoryState: inventory.state }, 'unexpected state on inventory');
    return null;
  }
  if (!inventoryStateChanged) {
    logger.trace({ ctx, inventoryId, action, inventoryState: inventory.state }, 'unchanged state on inventory');
    return inventory;
  }

  const updatedInventory = await inventoryRepo.updateInventory(ctx, inventory.id, { state: newState });
  inventoryStateChanged &&
    notify({
      ctx,
      event: eventTypes.INVENTORY_UPDATED,
      data: { inventoryId: updatedInventory.id, state: updatedInventory.state },
    });

  logger.trace({ ctx, updatedInventory }, 'inventory updated');

  return updatedInventory;
};

// Depending of the quantity of quotes related to an inventoryId, this code can cause performance issues. However that depends of how many agents are going to create a quote of an inventory on hold.
const addInventoryAvailabilityEventToActivityLog = async (
  ctx,
  { inventoryId, inventoryShorthand, changedBy, currentPartyId, daysReserved, activityType, reason },
) => {
  const quotes = await getQuotesByInventoryIdForActiveParties(ctx, inventoryId);
  await execConcurrent(quotes, async ({ partyId }) => {
    if (currentPartyId === partyId) return;
    await logEntity(ctx, {
      entity: { inventoryId, partyId, inventoryShorthand, changedBy, daysReserved, reason, shouldUpdateCollaborators: false },
      activityType,
      component: COMPONENT_TYPES.INVENTORY_STATUS,
    });
  });
};

const getBaseDataForHoldEventLog = async (ctx, { inventoryId, userId, endDate, startDate }) => {
  const user = await getUserById(ctx, userId);
  const changedBy = (user && user.fullName) || null;
  const inventoryShorthand = await getShortFormatRentableItem(ctx, inventoryId);
  const daysReserved = endDate && startDate ? toMoment(endDate).diff(toMoment(startDate), 'days') || '0' : null;

  return { changedBy, inventoryShorthand, daysReserved };
};

const addOnHoldEventToActivityLog = async (ctx, { reason, inventoryId, inventoryType, unitFullQualifiedName, partyId, userId }) => {
  const { changedBy, inventoryShorthand } = await getBaseDataForHoldEventLog(ctx, { inventoryId, userId });
  const activityType = [DALTypes.InventoryOnHoldReason.MANUAL, DALTypes.InventoryOnHoldReason.AUTOMATIC].includes(reason)
    ? ACTIVITY_TYPES.ADD_MANUAL_HOLD
    : ACTIVITY_TYPES.ADD_LEASE_HOLD;
  await logEntity(ctx, {
    entity: {
      inventoryId,
      partyId,
      inventoryShorthand,
      changedBy: reason === DALTypes.InventoryOnHoldReason.AUTOMATIC ? null : changedBy,
      reason,
    },
    activityType,
    component: COMPONENT_TYPES.INVENTORY_STATUS,
  });

  await addInventoryAvailabilityEventToActivityLog(ctx, {
    inventoryId,
    inventoryShorthand,
    changedBy,
    currentPartyId: partyId,
    activityType: ACTIVITY_TYPES.INVENTORY_RESERVED,
    reason,
  });

  if (inventoryType && unitFullQualifiedName) {
    await logEntity(ctx, {
      entity: {
        inventoryId,
        id: partyId,
        held: `${inventoryType} ${unitFullQualifiedName}`,
      },
      activityType: ACTIVITY_TYPES.UPDATE,
      component: COMPONENT_TYPES.PARTY,
    });
  }
};

export const updateInventories = async (ctx, { inventoryIds, dataToUpdate }) => {
  await inventoryRepo.updateInventoriesWhereIn(ctx, inventoryIds, dataToUpdate);
};

export const holdInventory = async (
  ctx,
  { inventoryId, rentableItemIds, partyId, quotable, reason, inventoryType, unitFullQualifiedName, quoteId, leaseId, skipExportToMRI, termLength },
) => {
  const { tenantId, authUser = {} } = ctx;
  logger.trace({ ctx, inventoryId, partyId, reason, quoteId, leaseId, rentableItemIds, termLength }, 'Hold inventory');

  const { state } = await getInventoryItem(ctx, inventoryId);
  const partyWorkflowName = await getPartyWorkflowByPartyId(ctx, partyId);

  if (isInventoryLeasedOnPartyType(state, { workflowName: partyWorkflowName })) {
    logger.error({ ctx, inventoryId, state }, 'Inventory can not be held because is already reserved');
    throw new ServiceError({ token: 'ERROR_TRYING_TO_HOLD_RESERVED_INVENTORY', status: 412 });
  }

  const heldBy = authUser.userId || authUser.id || (await loadPartyById(ctx, partyId)).userId;

  const inventoryOnHold = {
    inventoryId,
    partyId,
    startDate: now().toJSON(),
    quotable,
    reason,
    heldBy,
  };

  const inventoryHoldEventData = {
    tenantId,
    event: eventTypes.INVENTORY_HOLD,
  };

  const tasks = await getTasksForPartiesByName(ctx, [partyId], DALTypes.TaskNames.HOLD_INVENTORY);

  if (tasks && tasks.length) {
    await sendMessageToCompletePlaceInventoryOnHoldTask(ctx, partyId);
  }

  const inventoriesOnHold = await inventoryRepo.getInventoriesOnHoldForParty(ctx, partyId);

  const inventoriesToApplyHold = (rentableItemIds || []).map(rentableItemId => ({
    inventoryId: rentableItemId,
    partyId,
    startDate: now().toJSON(), // TODO: check if this should be startOf('day)
    quotable,
    reason,
    heldBy,
  }));
  inventoriesToApplyHold.push(inventoryOnHold);

  const result = await inventoryRepo.saveInventoryOnHold(ctx, inventoriesToApplyHold);

  logger.trace({ ctx, inventoryId, partyId }, 'Inventory held');

  // heldBy is only undefined during import apparently
  // so probably there is another bug here where we don't pass the authUser
  // because the import is executed during Refresh of tenant
  // This is the actual fix for CPM-9611
  if (heldBy) {
    await addOnHoldEventToActivityLog(ctx, { reason, inventoryId, inventoryType, unitFullQualifiedName, partyId, userId: heldBy });
    const user = await getUserById(ctx, heldBy);
    result.agentName = user.fullName;
  }

  logger.trace(
    {
      ctx,
      inventoryId,
      partyId,
      inventoriesOnHold,
      termLength,
    },
    'saveUnitHeldEvent params',
  );

  const inventoryOnHoldId = flatten([result]).find(hold => hold.inventoryId === inventoryId)?.id;
  await saveUnitHeldEvent(ctx, {
    partyId,
    metadata: {
      inventoryId,
      ...(inventoryOnHoldId && { inventoryOnHoldId }),
      ...(leaseId && { leaseId }),
      ...(skipExportToMRI && { skipExportToMRI }),
      ...(termLength && { termLength }),
    },
  });
  notify({ ctx, ...inventoryHoldEventData, data: { quotable: inventoryOnHold.quotable, hold: true, inventoryId, inventoryOnHold: result } });

  return result;
};

const addReleaseHoldEventToActivityLog = async (ctx, { releasedBy, inventoryId, partyId, startDate, endDate, automatically, isContractInventory, reason }) => {
  const { changedBy, inventoryShorthand, daysReserved } = await getBaseDataForHoldEventLog(ctx, { inventoryId, userId: releasedBy, startDate, endDate });
  if (!isContractInventory) {
    const activityType = [DALTypes.InventoryOnHoldReason.MANUAL, DALTypes.InventoryOnHoldReason.AUTOMATIC].includes(reason)
      ? ACTIVITY_TYPES.REMOVE_MANUAL_HOLD
      : ACTIVITY_TYPES.REMOVE_LEASE_HOLD;
    await logEntity(ctx, {
      entity: {
        inventoryId,
        partyId,
        inventoryShorthand,
        changedBy,
        daysReserved,
        automatically,
        reason,
      },
      activityType,
      component: COMPONENT_TYPES.INVENTORY_STATUS,
    });
  }

  await addInventoryAvailabilityEventToActivityLog(ctx, {
    inventoryId,
    inventoryShorthand,
    changedBy,
    currentPartyId: partyId,
    daysReserved,
    activityType: ACTIVITY_TYPES.INVENTORY_RELEASED,
    reason,
  });
};

export const releaseInventories = async (ctx, { inventoryIds, reason, partyId }) => {
  const { authUser } = ctx;
  const releasedBy = (authUser && (authUser.userId || authUser.id)) || null;
  logger.trace({ ctx, inventoryIds, reason }, 'Unhold inventory');

  const inventoryOnHolds = await inventoryRepo.getInventoryOnHoldsWhereIn(ctx, inventoryIds, reason);
  if (!inventoryOnHolds.length) {
    logger.error({ ctx, inventoryIds, reason }, 'The inventory is not on hold');
    return;
  }
  const inventoryOnHoldsIds = inventoryOnHolds.filter(inv => inv.partyId === partyId).map(inventoryOnHold => inventoryOnHold.id);
  if (!inventoryOnHoldsIds.length) {
    logger.trace({ ctx, inventoryIds, reason, partyId }, 'No inventory holds found for this party');
    return;
  }

  const dataToUpdate = {
    ...(releasedBy && { releasedBy }),
    endDate: now().toJSON(),
  };

  const updatedInventoryOnHolds = await inventoryRepo.updateInventoryOnHoldsWhereIn(ctx, inventoryOnHoldsIds, dataToUpdate);
  logger.trace({ ctx, inventoryIds }, 'Inventories unheld');

  if (!updatedInventoryOnHolds.length) {
    logger.error({ ctx, inventoryIds }, 'The inventories cant be unheld');
    return;
  }

  await execConcurrent(updatedInventoryOnHolds, async updatedInventoryOnHold => {
    await addReleaseHoldEventToActivityLog(ctx, updatedInventoryOnHold);
    notify({
      ctx,
      event: eventTypes.INVENTORY_HOLD,
      data: { hold: false, inventoryId: updatedInventoryOnHold.inventoryId, inventoryOnHold: updatedInventoryOnHold },
    });
  });
};

export const releaseInventory = async (ctx, { inventoryId, reasons, partyId, leaseId }) => {
  const { authUser } = ctx;
  const releasedBy = authUser.userId || authUser.id;
  logger.trace({ ctx, inventoryId, reasons, leaseId }, 'Unhold inventory');

  const inventoryOnHold = {
    releasedBy,
    endDate: now().toJSON(),
  };

  const inventoryHolds = await inventoryRepo.getInventoryHolds(ctx, inventoryId, reasons);
  if (!inventoryHolds.length) {
    logger.error({ ctx, inventoryId, reasons }, 'The inventory is not on hold');
    return;
  }

  if (partyId && inventoryHolds[0].partyId !== partyId) {
    logger.error(
      {
        ctx,
        inventoryId,
        releaseRequestedBy: partyId,
        onHoldForParty: inventoryHolds[0].partyId,
      },
      'Inventory on hold for a different party. The inventory will not be unheld.',
    );
    return;
  }

  const updatedInventoryOnHold = await inventoryRepo.updateInventoryOnHold(ctx, inventoryHolds[0].id, inventoryOnHold);
  logger.trace({ ctx, inventoryId }, 'Inventory unheld');

  if (!updatedInventoryOnHold.length) {
    logger.error({ ctx, inventoryId }, 'The inventory cant be unheld');
    return;
  }

  const releasedInventory = updatedInventoryOnHold[0];
  await addReleaseHoldEventToActivityLog(ctx, releasedInventory);

  const inventoriesOnHold = await inventoryRepo.getInventoriesOnHoldForParty(ctx, inventoryHolds[0].partyId);

  const remainingInventoryOnHold =
    inventoriesOnHold &&
    inventoriesOnHold.find(
      hold => hold.inventoryId !== inventoryId && hold.partyId === partyId && !hold.endDate && hold.reason !== DALTypes.InventoryOnHoldReason.LEASE,
    );

  const quotes = remainingInventoryOnHold && (await getQuotesByPartyId(ctx, inventoryHolds[0].partyId));
  const quote = quotes?.find(q => q.inventoryId === remainingInventoryOnHold.inventoryId);
  const leaseTermLength = quote?.publishedQuoteData?.leaseTerms[0]?.termLength;
  const leaseStartDate = quote?.publishedQuoteData?.leaseStartDate;

  await saveUnitReleasedEvent(ctx, {
    partyId: inventoryHolds[0].partyId,
    metadata: {
      inventoryId,
      ...(leaseId && { leaseId }),
      manualRelease: reasons.includes(DALTypes.InventoryOnHoldReason.MANUAL),
      releasedOnExecutedLease: reasons.includes(DALTypes.InventoryOnHoldReason.LEASE),
      ...(remainingInventoryOnHold && { remainingInventoryOnHold: remainingInventoryOnHold.inventoryId, leaseTermLength, leaseStartDate }),
    },
  });

  notify({ ctx, event: eventTypes.INVENTORY_HOLD, data: { hold: false, inventoryId, inventoryOnHold: releasedInventory } });

  return;
};

/*
  This function realeases all the MANUAL holds of the inventories that belong to a given party,
  the logs in the activity table are different than the releaseInventory method above, plus this
  function does just one call to the db.
*/
export const releaseManuallyHeldInventoriesByParty = async (ctx, partyId, contractInventoryId, leaseId) => {
  const { trx, authUser = {} } = ctx;
  const releasedBy = authUser.userId || authUser.id;
  logger.trace({ ctx, partyId, contractInventoryId, leaseId }, 'Release inventories for party');

  const party = await getPartyById(ctx, partyId);

  const inventoryOnHold = {
    releasedBy,
    endDate: now().toJSON(),
  };

  let manualHolds;
  let automaticHolds;
  let leaseHolds = [];

  if (party.leaseType === DALTypes.PartyTypes.CORPORATE && contractInventoryId) {
    manualHolds = await inventoryRepo.releaseInventoriesOnHoldByPartyAndInventory(
      ctx,
      { partyId, inventoryId: contractInventoryId, reason: DALTypes.InventoryOnHoldReason.MANUAL },
      inventoryOnHold,
      trx,
    );

    automaticHolds = await inventoryRepo.releaseInventoriesOnHoldByPartyAndInventory(
      ctx,
      { partyId, inventoryId: contractInventoryId, reason: DALTypes.InventoryOnHoldReason.AUTOMATIC },
      inventoryOnHold,
      trx,
    );

    leaseHolds = await inventoryRepo.releaseInventoriesOnHoldByPartyAndInventory(
      ctx,
      { partyId, inventoryId: contractInventoryId, reason: DALTypes.InventoryOnHoldReason.LEASE },
      inventoryOnHold,
      trx,
    );
  } else {
    manualHolds = await inventoryRepo.releaseInventoriesOnHoldByParty(ctx, { partyId, reason: DALTypes.InventoryOnHoldReason.MANUAL }, inventoryOnHold, trx);

    automaticHolds = await inventoryRepo.releaseInventoriesOnHoldByParty(
      ctx,
      { partyId, reason: DALTypes.InventoryOnHoldReason.AUTOMATIC },
      inventoryOnHold,
      trx,
    );
  }
  const releasedInventories = [...manualHolds, ...automaticHolds, ...leaseHolds];

  if (!releasedInventories?.length) {
    logger.trace({ ctx, partyId }, 'No inventories to release');
    return;
  }

  const releasedInventoriesIds = releasedInventories.map(({ inventoryId }) => inventoryId);

  logger.trace({ ctx, partyId, releasedInventoriesIds }, 'Inventories unheld for party');

  const uniqInventories = uniqBy(releasedInventories, 'inventoryId');
  await execConcurrent(uniqInventories, async releasedInventory => {
    await addReleaseHoldEventToActivityLog(ctx, {
      ...releasedInventory,
      automatically: true,
      isContractInventory: contractInventoryId === releasedInventory.inventoryId,
    });

    await saveUnitReleasedEvent(ctx, {
      partyId,
      metadata: {
        ...(leaseId && { leaseId }),
        inventoryId: releasedInventory.inventoryId,
        releasedOnExecutedLease: !!leaseHolds?.length,
        releaseAtCloseParty: !contractInventoryId,
      },
    });

    notify({
      ctx,
      event: eventTypes.INVENTORY_HOLD,
      data: { hold: false, inventoryId: releasedInventory.inventoryId, inventoryOnHold: releasedInventory },
    });
  });
};

const isNotHeldByTheSameParty = ({ inventoryHold, partyId }) => inventoryHold.partyId !== partyId;

const manualHoldRestrictedActions = {
  [ActionTypes.PUBLISH_LEASE]: isNotHeldByTheSameParty,
};

const leaseHoldRestrictedActions = {
  [ActionTypes.PUBLISH_LEASE]: isNotHeldByTheSameParty,
};

const inventoryRestrictedActionsByHoldType = {
  [DALTypes.InventoryOnHoldReason.MANUAL]: manualHoldRestrictedActions,
  [DALTypes.InventoryOnHoldReason.AUTOMATIC]: manualHoldRestrictedActions,
  [DALTypes.InventoryOnHoldReason.LEASE]: leaseHoldRestrictedActions,
};

const isARestrictedAction = (action, { inventoryHold, partyId }) => {
  if (!inventoryHold) return false;

  const inventoryHoldRestrictedActions = inventoryRestrictedActionsByHoldType[inventoryHold.reason];
  if (!inventoryHoldRestrictedActions) return false;

  const validationFunc = inventoryHoldRestrictedActions[action];
  if (!validationFunc) {
    return false;
  }

  return validationFunc({ inventoryHold, partyId });
};

const canPerformActionOnInventory = async (ctx, action, { inventoryId, partyId }) => {
  const inventoryHolds = await inventoryRepo.getInventoryHolds(ctx, inventoryId);
  if (!inventoryHolds.length) return true;

  return !inventoryHolds.some(inventoryHold => isARestrictedAction(action, { inventoryHold, partyId }));
};

export const validateActionOnInventory = async (ctx, action, { inventoryId, partyId }) => {
  if (!inventoryId || !partyId) return;

  const canPerformAction = await canPerformActionOnInventory(ctx, action, {
    inventoryId,
    partyId,
  });
  if (!canPerformAction) {
    throw new ServiceError({ token: 'INVENTORY_ON_HOLD', status: 412 });
  }
  return;
};

export const getInventoryHolds = async (ctx, inventoryId, reasons) => await inventoryRepo.getInventoryHolds(ctx, inventoryId, reasons);

export const updateInventoryOnHold = async (ctx, inventoryId, inventoryOnHold) => await inventoryRepo.updateInventoryOnHold(ctx, inventoryId, inventoryOnHold);

export const getInventoryForQuote = async (ctx, quoteId, columns = ['*']) => await inventoryRepo.getInventoryForQuote(ctx, quoteId, columns);

export const isInventoryOnHold = async (ctx, inventoryId) => !!(await inventoryRepo.getInventoryHolds(ctx, inventoryId)).length;
