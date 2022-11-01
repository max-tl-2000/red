/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as service from '../../services/config';
import { ServiceError } from '../../common/errors';

export const getConfig = request => service.getConfig(request);

export const getTenantAndPropertyIds = request => {
  const { propertyName, tenant } = request.query;

  if (!tenant || !request.tenantId) {
    throw new ServiceError({ token: 'INVALID_TENANT', status: 400 });
  }

  if (!propertyName) {
    throw new ServiceError({ token: 'INVALID_PROPERTY', status: 400 });
  }

  return service.getTenantAndPropertyIds(request, propertyName);
};
