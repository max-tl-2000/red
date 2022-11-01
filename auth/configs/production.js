/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';
import { commonConfig } from '../../common/server-config';

const config = {
  ...commonConfig,
  serverPort: envVal('AUTH_PORT', 3500),
  apiPort: envVal('API_PORT', 3030),
  i18nDebug: envVal('I18N_DEBUG', false),
  registrationTokenExpires: '2year',
};

module.exports = config;
