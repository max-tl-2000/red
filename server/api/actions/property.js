/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertiesWithAmenitiesAndFloors } from '../../dal/propertyRepo';
import { getPropertiesByTeams, updatePaymentProvider } from '../../services/properties';
import { getAccounts } from '../../../rentapp/server/payment/payment-provider-integration';
import logger from '../../../common/helpers/logger';
import { ServiceError } from '../../common/errors';

export const loadProperties = req => getPropertiesWithAmenitiesAndFloors(req, false);

export const loadPropertiesByTeams = req => getPropertiesByTeams(req);

export const refreshPaymentProvider = async req => {
  const ctx = { tenantId: req.params.tenantId };
  let associatedAccounts;
  try {
    associatedAccounts = await getAccounts(ctx);
  } catch (e) {
    logger.error({ ctx: req, error: e }, 'Error fetching accounts');
    throw new ServiceError({ token: 'APTEXX_FETCH_FAILED', message: e.message, status: 500 });
  }

  return await updatePaymentProvider(ctx, associatedAccounts);
};
