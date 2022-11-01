/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import pick from 'lodash/pick';
import { knex, runInTransaction, insertInto, insertOrUpdate, initQuery, rawStatement, saveMetadata as saveMetadataFactory } from '../database/factory';
import { hash } from '../helpers/crypto';
import { getToken } from './tokensRepo';
import { tenantAdminEmail, revaAdminEmail } from '../../common/helpers/database';
import logger from '../../common/helpers/logger';
import { REVA_ADMIN_EMAIL } from '../../common/auth-constants';
import { DALTypes } from '../../common/enums/DALTypes';
import { prepareRawQuery } from '../common/schemaConstants';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { ServiceError } from '../common/errors';
import { now } from '../../common/helpers/moment-utils';

export const getUsers = async ctx => await initQuery(ctx).from('Users');

// eslint-disable-next-line red/dal-async
export const getUserByIdQuery = (ctx, id) => knex.raw(prepareRawQuery('SELECT * FROM db_namespace."Users" WHERE id = :id LIMIT 1', ctx.tenantId), { id });

export const getUserById = async (ctx, id) => {
  const [user] = await initQuery(ctx).from('Users').where({ id });
  return user;
};

export const getUserFullNameById = async (ctx, id) => id && (await getUserById(ctx, id)).fullName;

export const getUsersByIds = async (ctx, ids) => await initQuery(ctx).from('Users').whereIn('Users.id', ids);

export const getUsersFullNamesByIds = async (ctx, ids) => (await getUsersByIds(ctx, ids)).map(u => u.fullName);

export const getUserByExternalUniqueId = async (ctx, externalUniqueId) => await initQuery(ctx).from('Users').where({ externalUniqueId }).first();

export const getUserByDirectPhoneIdentifer = async (ctx, phone) => await initQuery(ctx).from('Users').where({ directPhoneIdentifier: phone }).first();

export const getUserByDirectEmailIdentifier = async (ctx, email) => await initQuery(ctx).from('Users').where({ directEmailIdentifier: email }).first();

export const getUsersWithRoleFromPartyOwnerTeam = async (ctx, partyId, functionalRole) => {
  logger.trace({ ctx, partyId, functionalRole }, 'getUsersWithRoleFromPartyOwnerTeam');

  const results = await knex.raw(
    `select distinct tm."userId"
      from
        :tenantId:."TeamMembers" as tm
        inner join :tenantId:."Users" as u on u."id" = tm."userId"
      where
        tm."teamId" = (select "ownerTeam" from :tenantId:."Party" where id = :partyId)
        and tm.inactive = false
        and :functionalRole = any("functionalRoles")`,
    {
      tenantId: ctx.tenantId,
      partyId,
      functionalRole,
    },
  );

  return (results && results.rows.map(item => item.userId)) || [];
};

export const getUsersWithRoleFromTeam = async (ctx, teamId, functionalRole) => {
  logger.trace({ ctx, teamId, functionalRole }, 'getUsersWithRoleFromTeam');

  const result = await initQuery(ctx)
    .from('TeamMembers')
    .innerJoin('Users', 'TeamMembers.userId', 'Users.id')
    .where({ teamId, inactive: false })
    .andWhereNot({ email: REVA_ADMIN_EMAIL })
    .andWhereRaw(`"TeamMembers"."functionalRoles" @> array['${functionalRole}']::varchar[]`)
    .andWhereRaw('("Users".metadata -> \'isAdmin\' is null OR ("Users".metadata ->> \'isAdmin\')::boolean <> true)')
    .select('userId', 'fullName');
  return result || [];
};

export const getUserIdsWithFunctionalRolesForProperty = async (ctx, partyId, functionalRole, propertyId) => {
  logger.trace({ ctx, partyId, functionalRole, propertyId }, 'getUserIdsWithFunctionalRolesForProperty');

  const results = await knex.raw(
    `select distinct tm."userId"
      from
        :tenantId:."TeamMembers" as tm
        inner join :tenantId:."TeamProperties" as tp on tp."teamId" = tm."teamId"
        inner join :tenantId:."Users" as u on u."id" = tm."userId"
      where
        tm."teamId"::varchar(36) in (select unnest(teams) from :tenantId:."Party" where id = :partyId)
        and :functionalRole = any("functionalRoles")
        and tm.inactive = false
        and tp."propertyId" = :propertyId`,
    {
      tenantId: ctx.tenantId,
      partyId,
      functionalRole,
      propertyId,
    },
  );

  logger.trace({ ctx, partyId, functionalRole, propertyId, results }, 'getUserIdsWithFunctionalRolesForProperty results');

  return (results && results.rows.map(item => item.userId)) || [];
};

export const getUserEmailIdentifierByOutsideDedicatedEmail = async (ctx, outsideDedicatedEmail) => {
  const allUsers = await initQuery(ctx).from('Users');
  const user = allUsers.find(u => u.outsideDedicatedEmails && u.outsideDedicatedEmails.includes(outsideDedicatedEmail));
  return user && user.directEmailIdentifier;
};

export const getUserEmailIdentifierByOutsideDedicatedEmails = async (ctx, outsideDedicatedEmails) => {
  const allUsers = await initQuery(ctx).from('Users');
  const user = allUsers.find(u => u.outsideDedicatedEmails && u.outsideDedicatedEmails.some(email => outsideDedicatedEmails.indexOf(email) >= 0));
  return user && user.directEmailIdentifier;
};

export const getUserByEmail = async (ctx, email) => {
  const [user] = await initQuery(ctx).from('Users').where({ email: email.toLowerCase() });
  return user;
};

export const getAdminUser = ctx => getUserByEmail(ctx, tenantAdminEmail);

export const getRevaAdmin = ctx => getUserByEmail(ctx, revaAdminEmail);

export const userExists = async (ctx, id) => {
  const users = await initQuery(ctx).from('Users').where({ id });
  return users.length === 1;
};

export const getUserByPartyMemberPhone = async (ctx, phone) => {
  const [user] = await initQuery(ctx)
    .select('Users.*')
    .from('Users')
    .innerJoin('Party', 'Users.id', 'Party.userId')
    .innerJoin('PartyMember', 'Party.id', 'PartyMember.partyId')
    .innerJoin('ContactInfo', 'ContactInfo.personId', 'PartyMember.personId')
    .where('ContactInfo.type', 'phone')
    .andWhere('ContactInfo.value', phone);
  return user;
};

export const insertUserStatus = async (ctx, userId) => {
  const query = `INSERT INTO db_namespace."UserStatus"
               ("id", "userId", "status") VALUES
               ("public".gen_random_uuid(), :userId, :status)`;

  const { rows } = await rawStatement(ctx, query, [
    {
      userId,
      status: DALTypes.UserStatus.NOT_AVAILABLE,
    },
  ]);
  return rows[0];
};

export const insertLoginUserStatusHistory = async (ctx, userId, status) => {
  logger.trace({ ctx, userId, status }, 'insertLoginUserStatusHistory');

  const query = `INSERT INTO db_namespace."UserStatusHistory"
               ("id", "userId", "status", "loginAt", pid) VALUES
               ("public".gen_random_uuid(), :userId, :status, :loginAt, pg_backend_pid())`;

  const { rows } = await rawStatement(ctx, query, [
    {
      userId,
      status,
      loginAt: now(),
    },
  ]);
  return rows[0];
};

export const insertLogoutUserStatusHistory = async (ctx, userId) => {
  logger.trace({ ctx, userId }, 'insertLogoutUserStatusHistory');

  const query = `INSERT INTO db_namespace."UserStatusHistory"
               ("id", "userId", "status", "logoutAt", pid) VALUES
               ("public".gen_random_uuid(), :userId, :status, :logoutAt, pg_backend_pid())`;

  const { rows } = await rawStatement(ctx, query, [
    {
      userId,
      status: DALTypes.UserStatus.NOT_AVAILABLE,
      logoutAt: now(),
    },
  ]);
  return rows[0];
};

export const registerNewUser = async (ctx, user, invite) => {
  try {
    return await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };
      await initQuery(innerCtx).from('UsersInvites').where({ id: invite.id }).update({ valid: false });
      user.id = getUUID();
      user.externalUniqueId = getUUID();
      user.email = user.email.toLowerCase();
      user.directEmailIdentifier = user.directEmailIdentifier && user.directEmailIdentifier.toLowerCase();

      const savedUser = insertInto(innerCtx.tenantId, 'Users', user, { trx: innerCtx.trx });
      await insertUserStatus(ctx, savedUser.id);
      return savedUser;
    }, ctx);
  } catch (error) {
    logger.error({ ctx, error, userId: user.id }, 'User registration error');
    throw new ServiceError({ token: 'USER_REGISTRATION_ERROR', innerError: error });
  }
};

export const saveUser = async (ctx, user) => {
  logger.trace({ ctx, userEmail: user.email }, 'saveUser');

  return insertOrUpdate(ctx.tenantId, 'Users', user, {
    conflictColumns: ['externalUniqueId'],
    excludeColumns: ['password'],
  });
};

export const saveMetadata = async (ctx, userId, metadata) => {
  const [result] = await saveMetadataFactory(ctx, 'Users', userId, metadata);

  return result;
};

export const getUsersStatusesByUserIds = async (ctx, userIds) => {
  const query = `SELECT *
                  FROM db_namespace."UserStatus" us
                  WHERE us."userId" IN (${userIds.map(id => `'${id}'`).join(',')})`;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getUserStatusByUserId = async (ctx, userId) => {
  const query = `SELECT *
                  FROM db_namespace."UserStatus" us
                WHERE us."userId" = :userId`;

  const { rows } = await rawStatement(ctx, query, [{ userId }]);
  return rows[0] || {};
};

export const saveUserStatusWrapUpCallTimeoutId = async (ctx, userId, wrapUpCallTimeoutId) => {
  const query = `
    UPDATE db_namespace."UserStatus"
      SET "wrapUpCallTimeoutId" = :wrapUpCallTimeoutId
      WHERE "userId" = :userId
    RETURNING *
  `;

  const { rows } = await rawStatement(ctx, query, [{ userId, wrapUpCallTimeoutId }]);

  return rows;
};

export const saveUserStatusLoginTimeoutId = async (ctx, userId, loginTimeoutId) => {
  const query = `
    UPDATE db_namespace."UserStatus"
      SET "loginTimeoutId" = :loginTimeoutId
      WHERE "userId" = :userId
    RETURNING *
  `;

  const { rows } = await rawStatement(ctx, query, [{ userId, loginTimeoutId }]);

  return rows;
};

export const updateStatusForUsers = async (ctx, ids, status, statusUpdatedAt = now(), manuallySet = false) => {
  let delta = { status, statusUpdatedAt };

  switch (status) {
    case DALTypes.UserStatus.AVAILABLE:
      delta = { ...delta, wrapUpCallTimeoutId: null, notAvailableSetAt: null, loginTimeoutId: null };
      break;
    case DALTypes.UserStatus.NOT_AVAILABLE:
      delta = manuallySet ? { ...delta, notAvailableSetAt: statusUpdatedAt } : delta;
      break;
    default:
      break;
  }

  const shouldUpdateWrapUpCallTimeoutId = delta.wrapUpCallTimeoutId || delta.wrapUpCallTimeoutId === null;
  const shouldUpdateNotAvailableSetAt = delta.notAvailableSetAt || delta.notAvailableSetAt === null;
  const shouldUpdateLoginTimeoutId = delta.loginTimeoutId || delta.loginTimeoutId === null;

  const query = `
    UPDATE db_namespace."UserStatus"
      SET "status" = :status,
          ${shouldUpdateWrapUpCallTimeoutId ? '"wrapUpCallTimeoutId" = :wrapUpCallTimeoutId,' : ''}
          ${shouldUpdateLoginTimeoutId ? '"loginTimeoutId" = :loginTimeoutId,' : ''}
          ${shouldUpdateNotAvailableSetAt ? '"notAvailableSetAt" = :notAvailableSetAt,' : ''}
          "statusUpdatedAt" = :statusUpdatedAt
      WHERE ARRAY["userId"::varchar(36)] <@ :ids
          AND "status" != :status
    RETURNING *
  `;

  const { rows } = await rawStatement(ctx, query, [{ ...delta, ids }]);

  return ((await getUsersByIds(ctx, ids)) || []).map(user => {
    const userStatus = pick(
      rows.find(r => r.userId === user.id),
      ['status', 'statusUpdatedAt', 'notAvailableSetAt', 'wrapUpCallTimeoutId', 'loginTimeoutId'],
    );

    return {
      ...user,
      metadata: {
        ...user.metadata,
        ...userStatus,
      },
    };
  });
};

export const resetPassword = async (ctx, email, password, token) => {
  const hashedPassword = await hash(password);
  const dbToken = await getToken(ctx, token);

  try {
    return await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };
      await initQuery(innerCtx).from('Tokens').where({ id: dbToken.id, valid: true }).update({ valid: false });

      const [usr] = await initQuery(innerCtx).from('Users').where({ email }).update({ loginAttempts: 0, password: hashedPassword }).returning('*');

      return usr;
    }, ctx);
  } catch (error) {
    logger.error({ error, email }, 'Error resetting user password');
    throw new ServiceError({ token: 'UPDATE_USER_FAIL', innerError: error });
  }
};

export const updateUser = async (ctx, id, user) => {
  const delta = user.sipEndpoints ? { ...user, sipEndpoints: JSON.stringify(user.sipEndpoints) } : user;

  const [updatedUser] = await initQuery(ctx).from('Users').where({ id }).update(delta).returning('*');
  return updatedUser;
};

export const getActiveUserById = async (ctx, id) =>
  await initQuery(ctx)
    .from('Users')
    .select('Users.*')
    .innerJoin('TeamMembers', 'TeamMembers.userId', 'Users.id')
    .where('Users.id', id)
    .andWhere('TeamMembers.inactive', false)
    .first();

export const getUserBySipUsername = async (ctx, username) =>
  (await initQuery(ctx).from('Users')).find(({ sipEndpoints }) => sipEndpoints.some(e => e.username === username));

export const getAllSipEndpoints = async ctx =>
  (await initQuery(ctx).from('Users')).reduce((endpoints, { sipEndpoints }) => [...endpoints, ...sipEndpoints], []);

export const getUserByFullName = async (ctx, fullName) =>
  await initQuery(ctx)
    .from('Users')
    .innerJoin('TeamMembers', 'TeamMembers.userId', 'Users.id')
    .whereRaw('"TeamMembers"."inactive" IS FALSE AND "Users"."fullName" ilike :fullName', { fullName })
    .select('Users.*')
    .first();

export const getFirstUserWithFunctionalRoleForProperty = async (ctx, functionalRole, propertyId) => {
  const results = await rawStatement(
    ctx,
    `SELECT u.*
      FROM
        db_namespace."TeamMembers" AS tm
        INNER JOIN db_namespace."TeamProperties" AS tp ON tp."teamId" = tm."teamId"
        INNER JOIN db_namespace."Teams" AS t ON tm."teamId" = t.id
        INNER JOIN db_namespace."Users" AS u ON u."id" = tm."userId"
      WHERE
        tp."propertyId" = :propertyId
        AND :functionalRole = ANY("functionalRoles")
        AND tm.inactive = FALSE
        AND t."endDate" is NULL
      ORDER BY t."displayName", tp."created_at", tm."created_at"
      LIMIT 1`,
    [
      {
        functionalRole,
        propertyId,
      },
    ],
  );

  return results && results.rows[0];
};

export const getUserAndTeamsForProspectImport = async (ctx, fullNameOrExternalUniqueId, propertyId) => {
  const query = `
    SELECT
      u."userId",
      u."teamIds"
    FROM (
    (SELECT
      u.id AS "userId",
      array_agg(tp."teamId" ORDER BY (CASE t.module
        WHEN :residentServices THEN 1
        ELSE 2 END)) AS "teamIds"
    FROM db_namespace."Users" AS u
    INNER JOIN db_namespace."TeamMembers" AS tm ON u.id = tm."userId"
    INNER JOIN db_namespace."TeamProperties" AS tp ON tm."teamId" = tp."teamId"
    INNER JOIN db_namespace."Teams" AS T ON tp."teamId" = t.id
    WHERE tm.inactive IS FALSE
    AND tp."propertyId" = :propertyId
    AND (u."fullName" ILIKE :fullNameOrExternalUniqueId OR u."externalUniqueId" ILIKE :fullNameOrExternalUniqueId)
    AND t."endDate" IS NULL
    GROUP BY u.id
    LIMIT 1)

    UNION ALL

    (SELECT
      tm."userId",
      array[tp."teamId"]::uuid[] AS "teamIds"
    FROM db_namespace."TeamMembers" AS tm
    INNER JOIN db_namespace."TeamProperties" AS tp ON tp."teamId" = tm."teamId"
    INNER JOIN db_namespace."Teams" AS t ON tm."teamId" = t.id
    WHERE tp."propertyId" = :propertyId
    AND :ldRole = any("functionalRoles")
    AND tm.inactive IS FALSE
    AND t."endDate" IS NULL
    ORDER BY (CASE t.module
      WHEN :residentServices THEN 1
      ELSE 2 END)
    LIMIT 1)
    ) AS u
    LIMIT 1
  `;

  const { rows } = await rawStatement(ctx, query, [
    { fullNameOrExternalUniqueId, propertyId, ldRole: FunctionalRoleDefinition.LD.name, residentServices: DALTypes.ModuleType.RESIDENT_SERVICES },
  ]);
  return (rows && rows[0]) || {};
};

export const getEmployeesToExport = async ctx => {
  const result = await knex.raw(
    `select
      "externalUniqueId",
      "email",
      "fullName",
      "preferredName",
      "employmentType",
      "metadata"->>'businessTitle' as "businessTitle",
      "externalCalendars"->>'calendarAccount' as "calendarAccount"
    from :tenantId:."Users"
    where not email = 'admin'`,
    {
      tenantId: ctx.tenantId,
    },
  );

  return result.rows;
};

export const isAdminOrDispatcherAgent = async (ctx, userId, { excludeAdmin = false } = {}) => {
  const adminFilter = !excludeAdmin ? 'OR u.email ilike :revaAdminEmail' : '';
  const query = `
    SELECT count(*)
    FROM db_namespace."Users" as u
    INNER JOIN db_namespace."TeamMembers" as tm on u.id = tm."userId"
    WHERE u.id = :userId
    AND (tm."functionalRoles" @> '{${FunctionalRoleDefinition.LD.name}}' ${adminFilter})
  `;
  const result = await rawStatement(ctx, query, [{ userId, revaAdminEmail }]);
  return Number(result.rows[0].count) > 0;
};

export const getUserAndTeamMemberExternalIds = async (ctx, teamId, userId) => {
  const query = `
    SELECT u."externalUniqueId", tm."externalId"
    FROM db_namespace."Users" as u
    INNER JOIN db_namespace."TeamMembers" as tm ON u.id = tm."userId"
    WHERE tm."teamId"= :teamId and tm."userId"=:userId;
  `;
  const result = await rawStatement(ctx, query, [{ teamId, userId }]);

  return result.rows[0];
};

export const deleteRingPhones = async ctx => {
  const query = 'UPDATE db_namespace."Users" SET "ringPhones" = \'{}\'';

  await rawStatement(ctx, query);
};

export const getLeasingAgentInformationForApplication = async (ctx, userId) => {
  const query = `SELECT  u.id , u.email , u."displayEmail" , u."fullName" , u."preferredName"
  from db_namespace."Users" u
  INNER JOIN db_namespace."TeamMembers" tm on tm."userId" = u.id
  WHERE u.id= :userId`;

  const { rows } = await rawStatement(ctx, query, [{ userId }]);
  return rows[0] || {};
};
