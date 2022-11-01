/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { updateLinkedGuarantor } from '../../rentapp/server/screening/screening-helper';
import { getPartyIdsByMemberType } from '../dal/partyRepo';
import { now } from '../../common/helpers/moment-utils';
import { updateTenant } from '../services/tenantService';

export const updatePartyGuarantorHolds = async (ctx, partySettingsDiff) => {
  const hasGuarantorLevelChanged = partySettingsDiff && partySettingsDiff.some(diff => diff.path && diff.path.includes('residentOrPartyLevelGuarantor'));
  if (!hasGuarantorLevelChanged) return;

  const partyWithGuarantorsIds = await getPartyIdsByMemberType(ctx);
  const hasPartyWithGuarantors = partyWithGuarantorsIds && partyWithGuarantorsIds.length;

  if (hasPartyWithGuarantors) {
    await mapSeries(partyWithGuarantorsIds, async partyId => {
      await updateLinkedGuarantor(ctx, partyId);
    });
  }
};

export const updateTenantIgnoreImportUpdateOptimizationUntilFlag = async (tenant, propertySettingsDiff) => {
  const hasAvailabilityDateSourceChanged =
    propertySettingsDiff && propertySettingsDiff.some(diff => diff.path && diff.path.includes('inventoryAvailabilityDate'));
  if (!hasAvailabilityDateSourceChanged) return;

  await updateTenant(tenant.id, {
    metadata: {
      ...tenant.metadata,
      ignoreImportUpdateOptimizationUntil: now().add(1, 'days'),
    },
  });
};
