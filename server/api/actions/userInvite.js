/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { sendInviteEmail } from '../../services/mails';
import { getTenantData } from '../../dal/tenantsRepo';
import { getUserByEmail, getUserByDirectEmailIdentifier, saveMetadata } from '../../dal/usersRepo';
import { getInviteByToken, updateUserInvite, getInvite } from '../../dal/usersInvitesRepo';
import { admin } from '../../common/schemaConstants';
import { ServiceError } from '../../common/errors';
import config from '../../config';
import { verifyDirectEmailIdentifier, loadUsersByIds } from '../../services/users';
import logger from '../../../common/helpers/logger';

const { apiToken } = config;

async function updateContext(req, tenantId) {
  if (tenantId === admin.id) {
    req.tenantId = admin.id;
    req.tenantName = admin.name;
    return;
  }
  const ctx = { tenantId: admin.id };
  const tenant = await getTenantData(ctx, tenantId);

  req.tenantId = tenantId;
  req.tenantName = tenant.name;
}

async function verifyUser(ctx, email) {
  const userAlreadyExists = await getUserByEmail(ctx, email);
  if (userAlreadyExists) {
    throw new ServiceError({
      token: 'USER_ALREADY_REGISTERED',
      status: 400,
    });
  }
}

async function validateDirectEmailIdentifier(ctx, directEmailIdentifier) {
  let isEmailValidToken = await verifyDirectEmailIdentifier(ctx, directEmailIdentifier);
  const matchingUser = await getUserByDirectEmailIdentifier(ctx, directEmailIdentifier);
  if (matchingUser) {
    isEmailValidToken = 'CRM_EMAIL_ALREADY_REGISTERED';
  }

  if (isEmailValidToken !== '') {
    throw new ServiceError({
      data: { errorType: 'CrmEmail' },
      token: isEmailValidToken,
      status: 400,
    });
  }
}

async function verifyAlreadyInvited(ctx, email) {
  const inviteAlreadyExists = await getInvite(ctx, {
    email,
    valid: true,
  });

  if (inviteAlreadyExists) {
    throw new ServiceError({
      token: 'INVITE_ALREADY_SENT',
      status: 400,
    });
  }
}

export async function sendInvite(req) {
  // switching to organization/tenant namespace for saving the token
  await updateContext(req, req.body.organization);

  await verifyAlreadyInvited(req, req.body.mail);
  await verifyUser(req, req.body.mail);
  await validateDirectEmailIdentifier(req, req.body.inviteData.directEmailIdentifier);

  return sendInviteEmail(req, req.body.mail, req.body.organization, req.body.inviteData);
}

export async function updateInvite(req) {
  const inviteData = req.body;
  const reqApiToken = req.query.apiToken;

  if (!reqApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_REQUIRED',
      status: 403,
    });
  }

  if (reqApiToken !== apiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_INVALID',
      status: 403,
    });
  }

  await updateContext(req, inviteData.organization);

  const dbInvite = await getInviteByToken(req, inviteData.token);
  if (!dbInvite) {
    throw new ServiceError({
      token: 'INVITE_NOT_FOUND',
      status: 404,
    });
  }

  return await updateUserInvite(req, inviteData.token, inviteData.updateData);
}

export async function sendInviteImportedUsers(req) {
  const body = req.body;
  const { tenantId, organization, userIds, sendForIndividual } = body;

  req.mode = 'register';
  req.tenantId = tenantId;

  const users = await loadUsersByIds(req, userIds);
  await updateContext(req, organization);

  const inviteUsers = sendForIndividual ? users : users.filter(u => !u.metadata.wasInvited);

  await mapSeries(inviteUsers, async u => {
    body.mail = u.email;

    logger.debug(`Sending reset password email to ${u.fullName} email:${body.mail}...`);
    await sendInviteEmail(req, u.email);

    await saveMetadata(req, u.id, { wasInvited: true });
  });
}
