/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { mapSeries } from 'bluebird';
import { getOne, updateOne, getOneWhere, runInTransaction, rawStatement } from '../../../server/database/factory';
import logger from '../../../common/helpers/logger';
import { hash } from '../../../server/helpers/crypto';
import { errorIfHasUndefinedValues } from '../../../common/helpers/validators';
import { DALTypes } from '../../../common/enums/DALTypes';
import { initCommonQuery, commonQueryCtx, COMMON_SCHEMA_CTX } from './common';

const USERS_TABLE = 'Users';
const USERS_PERSONS_TABLE = 'UserPerson';

export const getUserIdByPersonId = async (ctx, personId) => {
  const { tenantId } = ctx;
  errorIfHasUndefinedValues({ tenantId, personId });
  const result = await initCommonQuery(ctx)
    .from(USERS_PERSONS_TABLE)
    .where({
      personId,
      tenantId,
    })
    .select('userId')
    .first();
  return result && result.userId;
};

export const getPersonIdByTenantIdAndUserId = async (ctx, tenantId, userId) => {
  const [result] = await initCommonQuery(ctx)
    .from(USERS_PERSONS_TABLE)
    .where({
      userId,
      tenantId,
    })
    .select('personId');
  return result && result.personId;
};

export const insertCommonUser = async (ctx, commonUserRaw) => {
  const now = new Date();
  commonUserRaw.id = getUUID();
  commonUserRaw.anonymousEmailId = getUUID();
  commonUserRaw.created_at = now;
  commonUserRaw.updated_at = now;
  // we use empty password to create the common user and will not allow the login with empty passwords
  commonUserRaw.password = '';
  const createdUser = await initCommonQuery(ctx).returning('id').insert(commonUserRaw).into(USERS_TABLE);
  return createdUser[0];
};

export const insertPersonMapping = async (ctx, personId, commonUserId) => {
  const { tenantId } = ctx;
  const personMapping = {
    tenantId,
    personId,
    commonUserId,
  };
  errorIfHasUndefinedValues(personMapping);
  await initCommonQuery(ctx).insert({ tenantId, personId, userId: personMapping.commonUserId }).into(USERS_PERSONS_TABLE);
  return personMapping;
};

export const getCommonUser = (ctx, id) => getOne(commonQueryCtx(ctx), USERS_TABLE, id);

export const getEmailAddressByUserId = async (ctx, userId) =>
  getOneWhere(commonQueryCtx(ctx), USERS_TABLE, {
    id: userId,
  });

export const getCommonUserByAnonymousEmailId = (ctx, anonymousEmailId) => getOneWhere(commonQueryCtx(ctx), USERS_TABLE, { anonymousEmailId });

export const getCommonUserByIdAndEmail = async (ctx, id, email) => {
  const context = { ...ctx, ...COMMON_SCHEMA_CTX };
  const { rows = [] } = await rawStatement(
    context,
    `
        SELECT * FROM db_namespace."${USERS_TABLE}" WHERE email = :email AND id = :id
      `,
    [
      {
        email,
        id,
      },
    ],
  );
  return rows.length ? rows[0] : null;
};

export const getCommonUserByEmailAddress = (ctx, emailAddress) =>
  getOneWhere(commonQueryCtx(ctx), USERS_TABLE, {
    email: emailAddress.toLowerCase(),
  });

// TODO: this should be renamed to reflect that it also fetches existing user
export const createCommonUser = async (ctx, personId, commonUserRaw) => {
  logger.debug({ ctx, personId, commonUserRaw }, 'Create common user');
  const { tenantId } = ctx;
  const existingUserId = await getUserIdByPersonId(ctx, personId);
  commonUserRaw.email = commonUserRaw.email.toLowerCase();
  return runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    let personMapping;
    let commonUser;
    if (existingUserId) {
      logger.debug({ ctx: innerCtx, existingUserId }, 'fetching existing user');
      commonUser = await getCommonUser(innerCtx, existingUserId);
      logger.debug({ ctx: innerCtx, personId, commonUserId: commonUser.id }, 'found existing user');
      personMapping = {
        tenantId,
        personId,
        commonUserId: existingUserId,
      };
    } else {
      logger.debug({ ctx: innerCtx, personId, ...commonUserRaw }, 'inserting new common user');
      // try to see if we already have the Common user (maybe it was added for a different tenant)
      const user = await getCommonUserByEmailAddress(innerCtx, commonUserRaw.email);
      if (user) logger.debug({ ctx: innerCtx, email: commonUserRaw.email, userId: user.id }, 'createCommonUser found existing user from email');
      const commonUserId = user ? user.id : await insertCommonUser(innerCtx, commonUserRaw);
      logger.debug({ ctx: innerCtx, personId, commonUserRaw }, 'inserting person mapping');
      personMapping = await insertPersonMapping(innerCtx, personId, commonUserId);
      commonUser = commonUserRaw;
    }
    return {
      personMapping,
      commonUser,
    };
  }).catch(error => {
    logger.error({ ctx, error }, 'createCommonUser caught error - rethrowing');
    throw error;
  });
};

const getPersonInfoForCommonUserByPersonId = async (ctx, personId) => {
  const query = `
    SELECT p."fullName", p."preferredName", c.value email
    FROM :tenantId:."Person" p
    INNER JOIN :tenantId:."ContactInfo" c ON c."personId" = p.id
    WHERE c.type = :emailType AND c."isPrimary" IS TRUE AND p.id = :personId
  `;
  const { rows } = await rawStatement(ctx, query, [{ tenantId: ctx.tenantId, personId, emailType: DALTypes.ContactInfoType.EMAIL }]);
  return rows.length ? rows[0] : {};
};

export const createCommonUsersByPersonIds = async (ctx, personIds) => {
  logger.info({ ctx, personIds }, 'Create common users by person ids');

  await mapSeries(personIds, async personId => {
    const commonUserRaw = await getPersonInfoForCommonUserByPersonId(ctx, personId);
    await createCommonUser(ctx, personId, commonUserRaw);
  });
};

export const updateCommonUser = (ctx, id, commonUserRaw) => updateOne(commonQueryCtx(ctx), USERS_TABLE, id, commonUserRaw);

export const getCommonUserByPersonId = async (ctx, personId) =>
  await initCommonQuery(ctx)
    .from(USERS_TABLE)
    .join(USERS_PERSONS_TABLE, `${USERS_PERSONS_TABLE}.userId`, `${USERS_TABLE}.id`)
    .where(`${USERS_PERSONS_TABLE}.tenantId`, ctx.tenantId)
    .andWhere(`${USERS_PERSONS_TABLE}.personId`, personId)
    .first();

export const getCommonUserByPersonIds = async (ctx, personIds) =>
  await initCommonQuery(ctx)
    .from(USERS_TABLE)
    .join(USERS_PERSONS_TABLE, `${USERS_PERSONS_TABLE}.userId`, `${USERS_TABLE}.id`)
    .whereIn(`${USERS_PERSONS_TABLE}.personId`, personIds)
    .andWhere(`${USERS_PERSONS_TABLE}.tenantId`, ctx.tenantId);

export const getCommonUsersByCommonUserId = async (ctx, commonUserId) =>
  await initCommonQuery(ctx)
    .from(USERS_TABLE)
    .join(USERS_PERSONS_TABLE, `${USERS_PERSONS_TABLE}.userId`, `${USERS_TABLE}.id`)
    .andWhere(`${USERS_PERSONS_TABLE}.userId`, commonUserId);

export const commonUserChangePassword = async (ctx, userId, password) => {
  const hashedPassword = await hash(password);
  return initCommonQuery(ctx).from(USERS_TABLE).where({ id: userId }).update({ password: hashedPassword, loginAttempts: 0 }).returning('*');
};

const deleteUsers = async (ctx, tenantId, userIds) => await initCommonQuery(ctx).from(USERS_TABLE).whereIn('id', userIds).del();

const deleteAllUserPersonsBySchema = async (ctx, tenantId) =>
  await initCommonQuery(ctx).returning('userId').from(USERS_PERSONS_TABLE).where({ tenantId }).del();

const getUserCount = async (ctx, userIds) =>
  await initCommonQuery(ctx).from(USERS_PERSONS_TABLE).select('userId').whereIn('userId', userIds).count('userId').groupBy('userId');

// for given tenantId, delete all users
export const deleteCommonInformation = async (ctx, tenantId) => {
  const userIds = await deleteAllUserPersonsBySchema(ctx, tenantId);
  const duplicatedUsersInUserPersonsTable = await getUserCount(ctx, userIds);
  const commonUsersForDeletion = userIds.reduce(
    (acc, curr) =>
      // don't delete the users if we still have them used by another tenant
      duplicatedUsersInUserPersonsTable.find(u => u.userId === curr) ? acc : [...acc, curr],
    [],
  );
  await deleteUsers(ctx, tenantId, commonUsersForDeletion);
};

export const updatePersonIdForCommonUserPerson = async (ctx, { basePersonId, otherPersonId }) =>
  await initCommonQuery(ctx).from(USERS_PERSONS_TABLE).where({ personId: otherPersonId }).update({ personId: basePersonId }).returning('*');

export const getTenantResidentSettingsByAppId = async (ctx, { appId, commonUserId, tenantId, propertyId }) => {
  let results = [];
  if (tenantId && (propertyId || appId)) {
    let propertyCondition = '';
    if (propertyId && appId) {
      propertyCondition = 'AND id = :propertyId';
    } else if (propertyId) {
      propertyCondition = 'WHERE id = :propertyId';
    }

    const whereCondition = appId ? `WHERE settings -> 'rxp' -> 'app' ->> 'id' = :appId ${propertyCondition}` : propertyCondition;

    const { rows = [] } = await rawStatement(
      { ...ctx, tenantId },
      `
      SELECT '${tenantId}' as "tenantId", settings -> 'rxp' -> 'app' ->> 'scheme' as "scheme" FROM db_namespace."Property"
      ${whereCondition}
      `,
      [
        {
          appId,
          propertyId,
        },
      ],
    );
    results = rows;
  } else if (appId) {
    const context = { ...ctx, ...COMMON_SCHEMA_CTX };
    const { rows: tenants } = await rawStatement(
      context,
      `
        SELECT DISTINCT(up."tenantId")
        FROM db_namespace."UserPerson" up
        WHERE up."userId" = :commonUserId
      `,
      [
        {
          commonUserId,
        },
      ],
    );

    const queries = tenants?.map(
      ({ tenantId: scheme }) =>
        `SELECT '${scheme}' as "tenantId", settings -> 'rxp' -> 'app' ->> 'scheme' as "scheme", settings -> 'rxp' -> 'app' ->> 'name' as "appName" FROM "${scheme}"."Property" WHERE settings -> 'rxp' -> 'app' ->> 'id' = :appId`,
    );

    if (!queries || !queries.length) {
      return null;
    }

    const { rows = [] } = await rawStatement(
      context,
      `
        SELECT t."tenantId", t.scheme, t."appName" FROM (${queries.join(' UNION ')}) as t LIMIT 1
      `,
      [
        {
          appId,
        },
      ],
    );
    results = rows;
  }

  if (!results.length) {
    return null;
  }

  return { ...results[0], appId };
};

export const getUsersAccessedProperties = async (ctx, { personIds, propertyId }) => {
  logger.trace({ ctx, personIds, propertyId }, 'getUsersAccessedProperties');

  const query = `
    SELECT up."personId"
    FROM common."${USERS_PERSONS_TABLE}" up
    INNER JOIN common."AccessedProperties" ap ON up."userId" = ap."commonUserId"
    WHERE ap."propertyId" = :propertyId
      AND up."personId" IN (${personIds.map(id => `'${id}'`)})
      AND ap."lastAccessed" IS NOT NULL
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows.map(({ personId }) => personId);
};
