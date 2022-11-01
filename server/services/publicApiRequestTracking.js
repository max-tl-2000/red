/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import stringify from 'json-stringify-safe';
import { getStringHash } from '../../common/server/hash-utils';
import { ServiceError } from '../common/errors';
import {
  getPublicApiRequestCountByChecksum as getPublicApiRequestChecksumCountRepo,
  savePublicApiRequestTracking as savePublicApiRequestTrackingRepo,
} from '../dal/publicApiRequestTrackingRepo';
import loggerModule from '../../common/helpers/logger';
import { runInTransaction } from '../database/factory';
import { isObject } from '../../common/helpers/type-of';

const logger = loggerModule.child({ subType: 'publicApiRequestTracking' });

export const DECISION_SERVICE_LOOP_DETECTED = 'DECISION_SERVICE_LOOP_DETECTED';
const REQUEST_WITH_SAME_CHECKSUM_LIMIT = 3;

const throwServiceError = error => {
  throw new ServiceError(error);
};

export const getPublicApiRequestChecksumCount = async (ctx, { partyId, checksum, urlPath, sessionId }) =>
  await getPublicApiRequestChecksumCountRepo(ctx, partyId, checksum, {
    minAgeFilter: '15 minutes',
    urlFilter: urlPath,
    sessionIdFilter: sessionId,
  });

const validatePublicApiRequestTracking = ({ partyId, documentVersion, urlPath, payload, sessionId }) => {
  !sessionId && throwServiceError({ token: 'MISSING_SESSION_ID', status: 400 });
  !partyId && throwServiceError({ token: 'MISSING_PARTY_ID', status: 400 });
  !documentVersion && throwServiceError({ token: 'MISSING_DOCUMENT_VERSION', status: 400 });
  !urlPath && throwServiceError({ token: 'MISSING_URL_PATH', status: 400 });
  !isObject(payload) && throwServiceError({ token: 'PAYLOAD_TYPE_ERROR', status: 400 });
};

export const savePublicApiRequestTracking = async (ctx, part) => {
  const { partyId, payload, documentVersion, urlPath, sessionId } = part;
  logger.info({ ctx, partyId, documentVersion }, 'savePublicApiRequestTracking');

  validatePublicApiRequestTracking(part);

  let requestTracking;

  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };

    const stringifiedPayload = stringify(payload);
    const checksum = getStringHash(stringifiedPayload);

    const numOfRequestsWithSamePayload = await getPublicApiRequestChecksumCount(innerCtx, { partyId, checksum, urlPath, sessionId });
    if (numOfRequestsWithSamePayload >= REQUEST_WITH_SAME_CHECKSUM_LIMIT) {
      throwServiceError({
        token: DECISION_SERVICE_LOOP_DETECTED,
        status: 400,
        data: {
          sessionId,
          partyId,
          documentVersion,
          checksumLimit: REQUEST_WITH_SAME_CHECKSUM_LIMIT,
          numOfRequestsWithSamePayload,
          payload: stringifiedPayload,
          checksum,
          publicApiUrlPath: urlPath,
        },
      });
    }

    requestTracking = await savePublicApiRequestTrackingRepo(innerCtx, {
      partyId,
      documentVersion,
      sessionId,
      payload: stringifiedPayload,
      urlPath,
      checksum,
    });
  });

  return requestTracking;
};
