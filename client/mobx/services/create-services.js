/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createService } from '../../../common/client/service-creator';

export const createAuthAwareService = (descriptors, auth) => {
  const service = createService(descriptors);

  service.setHeadersForAllCalls(() => {
    if (!auth || !auth.isAuthenticated) return {};
    return {
      Authorization: `Bearer ${auth.token}`,
    };
  });

  return service;
};
