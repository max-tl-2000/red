/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../../config';
import { ServiceError } from '../../common/errors';
import * as universityService from '../../services/university';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'universityAPI' });

const validateRequest = req => {
  const { secret, isUniversityEnv } = config.university;

  if (isUniversityEnv !== true) {
    logger.warn({ ctx: req }, 'University request was sent to an environment where it is not enabled');
    throw new ServiceError({
      token: 'NOT_A_UNIVERSITY_ENVIRONMENT',
      status: 404,
    });
  }

  const { secret: requestSecret } = req.body;

  if (secret !== requestSecret) {
    logger.error({ ctx: req }, 'University request was sent with an invalid secret');
    throw new ServiceError({
      token: 'INVALID_SECRET',
      status: 401,
    });
  }
};

// endpoint for requesting a sandbox to be created from a  non-university environment
export const requestSandboxCreation = async req => {
  logger.trace({ ctx: req }, 'requestSandboxCreation');

  await universityService.triggerSandboxCreation(req);
  return { status: 200 };
};

// endpoint for requesting a sandbox token to auto-login from the non-university environment
export const getSandboxUrl = async req => {
  logger.trace({ ctx: req }, 'getSandboxUrl');
  const userId = req.authUser.userId;

  return await universityService.getSandboxUrl(req, userId);
};

// create sandbox on the university environment
export const createSandbox = async req => {
  logger.trace({ ctx: req }, 'createSandbox');
  validateRequest(req);
  return await universityService.createSandbox(req, req.body);
};

// check the status of the sandbox on the university environment
export const checkSandboxStatus = async req => {
  logger.trace({ ctx: req }, 'checkSandboxStatus');
  validateRequest(req);
  const { jobId } = req.body;
  return await universityService.checkSandboxStatus(req, jobId);
};
