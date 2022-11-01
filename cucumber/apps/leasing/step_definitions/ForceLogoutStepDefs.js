/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';

import { tenant } from 'support/hooks';
import { forceUsersLogout } from '../../../lib/utils/apiHelper';

module.exports = function logoutStepDefs() {
  this.Given(/^System forces users to logout$/, async () => {
    await forceUsersLogout({ tenantId: tenant.id });
  });
};
