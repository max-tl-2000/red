/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { rawStatement } from '../database/factory';
import { CalendarUserEventType } from '../../common/enums/calendarTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subtype: 'calendarEventsRepo' });

export const saveUserEvent = async (ctx, event) => {
  logger.trace({ ctx, userEvent: event }, 'saveUserEvent');
  const query = `INSERT INTO db_namespace."UserCalendarEvents"
                 ("id", "userId", "startDate", "endDate", "metadata", created_at, updated_at) VALUES
                 (:id, :userId, :startDate, :endDate, :metadata, now(), now())
                 RETURNING *`;

  const { userId, startDate, endDate, metadata } = event;
  const id = newUUID();

  const metadataFinal = metadata.type === CalendarUserEventType.SICK_LEAVE ? { ...event.metadata, id } : event.metadata;

  const { rows } = await rawStatement(ctx, query, [
    {
      id,
      userId,
      startDate,
      endDate,
      metadata: metadataFinal,
    },
  ]);

  return rows[0];
};

export const updateUserEvent = async (ctx, event) => {
  const query = `UPDATE db_namespace."UserCalendarEvents"
                 SET "userId" = :userId, "startDate" = :startDate, "endDate" = :endDate
                 WHERE "metadata" = (:metadata)::jsonb`;

  const { userId, startDate, endDate, metadata } = event;

  const { rows } = await rawStatement(ctx, query, [
    {
      userId,
      startDate,
      endDate,
      metadata,
    },
  ]);

  return rows[0];
};

export const saveTeamEvent = async (ctx, event) => {
  const query = `INSERT INTO db_namespace."TeamCalendarEvents"
                 ("id", "teamId", "startDate", "endDate", "externalId", created_at, updated_at) VALUES
                 ("public".gen_random_uuid(), :teamId, :startDate, :endDate, :externalId, now(), now())`;

  const { teamId, startDate, endDate, externalId } = event;

  const { rows } = await rawStatement(ctx, query, [
    {
      teamId,
      startDate,
      endDate,
      externalId,
    },
  ]);

  return rows[0];
};

export const getTeamEvents = async (ctx, teamId, startOfDay) => {
  const query = `SELECT * FROM db_namespace."TeamCalendarEvents"
                 WHERE "teamId" = :teamId and "endDate">= :startOfDay `;
  const { rows } = await rawStatement(ctx, query, [{ teamId, startOfDay }]);
  return rows;
};

export const getUserEvents = async (ctx, userId, startOfDay) => {
  const query = `SELECT * FROM db_namespace."UserCalendarEvents"
                 WHERE "userId" = :userId and "endDate">= :startOfDay
                 AND "isDeleted" is false`;
  const { rows } = await rawStatement(ctx, query, [{ userId, startOfDay }]);
  return rows;
};

export const getUsersEventsForDatesByUserIds = async (ctx, { userIds, startDate, noOfDays }) => {
  const query = `SELECT * FROM db_namespace."UserCalendarEvents"
                    WHERE ARRAY["userId"] <@ :userIds::uuid[]
                      AND ("startDate", "endDate") OVERLAPS (:startDate::timestamp, INTERVAL '${noOfDays} days')
                      AND "isDeleted" is false`;
  const { rows } = await rawStatement(ctx, query, [{ userIds, startDate }]);
  return rows;
};

export const getTeamEventsForDatesByTeamId = async (ctx, { teamId, startDate, noOfDays }) => {
  const query = `SELECT * FROM db_namespace."TeamCalendarEvents"
                    WHERE "teamId" = :teamId
                      AND ("startDate", "endDate") OVERLAPS (:startDate::timestamp, INTERVAL '${noOfDays} days')`;
  const { rows } = await rawStatement(ctx, query, [{ teamId, startDate }]);
  return rows;
};

export const removeUserExternalEventsByIds = async (ctx, userId, externalIds) => {
  const query = `DELETE FROM db_namespace."UserCalendarEvents"
                 WHERE "userId" = :userId
                    AND metadata->>'type' = '${CalendarUserEventType.PERSONAL}'
                    AND ARRAY[metadata->>'id'::varchar(50)] <@ :externalIds`;
  await rawStatement(ctx, query, [
    {
      userId,
      externalIds,
    },
  ]);
};

export const removeUserEvent = async (ctx, metadata) => {
  const query = `DELETE from db_namespace."UserCalendarEvents"
                 WHERE "metadata" = (:metadata)::jsonb`;
  await rawStatement(ctx, query, [{ metadata }]);
};

export const removeAllExternalUserEvents = async (ctx, userId) => {
  const query = ` DELETE FROM db_namespace."UserCalendarEvents"
                  WHERE "userId" = :userId and metadata->>'type' = '${CalendarUserEventType.PERSONAL}' `;
  await rawStatement(ctx, query, [{ userId }]);
};

export const removeTeamEventsByTeamId = async (ctx, teamId) => {
  const query = ` DELETE FROM db_namespace."TeamCalendarEvents"
                  WHERE "teamId" = :teamId`;
  await rawStatement(ctx, query, [{ teamId }]);
};

export const removeTeamEventsByExternalIds = async (ctx, externalIds) => {
  const query = `DELETE from db_namespace."TeamCalendarEvents"
                 WHERE ARRAY["externalId"::varchar(50)] <@ :externalIds`;

  await rawStatement(ctx, query, [
    {
      externalIds,
    },
  ]);
};

export const removeAllTeamEvents = async ctx => {
  const query = 'TRUNCATE TABLE db_namespace."TeamCalendarEvents" ';
  await rawStatement(ctx, query);
};

export const isSlotAvailableForTeam = async (ctx, teamId, startDate, endDate) => {
  const query = `
    SELECT COUNT(*) = 0 AS "isAvailable"
    FROM db_namespace."TeamCalendarEvents"
    WHERE "teamId" = :teamId
    AND (:startDate, :endDate) OVERLAPS ("startDate", "endDate")
  `;

  const { rows } = await rawStatement(ctx, query, [{ teamId, startDate, endDate }]);
  const [{ isAvailable }] = rows;
  return isAvailable;
};

const agentWihLeastBookedApptsQuery = ({ preferredCurrentOwnerId, preferredPartyOwnerId, preferredPartyCollaboratorIds } = {}) => `
    WITH "bookedAgents" AS (
      SELECT "userId"
      FROM db_namespace."UserCalendarEvents"
      WHERE (:startDate, :endDate) OVERLAPS ("startDate", "endDate")
      AND  "isDeleted" is false
    ),
    "availableAgents" AS (
      SELECT "userId" FROM db_namespace."TeamMembers"
      WHERE ARRAY["userId"::varchar(36)] <@ :activeAgentsForTeamForSlotDay
      AND "userId" NOT IN (SELECT "userId" FROM "bookedAgents")
    ),
    "agentsWithSameDateAppts" AS (
      SELECT "userId",
             COUNT(*) AS "apptsNo",
             array_agg(concat(
               'apptId: ', metadata->>'id', ', type: ', metadata->>'type', ', start: ', "startDate", ', end: ', "endDate"
             ))::text AS details
      FROM db_namespace."UserCalendarEvents"
      WHERE "userId" IN (SELECT "userId" FROM "availableAgents")
      AND metadata->>'type' != '${CalendarUserEventType.PERSONAL}'
      AND date("startDate" at TIME ZONE :timezone) = date(:startDate at TIME ZONE :timezone)
      GROUP BY "userId"
    ),
    "agentsWithNoEvents" AS (
      SELECT "userId" FROM "availableAgents"
      WHERE "userId" NOT IN (SELECT "userId" FROM "agentsWithSameDateAppts")
    ),
    "agentsApptsDetails" AS (
      ${
        preferredCurrentOwnerId
          ? `
          SELECT "userId", -3 AS "apptsNo", 'preferred agent' AS details, random() AS "randomSortSeed" FROM "availableAgents" where "userId" = :preferredCurrentOwnerId
          UNION`
          : ''
      }
      ${
        preferredPartyOwnerId
          ? `
          SELECT "userId", -2 AS "apptsNo", 'preferred agent' AS details, random() AS "randomSortSeed" FROM "availableAgents" where "userId" = :preferredPartyOwnerId
          UNION`
          : ''
      }
      ${
        preferredPartyCollaboratorIds
          ? `
          SELECT "userId", -1 AS "apptsNo", 'preferred agent' AS details, random() AS "randomSortSeed" FROM "availableAgents" where ARRAY["userId"] <@ :preferredPartyCollaboratorIds
          UNION`
          : ''
      }
      SELECT "userId", 0 AS "apptsNo", 'agent with no events' AS details, random() AS "randomSortSeed" FROM "agentsWithNoEvents"
      UNION
      SELECT "userId", "apptsNo", details, random() AS "randomSortSeed" FROM "agentsWithSameDateAppts"
      ORDER BY "apptsNo", "randomSortSeed"
    ),
    "agentWithLeastBookedAppts" AS (
      SELECT agent.*, details.*
      FROM
        (SELECT "userId" FROM "agentsApptsDetails" LIMIT 1) agent,
        (SELECT array_to_json(array_agg("agentsApptsDetails")) AS details FROM "agentsApptsDetails") details
    )
`;

export const getAgentWithLeastBookedAppts = async (ctx, { startDate, endDate, activeAgentsForTeamForSlotDay, timezone }) => {
  const query = `
    ${agentWihLeastBookedApptsQuery()}
    SELECT "userId", details FROM "agentWithLeastBookedAppts"
  `;
  const { rows } = await rawStatement(ctx, query, [{ startDate, endDate, activeAgentsForTeamForSlotDay, timezone }]);
  return rows;
};

export const createSelfBookEvent = async (
  ctx,
  { startDate, endDate, activeAgentsForTeamForSlotDay, preferredPartyOwnerId, preferredPartyCollaboratorIds, timezone },
) => {
  const command = `
    ${agentWihLeastBookedApptsQuery({ preferredPartyOwnerId, preferredPartyCollaboratorIds })}
    INSERT INTO db_namespace."UserCalendarEvents" (id, "userId", "startDate", "endDate", metadata)
      (SELECT public.gen_random_uuid(), "userId", :startDate, :endDate, '{ "type": "${CalendarUserEventType.SELF_BOOK}"}'
       FROM "agentWithLeastBookedAppts")
    RETURNING *, (SELECT details FROM "agentWithLeastBookedAppts")
  `;
  const { rows } = await rawStatement(ctx, command, [
    { startDate, endDate, activeAgentsForTeamForSlotDay, preferredPartyOwnerId, preferredPartyCollaboratorIds, timezone },
  ]);
  return rows;
};

export const updateAppointmentEvent = async (
  ctx,
  { appointmentId, startDate, endDate, activeAgentsForTeamForSlotDay, preferredCurrentOwnerId, preferredPartyOwnerId, preferredPartyCollaboratorIds, timezone },
) => {
  const command = `
    ${agentWihLeastBookedApptsQuery({ preferredCurrentOwnerId, preferredPartyOwnerId, preferredPartyCollaboratorIds })}
    UPDATE db_namespace."UserCalendarEvents" SET "userId" = at."userId", "startDate" = :startDate, "endDate" = :endDate
       FROM "agentWithLeastBookedAppts" as at
    WHERE "metadata"->>'id' = :appointmentId
    RETURNING "UserCalendarEvents".*, at.details
  `;
  const { rows } = await rawStatement(ctx, command, [
    {
      appointmentId,
      startDate,
      endDate,
      activeAgentsForTeamForSlotDay,
      preferredCurrentOwnerId,
      preferredPartyOwnerId,
      preferredPartyCollaboratorIds,
      timezone,
    },
  ]);
  return rows;
};

export const saveEventMetadataId = async (ctx, eventId, metadataId) => {
  const command = `
    UPDATE db_namespace."UserCalendarEvents"
    SET metadata = metadata || :metadataIdObj
    WHERE id = :eventId
    RETURNING *
    `;

  const {
    rows: [updatedEvent],
  } = await rawStatement(ctx, command, [{ metadataIdObj: { id: metadataId }, eventId }]);

  return updatedEvent;
};

export const getPersonalUserEventByExternalId = async (ctx, userId, externalId) => {
  const query = `SELECT * FROM db_namespace."UserCalendarEvents"
                 WHERE "userId" = :userId AND metadata->>'type' = '${CalendarUserEventType.PERSONAL}' AND metadata->>'id' = :externalId`;
  const { rows } = await rawStatement(ctx, query, [{ userId, externalId }]);
  return rows.length && rows[0];
};

export const getTeamEventByExternalId = async (ctx, externalId) => {
  const query = `SELECT * FROM db_namespace."TeamCalendarEvents"
                 WHERE "externalId" = :externalId`;
  const { rows } = await rawStatement(ctx, query, [{ externalId }]);
  return rows.length && rows[0];
};

export const removeTeamEventByExternalId = async (ctx, externalId) => {
  const query = `DELETE from db_namespace."TeamCalendarEvents"
                 WHERE "externalId" = :externalId`;
  await rawStatement(ctx, query, [{ externalId }]);
};

export const updateTeamEvent = async (ctx, event) => {
  const query = `UPDATE db_namespace."TeamCalendarEvents"
                 SET "startDate" = :startDate, "endDate" = :endDate
                 WHERE "externalId" = :externalId`;

  const { startDate, endDate, externalId } = event;

  const { rows } = await rawStatement(ctx, query, [
    {
      externalId,
      startDate,
      endDate,
    },
  ]);

  return rows[0];
};

export const getAllUserEvents = async (ctx, userId, includeDeleted = false) => {
  const query = `SELECT * FROM db_namespace."UserCalendarEvents"
                 WHERE "userId" = :userId
                 AND ( :includeDeleted OR "isDeleted" is false ) `;
  const { rows } = await rawStatement(ctx, query, [{ includeDeleted, userId }]);
  return rows;
};

export const getAllTeamEvents = async (ctx, teamId) => {
  const query = `SELECT * FROM db_namespace."TeamCalendarEvents"
                 WHERE "teamId" = :teamId`;
  const { rows } = await rawStatement(ctx, query, [{ teamId }]);
  return rows;
};

export const getMissingRevaEvents = async ctx => {
  const query = `
    SELECT t.id
    FROM db_namespace."Tasks" as t
    WHERE t.name = :taskName
      AND t.created_at::date >= current_date - interval '3 days'
      AND (t.state = :active OR t.state = :completed)
      AND NOT EXISTS (
        SELECT 1
        FROM db_namespace."UserCalendarEvents"
        WHERE created_at::date >= current_date - interval '3 days'
          AND t.id::text = metadata->>'id'
        LIMIT 1)`;

  const { rows } = await rawStatement(ctx, query, [
    {
      taskName: DALTypes.TaskNames.APPOINTMENT,
      active: DALTypes.TaskStates.ACTIVE,
      completed: DALTypes.TaskStates.COMPLETED,
    },
  ]);

  return rows.map(r => r.id);
};

export const getTimezoneForUser = async (ctx, userId) => {
  const query = `
    SELECT p.timezone
    FROM db_namespace."Property" p
      INNER JOIN db_namespace."TeamProperties" tp on p.id = tp."propertyId"
      INNER JOIN db_namespace."TeamMembers" tm on tm."teamId" = tp."teamId"
      INNER JOIN db_namespace."Users" u on u.id = tm."userId"
    WHERE u.id = :userId
    ORDER BY tm."updated_at" DESC
    LIMIT 1
  `;
  const { rows } = await rawStatement(ctx, query, [{ userId }]);
  return rows[0].timezone;
};

export const getTimezoneForTeam = async (ctx, teamId) => {
  const query = `
    SELECT p.timezone
    FROM db_namespace."Property" p
      INNER JOIN db_namespace."TeamProperties" tp on p.id = tp."propertyId"
    WHERE tp."teamId" = :teamId
    ORDER BY tp."updated_at" DESC
    LIMIT 1
  `;
  const { rows } = await rawStatement(ctx, query, [{ teamId }]);
  return rows[0].timezone;
};

export const getUserEventsByDateAndType = async (ctx, userId, startOfDay, type) => {
  logger.trace({ ctx, userId, startOfDay, type }, 'getUserEventsByDateAndType');
  const query = `SELECT * FROM db_namespace."UserCalendarEvents"
                 WHERE "userId" = :userId AND "endDate">= :startOfDay
                 AND metadata->>'type' = :type
                 AND "isDeleted" is false`;
  const { rows } = await rawStatement(ctx, query, [{ userId, startOfDay, type }]);
  return rows;
};

export const getUserEventById = async (ctx, eventId) => {
  logger.trace({ ctx, eventId }, 'getUserEvent');
  const query = `SELECT * FROM db_namespace."UserCalendarEvents"
                 WHERE id = :eventId `;
  const { rows } = await rawStatement(ctx, query, [{ eventId }]);
  return rows.length && rows[0];
};

export const markEventAsDeleted = async (ctx, eventId, metadata) => {
  logger.trace({ ctx, eventId, metadata }, 'markEventAsDeleted');
  const query = `UPDATE db_namespace."UserCalendarEvents"
                 SET "metadata" = :metadata, "isDeleted" = true
                 WHERE id = :eventId
                 RETURNING id`;

  const { rows } = await rawStatement(ctx, query, [
    {
      eventId,
      metadata,
    },
  ]);

  return rows[0];
};
