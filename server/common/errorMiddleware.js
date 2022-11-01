/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../config';
import logger from '../../common/helpers/logger';
import { USER_AUTHORIZATION_ERROR_TOKENS } from '../../common/enums/error-tokens';
import { verboseLogCtx } from './verboseLogCtx';
import { formatError } from '../../common/server/format-error';

const isLoginError = error => error && error.message && error.message in USER_AUTHORIZATION_ERROR_TOKENS;
const isInvalidJWTError = error => error && error.code && error.code.toUpperCase() === 'INVALID_TOKEN';
const isExpiredInvite = error => error.status === 498;

// eslint-disable-next-line no-unused-vars
export const errorHandler = () => (err, req, res, next) => {
  if (err && err.redirect) {
    res.redirect(err.redirect);
  } else {
    if (err.name === 'JsonSchemaValidation') {
      config.logMiddlewareErrors && logger.error({ error: err, ...verboseLogCtx(req), validations: err.validations }, 'JSONSchemaValidation');
      res.status(400);

      const responseData = {
        statusText: 'Bad Request',
        jsonSchemaValidation: true,
        validations: err.validations,
      };
      res.json(responseData);
      return;
    }
    if (config.logMiddlewareErrors) {
      if (err.status === 412) {
        logger.warn({ err, ...verboseLogCtx(req) }, `Precondition Failed: ${err.token}`);
      } else if (isLoginError(err) || isInvalidJWTError(err) || isExpiredInvite(err)) {
        logger.info({ err, ...verboseLogCtx(req) }, err.message);
      } else {
        logger.error({ err, ...verboseLogCtx(req) }, 'api error handler');
      }
    } else if (!err.status) {
      // log unhandled api errors as these shoul usually be properly caught errors
      logger.error({ err, ...verboseLogCtx(req) }, 'Api error without status. Possible uncaught error');
    }
    res.status(err.status || 500).json(formatError(err, { isProdEnv: config.isProdEnv, logger }));
  }
};
