/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getKeyPrefixForSignedLeaseDocuments, getPrivateBucket } from '../upload/uploadUtil';
import { getObjectStream } from '../upload/s3';
import logger from '../../../common/helpers/logger';

const bucket = getPrivateBucket();

export const downloadLeaseDocument = (ctx, envelopeId, id) => {
  const keyPrefix = getKeyPrefixForSignedLeaseDocuments(ctx.tenantId, envelopeId);
  const key = `${keyPrefix}/${id}`;

  try {
    return getObjectStream(ctx, bucket, key);
  } catch (error) {
    logger.error({ ctx, bucket, key, error }, 'downloadLeaseDocument - could not get dcument stream from S3');
    return [];
  }
};
