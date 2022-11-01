/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, getAllWhere, rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

export const getAllStrongMatches = async ctx => await getAllWhere(ctx, 'PersonStrongMatches', {});

export const saveStrongMatches = async (ctx, strongMatches) => await initQuery(ctx).insert(strongMatches).into('PersonStrongMatches').returning('*');

export const updateStrongMatch = async (ctx, id, delta) => await initQuery(ctx).from('PersonStrongMatches').where({ id }).update(delta).returning('*');

export const deleteStrongMatches = async (ctx, contactInfoIds) =>
  await initQuery(ctx)
    .from('PersonStrongMatches')
    .where('status', DALTypes.StrongMatchStatus.NONE)
    .whereIn('firstPersonContactInfoId', contactInfoIds)
    .orWhereIn('secondPersonContactInfoId', contactInfoIds)
    .del();

export const dismissStrongMatch = async (ctx, firstPersonId, secondPersonId) =>
  await initQuery(ctx)
    .from('PersonStrongMatches')
    .where('status', DALTypes.StrongMatchStatus.NONE)
    .andWhereRaw(
      `("firstPersonId" = :firstPersonId AND "secondPersonId" = :secondPersonId) OR
                                    ("firstPersonId" = :secondPersonId AND "secondPersonId" = :firstPersonId)`,
      { firstPersonId, secondPersonId },
    )
    .update({
      status: DALTypes.StrongMatchStatus.DISMISSED,
      resolvedBy: ctx.authUser.userId,
    })
    .returning('*');

export const confirmStrongMatch = async (ctx, firstPersonId, secondPersonId) => {
  const query = `
  UPDATE :schema:."PersonStrongMatches" AS psm
  SET "status" = '${DALTypes.StrongMatchStatus.CONFIRMED}'
  FROM (
    SELECT * FROM :schema:."PersonStrongMatches"
    WHERE "firstPersonId" IN (:firstPersonId, :secondPersonId)
    AND "secondPersonId" IN (:firstPersonId, :secondPersonId)
  ) AS m
  WHERE psm."id" = m."id"
  RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, firstPersonId, secondPersonId }]);
  return rows;
};

export const deleteUnresolvedStrongMathcesByPersonIds = async (ctx, personIds) => {
  const query = `
  DELETE FROM :schema:."PersonStrongMatches"
  WHERE "status" = '${DALTypes.StrongMatchStatus.NONE}'
  AND ("firstPersonId" = ANY (:personIds) OR "secondPersonId" = ANY (:personIds))
  RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, personIds }]);
  return rows;
};
