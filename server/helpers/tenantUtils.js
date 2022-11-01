/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { IS_VALID_TENANT_NAME } from '../../common/regex';
import { RESERVED_TENANT_NAMES } from '../common/schemaConstants';

export const isValidTenantName = name => IS_VALID_TENANT_NAME.test(name);
export const isReservedTenantName = name => RESERVED_TENANT_NAMES.has(name);
