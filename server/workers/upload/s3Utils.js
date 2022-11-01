/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantKeyPrefix } from './uploadUtil';
import { getAllObjects, deleteObjects } from './s3';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'aws' });

export const deleteAll = async (ctx, bucket) => {
  if (!ctx.tenantId || !bucket) return;

  const keys = await getAllObjects(bucket, getTenantKeyPrefix(ctx.tenantId));
  logger.info({ ctx, bucket }, 'Deleting all tenant files from S3 bucket');
  await deleteObjects(ctx, bucket, keys);
};
