/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import jwt from 'express-jwt';
import URL from 'url';
import get from 'lodash/get';
import config from '../config';
import { getTenantByName, getTenantByAuthToken, getTenantData } from '../dal/tenantsRepo';
import { knex } from '../database/factory';
import { hydrateContext } from '../services/users';
import { getReplacedPropertyId } from '../services/properties';
import { getPartyById } from '../services/party';
import { admin } from './schemaConstants';
import { tenant as testTenant } from '../testUtils/test-tenant';
import { TEST_TENANT_ID } from '../../common/test-helpers/tenantInfo';
import { isUuid } from '../api/helpers/validators';
import { decrypt } from '../../common/server/crypto-helper';
import typeOf, { isArray } from '../../common/helpers/type-of';
import { ServiceError } from './errors';

import { isRequestFromABot } from '../../common/server/browser-detector.ts';
import { hasOwnProp } from '../../common/helpers/objUtils';
import { getLastMergeWithByPersonId } from '../dal/personRepo';
import { isCorporateParty } from '../../common/helpers/party-utils';
import { verboseLogCtx } from './verboseLogCtx';
import cucumberConfig from '../../cucumber/config';

import loggerInstance from '../../common/helpers/logger';
import { tenantNamesToIgnore } from '../../common/server/tenants-info';
import { isLocalApiHost } from '../../common/regex';
import { X_ROBOTS_TAG } from '../../common/enums/requestHeaders';

const logger = loggerInstance.child({ subType: 'common/middleware' });

const { cucumber } = cucumberConfig;

const logReq = req => ({
  reqId: req.reqId || req.get('X-Request-Id'),
});

// copies the req so that it can be accessed in the same way as it was
// before Node 14.  See CPM-20320 for details
// (This includes any objects added via prior middleware)
const extractCtx = req => {
  const headers = {};
  Object.keys(req.headers).forEach(key => (headers[key] = req.headers[key]));

  const ctx = {
    ...req,
    headers,
    // These will prevent warnings from being displayed when accessing deprecated host field
    hostname: req.hostname, // This will prevent warnings from being displayed when accessing deprecated host field
    host: req.hostname, // allow downstream to access via the "correct" key, which isnt cloned in the spread
    protocol: req.protocol,

    // These functions are not copied over via spread
    next: req.next,
    get: req.get,
    route: req.route,
  };
  return ctx;
};

export const routeHandler = action => {
  if (!action) throw new Error('Failed registering action!');

  return async (req, res, next) => {
    try {
      const result = await action(extractCtx(req));
      const { type, httpStatusCode, content, headers } = result || {};
      if (!req.isCacheable) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
      }
      if (headers) {
        Object.keys(headers).forEach(key => res.set(key, headers[key]));
      }

      if (httpStatusCode) res.status(httpStatusCode);

      switch (type) {
        case 'xml':
          res.set({ 'Content-Type': 'text/xml' });
          res.send(content);
          break;
        case 'json':
          res.json(content);
          break;
        case 'stream': {
          const { stream, filename } = result;
          res.header('Content-Disposition', `attachment; filename="${filename}"`);
          stream.on('error', error => {
            logger.warn({ ctx: req, error }, 'error while handling stream');
            res.end(error.message);
          });
          stream.pipe(res);
          break;
        }
        case 'blob': {
          const { stream } = result;
          stream.pipe(res);
          break;
        }
        case 'redirect': {
          const { url } = result;
          if (!url) {
            throw new ServiceError({ status: 404 });
          }
          res.redirect(301, url);
          break;
        }
        case 'html':
          res.set({ 'Content-Type': 'text/html' });
          res.send(content);
          break;
        default:
          res.json(result);
      }
    } catch (error) {
      error.token = error.token || error.code || error.errno || 'GENERIC_ERROR';
      next(error);
    }
  };
};

const enhanceRequest = (req, tenant) => {
  if (req.tenantId && req.tenantId !== tenant.id) {
    logger.warn({ ...logReq(req), newTenantId: tenant.id, oldTenantId: req.tenantId }, 'replacing tenantId after merge');
  }
  req.tenantId = tenant.id;
  req.tenantName = tenant.name;
  req.mergedTenantId = ((tenant.metadata?.previousTenantNames || []).find(prevTenant => prevTenant.id === req.tenantId) || {}).id;

  if (tenant.name !== admin.name && req.authUser && req.authUser.tenantId !== tenant.id) {
    logger.warn({ ...logReq(req), newTenantId: tenant.id, oldTenantId: req.authUser.tenantId }, 'replacing authUser.tenantId after merge');
    req.authUser.tenantId = tenant.id;
  }

  if (tenant.name !== admin.name && tenant.settings) {
    req.isTrainingTenant = tenant.isTrainingTenant;
  }

  if (tenant.refreshed_at) {
    req.refreshed_at = tenant.refreshed_at;
  }
  req.hasRCToken = tenant.metadata && !!tenant.metadata.ringCentral;
};

const getToken = req => {
  logger.trace({ ctx: req }, 'getToken');
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
};

const isUrlMatch = (path, url) => {
  const type = typeOf(path);
  if (type === 'regexp') {
    return path.test(url);
  }

  const filterExpression = new RegExp(`^${path}$`, 'i');
  return filterExpression.test(url);
};

/* assume host is fully qualified unless it meets this criteria */
const isFullyQualifiedHost = host =>
  !host?.startsWith('localhost') &&
  !host?.startsWith('127') &&
  !host?.startsWith('10.226') &&
  !host?.startsWith('10.10.10') &&
  !host?.startsWith('10.10.11') &&
  !isLocalApiHost(host, config.apiPort);

const detectTenantName = req => {
  const host = req.get('Host');
  if (!isFullyQualifiedHost(host)) {
    if (req.body.tenant) {
      logger.info(logReq(req), 'Setting tenant for AWS SES development routing');
      return req.body.tenant;
    }
    if (req.query && req.query.tenant) {
      logger.info(logReq(req), `Setting tenant from query string to ${req.query.tenant}`);
      return req.query.tenant;
    }

    if (req.authUser?.tenantId === TEST_TENANT_ID) {
      logger.info(logReq(req), 'Setting tenant for cucumber tests');
      return cucumber.tenantName;
    }

    if (req.authUser?.decisionServiceID) {
      logger.info(logReq(req), 'Setting tenant for decision service request ( no callBackUrl was provided )');
      return '';
    }

    logger.info(logReq(req), 'Defaulting to test tenant for tests');
    return testTenant.name;
  }

  return host.split(new RegExp('[:|.]'))[0];
};

const hasTenantToken = req => req.query && req.query.token && isUuid(req.query.token);

const isAuthorizedApiToken = (apiToken, configTokenPath = 'tokens.api') => apiToken === get(config, configTokenPath);

const apiTokenAuthorizationHandler = (apiTokenPaths, { defaultTokenPath, requestType }) => (req, res, next) => {
  const url = URL.parse(req.url || '', true);
  if (
    !apiTokenPaths.some(apiTokenPath => {
      const [path, tokenConfigPath = defaultTokenPath] = apiTokenPath.split(':');
      if (isUrlMatch(path, url.pathname)) {
        const apiToken = req.query['api-token'];
        if (isAuthorizedApiToken(apiToken, tokenConfigPath)) {
          getTenantByName(req, detectTenantName(req))
            .then(tenant => {
              if (tenant) enhanceRequest(req, tenant);
              req[requestType] = true;
              next();
            })
            .catch(err => {
              logger.error({ error: err, ...verboseLogCtx(req) }, 'error executing getTenantByName');
              next(err);
            });
        } else {
          next({
            status: 401,
            message: 'Access is denied due to invalid credentials',
            token: 'UNAUTHORIZED',
          });
        }
        // even if not an authorized token, we are still done with the some loop
        return true;
      }
      return false;
    })
  ) {
    // not a webhook path
    next();
  }
};

export const tokenAuthorizationHandler = () => (req, res, next) => {
  if (hasTenantToken(req)) {
    const ctx = { tenantId: admin.id };
    getTenantByAuthToken(knex, ctx, req.query.token)
      .then(tenant => {
        if (tenant) {
          enhanceRequest(req, tenant);
        }
        next();
      })
      .catch(err => {
        logger.error({ error: err, ...verboseLogCtx(req) }, 'error executing getTenantByAuthToken');
        next(err);
      });
  } else {
    next();
  }
};

// if URL is one of the webhookPaths, then looks for an api-token
// whose config key is specified as part of the webhookPathConfig
export const webhookAuthorizationHandler = webhookPathConfigs =>
  apiTokenAuthorizationHandler(webhookPathConfigs, {
    defaultTokenPath: 'tokens.api',
    requestType: 'isWebhookRequest',
  });

export const internalAuthorizationHandler = internalPathConfigs =>
  apiTokenAuthorizationHandler(internalPathConfigs, {
    defaultTokenPath: 'tokens.internalApi',
    requestType: 'isInternalRequest',
  });

export const hydrateSession = () => async (req, res, next) => {
  const { tenantId, userId, personMapping } = req.authUser || {};
  const { commonUserId } = personMapping || {};

  if (req.authUser && req.mergedTenantId && req.authUser.propertyId) {
    const propertyId = await getReplacedPropertyId(req, req.authUser.propertyId);

    if (propertyId !== req.authUser.propertyId) {
      logger.trace({ ctx: req, propertyId, oldPropertyId: req.authUser.propertyId }, 'replacing propertyId after tenantId got replaced');
      req.authUser.propertyId = propertyId;
    }
  }

  if (tenantId && userId && userId !== commonUserId) {
    const sanitized = await hydrateContext(req, userId).catch(err => next(err));
    req.authUser = { ...req.authUser, ...sanitized };
    req.userId = userId;
    next();
  } else {
    next();
  }
};

export const jwtAuthorizationHandler = openPaths => (req, res, next) => {
  const jwtMiddleware = jwt({
    secret: config.auth.secret,
    requestProperty: 'encryptedBody',
    getToken,
  }).unless({
    path: openPaths,
  });

  const decryptBody = error => {
    if (error) {
      logger.trace({ error, ...verboseLogCtx(req) }, 'jwtAuthorizationHandler');
      next(error);
      return;
    }

    if (req.encryptedBody) {
      const { body, ...rest } = req.encryptedBody;
      if (!body) {
        logger.info(
          {
            ...logReq(req),
            encryptedBody: req.encryptedBody,
          },
          'Invalid token supplied for service',
        );
        next({
          status: 401,
          token: 'INVALID_TOKEN',
        });
        return;
      }

      const decrypted = decrypt(body);
      const auth = JSON.parse(decrypted);
      req.tenantId = auth.tenantId;
      req.encryptedBody = rest;
      req.decryptedToken = auth;
      next();
    } else {
      next();
    }
  };

  jwtMiddleware(req, res, decryptBody);
};

export const authorizationHandler = openPaths => (req, res, next) => {
  if (req.tenantId || req.isWebhookRequest || req.isInternalRequest) {
    // tenantId resolved by tokenAuthorizationHandler
    next();
    return;
  }

  const jwtMiddleware = jwt({
    secret: config.auth.secret,
    requestProperty: 'encryptedBody',
    getToken,
  }).unless({
    path: openPaths,
  });

  const decryptBody = error => {
    if (error) {
      logger.trace({ error, ...verboseLogCtx(req) }, 'jwtMiddleware');
      next(error);
      return;
    }

    if (req.encryptedBody) {
      const { body, ...rest } = req.encryptedBody;
      if (!body) {
        logger.info(
          {
            ...logReq(req),
            userId: req.authUser.userId,
            encryptedBody: req.encryptedBody,
          },
          'Forcing logout due to token changes!',
        );
        next({
          status: 401,
          message: 'Forcing logout due to token changes!',
          token: 'OBSOLETE_TOKEN',
        });
        return;
      }

      const decrypted = decrypt(body);
      const authUser = JSON.parse(decrypted);

      let allowedReferrer = authUser.allowedReferrer;

      if ('allowedReferer' in authUser) {
        allowedReferrer = authUser.allowedReferer;
      }

      req.authUser = { ...authUser, allowedReferrer };

      req.encryptedBody = rest;
      next();
    } else {
      next();
    }
  };

  jwtMiddleware(req, res, decryptBody);
};

export const commonTokenAuthorizationHandler = userPaths => (req, res, next) => {
  const { commonUserId } = req.authUser || {};
  if (commonUserId && isUuid(commonUserId)) {
    const url = URL.parse(req.url || '', true);
    const denyAccess = !userPaths.some(path => isUrlMatch(path, url.pathname));
    if (denyAccess) {
      next({
        status: 401,
        message: 'Access is denied due to invalid credentials',
        token: 'UNAUTHORIZED',
      });
      return;
    }
  }

  next();
};

export const tenantHandler = () => (req, res, next) => {
  // detect tenant from JWT token
  const tenantId = (req.authUser || req).tenantId;

  // detect tenant from url.HOST
  const tenantName = detectTenantName(req);

  const logError = error => {
    logger.error({ error, ...verboseLogCtx(req) }, 'Error looking up tenant');
    next();
  };

  const handleGetTenantResult = (tenant, skipTenantValidation = false) => {
    if (!tenant) {
      logger.warn({ tenantId, tenantName, reqId: req.reqId }, 'Tenant detection failed!');
      res.status(400).json({ token: 'INVALID_TENANT', message: 'Tenant detection failed!' });
      return;
    }

    if (!skipTenantValidation) {
      // CPM-3469: tenantRefreshed will be null for calls made to shared api's
      if (req.authUser && req.authUser.tenantRefreshedAt && req.authUser.tenantRefreshedAt !== tenant.refreshed_at.toUTCString()) {
        // Note: previous version of this message and token indicated an 'expired' token, which was inaccurate
        logger.info({ tenantId, userId: req.authUser.userId, ...logReq(req) }, 'Forcing logout due to tenant refresh!');
        res.status(401).json({ token: 'TENANT_REFRESHED', message: 'Forcing logout due to tenant refresh!' });
        return;
      }

      if (tenant && tenantName && tenant.name !== tenantName) {
        logger.info(
          { tenantNameFromURL: tenantName, tenantNameFromToken: tenant.name, ...logReq(req) },
          'Forcing logout due to tenant names mismatch between request and auth token !',
        );
        if (tenantName.match(/^\d/)) {
          logger.info(
            { tenantNameFromURL: tenantName, tenantNameFromToken: tenant.name, ...logReq(req) },
            'Received a url with IP. Please check whether isFullyQualifiedHost() should be updated',
          );
        }
        res.status(401).json({ token: 'TENANT_NAME_MISMATCH', message: 'Forcing logout due to tenant names mismatch between request url and auth token !' });
        return;
      }
    }

    enhanceRequest(req, tenant);
    next();
  };

  if (tenantName === admin.name || (req.authUser && req.authUser.tenantId === admin.id)) {
    enhanceRequest(req, admin);
    next();
    return;
  }

  const skipTenantDetection = tenantNamesToIgnore.includes(tenantName);

  if (tenantId) {
    getTenantData(req, tenantId)
      .then(tenant => handleGetTenantResult(tenant, skipTenantDetection))
      .catch(logError);
    return;
  }

  // TODO Is there a better way to do this?
  // When FADV posts the screening response to the webhook, they will use `application` as the hostname in the URL.
  // Since this is an API call, the middleware will attempt to convert that into a real tenant ID, which will fail.
  // This code skips the tenantName-to-tenantId conversion for the application hostname.
  if (!skipTenantDetection) {
    getTenantByName(req, tenantName).then(handleGetTenantResult).catch(logError);
  } else {
    next();
  }
};

export const notFoundHandler = () => (req, res, next) => {
  logger.info({ ...verboseLogCtx(req) }, 'Route not found');
  next(new ServiceError({ token: 'ROUTE_NOT_FOUND', status: 404 }));
};

export const forbiddenOnProd = (req, res, next) => {
  if (config.cloudEnv === 'prod') {
    next({ status: 403, token: 'FORBIDDEN_ON_PROD' });
  }
  next && next();
};

export const ignoreBot = (req, res, next) => {
  const isABot = isRequestFromABot(req);
  if (isABot) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.status(200);
    res.end();
    return;
  }
  next && next();
};

export const forbiddenOnCorporate = async (req, res, next) => {
  try {
    const partyId = req.params.partyId;
    const party = await getPartyById(req, partyId);
    const isCorporate = isCorporateParty(party);
    if (partyId && isUuid(partyId) && isCorporate) {
      next && next({ status: 403, token: 'FORBIDDEN_ON_CORPORATE' });
    }

    next && next();
  } catch (e) {
    next && next(e);
  }
};

export const replacePersonIdForMergedPerson = async (req, res, next) => {
  try {
    if (hasOwnProp(req.authUser || {}, 'personId')) {
      const lastPersonIdMerged = await getLastMergeWithByPersonId(req, req.authUser.personId);

      if (lastPersonIdMerged && lastPersonIdMerged.id) {
        req.authUser = {
          ...req.authUser,
          personId: lastPersonIdMerged.id,
        };
      }
    }

    next && next();
  } catch (e) {
    next && next(e);
  }
};

export const buildFileObjectWithOrginalName = files =>
  files.map(file => {
    if (!file.originalname) return file;

    const { originalname, ...rest } = file;
    return {
      ...rest,
      originalName: originalname,
    };
  });

export const mapOriginalName = (req, res, next) => {
  if (req.files && isArray(req.files)) {
    req.files = buildFileObjectWithOrginalName(req.files);
  }
  next();
};

// see CPM-15563.  This is so everwhere in the code can use "headers.referrer"
// MAM - IMHO if we wanted to do this, we should enhance the req object and not mutate the headers
export const addHeaderReferrer = () => (req, res, next) => {
  const referer = req.headers.referer;
  if (!referer) {
    next();
    return;
  }

  delete req.headers.referer;
  req.headers.referrer = referer;
  next();
  return;
};

export const noIndexRobotsHeader = () => (req, res, next) => {
  res.set(X_ROBOTS_TAG, 'noindex, nofollow');
  next && next();
};
