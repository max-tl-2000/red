/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../common/helpers/logger';
import { DECISION_SERVICE_LOOP_DETECTED, savePublicApiRequestTracking } from '../services/publicApiRequestTracking';
import { isUuid } from './utils';

export const docVersionHandler = (req, res, next) => {
  const { decryptedToken } = req;
  const { partyId, documentVersion } = decryptedToken;
  logger.trace({ ctx: req, partyId, documentVersion }, 'Handling event for PartyDocumentHistory version');
  if (!partyId) {
    next({
      status: 400,
      token: 'MISSING_PARTY_ID',
    });
    return;
  }

  if (!isUuid(partyId)) {
    next({
      status: 400,
      token: 'INVALID_PARTY_ID',
    });
    return;
  }

  if (!documentVersion) {
    next({
      status: 400,
      token: 'MISSING_DOCUMENT_VERSION',
    });
    return;
  }
  next();
};

export const requestTrackingHandler = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  try {
    const { decryptedToken, body, url, reqId: sessionId } = req;
    const { partyId, documentVersion } = decryptedToken;
    logger.trace({ ctx: req, partyId, documentVersion, publicApiUrlPath: url }, 'public api requestTrackingHandler');

    await savePublicApiRequestTracking(req, {
      partyId,
      documentVersion,
      sessionId,
      payload: body,
      urlPath: url,
    });
  } catch (error) {
    logger.error({ ctx: req, error }, 'an error occurred on public api requestTrackingHandler');
    if (error.token === DECISION_SERVICE_LOOP_DETECTED) {
      logger.error(
        {
          ctx: req,
          checksum: error.data?.checksum,
          checksumLimit: error.data?.checksumLimit,
          numOfRequestsWithSamePayload: error.data?.numOfRequestsWithSamePayload,
          partyId: error.data?.partyId,
          documentVersion: error.data?.documentVersion,
          publicApiUrlPath: error.data?.publicApiUrlPath,
          payload: error.data?.payload,
          sessionId: error.data?.sessionId,
        },
        'Decision service loop detected',
      );
    }

    next(error);
    return;
  }

  next();
};
