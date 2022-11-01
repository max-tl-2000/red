/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as maintenanceService from '../../services/maintenance';
import { checkFields } from '../../common/check-fields';
import { isValidPhoneNumber } from '../../../../server/helpers/phoneUtils';
import { ServiceError } from '../../../../server/common/errors';

export const createMaintenanceTicket = async req => {
  const { propertyId } = req.params;
  const { personId } = req.middlewareCtx;

  checkFields(req, { propertyId, personId, ...req.body }, [
    'propertyId',
    'personId',
    'inventoryId',
    'location',
    'type',
    'phone',
    'description',
    'hasPermissionToEnter',
    'hasPets',
  ]);

  const { phone, attachments } = req.body;

  if (attachments?.length > 0) attachments.forEach(a => checkFields(req, a, ['metadata', 'contentData']));

  if (!isValidPhoneNumber(phone)) {
    throw new ServiceError({
      token: 'INVALID_PHONE_NUMBER',
      status: 400,
    });
  }

  return {
    type: 'json',
    content: await maintenanceService.createMaintenanceTicket(req, { propertyId, personId, maintenanceRequest: req.body }),
  };
};

export const getMaintenanceTickets = async req => {
  const { propertyId } = req.params;
  const { testDataUnits = true } = req.query;
  const { personId, consumerToken } = req.middlewareCtx;
  const { commonUserId } = consumerToken || {};
  checkFields(req, { propertyId, personId }, ['propertyId', 'personId']);

  return {
    type: 'json',
    content: await maintenanceService.getMaintenanceInfo(req, { propertyId, personId, commonUserId, testDataUnits }),
  };
};

export const getMaintenanceTypes = async req => {
  const { propertyId } = req.params;
  checkFields(req, { propertyId }, ['propertyId']);

  return {
    type: 'json',
    content: await maintenanceService.getMaintenanceTypes(req, { propertyId }),
  };
};
