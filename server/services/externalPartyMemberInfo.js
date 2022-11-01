/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import minBy from 'lodash/minBy';
import { now } from '../../common/helpers/moment-utils';
import { DALTypes } from '../../common/enums/DALTypes';
import {
  insertExternalInfo,
  updateExternalInfo,
  getActiveExternalInfo,
  getExternalInfoByPartyIdAndChildInfo,
  updateExternalInfoEndDateByPartyId,
  getExternalInfoByPartyMemberId,
  getPrimaryExternalInfoByParty,
  reviveExternalInfoByPartyId,
} from '../dal/exportRepo';

import loggerModule from '../../common/helpers/logger';
import { getExternalPartyMemberInfoExternalIdsByPropertyId, loadPartyMembers } from '../dal/partyRepo';
import { ServiceError } from '../common/errors';
import { getPrimaryTenantId } from './export';
import { generateExternalId } from '../helpers/generateIntegrationId';
import { shouldProcessPartyCreatePartyMemberSubscription } from '../dal/subscriptionsRepo';

const logger = loggerModule.child({ subType: 'externalPartyMemberInfo' });

export const archiveExternalInfo = async (ctx, externalInfo) => {
  logger.trace({ ctx, externalInfo }, 'archiveExternalInfo');

  if (!externalInfo) return;

  await updateExternalInfo(ctx, {
    ...externalInfo,
    endDate: now().toDate().toUTCString(),
  });
};

export const archiveAllExternalInfoByParty = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'archiveAllExternalInfoByParty');
  const archiveDate = now().toDate().toUTCString();

  return await updateExternalInfoEndDateByPartyId(ctx, partyId, archiveDate);
};

export const saveExternalPartyMemberInfo = async (ctx, data) => {
  logger.trace({ ctx, externalInfo: data }, 'saveExternalPartyMemberInfo');

  return await insertExternalInfo(ctx, {
    ...data,
    id: newId(),
  });
};

export const insertExternalPartyMemberInfoBySeedParty = async (ctx, data) => {
  logger.trace({ ctx, externalInfo: data }, 'insertExternalPartyMemberInfoBySeedParty');
  let externalPartyMemberInfo;
  const { partyMemberId = null, seedPartyMemberId, partyId, propertyId, seedPartyId, childId = '', info = {}, leaseId, leaseType, isSeedPartyArchived } = data;
  const externalInfoLeaseId = leaseType === DALTypes.LeaseType.CORPORATE ? leaseId : null;

  if (partyMemberId) {
    externalPartyMemberInfo = isSeedPartyArchived
      ? await getExternalInfoByPartyMemberId(ctx, seedPartyMemberId, externalInfoLeaseId)
      : await getActiveExternalInfo(ctx, seedPartyMemberId, externalInfoLeaseId);
  } else {
    externalPartyMemberInfo = await getExternalInfoByPartyIdAndChildInfo(ctx, { partyId: seedPartyId, info, leaseId });
  }

  const { externalId = null, isPrimary = false, externalProspectId = null, externalRoommateId = null, metadata = {} } = externalPartyMemberInfo || {};
  const { aptexxData } = metadata;

  const externalInfo = {
    id: newId(),
    partyId,
    partyMemberId: partyMemberId || null,
    childId: childId || null,
    isPrimary,
    externalId,
    externalProspectId,
    externalRoommateId,
    propertyId,
    leaseId,
    metadata: aptexxData ? { aptexxData } : {},
  };

  (externalId || externalProspectId || externalRoommateId) &&
    (await insertExternalInfo(ctx, {
      ...externalInfo,
    }));

  return externalInfo;
};

export const replacePrimaryTenant = async (ctx, { partyId, partyMembers, removedMember, propertyId }) => {
  logger.trace({ ctx, partyId, removedMember, propertyId }, 'replacePrimaryTenant');

  const externalInfo = await getActiveExternalInfo(ctx, removedMember.id);
  if (!externalInfo || !externalInfo.externalId || !externalInfo.externalProspectId) {
    logger.trace({ ctx, partyId, removedMemberId: removedMember.id }, 'The removed party member is not a primary tenant, no need to set a new one.');
    return;
  }

  await archiveExternalInfo(ctx, externalInfo);

  const residents = partyMembers.filter(pm => !pm.endDate && pm.memberType === DALTypes.MemberType.RESIDENT);
  const newPrimary = minBy(residents, 'created_at') || minBy(partyMembers, 'created_at');
  logger.trace({ ctx, newPrimary }, 'Chosen a new primary tenant');

  if (!newPrimary) return;

  // archive previous external info (if any)
  const prevExternalInfo = await getActiveExternalInfo(ctx, newPrimary.id);
  if (prevExternalInfo) {
    logger.trace({ ctx, prevExternalInfo }, 'Archiving previous external IDs for the chosen primary tenant.');
    await archiveExternalInfo(ctx, prevExternalInfo);
  }

  const data = {
    partyId,
    partyMemberId: newPrimary.id,
    externalId: externalInfo.externalId,
    externalProspectId: externalInfo.externalProspectId,
    isPrimary: true,
    propertyId: propertyId || externalInfo.propertyId,
  };
  await saveExternalPartyMemberInfo(ctx, data);
};

// Note: only applicable to real test aptexx and no integration turned on
export const createExternalPartyMemberInfoForPrimaryMember = async (ctx, { partyId, propertyId, propertyName }) => {
  const shouldBeSkipped = !(await shouldProcessPartyCreatePartyMemberSubscription(ctx));
  if (shouldBeSkipped) {
    logger.trace({ ctx, partyId, propertyId }, 'createExternalPartyMemberInfoForPrimaryMember process skipped');
    return;
  }

  const externalInfo = await getPrimaryExternalInfoByParty(ctx, partyId);
  if (externalInfo) {
    logger.trace({ ctx, partyId, propertyId }, 'createExternalPartyMemberInfoForPrimaryMember not executed, there is a row related to the party');
    return;
  }

  const externalIds = await getExternalPartyMemberInfoExternalIdsByPropertyId(ctx, propertyId);
  const usedExternalIds = externalIds.map(i => i.externalId);

  const externalId = generateExternalId(propertyName, usedExternalIds);
  if (!externalId) {
    throw new ServiceError({
      token: 'NOT_INTEGRATION_IDS_AVAILABLE_FOR_THE_PROPERTY',
    });
  }

  const partyMembers = await loadPartyMembers(ctx, partyId);
  const primaryPartyMemberId = getPrimaryTenantId(ctx, partyMembers);

  await saveExternalPartyMemberInfo(ctx, {
    partyMemberId: primaryPartyMemberId,
    partyId,
    externalId,
    propertyId,
    isPrimary: true,
  });
};

export const reviveAllExternalInfoByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'reviveAllExternalInfoByPartyId');

  return await reviveExternalInfoByPartyId(ctx, partyId);
};
