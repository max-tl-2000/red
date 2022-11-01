/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import jwt from 'express-jwt';
import { promisify } from 'util';
import loggerInstance from '../../../common/helpers/logger';
import { ResidentPropertyState } from '../../../common/enums/residentPropertyStates';

import { getTenantByName } from '../dal/tenant-repo';
import { tenantNamesToIgnore } from '../../../common/server/tenants-info';
import { commonConfig } from '../../../common/server-config';
import tryParse from '../../../common/helpers/try-parse';
import { decrypt } from '../../../common/server/crypto-helper';
import { ServiceError } from '../../../server/common/errors';
import { COMMON } from '../../../server/common/schemaConstants';
import { getPropertyIdFromURLFragment } from '../common/get-property-id-from-url';
import { getCommonUserProperties } from '../services/common-user';
import { markPropertyAsAccessed } from '../services/property';
import config from '../../../server/config';
import { decodeEmailToken } from '../common/decode-email-token';

const logger = loggerInstance.child({ subType: 'common-middlewares' });

const detectTenantName = req => {
  if (config.isIntegration) {
    return req.headers.tenant || 'resident';
  }

  const host = req.hostname || req.get('Host');

  return host.split(new RegExp('[:|.]'))[0];
};

// Remove clutter from Aptexx response
const clearQueryParam = param => {
  if (!param) return param;
  const index = param.indexOf('session/');
  return index > -1 ? param.slice(0, index) : param;
};

export const tenantMiddleware = async req => {
  const { tenant: tenantFromUrl } = req.query;
  const cleanedTenantFromUrl = clearQueryParam(tenantFromUrl);
  const tenantName = cleanedTenantFromUrl ?? detectTenantName(req);

  const middlewareCtx = (req.middlewareCtx = req.middlewareCtx || {});
  if (tenantName && tenantNamesToIgnore.includes(tenantName)) {
    logger.info({ ctx: req }, `Ignoring reserved tenant name ${tenantName}. Defaulting to common`);
    req.tenantId = middlewareCtx.tenantId = COMMON;
    middlewareCtx.tenantName = COMMON;
    return;
  }

  const tenant = await getTenantByName(tenantName);

  // to fix issues with missing tenantId in ctx object passed down
  // we kept the tenantId in the req object, but it should be better
  // to use the new middlewareCtx that is being created here
  req.tenantId = middlewareCtx.tenantId = tenant.id;
  middlewareCtx.tenantName = tenant.name;
};

const getToken = req => {
  logger.trace({ ctx: req }, 'getToken');
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

export const emailTokenMiddleware = req => {
  const { emailToken } = req?.query || {};
  if (!emailToken) return;

  const { successful, result, errorToken } = decodeEmailToken(emailToken);
  const { consumerToken } = req.middlewareCtx || {};

  if (!successful) {
    logger.error({ ctx: req, consumerToken, errorToken }, 'Email token is invalid');
    throw new ServiceError({
      status: 401,
      token: errorToken,
    });
  }

  if (!consumerToken || result.commonUserId === consumerToken.commonUserId) {
    req.emailTokenCtx = result;
    return;
  }

  logger.error({ ctx: req, consumerToken, emailToken: result }, 'Tokens mismatch');
  throw new ServiceError({
    status: 401,
    message: 'Forcing logout due to tokens mismatch!',
    token: 'TOKENS_MISMATCH',
  });
};

export const consumerTokenMiddleware = ({ credentialsRequired = true } = {}) => {
  const fn = async (req, res) => {
    try {
      const jwtMiddleware = jwt({
        secret: commonConfig.auth.secret,
        requestProperty: 'encryptedBody',
        credentialsRequired,
        getToken,
      });

      const jwtMiddlewareAsPromised = promisify(jwtMiddleware);

      await jwtMiddlewareAsPromised(req, res);
      req.middlewareCtx = req.middlewareCtx || {};

      if (req.encryptedBody) {
        const { body, ...rest } = req.encryptedBody;
        if (!body) {
          logger.info(
            {
              ctx: req,
              userId: req.commonUser.userId,
              encryptedBody: req.encryptedBody,
            },
            'Forcing logout due to token changes!',
          );
          throw new ServiceError({
            status: 401,
            message: 'Forcing logout due to token changes!',
            token: 'OBSOLETE_TOKEN',
          });
        }

        const decrypted = decrypt(body);
        const consumerToken = tryParse(decrypted);

        req.middlewareCtx = {
          ...req.middlewareCtx,
          consumerToken,
        };

        req.encryptedBody = rest;
      }
    } catch (error) {
      logger.trace({ error, ctx: req }, 'jwtMiddleware');
      throw error;
    }
  };

  return fn;
};

let getUserCommonUserPropertiesFunc = getCommonUserProperties;
const getRetrieveCommonUserPropertiesFunction = () => getUserCommonUserPropertiesFunc;
export const setRetrieveCommonUserPropertiesFunction = func => (getUserCommonUserPropertiesFunc = func);
export const resetRetrieveCommonUserPropertiesFunction = () => (getUserCommonUserPropertiesFunc = getCommonUserProperties);

export const propertyMiddleware = ({ requiredFeatures = [], checkIfUserIsCurrentResident = false, checkIfUserIsOnlyPastResident = true } = {}) => async req => {
  const propertyId = getPropertyIdFromURLFragment(req.url) || req?.body?.propertyId;

  if (!propertyId) {
    return;
  }

  req.middlewareCtx = req.middlewareCtx || {};

  const { consumerToken } = req.middlewareCtx;
  const { commonUserId } = consumerToken || {};

  if (!commonUserId) {
    throw new ServiceError({ token: 'MISSING_COMMON_USER_ID' });
  }

  let properties = [];
  try {
    properties = await getRetrieveCommonUserPropertiesFunction()(req, commonUserId, { propertyIds: [propertyId], tenantName: req?.middlewareCtx?.tenantName });
  } catch (err) {
    req.log?.error({ ctx: req, err, middlewareCtx: req.middlewareCtx }, `Error fetching properties for user ${commonUserId}`);
    throw new ServiceError({ token: 'ERROR_FETCHING_PROPERTIES_FOR_USER', originalError: err, status: 403 });
  }

  if (properties?.length === 0) {
    req.log?.error({ ctx: req, middlewareCtx: req.middlewareCtx }, `Error fetching properties for user ${commonUserId}`);
    throw new ServiceError({ token: 'PROPERTY_NOT_ASSOCIATED_TO_USER', status: 403 });
  } else {
    if (checkIfUserIsCurrentResident) {
      const allowedResidentStates = [checkIfUserIsCurrentResident && ResidentPropertyState.CURRENT].filter(allowedState => allowedState);
      const isAllowedUser = properties.some(property => allowedResidentStates.includes(property.residentState));
      if (!isAllowedUser) {
        throw new ServiceError({ token: 'USER_IS_NOT_AUTHORIZED', status: 403 });
      }
    }

    if (checkIfUserIsOnlyPastResident) {
      const userIsOnlyPastResident = properties.every(p => p.residentState === ResidentPropertyState.PAST);

      if (userIsOnlyPastResident) {
        throw new ServiceError({ token: 'USER_IS_NOT_AUTHORIZED', status: 401 });
      }
    }
    const { propertyName, tenantName, personId } = properties[0];
    const tenant = await getTenantByName(tenantName);
    req.middlewareCtx = {
      ...req.middlewareCtx,
      propertyId,
      propertyName,
      personId,
      // we are overriding middlewareCtx to use tenant data provided by the property
      tenantName: tenant.name,
      tenantId: tenant.id,
    };
    req = {
      ...req,
      tenantName,
      tenantId: tenant.id,
    };
    markPropertyAsAccessed(req, { commonUserId, propertyId });
  }

  if (requiredFeatures?.length) {
    const { features: propertyFeatures } = properties[0] || {};

    const missingFeatures = requiredFeatures.reduce((acc, featureName) => {
      const hasFeature = !!propertyFeatures?.[featureName];
      if (!hasFeature) {
        acc.push(featureName);
      }
      return acc;
    }, []);

    if (missingFeatures.length > 0) {
      req.log?.error({ ctx: req, propertyFeatures, requiredFeatures, missingFeatures }, 'Required features not found in property');
      throw new ServiceError({ status: 403, token: 'MISSING_REQUIRED_FEATURES_IN_PROPERTY', data: { missingFeatures } });
    }
  }
};

const getQueryToken = req => {
  logger.trace({ ctx: req }, 'getQueryToken');
  return req?.query?.token;
};

export const webhookTokenMiddleware = () => {
  const fn = async (req, res) => {
    try {
      const jwtMiddleware = jwt({
        secret: commonConfig.resident.webhookJwtSecret,
        requestProperty: 'encryptedBody',
        credentialsRequired: true,
        getToken: getQueryToken,
      });

      const jwtMiddlewareAsPromised = promisify(jwtMiddleware);

      await jwtMiddlewareAsPromised(req, res);

      if (req.encryptedBody) {
        const { body } = req.encryptedBody;

        const decrypted = decrypt(body, 'resident.webhookEncryptionKey');
        const parsedQueryToken = tryParse(decrypted);

        req.middlewareCtx = { ...req.middlewareCtx, queryToken: parsedQueryToken };
      }
    } catch (error) {
      logger.trace({ error, ctx: req }, 'jwtMiddleware');
      throw error;
    }
  };

  return fn;
};
