/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertInto, rawStatement } from '../database/factory';

export const getBlacklist = async ctx => await initQuery(ctx).returning('*').from('ContactInfo').where('ContactInfo.isSpam', true);

export const addToBlacklist = async (ctx, type, value) => {
  const loggedInUserId = ctx.authUser && ctx.authUser.id;

  const updatedItems = await initQuery(ctx)
    .returning('*')
    .from('ContactInfo')
    .where('ContactInfo.type', type)
    .andWhere('ContactInfo.value', value)
    .update({ isSpam: true, markedAsSpamBy: loggedInUserId });

  return updatedItems.map(item => item.personId);
};

export const removeFromBlacklist = async (ctx, type, value) => {
  const updatedItems = await initQuery(ctx)
    .returning('*')
    .from('ContactInfo')
    .where('ContactInfo.type', type)
    .andWhere('ContactInfo.value', value)
    .update({ isSpam: false, markedAsSpamBy: null });

  return updatedItems.map(item => item.personId);
};

export const getAllSpamCommunications = async ctx => await initQuery(ctx).returning('*').from('CommunicationSpam');

export const getSpamCommunicationsGroupedByFrom = async ctx =>
  await initQuery(ctx)
    .from('CommunicationSpam')
    .select('CommunicationSpam.from')
    .count('CommunicationSpam.id as messageCount')
    .max('CommunicationSpam.created_at as lastContact')
    .groupBy('CommunicationSpam.from');

export const isContactBlacklisted = async (ctx, type, value) => {
  const { rows } = await rawStatement(
    ctx,
    `
    SELECT id, "isSpam"
    FROM :schema:."ContactInfo"
    WHERE type = :type AND value = :value;`,
    [{ schema: ctx.tenantId, type, value: value.toLowerCase() }],
  );

  return rows.some(ci => ci.isSpam);
};

export const saveSpamCommunication = async (req, communication) => await insertInto(req.tenantId, 'CommunicationSpam', communication);
