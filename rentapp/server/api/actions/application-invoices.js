/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createApplicationInvoice } from '../../services/application-invoices';
import * as validators from '../../../../server/api/helpers/validators';

export const addApplicationInvoice = async req => {
  const applicationInvoice = req.body;
  const tenantId = req.tenantId;

  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');

  return createApplicationInvoice(req, applicationInvoice);
};
