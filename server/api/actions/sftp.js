/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenants } from '../../services/tenantService';
import { ServiceError } from '../../common/errors';
import config from '../../config';

export const getSftpUsers = async req => {
  const { token } = req.query;

  if (token !== config.import.sftp.authToken) {
    throw new ServiceError({
      status: 403,
    });
  }

  const result = await getTenants();
  return result.tenants.filter(t => t.metadata && t.metadata.sftp).map(t => t.metadata.sftp);
};
