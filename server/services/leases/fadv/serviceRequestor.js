/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenant } from '../../tenantService';
import loggerModule from '../../../../common/helpers/logger';
import config from '../../../config';
import { DALTypes } from '../../../../common/enums/DALTypes';
import * as leaseRequestor from './leaseRequestor';
import * as fakeLeaseRequestor from './fakeLeaseRequestor';

const logger = loggerModule.child({ subType: 'leaseServiceRequestor' });

export const getServiceRequestor = async ctx => {
  const tenant = await getTenant(ctx);
  const { leasingProviderMode } = tenant.metadata;
  const { testHostname, productionHostname, ctHostname, uatHostname } = config.fadv.contract;

  logger.debug({ ctx, leasingProviderMode }, 'Resolving lease service requestor');

  // Note that the serviceRequestor is only used for the fadv back-end
  switch (leasingProviderMode) {
    case DALTypes.LeasingProviderMode.FADV_PROD:
      return { hostname: productionHostname, requestor: leaseRequestor };
    case DALTypes.LeasingProviderMode.FADV_TEST:
      return { hostname: testHostname, requestor: leaseRequestor };
    case DALTypes.LeasingProviderMode.FADV_CT:
      return { hostname: ctHostname, requestor: leaseRequestor };
    case DALTypes.LeasingProviderMode.FADV_UAT:
      return { hostname: uatHostname, requestor: leaseRequestor };
    default:
      return { hostname: 'fake', requestor: fakeLeaseRequestor };
  }
};
