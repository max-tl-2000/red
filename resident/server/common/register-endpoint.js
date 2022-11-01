/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { pipeline } from 'stream';
import bodyParser from 'body-parser';
import { ServiceError } from '../../../server/common/errors';
import { formatError } from '../../../common/server/format-error';
import config from '../../../consumer/config';
import logger from '../../../common/helpers/logger';
import { renderCommonPage } from '../../../server/render-helpers';
import ErrorPage from '../../../server/views/error';

export const add404HandlerForEndpoints = app => {
  app.get('*', (req, res) => {
    const { isProdEnv } = config;
    res.status(404).json(
      formatError(new ServiceError({ token: 'RESIDENT_API_NOT_FOUND', message: `Resident api: "${req.path}" not found` }), {
        isProdEnv,
        logger: req?.log,
      }),
    );
  });
};

const ensureTokenInError = error => {
  error.token = error.token ?? error.code ?? error.errno ?? 'GENERIC_ERROR';
};

const renderError = (res, error) => {
  ensureTokenInError(error);
  res.status(error.status ?? 500);
  res.json(formatError(error, { isProdEnv: config.isProdEnv, logger: res.log }));
};

const wrapActionHandler = (action, { cacheable } = {}) => {
  if (!action) throw new Error('Failed registering action!');

  return async (req, res) => {
    try {
      const result = await action(req);

      if (!result) {
        throw new Error('actions should always return a result');
      }

      if (!result.type) {
        throw new Error('actions should always return a type');
      }

      const { type, httpStatusCode, content, headers } = result;

      if (!req.isCacheable || !cacheable) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
      }

      if (headers) {
        Object.keys(headers).forEach(key => res.set(key, headers[key]));
      }

      if (httpStatusCode) res.status(httpStatusCode);

      switch (type) {
        case 'xml': {
          res.set({ 'Content-Type': 'text/xml' });
          res.send(content);
          break;
        }
        case 'json': {
          res.json(content);
          break;
        }
        case 'stream': {
          const { stream, filename } = result;
          res.header('Content-Disposition', `attachment; filename="${filename}"`);

          pipeline(stream, res);
          break;
        }
        case 'redirect': {
          const { redirectTo } = result;
          if (!redirectTo) {
            throw new Error('redirect result type but no `redirectTo` url was provided');
          }
          res.redirect(302, redirectTo);
          break;
        }
        case 'html': {
          res.set({ 'Content-Type': 'text/html' });
          res.send(content);
          break;
        }
        default:
          throw new ServiceError({ token: 'UNKNOWN_ACTION_RESULT_TYPE', data: { type } });
      }
    } catch (error) {
      ensureTokenInError(error);
      throw error;
    }
  };
};

const wrapMiddleware = middlewareDescriptor => async (req, res, next) => {
  const pure = middlewareDescriptor.pure;
  const fn = middlewareDescriptor.middleware || middlewareDescriptor;

  if (pure) {
    // this is to be able to use regular middlewares that expect the next callback to be provided
    fn(req, res, next);
    return;
  }

  try {
    // these middlewares don't receive next, it is called automatically at the end if no error was
    // raised from inside the middlewares. If an exception is caught, the next callback is invoked
    // with such captured error
    await fn(req, res);
    next();
  } catch (error) {
    renderError(res, error);
  }
};

export const registerEndpoint = (
  app,
  { routePath, cacheable = false, errorAsJSON = true, method = 'get', middlewares = [], actionHandler, useHTMLResponsePage = false } = {},
) => {
  method = method || 'use';

  const fn = app[method];

  if (!fn) {
    throw new Error(`method does not exists in app ${method}`);
  }

  if (!routePath) {
    throw new Error('routePath is not defined');
  }

  middlewares = [
    ...[bodyParser.urlencoded({ extended: false, limit: '10000mb' }), bodyParser.json({ limit: '10000mb' }), ...middlewares.map(wrapMiddleware)],
    async (req, res, next) => {
      try {
        await wrapActionHandler(actionHandler, { cacheable })(req, res);
        // there is no next as the wrapped action handlers will write to the response
        // there is no need to call next from this point on
      } catch (error) {
        if (useHTMLResponsePage) {
          const { isProdEnv } = config;
          const serverError = formatError(error, { isProdEnv, logger });
          res.status(error.status || 500);
          await renderCommonPage(ErrorPage, { res, props: { serverError }, req, next });
          return;
        }

        if (errorAsJSON) {
          renderError(res, error);
          return;
        }
        next(error);
      }
    },
  ];

  app[method](routePath, ...middlewares);
};

export const wrapAsJSON = fn => async (...args) => {
  const content = await fn(...args);
  return { type: 'json', content };
};
