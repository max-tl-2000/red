/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatten from 'lodash/flatten';
import partition from 'lodash/partition';
import newId from 'uuid/v4';
import config from '../config';
import { initQuery, knex, runInTransaction, rawStatement, buildInClause } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

const { telephony } = config;
// knex is used as queryBuilder
// eslint-disable-next-line
const getQueuedCallsBy = (ctx, filter) =>
  initQuery(ctx)
    .from('CallQueue')
    .where(filter)
    .select('*');

export const getQueuedCallsByTeamId = async (ctx, teamId) => await getQueuedCallsBy(ctx, { teamId });

export const getQueuedCallByCommId = async (ctx, commId) => await getQueuedCallsBy(ctx, { commId }).first();

export const getQueuedCalls = async ctx => await initQuery(ctx).from('CallQueue').select('*');

export const addCallToQueue = async (ctx, call) =>
  await initQuery(ctx)
    .insert({ id: newId(), ...call })
    .into('CallQueue')
    .returning('*');

const removeCalls = async (ctx, commIds) => {
  const command = `
    WITH "updatedStatistics" AS (
      UPDATE db_namespace."CallQueueStatistics"
      SET "exitTime" = now()
      WHERE ARRAY["communicationId"::varchar(36)] <@ :commIds
    )
    DELETE FROM db_namespace."CallQueue"
    WHERE ARRAY["commId"::varchar(36)] <@ :commIds
    RETURNING *
  `;

  const { rows } = await rawStatement(ctx, command, [{ commIds }]);
  return rows;
};

const removeCall = async (ctx, { commId, includeLockedForDequeue = true }) => {
  const query = `
    SELECT "commId" FROM db_namespace."CallQueue"
    WHERE "commId" = :commId
    AND (:includeLockedForDequeue OR "lockedForDequeue" IS FALSE)
  `;

  const { rows } = await rawStatement(ctx, query, [{ commId, includeLockedForDequeue }]);
  const commIdsToRemove = rows.map(r => r.commId);
  const [call] = await removeCalls(ctx, commIdsToRemove);
  return call;
};

export const removeCallFromQueue = async (ctx, commId) => await removeCall(ctx, { commId });

export const removeCallUnlessLockedForDequeue = async (ctx, commId) => await removeCall(ctx, { commId, includeLockedForDequeue: false });

export const dequeueCallsByTeamIds = async (ctx, teamIds) => {
  const query = `
    SELECT "commId" FROM db_namespace."CallQueue"
    WHERE ARRAY["teamId"::varchar(36)] <@ :teamIds
  `;

  const { rows } = await rawStatement(ctx, query, [{ teamIds }]);
  const commIdsToRemove = rows.map(r => r.commId);
  return await removeCalls(ctx, commIdsToRemove);
};

export const getTargetedTeamsSortedByCallTime = async ctx => {
  const { rows } = await rawStatement(
    ctx,
    `
    SELECT "teamId"
    FROM :schema:."CallQueue"
    GROUP BY "teamId"
    ORDER BY MIN(created_at);
    `,
    [{ schema: ctx.tenantId }],
  );

  return rows.map(r => r.teamId);
};

export const lockCallForDequeueForOneUser = async ({ ctx, teamIds, userId, otherAvailableUserIds = [] }) => {
  const lockCommand = `UPDATE :schema:."CallQueue" SET "lockedForDequeue" = true
   WHERE id = (
     SELECT queue.id
     FROM :schema:."CallQueue" queue
     INNER JOIN :schema:."Communication" comm ON comm.id = queue."commId"
     INNER JOIN :schema:."Party" party ON ARRAY[party.id::varchar(36)] <@ comm.parties
     WHERE queue."teamId" = ANY(:team_ids)
     AND queue."lockedForDequeue" = false
     AND NOT ARRAY[:user_id::varchar(36)] <@ queue."declinedByUserIds"
     AND (NOT ARRAY[party."userId"::varchar(36)] <@ :other_users OR ARRAY[party."userId"::varchar(36)] <@ queue."declinedByUserIds")
     ORDER BY (CASE WHEN party."userId" = :user_id
                    THEN queue.created_at - interval '${telephony.queuedOwnedCallersPriority} seconds'
                    ELSE queue.created_at
               END) ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1
   )
   RETURNING *`;

  const {
    rows: [call],
  } = await rawStatement(ctx, lockCommand, [
    {
      schema: ctx.tenantId,
      team_ids: teamIds,
      user_id: userId,
      other_users: otherAvailableUserIds,
    },
  ]);

  return call;
};

export const lockCallForDequeueForMultipleUsers = async ({ ctx, teamId, userIds }) => {
  const lockCommand = `UPDATE :schema:."CallQueue" SET "lockedForDequeue" = true
   WHERE id = (
     SELECT queue.id
     FROM :schema:."CallQueue" queue
     WHERE queue."teamId" = :team_id
     AND queue."lockedForDequeue" = false
     AND NOT queue."declinedByUserIds" @> :user_ids
     ORDER BY queue.created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1
   )
   RETURNING *`;

  const {
    rows: [call],
  } = await rawStatement(ctx, lockCommand, [
    {
      schema: ctx.tenantId,
      team_id: teamId,
      user_ids: userIds,
    },
  ]);

  const declinedByUserIds = new Set((call && call.declinedByUserIds) || []);

  const [usersThatDeclinedCall, usersThatCanBeCalled] = partition(userIds, id => declinedByUserIds.has(id));
  return { call, usersThatDeclinedCall, usersThatCanBeCalled };
};

export const getBookedUsers = async ctx => {
  const { rows } = await rawStatement(ctx, 'SELECT DISTINCT jsonb_object_keys("firedCallsToAgents") AS id FROM :schema:."CallQueue"', [
    { schema: ctx.tenantId },
  ]);
  return rows.map(r => r.id);
};

export const saveUserThatDeclinedCall = async (ctx, commId, userId) =>
  await initQuery(ctx)
    .from('CallQueue')
    .where({ commId })
    .update({ declinedByUserIds: knex.raw('array_append("declinedByUserIds", :param)', { param: userId }) });

export const unlockCallForDequeue = async (ctx, commId, declinedByUserId) => {
  const declinedByUserIds = declinedByUserId ? { declinedByUserIds: knex.raw('array_append("declinedByUserIds", :param)', { param: declinedByUserId }) } : {};

  const [updatedCall] = await initQuery(ctx)
    .from('CallQueue')
    .where({ commId })
    .update({
      lockedForDequeue: false,
      ...declinedByUserIds,
    })
    .returning('*');
  return updatedCall;
};

export const getCallQueueStatsByCommId = async (ctx, commId) => await initQuery(ctx).from('CallQueueStatistics').where({ communicationId: commId }).first();

export const addCallQueueStats = async (ctx, callQueueStats) =>
  await initQuery(ctx)
    .insert({ id: newId(), ...callQueueStats })
    .into('CallQueueStatistics')
    .returning('*');

export const updateCallQueueStatsByCommId = async (
  ctx,
  commId,
  {
    entryTime = null,
    exitTime = null,
    hangUp = null,
    userId = null,
    callBackTime = null,
    transferredToVoiceMail = null,
    callBackCommunicationId = null,
    callerRequestedAction = null,
    metadata = {},
  },
) => {
  const query = `
    UPDATE db_namespace."CallQueueStatistics"
    SET "entryTime" = COALESCE(:entryTime, "entryTime"),
        "exitTime" = COALESCE(:exitTime, "exitTime"),
        "hangUp" = COALESCE(:hangUp, "hangUp"),
        "userId" = COALESCE(:userId, "userId"),
        "callBackTime" = COALESCE(:callBackTime, "callBackTime"),
        "transferredToVoiceMail" = COALESCE(:transferredToVoiceMail, "transferredToVoiceMail"),
        "callBackCommunicationId" = COALESCE(:callBackCommunicationId, "callBackCommunicationId"),
        "callerRequestedAction" = COALESCE(:callerRequestedAction, "callerRequestedAction"),
        "metadata" = "metadata"::jsonb || :metadata
    WHERE "communicationId" = :commId`;

  const { rows } = await rawStatement(ctx, query, [
    { commId, entryTime, exitTime, hangUp, userId, callBackTime, transferredToVoiceMail, callBackCommunicationId, callerRequestedAction, metadata },
  ]);
  const [updatedStat] = rows;
  return updatedStat;
};

export const updateCallBackCommForParties = async (ctx, comm) => {
  const command = `UPDATE :tenantId:."CallQueueStatistics"
        SET "callBackTime" = :now,
            "userId" = :userId,
            "callBackCommunicationId" = :commId
     WHERE id IN
       (SELECT "CallQueueStatistics".id FROM :tenantId:."CallQueueStatistics"
        INNER JOIN :tenantId:."Communication" ON "CallQueueStatistics"."communicationId" = "Communication".id
        WHERE "Communication".parties @> :parties
        AND "CallQueueStatistics"."callerRequestedAction" = :callBack
        AND "CallQueueStatistics"."callBackTime" IS NULL)`;

  return await rawStatement(ctx, command, [
    {
      tenantId: ctx.tenantId,
      now: new Date(),
      parties: comm.parties,
      userId: comm.userId,
      commId: comm.id,
      callBack: DALTypes.CallerRequestedAction.CALL_BACK,
    },
  ]);
};

export const addFiredCallsForUsers = async (ctx, commId, callsToAgents) => {
  const update = `
    UPDATE :schema:."CallQueue"
    SET "firedCallsToAgents" = "firedCallsToAgents"::jsonb || :calls_to_agents
    WHERE "commId" = :comm_id
    RETURNING id
  `;

  const { rows } = await rawStatement(ctx, update, [{ schema: ctx.tenantId, comm_id: commId, calls_to_agents: callsToAgents }]);
  return rows.length > 0;
};

const takeFiredCalls = async (ctx, commId, remainingFiredCalls) =>
  await runInTransaction(async trx => {
    const takeCommand = `
      UPDATE :schema:."CallQueue" cqu
      SET "firedCallsToAgents" = ${remainingFiredCalls}
      FROM (
        SELECT id, "firedCallsToAgents"
        FROM :schema:."CallQueue"
        WHERE "commId" = :comm_id
        FOR UPDATE SKIP LOCKED
      ) cqs
      WHERE cqu.id = cqs.id
      RETURNING cqs."firedCallsToAgents"
    `;
    const command = knex.raw(takeCommand, { schema: ctx.tenantId, comm_id: commId });

    const {
      rows: [call],
    } = await command.transacting(trx);
    return call;
  }, ctx);

export const takeAllFiredCalls = async (ctx, commId) => {
  const call = await takeFiredCalls(ctx, commId, "'{}'");
  const firedCallsByAgent = (call && call.firedCallsToAgents) || {};
  return { takenFiredCalls: flatten(Object.values(firedCallsByAgent)) };
};

export const takeFiredCallsForUser = async (ctx, commId, userId) => {
  const call = await takeFiredCalls(ctx, commId, `cqu."firedCallsToAgents" - '${userId}'`);

  const { [userId]: firedCallsForUser, ...otherFiredCalls } = (call && call.firedCallsToAgents) || {};
  return { takenFiredCalls: firedCallsForUser, remainingFiredCalls: flatten(Object.values(otherFiredCalls || {})) };
};

export const getCallQueueCountByTeamIds = async (ctx, teamIds) => {
  const query = `
    SELECT COUNT(cq.id), tm.id "teamId"
    FROM db_namespace."Teams" tm
    LEFT JOIN db_namespace."CallQueue" cq on cq."teamId"  = tm.id
    WHERE tm.id IN (${buildInClause(teamIds)})
      AND (tm.metadata->'callQueue'->>'enabled')::boolean = true
      AND tm."endDate" IS NULL
    GROUP BY tm.id
  `;
  const { rows } = await rawStatement(ctx, query, [teamIds]);
  return rows;
};
