/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertInto } from '../database/factory';

export const getInvite = async (ctx, query) => await initQuery(ctx).from('UsersInvites').where(query).first();

export const createInvite = async (ctx, invite) => await insertInto(ctx.tenantId, 'UsersInvites', invite);

export const getInviteByToken = async (ctx, token) => await initQuery(ctx).from('UsersInvites').where({ token }).first();

export const getAllValidInvites = async ctx => await initQuery(ctx).from('UsersInvites').where({ valid: true });

export const updateUserInvite = async (ctx, inviteToken, updateData) => {
  const [invite] = await initQuery(ctx).from('UsersInvites').where({ token: inviteToken }).update(updateData).returning('*');
  return invite;
};
