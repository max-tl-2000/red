/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import FadvLeaseProvider from './fadvLeaseProvider';
import BluemoonLeaseProvider from './bluemoonLeaseProvider';
import { getTenant } from '../tenantService';
import loggerModule from '../../../common/helpers/logger';
import { LeaseProviderName } from '../../../common/enums/enums';

const logger = loggerModule.child({ subType: 'leaseProvider' });

export default class LeaseProviderFactory {
  getProvider = async ctx => {
    const tenant = await getTenant(ctx);
    const { leasingProviderMode } = tenant.metadata;

    if (leasingProviderMode?.startsWith(LeaseProviderName.BLUEMOON)) {
      logger.debug({ ctx, leasingProviderMode }, 'Resolving lease service provider to blue moon');
      return new BluemoonLeaseProvider();
    }

    logger.debug({ ctx, leasingProviderMode }, 'Resolving lease service provider to fadv');
    return new FadvLeaseProvider();
  };
}
