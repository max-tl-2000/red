/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';

import { ExportType } from './export';
import { getPartyData } from '../common-export-utils';
import { getExternalInfo, processExportMessage } from './mri-export-utils';
import { getInventoryExpanded } from '../../services/inventories';

import { DALTypes } from '../../../common/enums/DALTypes';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export/mri' });

export const getData = async (ctx, partyDocument, leaseId, inventoryId, leaseTermLength, leaseStartDate) => {
  const partyData = await getPartyData(ctx, partyDocument);
  const { party, primaryTenant, externalInfo } = await getExternalInfo(ctx, partyDocument, leaseId);
  const inventory = inventoryId && (await getInventoryExpanded(ctx, inventoryId));
  const lease = (partyDocument.leases || []).find(l => l.id === leaseId);

  return {
    tenantId: ctx.tenantId,
    ...partyData,
    party,
    lease: lease && {
      id: lease.id,
      baselineData: {
        quote: pick(lease.baselineData.quote, ['timezone', 'moveInDate']),
      },
    },
    primaryTenant,
    externalInfo,
    inventory: inventory && {
      ...pick(inventory, ['itemType', 'itemId', 'name', 'externalId']),
      building: pick(inventory.building, ['externalId']),
      property: pick(inventory.property, ['externalId']),
    },
    leaseTermLength,
    quote: {
      leaseStartDate: inventory?.availabilityDate || leaseStartDate,
    },
  };
};

export const exportMriVoidedLease = async (ctx, partyDocument, exportEvent, extraPayload) => {
  try {
    const partyId = partyDocument.id;
    const { leaseId, allPartyMembersSigned, remainingInventoryOnHold, leaseTermLength, leaseStartDate, leasePrevStatus } = exportEvent.metadata;

    if (leasePrevStatus === DALTypes.LeaseStatus.DRAFT) {
      logger.trace({ ctx, leaseId, partyId, exportEvent }, 'Export MRI - Lease status is in draft. Skipping export');
      return;
    }

    const steps = [ExportType.ClearSelectedUnit];

    if (allPartyMembersSigned) {
      logger.trace({ ctx, leaseId, partyId, allPartyMembersSigned }, 'Export MRI - All party members signed the lease, will void the lease in MRI.');
      steps.push(ExportType.VoidLease);
    }

    if (remainingInventoryOnHold) {
      logger.trace({ ctx, leaseId, remainingInventoryOnHold }, 'Export MRI - We still have a hold on the unit in Reva, so we will push back the hold to MRI');
      steps.push(ExportType.SelectUnit);
    }

    const newLeaseExportSteps = () => steps.map((value, index) => ({ index, ...value }));
    const renewalLeaseExportSteps = () => [ExportType.CancelRenewalOffer].map((value, index) => ({ index, ...value }));
    const exportSteps = partyDocument.workflowName === DALTypes.WorkflowName.RENEWAL ? renewalLeaseExportSteps() : newLeaseExportSteps();
    const data = await getData(ctx, partyDocument, leaseId, remainingInventoryOnHold, leaseTermLength, leaseStartDate);

    await processExportMessage(ctx, {
      partyId,
      data,
      exportSteps,
      extraPayload,
      mriExportAction: DALTypes.MriExportAction.VOID_LEASE,
    });
  } catch (error) {
    logger.error({ ctx, error, partyId: partyDocument.id }, 'Export MRI - on voided lease - error');
    throw error;
  }
};
