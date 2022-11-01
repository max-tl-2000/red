/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import newId from 'uuid/v4';
import { sendMessage } from './pubsub';
import { saveTenant } from './tenantService';
import { ServiceError } from '../common/errors';
import config from '../config';
import { APP_EXCHANGE, UNIVERSITY_MESSAGE_TYPE } from '../helpers/message-constants';
import { DALTypes } from '../../common/enums/DALTypes';
import { saveCreateSandboxJob, getCreateSandboxJobById } from '../dal/createSandboxJobRepo';
import { getUserByEmail, getUserById, updateUser } from '../dal/usersRepo';
import { removeAllDataFromRecurringJobs } from '../dal/jobsRepo';
import { createLeasingUserToken } from '../../common/server/jwt-helpers';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'services/university' });

const { secret, universityDomain } = config.university;
const universityUrl = `https://admin.${universityDomain}/api/university`;

const createSandboxUrl = `${universityUrl}/createSandbox`;
const checkSandboxStatusUrl = `${universityUrl}/checkSandboxStatus`;

const generateRandomName = () => newId().replace(/-/gi, '').slice(0, 15);

export const buildSandboxAutoLoginUrl = tenantName => `https://${tenantName}.${universityDomain}`;

export const triggerSandboxCreation = async ctx => {
  logger.trace({ ctx }, 'triggerSandboxCreation');

  return await sendMessage({
    exchange: APP_EXCHANGE,
    key: UNIVERSITY_MESSAGE_TYPE.SANDBOX_CREATION_REQUEST,
    message: {
      userId: ctx.authUser.userId,
      tenantId: ctx.tenantId,
      host: ctx.get('Host'),
    },
    ctx,
  });
};

export const requestSandboxCreation = async (ctx, user, host) => {
  logger.trace({ ctx, createSandboxUrl, user }, 'createSandbox url');
  const { email, fullName, preferredName } = user;

  const { status, body } = await request.post(createSandboxUrl).send({ userId: user.id, secret, email, fullName, preferredName, host }).set('accept', 'json');

  logger.trace({ ctx, user, status, body }, 'Response for sandbox creation');
  const { tenantName: _name, jobId } = body;

  return jobId;
};

export const fetchSandboxStatus = async (ctx, userId, jobId) => {
  logger.trace({ ctx, userId, jobId }, 'fetchSandboxStatus');
  const sandboxStatus = await request.post(checkSandboxStatusUrl).send({ userId, secret, jobId }).set('accept', 'json');

  logger.trace({ ctx, userId, jobId, status: sandboxStatus.status, body: sandboxStatus.body }, 'fetchSandboxStatus - result');
  if (sandboxStatus.status !== 200) return { status: DALTypes.SandboxJobStatus.FAILED };
  return sandboxStatus.body;
};

export const getSandboxUrl = async (ctx, userId) => {
  logger.trace({ ctx }, 'getSandboxUrl');

  const user = await getUserById(ctx, userId);
  const { tenantName, loginToken, error } = await fetchSandboxStatus(ctx, userId, user?.metadata?.jobId || user?.metadata?.createSandboxJobId);

  if (error) {
    const { sandboxTenant, sandboxAvailable, jobId, createSandboxJobId, ...metadata } = user.metadata;
    const updatedUser = await updateUser(ctx, user.id, {
      ...user,
      metadata,
    });
    logger.trace({ ctx, updatedUser }, 'getSandboxUrl - removed sandbox information');

    throw new ServiceError({
      token: error,
      status: 404,
    });
  }

  const sandboxUrl = buildSandboxAutoLoginUrl(tenantName);
  return { sandboxUrl, loginToken };
};

export const createSandbox = async (ctx, payload) => {
  logger.trace({ ctx }, 'createSandbox');
  const { userId, email, preferredName, fullName, host } = payload;
  const name = generateRandomName();
  const data = {
    name,
    isTrainingTenant: true,
    metadata: {
      enablePhoneSupport: false,
      phoneNumbers: [],
      requestedByEnv: host,
    },
  };
  logger.trace({ ctx, data }, 'createSandbox tenant');
  const tenant = await saveTenant(ctx, data);

  const job = await saveCreateSandboxJob(ctx, { userId, email, tenantId: tenant.id, host });

  const tenantCtx = { tenantId: tenant.id };
  await removeAllDataFromRecurringJobs(tenantCtx);

  logger.trace({ ctx, job }, 'createSandbox tenant');

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: UNIVERSITY_MESSAGE_TYPE.CREATE_SANDBOX,
    message: {
      tenantId: tenant.id,
      userId,
      email,
      preferredName,
      fullName,
      sandboxJobId: job.id,
    },
    ctx,
  });

  return { tenantId: tenant.id, tenantName: tenant.name, jobId: job.id };
};

export const checkSandboxStatus = async (ctx, jobId) => {
  logger.trace({ ctx }, 'checkSandboxStatus');
  const job = await getCreateSandboxJobById(ctx, jobId);
  if (!job) return { error: 'Sandbox no longer available.' };

  if (job.status === DALTypes.SandboxJobStatus.COMPLETED) {
    let host = ctx.get('Host');
    // This is only to support the api tests.
    if (host.startsWith('127')) {
      host = 'localhost';
    }

    const newCtx = { tenantId: job.tenantId };
    const user = await getUserByEmail(newCtx, job.email);
    const utcOffset = new Date().getTimezoneOffset();
    const jwtBody = {
      tenantId: job.tenantId,
      tenantName: job.tenantName,
      id: user.id,
      userId: user.id,
      teamIds: user.teams,
      domain: host,
      protocol: `${ctx.protocol}`,
      tenantRefreshedAt: null,
      utcOffset,
    };

    const loginToken = createLeasingUserToken(ctx, jwtBody, { utcOffset });
    return { ...job, loginToken };
  }
  return job;
};
