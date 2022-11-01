/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { obscureObject } from './logger-utils';

const privateData = ['tenant.metadata', 'tenant.settings', 'tenant.partySettings'];

export const sanitizeData = data => omit(obscureObject(data), privateData);
