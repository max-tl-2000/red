/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import { getPropertyById } from '../../../server/dal/propertyRepo';
import { getPropertyAssignedToParty } from '../../../server/helpers/party';
import { logEntity } from '../../../server/services/activityLogService';
import { updateAssignedProperty } from '../../../server/services/party';
import { getApplicationInvoicesByFilter } from './application-invoices';
import { DALTypes } from '../../../common/enums/DALTypes';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'propertyService' });

export const getPropertyToAssign = async (ctx, { quote, party, propertyId }) => {
  if (propertyId) return await getPropertyById(ctx, propertyId);

  const property = await getPropertyAssignedToParty(ctx, party);
  if (!property) {
    if (quote && quote.inventory && quote.inventory.property) {
      return await getPropertyById(ctx, quote.inventory.property.id);
    }
  }
  return property;
};

export const updateAssignedPropertyOnFirstPayment = async (ctx, { partyApplicationId, propertyId, party }) => {
  const partyId = party.id;
  const applicationInvoices = await getApplicationInvoicesByFilter(ctx, {
    partyApplicationId,
    paymentCompleted: true,
  });
  if (applicationInvoices.length > 1) return;

  if (party.assignedPropertyId === propertyId) {
    logger.trace({ ctx, partyId, partyApplicationId, propertyId }, 'No need to update the assigned property');
    return;
  }

  const property = await getPropertyToAssign(ctx, { party, propertyId });
  logger.info({ ctx, partyId, partyApplicationId, propertyId }, 'A payment has been done to a different property. Updating the party assigned property.');
  await logEntity(ctx, {
    entity: {
      id: partyId,
      primaryProperty: property.name,
      reason: 'First paid application',
      createdByType: DALTypes.CreatedByType.SYSTEM,
    },
    activityType: ACTIVITY_TYPES.UPDATE,
    component: COMPONENT_TYPES.PARTY,
  });
  await updateAssignedProperty(ctx, partyId, propertyId);
};
