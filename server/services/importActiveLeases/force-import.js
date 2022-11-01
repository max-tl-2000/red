/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';

import loggerModule from '../../../common/helpers/logger';
import { processData } from './process-data/process-data';
import { retrieveData } from './retrieve-data';
import { getAssignedPropertyByPartyId } from '../../dal/partyRepo';
import { getPropertyById } from '../../dal/propertyRepo';
import { getPrimaryExternalInfoByParty, getPartyGroupIdByExternalId } from '../../dal/exportRepo';
import { getTenant } from '../tenantService';
import { DALTypes } from '../../../common/enums/DALTypes';
import { logEntity } from '../activityLogService';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';
import { workflowCycleProcessor } from '../../workers/party/workflowCycleHandler';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const shouldImport = async (ctx, { property, primaryExternalId, backendMode }) => {
  if (!primaryExternalId || backendMode === DALTypes.BackendMode.NONE) return false;
  return property?.settings?.integration?.import?.residentData;
};

const shouldTriggerImportOnUserActions = async ctx => {
  const tenant = await getTenant(ctx);
  const backendMode = get(tenant, 'metadata.backendIntegration.name', DALTypes.BackendMode.NONE);

  return backendMode === DALTypes.BackendMode.MRI;
};

// Scenarios for force import:
// - move out (based on partyId)
// - cancel move out (based on partyId)
// - reopen party (based on partyId)
// - create renewal manually (based on partyId)
// - postman (based on propertyExternalId or propertyexternalId + primaryExternalId)

export const forceImport = async (ctx, { property, primaryExternalId, isInitialImport, forceSyncLeaseData, backendMode }) => {
  if (!(await shouldImport(ctx, { property, primaryExternalId, backendMode }))) return;

  logger.trace({ ctx, propertyId: property.id, primaryExternalId, isInitialImport, forceSyncLeaseData }, 'forceImport - input params');
  const entries = await retrieveData(ctx, { propertyExternalId: property.externalId, primaryExternalId, backendMode });
  await processData({ ...ctx, backendMode }, { property, entries, forceSync: !!primaryExternalId, isInitialImport, forceSyncLeaseData });
  logger.trace({ ctx }, 'forceImport - done');
};

export const importActiveLeaseByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'importActiveLeaseByPartyId - input params');

  try {
    const assignedPropertyId = await getAssignedPropertyByPartyId(ctx, partyId);
    const property = await getPropertyById(ctx, assignedPropertyId);
    const { externalId: primaryExternalId } = (await getPrimaryExternalInfoByParty(ctx, partyId)) || {};

    const shouldTriggerImport = await shouldTriggerImportOnUserActions(ctx);
    if (!primaryExternalId || !shouldTriggerImport) return { syncSuccessful: false };
    await forceImport(ctx, { property, primaryExternalId, backendMode: DALTypes.BackendMode.MRI });

    const entity = {
      id: partyId,
      syncEventType: DALTypes.SyncEventTypes.FORCE_UPDATE,
      createdByType: DALTypes.CreatedByType.SYSTEM,
    };
    await logEntity(ctx, { entity, activityType: ACTIVITY_TYPES.DATA_SYNC, component: COMPONENT_TYPES.PARTY });

    const { partyGroupId: partyGroupIdFilter } = (primaryExternalId && (await getPartyGroupIdByExternalId(ctx, primaryExternalId))) || {};
    const { processed } = await workflowCycleProcessor({ tenantId: ctx.tenantId, partyGroupIdFilter, propertyId: property.externalId, reqId: ctx.reqId });

    return { syncSuccessful: processed };
  } catch (error) {
    logger.error({ ctx, partyId }, 'importActiveLeaseByPartyId - error');
    return { syncSuccessful: false };
  }
};
