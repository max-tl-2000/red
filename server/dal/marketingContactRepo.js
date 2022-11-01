/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { initQuery } from '../database/factory';

export const marketingSessionResolution = {
  NO_EXISTING_SESSION_NO_PROGRAM_MATCHED: 'no existing session, no program matched, no session created',
  NO_EXISTING_SESSION_NEW_PROGRAM_MATCHED: 'no existing session, new program matched, new session created',
  EXISTING_SESSION_NO_PROGRAM_MATCHED: 'existing session, no program matched, kept previous session',
  EXISTING_SESSION_SAME_PROGRAM_MATCHED: 'existing session, same program matched, kept previous session',
  EXISTING_SESSION_UPDATED_PROGRAM_MATCHED: 'existing session, updated program matched, new session created',
  EXISTING_SESSION_NEW_PROGRAM_MATCHED: 'existing session, new program matched, new session created',
  EXISTING_SESSION_DEFAULT_PROGRAM_MATCHED: 'existing session, default program matched, kept previous session',
  EXISTING_SESSION_ASSOCIATED_PROPERTIES_CHANGED: 'existing session, properties updated, new session created',
};

export const saveMarketingContactHistory = async (ctx, data) =>
  await initQuery(ctx)
    .insert({ id: newId(), ...data })
    .into('MarketingContactHistory')
    .returning('*');

export const loadMarketingContactHistory = async ctx => await initQuery(ctx).from('MarketingContactHistory').select('*');

export const getLastMarketingContactHistoryEntry = async (ctx, marketingSessionId) =>
  await initQuery(ctx).from('MarketingContactHistory').where({ marketingSessionId }).orderBy('created_at', 'desc').first();

export const saveMarketingContactData = async (ctx, data) =>
  await initQuery(ctx)
    .insert({ id: newId(), ...data })
    .into('MarketingContactData')
    .returning('*');

export const loadMarketingContactData = async ctx => await initQuery(ctx).from('MarketingContactData').select('*');

export const loadMarketingContactDataBySessionId = async (ctx, marketingSessionId) =>
  await initQuery(ctx).from('MarketingContactData').where({ marketingSessionId }).first();
