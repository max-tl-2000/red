/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex } from '../../../server/database/factory';
import { commonSchema } from '../../../common/helpers/database';
import { DALTables } from '../../common/enums/dal-tables';
import { getPersonIdByTenantIdAndUserId } from '../../../auth/server/dal/common-user-repo';
import { buildSelectQuery } from '../helpers/profile-helper';

const COMMON_SCHEMA = commonSchema;

const applyFilter = async (filter, initialQuery, alias) => {
  if (!filter) initialQuery;

  return knex
    .queryBuilder()
    .select(`${alias}.*`)
    .from(knex.raw(`(${initialQuery}) AS ${alias}`))
    .whereRaw(filter);
};

const getContactedStatus = async (roommates, outerFilter, context) => {
  const usersId = roommates.map(r => `'${r.id}'`).join(',');
  const usersIdFilter = usersId ? `"${COMMON_SCHEMA}"."UserPerson"."userId" IN (${usersId}) AND` : '';

  const allColumnsQuery = knex
    .select(
      knex.raw(`
      "${COMMON_SCHEMA}"."UserPerson"."userId",
      case when "${context.tenantId}"."PersonRelationship"."id" is null THEN false ELSE true END as "contacted"`),
    )
    .from(knex.raw(`"${commonSchema}"."UserPerson"`))
    .leftJoin(
      knex.raw(`
      "${context.tenantId}"."PersonRelationship" ON (
      "${context.tenantId}"."PersonRelationship"."propertyId" = '${context.propertyId}' AND
      "${context.tenantId}"."PersonRelationship"."from" = '${context.personId}' AND
      "${context.tenantId}"."PersonRelationship"."to" = "${COMMON_SCHEMA}"."UserPerson"."personId")`),
    )
    .where(
      knex.raw(`
      "${COMMON_SCHEMA}"."UserPerson"."tenantId" = '${context.tenantId}' AND
      ${usersIdFilter}
      "${COMMON_SCHEMA}"."UserPerson"."userId" <> '${context.userId}'`),
    );

  const usersStatus = await applyFilter(outerFilter, allColumnsQuery, 'connections');

  return roommates.filter(roommate => {
    const userStatus = usersStatus.find(us => us.userId === roommate.id);
    if (!userStatus) return false;

    roommate.contacted = !!userStatus && !!userStatus.contacted;
    return roommate;
  });
};

export const getRoommates = async (whereRaw, filter, outerFilter, context) => {
  const fieldsToSelect = buildSelectQuery(DALTables.TableColumns.USERS, {
    displayBasicFields: context.displayBasicFields,
  });

  let query;
  const allColumnsQuery = knex
    .withSchema(COMMON_SCHEMA)
    .from(DALTables.Tables.USERS)
    .whereRaw(whereRaw)
    .orderBy(DALTables.TableColumns.USERS.UPDATED_AT, 'desc');

  allColumnsQuery.select(knex.raw(fieldsToSelect));

  query = await applyFilter(filter, allColumnsQuery, 'roommates');

  if (context.userId) {
    const personId = await getPersonIdByTenantIdAndUserId(context, context.tenantId, context.userId);
    query = await getContactedStatus(query, outerFilter, {
      ...context,
      personId,
    });
  }

  return query;
};
