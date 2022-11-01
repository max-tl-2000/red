/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import flatten from 'lodash/flatten';
import { mapSeries } from 'bluebird';
import { knex, rawStatement, runInTransaction, initQuery, buildInClause, updateJsonColumn } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { prepareRawQuery } from '../common/schemaConstants';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'tasksRepo' });
import DBColumnLength from '../utils/dbConstants';

export const getFollowupPartyEligibleParties = async (ctx, partyIds = []) => {
  // no communication in previous 2 or 1 days
  // depending on a previous appointment completion
  // and party not in future resident state
  // and no active tasks exist for the party

  // The second "left join" clause is to ignore any task that has a completed state without a completed date
  // (when there is an issue with the followup tasks, we can mark them in db as completed and have time to process them manually, little by little
  // by changing their state to active)

  const filterByIds = partyIds.length ? ` AND party.id IN (${buildInClause(partyIds)}) ` : '';
  const results = await rawStatement(
    ctx,
    `
    SELECT DISTINCT party."id"
      FROM db_namespace."Party" party
      INNER JOIN db_namespace."Teams" team ON team.id = party.teams[1]::uuid
      LEFT join db_namespace."Tasks" tasks ON tasks."partyId" = party."id"
                                              AND tasks."state" = '${DALTypes.TaskStates.ACTIVE}'
      LEFT join db_namespace."Tasks" tasks2 on tasks2."partyId" = party."id"
                                              AND tasks."name" = '${DALTypes.TaskNames.FOLLOWUP_PARTY}'
                                              AND tasks."state" = '${DALTypes.TaskStates.COMPLETED}'
                                              AND tasks. "completionDate" IS null
      LEFT JOIN db_namespace."Tasks" tasks3 ON tasks3."partyId" = party."id"
                                              AND tasks3."name" = '${DALTypes.TaskNames.APPOINTMENT}'
                                              AND tasks3."state" = '${DALTypes.TaskStates.COMPLETED}'
      LEFT JOIN LATERAL
        ( SELECT 1 AS commEx
          FROM db_namespace."Communication" comm
          WHERE ARRAY[party."id"::varchar(36)] <@ comm.parties
          AND comm.created_at at TIME ZONE team."timeZone" >= (db_namespace.getstartoftoday(team."timeZone") - 1)
          AND comm.created_at >= now()- CASE WHEN tasks3."partyId" IS NOT NULL THEN INTERVAL '1 day' ELSE INTERVAL '2 day' END
        ) c ON TRUE
    WHERE party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}' ${filterByIds}
      AND party."state" in ('${DALTypes.PartyStateType.PROSPECT}', '${DALTypes.PartyStateType.CONTACT}','${DALTypes.PartyStateType.APPLICANT}',
                            '${DALTypes.PartyStateType.LEAD}','${DALTypes.PartyStateType.LEASE}')
      AND ((party.created_at at TIME ZONE team."timeZone") < db_namespace.getstartoftoday(team."timeZone"))
      AND c.commEx IS NULL
      AND tasks."partyId" is null
      AND tasks2."partyId" is null;
    `,
    [partyIds],
  );

  return (results && results.rows) || [];
};

export const getRenewalReminderEligibleParties = async ctx => {
  const query = `
    SELECT DISTINCT party.id FROM db_namespace."Party" AS party 
    INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON alwd."partyId" = party."seedPartyId"
    INNER JOIN db_namespace."Property" property ON property.id = party."assignedPropertyId"
    WHERE party."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
      AND party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND (alwd.state != '${DALTypes.ActiveLeaseState.MOVING_OUT}' OR alwd.state IS NULL)
      AND NOT EXISTS (SELECT 1 FROM db_namespace."Lease" lease WHERE lease."partyId" = party.id)
      AND NOT EXISTS (
        SELECT 1 FROM db_namespace."Tasks" task 
        WHERE TASK."partyId" = party.id  
        AND task.name = '${DALTypes.TaskNames.SEND_RENEWAL_QUOTE}'
        AND (task.state = '${DALTypes.TaskStates.ACTIVE}' 
          OR (task.state = '${DALTypes.TaskStates.COMPLETED}' 
            AND timezone(property.timezone, task."completionDate"::timestamptz)::date >= timezone(property.timezone, (alwd."leaseData"->>'leaseEndDate')::timestamptz)::date - ((property."settings"->'residentservices'->>'moveoutNoticePeriod')::integer + 3 || ' days')::interval)))
      AND NOT EXISTS (
        SELECT 1 FROM db_namespace."Tasks" task 
        WHERE TASK."partyId" = party.id  
        AND task.name = '${DALTypes.TaskNames.SEND_RENEWAL_REMINDER}'
        AND task.state = '${DALTypes.TaskStates.ACTIVE}')
      AND (
        timezone(property.timezone, (alwd."leaseData"->>'leaseEndDate')::timestamptz)::date =
        timezone(property.timezone, now())::date + ((property."settings"->'residentservices'->>'moveoutNoticePeriod')::integer + 3 || ' days')::interval
        OR
	      timezone(property.timezone, (alwd."leaseData"->>'leaseEndDate')::timestamptz)::date =
	      timezone(property.timezone, now())::date + INTERVAL '50 days'
	      OR
	      timezone(property.timezone, (alwd."leaseData"->>'leaseEndDate')::timestamptz)::date =
	      timezone(property.timezone, now())::date + INTERVAL '35 days'
	      OR
	      timezone(property.timezone, (alwd."leaseData"->>'leaseEndDate')::timestamptz)::date =
	      timezone(property.timezone, now())::date + INTERVAL '20 days'
	      OR
	      timezone(property.timezone, (alwd."leaseData"->>'leaseEndDate')::timestamptz)::date =
        timezone(property.timezone, now())::date + INTERVAL '5 days'
      )
  `;
  const results = await rawStatement(ctx, query);

  return (results && results.rows) || [];
};

const getTasksBy = async (ctx, filter) => {
  const query = initQuery(ctx).from('Tasks');
  return await (filter ? filter(query) : query);
};

export const getTasks = ctx => getTasksBy(ctx);
export const getTaskById = (ctx, id) => getTasksBy(ctx, q => q.where({ id }).first());
export const getTasksByIds = (ctx, ids) => getTasksBy(ctx, q => q.whereIn('id', ids));
export const getTasksByPartyIds = (ctx, ids) => getTasksBy(ctx, q => q.whereIn('partyId', ids));
export const getTasksByName = (ctx, name) => getTasksBy(ctx, q => q.where({ name }));

export const getTasksForPartiesByName = (ctx, partyIds, name) => getTasksBy(ctx, q => q.whereIn('partyId', partyIds).andWhere('name', name));

export const getTasksForPartiesByCategory = (ctx, partyIds, name) => getTasksBy(ctx, q => q.whereIn('partyId', partyIds).andWhere('category', name));

export const getActiveTasksForPartyByCategory = async (ctx, partyId, name) =>
  await getTasksBy(ctx, q => q.where('partyId', partyId).andWhere('category', name).andWhere('state', DALTypes.TaskStates.ACTIVE));

export const getCompletedTasksForPartyByCategory = async (ctx, partyId, name) => {
  const query = `SELECT *
                FROM db_namespace."Tasks" task
                WHERE task."partyId" = :partyId
                AND task."category" = :name AND task."state" = '${DALTypes.TaskStates.COMPLETED}'`;
  const { rows } = await rawStatement(ctx, query, [{ partyId, name }]);
  return rows;
};

export const getTasksForPartyByCategories = async (ctx, partyId, categories) =>
  await getTasksBy(ctx, q => q.where('partyId', partyId).whereIn('category', categories));

export const getActiveTasksForUserByCategory = async (ctx, userId, category) =>
  await getTasksBy(ctx, q =>
    q
      .where('state', DALTypes.TaskStates.ACTIVE)
      .andWhere('category', category)
      .andWhereRaw('? && "Tasks"."userIds"::text[]', [[userId]]),
  );

export const getAppointmentsWithAdditionalDetailsForUser = async (ctx, userId) => {
  const query = `
  SELECT task.*, inventories."name" as "inventoryName", property."name" as "propertyName", building."name" as "buildingName", ARRAY_AGG (person."fullName") "guestNames"
  FROM db_namespace."Tasks" task
    LEFT JOIN LATERAL (SELECT ARRAY(SELECT jsonb_array_elements_text( task."metadata"->'partyMembers'))) pm (val) ON TRUE
    INNER JOIN db_namespace."PartyMember" partyMember ON ARRAY[partyMember.id::text] <@ pm.val
    INNER JOIN db_namespace."Person" person on partymember."personId" = person."id"
    LEFT JOIN LATERAL (SELECT ARRAY(SELECT jsonb_array_elements_text( task."metadata"->'inventories'))) inv (val) ON TRUE
    LEFT JOIN db_namespace."Inventory" inventories ON ARRAY[inventories.id::text] <@ inv.val
    LEFT JOIN db_namespace."Building" building ON inventories."buildingId" = building."id"
    LEFT JOIN db_namespace."Property" property ON inventories."propertyId" = property."id"
  WHERE task."state" = '${DALTypes.TaskStates.ACTIVE}'
    AND task."name" = '${DALTypes.TaskNames.APPOINTMENT}'
    AND ARRAY[:userId::text] && task."userIds"::text[]
  GROUP BY
    task.id,
    inventories."name",
    building."name",
    property."name"`;
  const { rows } = await rawStatement(ctx, query, [{ userId }]);
  return rows;
};

export const getTasksForUserByCategory = async (ctx, userId, category) =>
  await getTasksBy(ctx, q =>
    q
      .whereNot('state', DALTypes.TaskStates.CANCELED)
      .andWhere('category', category)
      .andWhereRaw('? && "Tasks"."userIds"::text[]', [[userId]]),
  );

export const getActiveTasksForTeamMember = async (ctx, userId, teamId, partyId) => {
  const query = `SELECT task.* FROM db_namespace."Tasks" task
                 INNER JOIN db_namespace."Party" party
                 ON task."partyId" = party."id"
                 WHERE (task."metadata"->>'teamId'=:teamId
                 OR party."ownerTeam"=:teamId)
                 AND task."state" =:active
                 AND ARRAY[:userId::text] && task."userIds"::text[]`;
  const filteredQuery = partyId ? `${query} AND task."partyId" = :partyId` : query;
  const { rows } = await rawStatement(ctx, filteredQuery, [{ userId, teamId, active: DALTypes.TaskStates.ACTIVE, partyId }]);
  return rows;
};

export const getTasksForPersonByName = (ctx, personId, name) =>
  getTasksBy(ctx, q => q.where('name', name).andWhereRaw(`"Tasks"."metadata"->'personId' @> '"${personId}"'`));

export const getTasksByField = (ctx, field) => getTasksBy(ctx, q => q.where(field));

export const getTasksForPartyMember = async (ctx, { partyId, personId, id: memberId }) =>
  initQuery(ctx).from('Tasks').where('Tasks.partyId', partyId).andWhereRaw(`("Tasks"."metadata"->>'personId' = '${personId}' or
                   "Tasks"."metadata"->'partyMembers' @> '"${memberId}"')`);

const trimToNameLength = name => (name || '').substring(0, DBColumnLength.Name);
const enhance = task => ({
  ...task,
  name: trimToNameLength(task.name),
  state: task.state || DALTypes.TaskStates.ACTIVE,
  id: task.id || newId(),
});

const taskAlreadyExists = async (ctx, task) => {
  const { rows } = await knex
    .raw(
      prepareRawQuery(
        `SELECT id FROM db_namespace."Tasks"
         WHERE "partyId"=:partyId
         AND name=:name AND state=:state
         AND metadata=:metadata`,
        ctx.tenantId,
      ),
      {
        ...task,
        metadata: JSON.stringify(task.metadata),
      },
    )
    .transacting(ctx.trx);
  return rows[0];
};

export const saveTask = async (ctx, task) => {
  const taskToSave = enhance(task);
  taskToSave.modified_by = (ctx.authUser && ctx.authUser.id) || task.modified_by;

  logger.trace({ ctx, taskToSave }, 'saveTask');

  if ((task.metadata || {}).unique) {
    const taskAlreadyCreated = await taskAlreadyExists(ctx, taskToSave);
    if (taskAlreadyCreated) {
      logger.warn({ ctx, taskToSave }, 'saveTask - skipping insert as task already created');
      return null;
    }
  }

  const [savedTask] = await initQuery(ctx).into('Tasks').insert(taskToSave).returning('*');
  return savedTask;
};

export const saveTasks = async (ctx, tasks) =>
  await mapSeries(tasks, async task => {
    const taskToSave = enhance(task);
    try {
      const [savedTask] = await initQuery(ctx)
        .into('Tasks')
        .insert({ ...taskToSave, modified_by: ctx.authUser && ctx.authUser.id })
        .returning('*');
      return savedTask;
    } catch (error) {
      logger.error({ error, tenantId: ctx.tenantId, taskToSave }, 'saveTask');
      return null;
    }
  });

const toDeltaWithMetadataUpdates = (ctx, delta) => (delta.metadata ? { ...delta, metadata: updateJsonColumn(ctx, 'metadata', delta.metadata) } : delta);

export const updateTasksBulk = async (ctx, ids, delta) =>
  await initQuery(ctx)
    .from('Tasks')
    .whereIn('id', ids)
    .update(toDeltaWithMetadataUpdates(ctx, { ...delta, modified_by: ctx.authUser && ctx.authUser.id }))
    .returning('*');

export const updateTask = async (ctx, id, delta) => {
  const [task] = await updateTasksBulk(ctx, [id], delta);
  return task;
};

export const updateTasks = async (ctx, tasksData) => {
  logger.trace({ tasksData, tenantId: ctx.tenantId }, 'updateTasks');

  return await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    return await mapSeries(tasksData, async ({ id, ...delta }) => await updateTask(innerCtx, id, delta));
  }, ctx);
};

export const getUsersWithAssignedTasksForParties = async (ctx, partyIds) => {
  logger.trace({ ctx, partyIds }, 'getUsersWithAssignedTasksForParties');

  const query = `SELECT distinct(unnest(task."userIds"))
                 FROM db_namespace."Tasks" task
                 WHERE task."partyId" IN (${buildInClause(partyIds)})`;
  const { rows } = await rawStatement(ctx, query, [partyIds]);
  return flatten(rows.map(row => row.unnest));
};
