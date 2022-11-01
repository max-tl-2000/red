/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { notify } from '../../../common/server/notificationClient';
import sleep from '../../../common/helpers/sleep';
import eventTypes from '../../../common/enums/eventTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { createDataForDemo } from '../../import/demo_sample_data/import';
import { updateCreateSandboxStatusById } from '../../dal/createSandboxJobRepo';
import { requestSandboxCreation, fetchSandboxStatus } from '../../services/university';
import { getUserById, getUserByEmail, updateUser } from '../../dal/usersRepo';
import { admin } from '../../common/schemaConstants';

const logger = loggerModule.child({ subType: 'universityHandler' });

const waitForSandboxCompletion = (getStatus, timeoutMs = 600000) =>
  new Promise(async (resolve, reject) => {
    setTimeout(() => {
      reject(new Error('timeout'));
    }, timeoutMs);

    let spin = true;
    while (spin) {
      const result = await getStatus();
      logger.trace(result, 'getStatus result');
      if (result.status === DALTypes.SandboxJobStatus.STARTED) {
        logger.trace(result, 'waiting for completion');
        await sleep(5000);
      } else if (result.status === DALTypes.SandboxJobStatus.FAILED) {
        logger.trace(result, 'sandbox creation failed');
        spin = false;
        reject(result);
      } else {
        logger.trace(result, 'sandbox completed');
        spin = false;
        resolve(result);
      }
    }
  });

export const requestSandboxCreationHandler = async payload => {
  const { msgCtx } = payload;
  logger.info({ ctx: msgCtx, payload }, 'Requesting sandbox creation');

  const { tenantId, userId, host } = payload;

  try {
    await notify({
      ctx: msgCtx,
      event: eventTypes.UNIVERSITY_SANDBOX_CREATION_STARTED,
      data: { tenantId: msgCtx.tenantId, userIds: [userId] },
    });

    const user = await getUserById(msgCtx, userId);

    const jobId = await requestSandboxCreation(msgCtx, user, host);
    const getStatus = async () => await fetchSandboxStatus(msgCtx, user.id, jobId);

    const completionStatus = await waitForSandboxCompletion(getStatus);
    logger.trace({ ctx: msgCtx, completionStatus }, 'Sandbox creation completed');
    const { tenantName } = completionStatus;

    const updatedUser = await updateUser(msgCtx, user.id, {
      ...user,
      metadata: {
        ...(user.metadata || {}),
        sandboxTenant: tenantName,
        sandboxAvailable: true,
        createSandboxJobId: jobId,
      },
    });

    logger.trace({ ctx: msgCtx, updatedUser }, 'createSandboxHandler - updated user data');

    await notify({
      ctx: msgCtx,
      event: eventTypes.UNIVERSITY_SANDBOX_CREATION_COMPLETED,
      data: {
        tenantId,
        sandboxTenant: tenantName,
        sandboxAvailable: true,
        userIds: [userId],
      },
    });
  } catch (error) {
    logger.error({ ctx: msgCtx, error, msgPayload: payload }, 'Requesting sandbox creation failed');
    await notify({
      ctx: msgCtx,
      event: eventTypes.UNIVERSITY_SANDBOX_CREATION_FAILED,
      data: { tenantId, successfully: false, userIds: [userId] },
    });
    return { processed: false, retry: false };
  }

  return { processed: true };
};

const replaceUser = async (ctx, email, preferredName, fullName) => {
  const existingUser = await getUserByEmail(ctx, email);

  logger.trace({ ctx, existingUser, email }, 'createSandboxHandler - fetched existing user');

  if (existingUser) {
    logger.trace({ ctx, existingUser }, 'createSandboxHandler - user already exists, no need for replace');
    return { replaced: true };
  }
  const userToReplace = 'tu1@reva.tech';
  const user = await getUserByEmail(ctx, userToReplace);

  logger.trace({ ctx, user }, 'createSandboxHandler - replacing user data');
  if (user) {
    const updatedUser = await updateUser(ctx, user.id, {
      ...user,
      email,
      preferredName,
      fullName,
    });
    logger.trace({ ctx, updatedUser }, 'createSandboxHandler - replaced used data');
    return { replaced: true };
  }

  logger.error({ ctx, user, userToReplace }, 'createSandboxHandler - failed to sandbox user');
  return { replaced: false };
};

export const createSandboxHandler = async payload => {
  logger.info({ ctx: payload.msgCtx, payload }, 'createSandboxHandler');

  const { tenantId, sandboxJobId, email, preferredName, fullName } = payload;
  // TODO: update host
  const ctx = { protocol: 'https', host: '', ...payload.msgCtx, tenantId };
  const adminCtx = { tenantId: admin.id };

  try {
    logger.trace({ ctx, payload }, 'createSandboxHandler - createDataForDemo');
    await createDataForDemo(ctx, tenantId, true, '', null, 2);
    logger.trace({ ctx, payload }, 'createSandboxHandler - createDataForDemo completed');

    await replaceUser(ctx, email, preferredName, fullName);

    logger.trace({ ctx, payload }, 'createSandboxHandler - updateCreateSandboxStatus');
    await updateCreateSandboxStatusById(adminCtx, sandboxJobId, DALTypes.SandboxJobStatus.COMPLETED);
  } catch (error) {
    logger.error({ ctx, error, msgPayload: payload }, 'createSandboxHandler failed');

    await updateCreateSandboxStatusById(adminCtx, sandboxJobId, DALTypes.SandboxJobStatus.FAILED);
    return { processed: false, retry: false };
  }

  return { processed: true };
};
