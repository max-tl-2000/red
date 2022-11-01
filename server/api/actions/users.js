/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as validators from '../helpers/validators';
import { ServiceError } from '../../common/errors';
import { exists } from '../../database/factory';
import {
  getUsers as loadAllUsers,
  getUserById as loadUserFromDb,
  resetPassword as updatePassword,
  updateUser as updateUserInDb,
  saveMetadata,
  updateStatusForUsers,
} from '../../dal/usersRepo';
import * as usersService from '../../services/users';
import { updateLastLoginAttempt } from '../../../auth/server/services/user-management';
import { loadGlobalData } from '../../services/appDataLoaderService';
import { createLeasingUserToken } from '../../../common/server/jwt-helpers';
import { getInviteByToken } from '../../services/invites';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../../helpers/message-constants';
import { isValidPhoneNumber } from '../../helpers/phoneUtils';
import { isEmailValid } from '../../../common/helpers/validations';

import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ADMIN } from '../../common/schemaConstants';
import { getZendeskKeys } from './zendesk';
import { getSisenseKeys } from './sisense';
import { getTokenExpirationTime } from '../../../common/helpers/jwt';
import { getTenant, getTenantSettings } from '../../services/tenantService';
import loggerModule from '../../../common/helpers/logger';
import { getUserFromResetToken } from '../../dal/tokensRepo';
import { getTeamMembersByUserId } from '../../dal/teamsRepo';

const logger = loggerModule.child({ subType: 'actions/users' });

const formatUserForResponse = async (ctx, user, utcOffset) => {
  let { host, tenantId, tenantName } = ctx;

  // This is only to support the api tests.
  if (host.startsWith('127')) {
    host = 'localhost';
  }
  const sanitized = await usersService.sanitizeUser(ctx, user);
  const tenantSettings = await getTenantSettings(ctx);
  const communicationDefaultEmailSignature = tenantSettings?.communications?.defaultEmailSignature || '';

  let tenant;
  if (tenantName !== ADMIN) {
    tenant = await getTenant(ctx);
  }
  const backendName = (tenant?.metadata.backendIntegration || {}).name;
  const phoneSupportEnabled = tenant?.metadata?.enablePhoneSupport;
  const leasingProviderMode = tenant?.metadata.leasingProviderMode;
  const tenantSendGridSandboxEnabled = tenant?.metadata.sendGridSandboxEnabled;
  const teamMembers = tenant && (await getTeamMembersByUserId({ tenantId: tenant.id }, user.id));
  const laaAccessLevels = teamMembers && teamMembers.map(member => ({ teamId: member.teamId, laaAccessLevels: member.laaAccessLevels }));

  const out = {
    ...sanitized,
    ...getZendeskKeys({
      email: sanitized.email,
      name: sanitized.fullName,
      organization: tenantName,
    }),
    ...getSisenseKeys(sanitized.email),
    tenantId,
    tenantName,
    isTrainingTenant: ctx.isTrainingTenant,
    laaAccessLevels,
    hasRCToken: ctx.hasRCToken,
    domain: host,
    protocol: `${ctx.protocol}`,
    tenantCommunicationOverrides: tenantSettings?.communicationOverrides,
    features: tenantSettings?.features,
    communicationDefaultEmailSignature,
    inventorySettings: tenantSettings?.inventory,
    allowCounterSigningInPast: tenantSettings?.lease?.allowCounterSigningInPast,
    backendName,
    phoneSupportEnabled,
    leasingProviderMode,
    tenantSendGridSandboxEnabled,
  };

  const jwtBody = {
    tenantId,
    tenantName,
    id: user.id,
    userId: user.id,
    userEmail: sanitized.email,
    teamIds: sanitized.teamIds,
    domain: host,
    protocol: `${ctx.protocol}`,
    tenantRefreshedAt: ctx.refreshed_at ? ctx.refreshed_at.toUTCString() : null,
  };
  const globalData = tenantName === ADMIN ? {} : await loadGlobalData(ctx, user);
  const token = createLeasingUserToken(ctx, jwtBody, { utcOffset });
  const tokenExpirationTime = getTokenExpirationTime(token);

  return {
    user: out,
    token,
    tokenExpirationTime,
    globalData,
  };
};

export const validateUser = async (ctx, userId) => {
  validators.uuid(userId, 'INVALID_USER_ID');
  const user = await exists(ctx.tenantId, 'Users', userId);
  if (!user) {
    throw new ServiceError({
      token: 'USER_NOT_FOUND',
      status: 404,
    });
  }
};

export const loadUsersByIds = async req => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids)) {
    throw new ServiceError({ token: 'INVALID_USER_IDS', status: 400 });
  }

  ids.forEach(id => validators.uuid(id, 'INVALID_USER_ID'));

  return usersService.loadUsersByIds(req, ids);
};

export const loadUsers = async req => {
  const users = await loadAllUsers(req);
  return await usersService.sanitizeUsers(req, users);
};

export const loadUserById = async req => {
  const { userId } = req.params;
  await validateUser(req, userId);
  const user = await loadUserFromDb(req, userId);
  return await usersService.sanitizeUser(req, user);
};

export const login = async req => {
  const { email, password, utcOffset } = req.body;
  const user = await usersService.login(req, email, password);
  return formatUserForResponse(req, user, utcOffset);
};

export const autoLogin = async req => {
  logger.trace({ ctx: req }, 'Auto login.');
  const { utcOffset } = req.body;

  const userId = req.authUser.userId;

  const user = await loadUserFromDb(req, userId);
  await updateLastLoginAttempt(req, user);
  return formatUserForResponse(req, user, utcOffset);
};

export const registerWithInvite = async req => {
  const token = req.body.token;
  const { utcOffset } = req.body;

  const invite = await getInviteByToken(req, token);
  const user = await usersService.registerWithInviteToken(req, {
    ...req.body,
    ...invite,
  });

  return formatUserForResponse(req, user, utcOffset);
};

export const resetPassword = async req => {
  const { password, token, isRegisterMode, utcOffset } = req.body;

  // without this check a user requesting a token for his password
  // could potentially update the password of a different user
  // we should always honor the token info and never ever trust what
  // the frontend is sending
  const tokenUser = await getUserFromResetToken(req, token);

  if (!tokenUser || !tokenUser.email) {
    throw new ServiceError({ token: 'INVALID_TOKEN' });
  }

  const { email } = tokenUser;

  let user = await updatePassword(req, email, password, token);

  if (isRegisterMode) {
    [user] = await updateStatusForUsers(req, [user.id], DALTypes.UserStatus.AVAILABLE);

    sendMessage({
      exchange: APP_EXCHANGE,
      key: COMM_MESSAGE_TYPE.NEW_USER_REGISTERED,
      message: {
        ctx: { tenantId: req.tenantId },
        user,
      },
      ctx: req,
    });
  }

  // TODO: why is the utcOffset needed?
  return formatUserForResponse(req, user, utcOffset);
};

export const createIpPhoneCredentials = async req => {
  const { userId } = req.params;
  await validateUser(req, userId);
  const user = await usersService.loadUserById(req, userId);

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.CREATE_IP_PHONE_CREDENTIALS,
    message: {
      ctx: { tenantId: req.tenantId },
      user,
    },
    ctx: req,
  });

  return { httpStatusCode: 202 }; // accepted
};

export const removeIpPhoneCredentials = async req => {
  const { userId } = req.params;
  const { sipUsername } = req.body;
  await validateUser(req, userId);
  const user = await usersService.loadUserById(req, userId);

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.REMOVE_IP_PHONE_CREDENTIALS,
    message: {
      ctx: { tenantId: req.tenantId },
      user,
      sipUsername,
    },
    ctx: req,
  });

  return { httpStatusCode: 202 }; // accepted
};

const isEmpty = user => Object.keys(user).length === 0;

const validatePhoneNumber = number => {
  if (isValidPhoneNumber(number)) return;
  throw new ServiceError({
    token: 'INVALID_PHONE_NUMBER',
    status: 400,
  });
};

const validateEmailAddress = emailAddress => {
  if (isEmailValid(emailAddress)) return;
  throw new ServiceError({
    token: 'INVALID_EMAIL_ADDRESS',
    status: 400,
  });
};

export const updateUser = async req => {
  const { userId } = req.params;
  const user = req.body;
  await validateUser(req, userId);
  validators.defined(user && !isEmpty(user), 'MISSING_USER');
  (user.ringPhones || []).forEach(validatePhoneNumber);
  (user.outsideDedicatedEmails || []).forEach(validateEmailAddress);

  let result;
  try {
    if (user.metadata) {
      result = await saveMetadata(req, userId, user.metadata);
      delete user.metadata;
    }

    if (!isEmpty(user)) {
      result = await updateUserInDb(req, userId, user);
    }
  } catch (error) {
    logger.error({ ctx: req, error }, 'Error while updating user.');
    throw error;
  }

  const sanitizedUser = await usersService.sanitizeUser(req, result);
  notify({
    ctx: req,
    event: eventTypes.USERS_UPDATED,
    data: { userIds: [sanitizedUser.id] },
    routing: { teams: user.teams },
  });

  return sanitizedUser;
};

export const updateUserStatus = async req => {
  const { userId } = req.params;
  const { status } = req.body;
  await validateUser(req, userId);

  await usersService.updateUserStatus(req, userId, status, true);
  return await usersService.loadUserById(req, userId);
};

export const logoutUser = async req => {
  const { userId } = req.params;
  await validateUser(req, userId);

  return await usersService.logoutUser(req, userId);
};
