/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import url from 'url';
import omit from 'lodash/omit';
import { removeToken } from '../../common/helpers/strings';
import loggerModule from '../../common/helpers/logger';
import { ServiceError } from '../common/errors';
import { validateToken as validateTokenId } from '../services/tokens';
import { getTenantSettings } from '../services/tenantService';

const logger = loggerModule.child({ subType: 'referrerAuth' });

const isAllowedEndpoint = (endpoint, calledEndpoint) => {
  const endpointLower = endpoint.toLowerCase();
  const calledEndpointLower = calledEndpoint.toLowerCase();

  if (endpointLower.endsWith('/')) {
    return calledEndpointLower.startsWith(endpointLower);
  }

  return endpointLower === calledEndpointLower;
};

export const validateToken = async req => {
  const { tokenId } = req.authUser;
  logger.trace({ ctx: req, tokenId }, 'validateToken');

  // temporaty check to allow a timeframe for updating existing tokens to new
  // version ( v1 tokens do not include a tokenId,  v2 tokens include tokenId)
  const tenantSettings = await getTenantSettings(req);
  if (tenantSettings?.features?.supportTokensV1) {
    logger.info({ ctx: req }, 'tokenId validation skipped');
    return;
  }

  if (!tokenId) throw new ServiceError({ token: 'MISSING_TOKEN_ID', status: 400 });

  await validateTokenId(req.authUser, tokenId);
};

const getAllowedReferrers = ({ allowedReferrer } = {}) => {
  if (Array.isArray(allowedReferrer)) return allowedReferrer;
  return allowedReferrer ? [allowedReferrer] : [];
};

const shouldSkipReferrerValidation = ({ allowedReferrer } = {}) => !Array.isArray(allowedReferrer) && allowedReferrer === '';

export const validateReferrer = req => {
  const { endpoints } = req.authUser;
  const originator = req.headers.origin || req.headers.referrer;
  const allowedReferrers = getAllowedReferrers(req.authUser);

  logger.trace(
    {
      ctx: req,
      body: omit(req.body, ['token']),
      referrer: originator,
      endpoints,
      allowedReferrers,
    },
    'validateReferrer',
  );

  const queryStringIndex = req.url.indexOf('?');
  const strippedEndpoint = queryStringIndex !== -1 ? req.url.substring(0, queryStringIndex) : req.url;
  const calledEndpoint = strippedEndpoint.replace('/', '');

  const throwInvalidEndpoint = () => {
    logger.trace({ ctx: req }, 'validateReferrer - invalid endpoint called');
    throw new ServiceError({ token: 'INVALID_ENDPOINT', status: 400 });
  };

  if (!endpoints || !calledEndpoint) {
    throwInvalidEndpoint();
  }

  const isAllowed = endpoints.some(endpoint => isAllowedEndpoint(endpoint, calledEndpoint));

  if (!isAllowed) {
    throwInvalidEndpoint();
  }

  if (shouldSkipReferrerValidation(req.authUser)) {
    logger.trace({ ctx: req, referrer: originator, endpoints }, 'Referrer validation skipped');
    return;
  }

  const referrer = originator && url.parse(originator);

  if (
    !allowedReferrers.length ||
    !referrer ||
    !referrer.hostname ||
    !allowedReferrers.some(allowedReferrer => referrer.hostname.endsWith(allowedReferrer.toLowerCase()))
  ) {
    logger.trace({ ctx: req, referrer: referrer && removeToken(referrer.href) }, 'validateReferrer - invalid referrer');
    throw new ServiceError({ token: 'INVALID_REFERRER', status: 400 });
  }
};
