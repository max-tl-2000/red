/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import omit from 'lodash/omit';
import get from 'lodash/get';

import {
  saveActiveLeaseWorkflowData,
  getActiveLeaseWorkflowDataByPartyId,
  getExtendedLeasesWithEndDateInPast,
  updateActiveLeaseData,
} from '../dal/activeLeaseWorkflowRepo';
import { getRenewalPartyIdBySeedPartyId } from '../dal/partyRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { toMoment, now } from '../../common/helpers/moment-utils';
import * as eventService from './partyEvent';
import { performPartyStateTransition } from './partyStatesTransitions';
import loggerModule from '../../common/helpers/logger';
import { getFeesAdditionalDataByIds } from '../dal/feeRepo';
import { getConcessionsByIds } from '../dal/concessionRepo';
import { getPropertyTimezoneAndSettingsFromInventoryId, getPropertyByExternalId } from '../dal/propertyRepo';
import { logMovingOutParty, logCancelMovingOutParty } from './helpers/workflows';
import { forceImport } from './importActiveLeases/force-import';
import { getPartyGroupIdByExternalId, getPrimaryExternalIdByPartyGroupId } from '../dal/exportRepo';
import { workflowCycleProcessor } from '../workers/party/workflowCycleHandler';
import { getTenant } from './tenantService';

const logger = loggerModule.child({ subType: 'activeLeaseService' });

export const markActiveLeaseAsMovingOut = async (ctx, { partyId, noticeDate, vacateDate, reason, moveOutCompleted, timezone, isUnderEviction }) => {
  const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, partyId);
  const metadata = isUnderEviction ? { ...activeLeaseData.metadata, isUnderEviction: true } : omit(activeLeaseData.metadata, ['isUnderEviction']);
  const delta = {
    state: DALTypes.ActiveLeaseState.MOVING_OUT,
    metadata: {
      ...metadata,
      dateOfTheNotice: noticeDate,
      vacateDate,
      notes: reason,
      moveOutConfirmed: moveOutCompleted,
    },
  };

  await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseData, ...delta });
  await logMovingOutParty(ctx, { id: activeLeaseData.partyId, noticeDate, vacateDate, reason, timezone });

  const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, partyId);
  if (renewalPartyId) {
    await performPartyStateTransition(ctx, renewalPartyId);
    await eventService.saveRenewalMovingOutEvent(ctx, { partyId: renewalPartyId });
  }
};

export const cancelActiveLeaseAsMovingOut = async (ctx, partyId) => {
  const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, partyId);
  const { dateOfTheNotice, vacateDate: dbVacateDate, notes, ...rest } = omit(activeLeaseData.metadata, ['isUnderEviction']);

  const delta = {
    state: DALTypes.ActiveLeaseState.NONE,
    metadata: {
      ...rest,
      moveOutConfirmed: false,
    },
  };

  await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseData, ...delta });
  await logCancelMovingOutParty(ctx, { id: activeLeaseData.partyId });

  const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, partyId);
  if (renewalPartyId) {
    await performPartyStateTransition(ctx, renewalPartyId);
    await eventService.saveRenewalCancelMoveOutEvent(ctx, { partyId: renewalPartyId });
  }
};

const computeExtensionLeaseEndDate = (leaseData, timezone) => {
  const pastEndDate = leaseData.computedExtensionEndDate || leaseData.leaseEndDate;
  const numberOfMonthsInPast = Math.ceil(now({ timezone }).diff(toMoment(pastEndDate), 'months', true));
  return toMoment(pastEndDate, { timezone }).add(numberOfMonthsInPast, 'months').toISOString();
};

export const updateExtensionLeasesEndDate = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'updateExtensionLeasesEndDate -  start');

  const leasesToUpdate = await getExtendedLeasesWithEndDateInPast(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace({ ctx, numberOfLeases: leasesToUpdate.length }, 'updateExtensionLeasesEndDate -  number of leases with end date in past');

  await mapSeries(leasesToUpdate, async ({ id, leaseData, timezone }) => {
    try {
      const computedExtensionEndDate = computeExtensionLeaseEndDate(leaseData, timezone);
      logger.trace({ ctx, id, leaseData, computedExtensionEndDate }, 'updateExtensionLeasesEndDate - updated extension end date');
      await updateActiveLeaseData(ctx, id, { ...leaseData, computedExtensionEndDate });
    } catch (error) {
      logger.error({ ctx, id, error }, 'updateExtensionLeasesEndDate - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'updateExtensionLeasesEndDate -  done');
};

const getFormattedCharges = async (ctx, additionalCharges, leaseStartDate, timezone) => {
  const feeTypesToSave = [DALTypes.FeeType.SERVICE, DALTypes.FeeType.INVENTORY_GROUP];

  const additionalChargesIds = Object.keys(additionalCharges);
  const additionalDataForCharges = !!additionalChargesIds.length && (await getFeesAdditionalDataByIds(ctx, additionalChargesIds));
  const getChargeById = feeId => (additionalDataForCharges || []).filter(addData => addData.id === feeId.split('--')[1] || addData.id === feeId)[0] || [];

  return Object.entries(additionalCharges)
    .filter(([key], _charge) => feeTypesToSave.includes(getChargeById(key).feeType) && getChargeById(key).servicePeriod !== DALTypes.ServicePeriod.ONE_TIME)
    .map(([key, { displayName, amount, quantity }]) => ({
      displayName,
      description: getChargeById(key).description || '',
      code: getChargeById(key).externalChargeCode || '',
      amount,
      quantity,
      startDate: toMoment(leaseStartDate, { timezone }).startOf('day').toISOString(),
      endDate: null,
    }));
};

const getFormattedConcessions = async (ctx, concessions, leaseStartDate, timezone) => {
  const concessionsIds = Object.keys(concessions);
  const additionalDataForConcessions = !!concessionsIds.length && (await getConcessionsByIds(ctx, concessionsIds));

  const getConcessionById = concessionId =>
    (additionalDataForConcessions || []).filter(addCon => addCon.id === concessionId.split('--')[1] || addCon.id === concessionId)[0] || [];
  return Object.entries(concessions)
    .filter(([key], _concession) => !getConcessionById(key).bakedIntoAppliedFeeFlag)
    .map(([key, { amount }]) => ({
      displayName: getConcessionById(key).displayName || '',
      description: getConcessionById(key).description || '',
      code: getConcessionById(key).externalChargeCode || '',
      amount,
      quantity: 1,
      startDate: toMoment(leaseStartDate, { timezone }).startOf('day').toISOString(),
      endDate: null,
    }));
};

export const saveActiveLeaseWfData = async (
  ctx,
  {
    leaseId,
    activeLeasePartyId,
    baselineData,
    externalLeaseId,
    termLength,
    rolloverPeriod = DALTypes.RolloverPeriod.NONE,
    isExtension = false,
    metadata,
    state,
  },
) => {
  logger.trace({ ctx, leaseId, activeLeasePartyId }, 'saveActiveLeaseWfData - input params');

  const { publishedLease, quote } = baselineData;
  const { inventoryId, inventoryType } = quote;
  const { moveInDate, unitRent, leaseEndDate, leaseStartDate, additionalCharges, concessions } = publishedLease;

  const { timezone } = await getPropertyTimezoneAndSettingsFromInventoryId(ctx, inventoryId);

  const recurringCharges = await getFormattedCharges(ctx, additionalCharges, leaseStartDate, timezone);
  const formattedConcessions = await getFormattedConcessions(ctx, concessions, leaseStartDate, timezone);

  const activeLeaseWfData = {
    leaseId,
    partyId: activeLeasePartyId,
    leaseData: { leaseTerm: termLength, inventoryId, inventoryType, moveInDate, unitRent, leaseEndDate, leaseStartDate },
    recurringCharges,
    concessions: formattedConcessions,
    isImported: false,
    externalLeaseId,
    rolloverPeriod,
    metadata,
    isExtension,
    state,
  };

  return await saveActiveLeaseWorkflowData(ctx, activeLeaseWfData);
};

export const importAndProcessWorkflows = async (
  ctx,
  { skipImport, skipProcess, propertyExternalId, primaryExternalId, partyGroupId, isInitialImport, forceSyncLeaseData },
) => {
  const property = await getPropertyByExternalId(ctx, propertyExternalId);
  if (!skipImport) {
    const { externalId: primaryExternalIdFilter = primaryExternalId } =
      (!primaryExternalId && partyGroupId && (await getPrimaryExternalIdByPartyGroupId(ctx, partyGroupId))) || {};
    const tenant = await getTenant(ctx);
    const backendMode = get(tenant, 'metadata.backendIntegration.name', DALTypes.BackendMode.NONE);
    await forceImport(ctx, {
      property,
      primaryExternalId: primaryExternalIdFilter,
      isInitialImport,
      forceSyncLeaseData,
      backendMode,
    });
  }
  if (!skipProcess) {
    const { partyGroupId: partyGroupIdFilter = partyGroupId } =
      !partyGroupId && primaryExternalId && (await getPartyGroupIdByExternalId(ctx, primaryExternalId));
    await workflowCycleProcessor({ tenantId: ctx.tenantId, partyGroupIdFilter, propertyId: property.externalId });
  }
  logger.trace({ ctx, reqQuery: ctx.query }, 'importActiveLeases - done');
};
