/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getActiveProperties } from '../../dal/propertyRepo';
import LeaseProviderFactory from '../../services/leases/leaseProviderFactory';

import loggerModule from '../../../common/helpers/logger';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';

const logger = loggerModule.child({ subType: 'import' });
const leaseProviderFactory = new LeaseProviderFactory();

export const importLeaseTemplates = async msg => {
  const { tenantId, msgCtx } = msg;
  const ctx = { ...msgCtx, tenantId };

  logger.info({ ctx }, 'Importing lease template');
  const propertiesData = (await getActiveProperties(ctx))
    .filter(p => p.settings && p.settings.lease && p.settings.lease.propertyName)
    .map(p => ({
      id: p.id,
      name: p.name,
      externalId: p.settings.lease.propertyName,
    }));

  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  let hadError = false;

  await execConcurrent(
    propertiesData,
    async property => {
      try {
        await leaseProvider.getFormSetsList(ctx, property);
      } catch (error) {
        logger.error({ ctx, error, property }, 'Caught error while importing lease templates');
        hadError = true;
      }
    },
    10,
  );

  logger.info({ ctx }, hadError ? 'Lease templates imported successfully.' : 'Lease templates imported with errors.');

  return { processed: true };
};
