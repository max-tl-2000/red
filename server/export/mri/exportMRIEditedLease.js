/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';

import { ExportType } from './export';
import { getPartyData, getCompanyName, getAppointmentInventory } from '../common-export-utils';
import { getExternalInfo, generateGuestCardsExportSteps, addIndex, processExportMessage } from './mri-export-utils';
import { getAllExternalInfoByPartyForMRI } from '../../dal/exportRepo';
import { getExternalIdsForUser } from '../../services/users';
import { getInventoryProps } from '../../dal/inventoryRepo';
import { getAvailabilityDate } from '../../../common/helpers/inventory';
import { getInventoryExpanded } from '../../services/inventories';
import { shouldExportExternalUniqueId } from '../helpers';

import { DALTypes } from '../../../common/enums/DALTypes';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export/mri' });

export const getData = async (ctx, partyDocument, leaseId, leaseTermLength, leaseStartDate) => {
  const partyData = await getPartyData(ctx, partyDocument);
  const { party, primaryTenant, externalInfo } = await getExternalInfo(ctx, partyDocument, leaseId);
  const lease = (partyDocument.leases || []).find(l => l.id === leaseId);
  const inventoryId = lease.baselineData.quote.inventoryId;
  const inventory = inventoryId && (await getInventoryExpanded(ctx, inventoryId));
  const firstAppointmentInventory = partyDocument?.metadata?.appointmentInventory;
  const inventoryProps = inventory && (await getInventoryProps(ctx, { inventoryId }));
  const inventoryAvailabilityDate = inventoryProps && getAvailabilityDate(inventoryProps, partyData.property.timezone);

  const externals = await getAllExternalInfoByPartyForMRI(ctx, partyDocument.id);
  const externalIds = await getExternalIdsForUser(ctx, partyDocument.ownerTeam, partyDocument.userId);
  const companyName = getCompanyName(partyDocument, primaryTenant.id);
  const shouldExportExternalUniqueIdForAgent = await shouldExportExternalUniqueId(ctx, partyDocument.ownerTeam, partyDocument.userId);

  return {
    tenantId: ctx.tenantId,
    ...partyData,
    party,
    lease: lease && {
      id: lease.id,
      baselineData: {
        ...lease.baselineData,
        quote: pick(lease.baselineData.quote, ['timezone', 'moveInDate']),
      },
    },
    primaryTenant,
    inventoryAvailabilityDate,
    userExternalUniqueId: externalIds.externalUniqueId,
    teamMemberExternalId: externalIds.externalId,
    shouldExportExternalUniqueIdForAgent,
    companyName,
    externalInfo,
    externals,
    inventory: inventory && {
      ...pick(inventory, ['itemType', 'itemId', 'name', 'externalId']),
      building: pick(inventory.building, ['externalId']),
      property: pick(inventory.property, ['externalId']),
    },
    appointmentInventory: await getAppointmentInventory(ctx, firstAppointmentInventory, partyData),
    leaseTermLength,
    quote: {
      leaseStartDate: leaseStartDate || inventory?.availabilityDate,
    },
  };
};

export const exportMriEditedLease = async (ctx, partyDocument, exportEvent, extraPayload) => {
  logger.info({ ctx, partyId: partyDocument.id, exportEvent }, 'Export to MRI - starting export on edit lease');

  try {
    const partyId = partyDocument.id;
    const { leaseId, allPartyMembersSigned, termLength, leaseStartDate } = exportEvent.metadata;

    const voidLeaseSteps = [ExportType.ClearSelectedUnit];

    if (allPartyMembersSigned) {
      logger.trace({ ctx, leaseId, partyId, allPartyMembersSigned }, 'Export MRI - All party members signed the lease, will void the lease in MRI.');
      voidLeaseSteps.push(ExportType.VoidLease);
    }

    const data = await getData(ctx, partyDocument, leaseId, termLength, leaseStartDate);

    const guestCardSteps = await generateGuestCardsExportSteps(ctx, partyDocument, data);

    const newLeaseExportSteps = () => addIndex([...voidLeaseSteps, ...guestCardSteps, ExportType.SelectUnit]);
    const renewalLeaseExportSteps = () => addIndex([ExportType.CancelRenewalOffer]);
    const exportSteps = partyDocument.workflowName === DALTypes.WorkflowName.RENEWAL ? renewalLeaseExportSteps() : newLeaseExportSteps();

    await processExportMessage(ctx, {
      partyId,
      data,
      exportSteps,
      extraPayload,
      mriExportAction: DALTypes.MriExportAction.EDIT_LEASE,
    });
  } catch (error) {
    logger.error({ ctx, error, partyId: partyDocument.id }, 'Export MRI - on edit lease - error');
    throw error;
  }
};
