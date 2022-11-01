/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import LeaseProviderFactory from '../../services/leases/leaseProviderFactory';
import loggerModule from '../../../common/helpers/logger';
import { getActiveProperties } from '../../dal/propertyRepo';
import { LeaseProviderName } from '../../../common/enums/enums';

const logger = loggerModule.child({ subType: 'syncBMLeaseSignatures' });
const leaseProviderFactory = new LeaseProviderFactory();

export const syncBMLeaseSignatures = async payload => {
  const ctx = { tenantId: payload.tenantId };
  logger.trace({ ctx, payload }, 'syncBMLeaseSignatures - input params');
  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  if (leaseProvider.providerName !== LeaseProviderName.BLUEMOON) {
    return { processed: true };
  }

  const properties = await getActiveProperties(ctx);
  await mapSeries(properties, async property => {
    try {
      const { integration } = property.settings;

      // We may have to still sync when bmAutoESignatureRequest=true in case agents still go to bluemoon and update there
      // We can decide at the time what we want to do about it.
      // For now, we do the work only for scenario where agent created the eSignatureRequets in Bluemoon
      if (integration?.lease?.bmAutoESignatureRequest) return;

      await leaseProvider.syncSignatureStatuses(ctx, property.id);
    } catch (error) {
      logger.error({ ctx, property, error }, 'syncBMLeaseSignatures for property failed');
    }
  });

  logger.trace({ ctx, payload }, 'syncBMLeaseSignatures - done');
  return { processed: true };
};
