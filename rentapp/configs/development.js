/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';

const applicationDomain = 'application.local.env.reva.tech';
const applicationBaseUrl = `https://${applicationDomain}`;

const config = {
  fadv: {
    fakeResponseEndpoint: `${applicationBaseUrl}/api/webhooks/screeningResponse`,
  },
  payment: {
    applicationDomain,
  },
  aptexx: {
    // TODO: override when sandbox account setup complete
    useOverrideSandboxTargetIds: true,
    targetAccountName: envVal('TARGET_ACCOUNT_NAME', 'Test 2'),
    successUrl: `${applicationBaseUrl}/payment-success.html`,
    cancelUrl: `${applicationBaseUrl}/payment-cancel.html`,
  },
};

module.exports = config;
