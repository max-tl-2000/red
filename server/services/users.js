/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import jwt from 'jsonwebtoken';
import newUUID from 'uuid/v4';
import uniqBy from 'lodash/uniqBy';
import pick from 'lodash/pick';

import { mapSeries, filter as promiseFilter } from 'bluebird';
import { hash } from '../helpers/crypto';

import { getAllValidInvites } from '../dal/usersInvitesRepo';
import { getInviteByToken } from './invites.js';
import { validateEmail } from '../../common/helpers/validations/email';
import { ServiceError, AuthorizationDataError } from '../common/errors';
import { formatTenantEmailDomain } from '../../common/helpers/utils';
import config from '../config';
import * as repo from '../dal/usersRepo';
import { getPropertiesAssociatedWithTeams } from '../dal/propertyRepo';
import { admin } from '../common/schemaConstants';
import PGPubsub from '../common/pgPubsub';
import { sendMessage } from './pubsub';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE, CALLS_QUEUE_MESSAGE_TYPE } from '../helpers/message-constants';
import { getTeamsForUsers, getTeamsWhereUserIsAgent, getAgentsInTeam, unlockAgentsForCallQueue } from '../dal/teamsRepo';
import { signInUser } from '../../auth/server/services/user-management';
import { notify, publish } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import { setAvailabilityDelayAtLogin } from './telephony/userAvailability';

import logger from '../../common/helpers/logger';
import { formatEmployeeAssetUrl } from '../helpers/assets-helper';
import { now } from '../../common/helpers/moment-utils';
import { runInTransaction } from '../database/factory';

const USER_HAS_WS_CONNECTION_REPLY_TIMEOUT = 200;

const userHasBecomeAvailable = async (ctx, userId) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.USER_AVAILABLE,
    message: {
      ctx: { tenantId: ctx.tenantId },
      userId,
    },
    ctx,
  });

const userHasBecomeUnavailable = async (ctx, userId) => {
  const teams = await getTeamsWhereUserIsAgent(ctx, userId);

  const allAgentsAreOffline = async teamId =>
    (await getAgentsInTeam(ctx, teamId)).every(u => !u.metadata.status || u.metadata.status === DALTypes.UserStatus.NOT_AVAILABLE);

  const teamIds = teams.map(t => t.id);
  const teamsWithAllAgentsOffline = await promiseFilter(teamIds, allAgentsAreOffline);

  if (!teamsWithAllAgentsOffline.length) return;

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: CALLS_QUEUE_MESSAGE_TYPE.ALL_AGENTS_OFFLINE,
    message: {
      ctx: { tenantId: ctx.tenantId },
      teamIds: teamsWithAllAgentsOffline,
    },
    ctx,
  });
};

let pgPubsub = new PGPubsub();
const initPGPubSub = async () => pgPubsub.isClosed && (pgPubsub = await new PGPubsub().connect());

let userHasWSConnectionFunc = async (ctx, userId) => {
  logger.trace({ ctx, userId }, 'userHasActiveWSConnection - params');
  await initPGPubSub();

  const replyChannel = `USER_CONNECTION_REPLY_${newUUID()}`;

  let resolve;
  const reply = new Promise(res => (resolve = res));

  const timeoutId = setTimeout(() => {
    logger.trace({ ctx, userId, timeout: USER_HAS_WS_CONNECTION_REPLY_TIMEOUT }, 'userHasActiveWSConnection timeout, resolving to false');
    resolve(false);
  }, USER_HAS_WS_CONNECTION_REPLY_TIMEOUT);

  await pgPubsub.connect();
  await pgPubsub.listen(replyChannel, hasConnection => {
    logger.trace({ ctx, userId, hasConnection, replyChannel }, 'userHasActiveWSConnection received notification');
    clearTimeout(timeoutId);
    resolve(hasConnection);
  });

  await publish(ctx, ctx.tenantId, { event: eventTypes.USER_HAS_WS_CONNECTION_QUERY, data: { userId, replyChannel } });

  return await reply;
};

export const setUserWSConnectionFunc = func => (userHasWSConnectionFunc = func);

export const userHasWSConnection = (...args) => userHasWSConnectionFunc(...args);

export const registerWithInviteToken = async (ctx, { token, password, fullName, preferredName }) => {
  if (!fullName) throw new ServiceError('FULL_NAME_REQUIRED');
  if (!preferredName) throw new ServiceError('PREFERRED_NAME_REQUIRED');
  if (!password) throw new ServiceError('PASSWORD_REQUIRED');

  const invite = await getInviteByToken(ctx, token);
  const hashedPassword = await hash(password);

  const newUser = {
    email: invite.email,
    fullName,
    preferredName,
    password: hashedPassword,
    directEmailIdentifier: invite.inviteData.directEmailIdentifier,
  };

  const user = await repo.registerNewUser(ctx, newUser, invite);
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.NEW_USER_REGISTERED,
    message: {
      ctx: { tenantId: ctx.tenantId }, // slim up the context as the queue processing fails if all the req is passed
      user,
    },
    ctx,
  });

  return newUser;
};

export const verifyDirectEmailIdentifier = async (ctx, email) => {
  const domain = formatTenantEmailDomain(ctx.tenantName, config.mail.emailDomain);
  const e = `${email}@${domain}`;

  const mailError = validateEmail(e, false /* strict = false */);

  if (mailError !== '') {
    return 'CRM_EMAIL_BAD_FORMAT';
  }

  const matchingUser = await repo.getUserByDirectEmailIdentifier(ctx, email);
  if (matchingUser) {
    return 'CRM_EMAIL_ALREADY_REGISTERED';
  }

  const invites = await getAllValidInvites(ctx);
  const emailAlreadyset = invites.some(p => p.inviteData.directEmailIdentifier === email);
  if (emailAlreadyset) {
    return 'CRM_EMAIL_ALREADY_SENT_ON_INVITE';
  }
  return '';
};

export const findSupervisingUserByGuestPhoneNumber = async (ctx, phone) => {
  const user = await repo.getUserByPartyMemberPhone(ctx, phone);
  const userStatus = await repo.getUserStatusByUserId(ctx, user.id);

  return {
    ...user,
    metadata: {
      ...user.metadata,
      ...pick(userStatus, ['status', 'statusUpdatedAt', 'notAvailableSetAt', 'wrapUpCallTimeoutId', 'loginTimeoutId']),
    },
  };
};

export const getUserTeams = async (ctx, userId) => {
  if (ctx.tenantName === admin.name) return [];
  return await getTeamsForUsers(ctx, [userId], { excludeInactiveTeams: false });
};

export const isUserAdmin = async (ctx, userId) => {
  const revaAdminUser = await repo.getRevaAdmin(ctx);
  return revaAdminUser.id === userId;
};

const getTeamsByUsers = async (ctx, userIds, excludeInactiveTeams = false) => {
  const teams = ctx.tenantName !== admin.name ? await getTeamsForUsers(ctx, userIds, { includeTeamsWhereUserIsInactive: false, excludeInactiveTeams }) : [];

  const foundTeamsByUsers = teams.reduce(
    (acc, { userId, ...team }) => ({
      ...acc,
      [userId]: [...(acc[userId] || []), team],
    }),
    {},
  );

  const teamsInfoByUser = userIds.reduce(
    ({ teamsByUser, teamIdsByUser }, id) => {
      const userTeams = foundTeamsByUsers[id] || [];
      return {
        teamsByUser: { ...teamsByUser, [id]: userTeams },
        teamIdsByUser: {
          ...teamIdsByUser,
          [id]: new Set(userTeams.map(t => t.id)),
        },
      };
    },
    { teamsByUser: {}, teamIdsByUser: {} },
  );

  return {
    ...teamsInfoByUser,
    allUsersTeamsIds: [...new Set(teams.map(t => t.id))],
  };
};

export const getZendeskPrivateContentToken = ({ email, name }) => {
  if (!config.zendesk.secretPrivateContent) return '';
  return jwt.sign(
    {
      iat: new Date().getTime() / 1000,
      jti: newUUID(),
      email,
      name,
    },
    config.zendesk.secretPrivateContent,
    {
      algorithm: config.zendesk.algorithm,
    },
  );
};

const getTeamProperties = (teamsByUser, teamsProperties, fnMapTeamProperties) =>
  teamsByUser.map(team => {
    const properties = teamsProperties.filter(tp => tp.teamId === team.id).map(fnMapTeamProperties);
    return {
      ...team,
      externalCalendars: {
        teamCalendarId: team.externalCalendars.teamCalendarId || '',
        calendars: team.externalCalendars.calendars || [],
      },
      associatedProperties: uniqBy(properties, 'id'),
    };
  });

export const sanitizeUsers = async (ctx, users, excludeInactiveTeams = false) => {
  const userIds = users.map(u => u.id);
  const { teamsByUser, teamIdsByUser, allUsersTeamsIds } = await getTeamsByUsers(ctx, userIds, excludeInactiveTeams);

  const isAdminContext = ctx.tenantName === admin.name;
  const teamsProperties = isAdminContext ? [] : await getPropertiesAssociatedWithTeams(ctx, allUsersTeamsIds);

  const mapTeamProperties = ({ id, displayName, propertyLegalName, partyCohortName }) => ({
    id,
    displayName,
    propertyLegalName,
    partyCohortName,
  });
  const teamsPropertiesByUser = userIds.reduce(
    (acc, userId) => ({
      ...acc,
      [userId]: [...(acc[userId] || []), ...teamsProperties.filter(p => teamIdsByUser[userId].has(p.teamId)).map(mapTeamProperties)],
    }),
    {},
  );

  const usersAssets = (await formatEmployeeAssetUrl(ctx, userIds)) || [];
  const usersStatuses = isAdminContext ? [] : await repo.getUsersStatusesByUserIds(ctx, userIds);

  return await mapSeries(users, async user => {
    const teams = getTeamProperties(teamsByUser[user.id] || user.teams || [], teamsProperties, mapTeamProperties);
    const avatarUrl = user.avatarUrl || usersAssets.find(it => it.entityId === user.id)?.assetUrl || '';
    const userStatus = pick(
      usersStatuses.find(us => us.userId === user.id),
      ['status', 'statusUpdatedAt', 'notAvailableSetAt', 'wrapUpCallTimeoutId', 'loginTimeoutId'],
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      preferredName: user.preferredName,
      metadata: {
        ...user.metadata,
        ...userStatus,
      },
      sipEndpoints: user.sipEndpoints || [],
      ringPhones: user.ringPhones,
      teams,
      teamIds: user.teamIds || teams.map(t => t.id),
      avatarUrl,
      associatedProperties: uniqBy(teamsPropertiesByUser[user.id], 'id'),
      externalCalendars: {
        revaCalendarId: user.externalCalendars && user.externalCalendars.revaCalendarId,
        calendars: (user.externalCalendars && user.externalCalendars.calendars) || [],
      },
    };
  });
};

export const sanitizeUser = async (ctx, user) => {
  const [sanitized] = await sanitizeUsers(ctx, [user]);
  return sanitized;
};

export const updateStatusForUsers = async (ctx, ids, status, manuallySet = false) => {
  logger.info({ ctx, userIds: ids, userStatus: status, manuallySet }, 'updateStatusForUsers - params');
  const statusUpdatedAt = now();
  const updatedUsers = await repo.updateStatusForUsers(ctx, ids, status, statusUpdatedAt, manuallySet);

  if (updatedUsers.length === 0) {
    logger.trace({ ctx, userIds: ids, userStatus: status }, "all users' status is as requested, no update needed");
    return;
  }

  const userIds = updatedUsers.map(u => u.id);

  if (status === DALTypes.UserStatus.AVAILABLE) {
    await Promise.all(userIds.map(async id => await userHasBecomeAvailable(ctx, id)));
  }
  if (status === DALTypes.UserStatus.NOT_AVAILABLE) {
    await Promise.all(userIds.map(async id => await userHasBecomeUnavailable(ctx, id)));
  }

  const teams = await getTeamsForUsers(ctx, userIds, { excludeInactiveTeams: false });
  await notify({
    ctx,
    event: eventTypes.USERS_AVAILABILITY_CHANGED,
    data: { userIds, status, statusUpdatedAt },
    routing: { teams: teams.map(team => team.id) },
  });

  logger.trace({ ctx, userIds, userStatus: status }, 'updateStatusForUsers - updated users');
};

export const updateUserStatus = async (ctx, userId, status, manuallySet) => await updateStatusForUsers(ctx, [userId], status, manuallySet);

export const loadUserById = async (ctx, userId) => {
  const user = await repo.getUserById(ctx, userId);
  if (user) return await sanitizeUser(ctx, user);
  return user;
};

export const loadActiveUserById = async (ctx, id) => {
  const user = await repo.getActiveUserById(ctx, id);

  if (user) return await sanitizeUser(ctx, user);
  return user;
};

export const loadUsersByIds = async (ctx, ids) => {
  const users = await repo.getUsersByIds(ctx, ids);
  if (users?.length) return await sanitizeUsers(ctx, users);
  return users;
};

export const loadUserBySipUsername = async (ctx, sipUsername) => {
  const user = await repo.getUserBySipUsername(ctx, sipUsername);
  return await sanitizeUser(ctx, user);
};

export const hydrateContext = async (ctx, userId) => {
  const user = await repo.getUserById(ctx, userId);
  if (!user) throw new AuthorizationDataError({ token: 'USER_NOT_FOUND' });
  return await sanitizeUser(ctx, user);
};

export const getExternalIdsForUser = async (ctx, teamId, userId) => await repo.getUserAndTeamMemberExternalIds(ctx, teamId, userId);

export const login = async (ctx, email, password) => {
  logger.debug({ ctx, email }, 'Attempting login');
  const matchingUser = await signInUser(ctx, email, password);
  logger.debug({ ctx, email }, 'Logged in');
  const isAdminTenant = ctx.tenantId === admin.id;

  const user = await loadUserById(ctx, matchingUser.id);
  const isAdminUser = user.metadata?.isAdmin;
  !isAdminTenant && !isAdminUser && (await repo.insertLoginUserStatusHistory(ctx, user.id, user.metadata?.status));

  if (!isAdminTenant && !isAdminUser) {
    setTimeout(() => {
      setAvailabilityDelayAtLogin(ctx, user);
    }, 2000);
  }

  return {
    ...pick(user, ['email', 'fullName', 'preferredName', 'id', 'metadata', 'ringPhones', 'teamIds']),
    sipEndpoints: user.sipEndpoints || [],
    externalCalendars: {
      revaCalendarId: user.externalCalendars && user.externalCalendars.revaCalendarId,
      calendars: (user.externalCalendars && user.externalCalendars.calendars) || [],
    },
  };
};

export const logoutUser = async (ctx, userId) => {
  if (ctx.authUser?.id !== userId) {
    logger.trace({ ctx, userId }, 'logoutUser - received userId does not match authUserId');
    throw new ServiceError({
      token: 'USER_ID_AND_AUTH_USER_ID_DO_NOT_MATCH',
    });
  }
  const isUserRevaAdmin = await isUserAdmin(ctx, userId);
  if (isUserRevaAdmin) {
    logger.trace({ ctx, userId }, 'logoutUser - user is Reva Admin, will not logout from all active sessions');
    await repo.insertLogoutUserStatusHistory(ctx, userId);
    return { userIsRevaAdmin: true };
  }
  try {
    logger.trace({ ctx, userId }, 'logoutUser');
    await runInTransaction(async trx => {
      const innerCtx = { ...ctx, trx };

      await updateStatusForUsers(innerCtx, [userId], DALTypes.UserStatus.NOT_AVAILABLE);
      await unlockAgentsForCallQueue(innerCtx, [userId]);
      await repo.insertLogoutUserStatusHistory(ctx, userId);
      logger.info({ ctx: innerCtx, userId }, 'Forcing user logout from all active sessions');

      await notify({
        ctx: innerCtx,
        event: eventTypes.FORCE_LOGOUT,
        routing: { users: [userId] },
      });
    });
  } catch (error) {
    const msg = 'Error while logging out user.';
    logger.error({ ctx, error, userId }, msg);
    throw error;
  }
  return {};
};
