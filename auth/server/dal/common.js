/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery } from '../../../server/database/factory';
import { commonSchema } from '../../../common/helpers/database';

export const COMMON_SCHEMA_CTX = { tenantId: commonSchema };

export const commonQueryCtx = ctx => ({ ...ctx, ...COMMON_SCHEMA_CTX });

// eslint-disable-next-line red/dal-async
export const initCommonQuery = ctx => initQuery(commonQueryCtx(ctx));
