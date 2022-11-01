/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantByIdQuery } from '../../dal/tenantsRepo';
import { VIEW_MODEL_TYPES } from './enums';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = ctx => getTenantByIdQuery(ctx.tenantId).toString();

export const tokensMapping = {
  displayName: ({ name }) => name,
};
