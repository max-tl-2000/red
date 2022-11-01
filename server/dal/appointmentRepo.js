/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import intersection from 'lodash/intersection';
import { knex, initQuery, rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import loggerModule from '../../common/helpers/logger';
import { loadPartyMembersBy, getActivePartyMembers } from './partyRepo';
import { isValidTimezone } from '../../common/helpers/moment-utils';
import { DATE_ONLY_FORMAT } from '../../common/date-constants';
import { prepareRawQuery } from '../common/schemaConstants';

const logger = loggerModule.child({ subType: 'appointmentRepo' });

// eslint-disable-next-line
export const getPartyAppointmentsQuery = (ctx, partyId) =>
  knex.raw(
    prepareRawQuery(
      `SELECT
       t.*,
       u.id as "userId",
       u."preferredName",
       u."fullName",
       u.metadata ->> 'businessTitle' as "businessTitle",
       p."leasingOfficeAddress",
       a."addressLine1",
       a."addressLine2",
       a."city",
       a."state",
       a."postalCode",
       p.settings -> 'appointment' ->> 'editUrl' as "editUrl",
       te."timeZone" as timezone
     FROM db_namespace."Tasks" as t
       INNER JOIN db_namespace."Property" as p ON t.category = :appointmentCategory AND p.id::TEXT = (t.metadata ->> 'selectedPropertyId')::TEXT
       INNER JOIN db_namespace."Address" as a ON a.id = p."addressId"
       INNER JOIN db_namespace."Users" u ON t."userIds"::TEXT[] = string_to_array(u.id::TEXT, ',')
       INNER JOIN db_namespace."Teams" te ON te.id::TEXT = t.metadata ->> 'teamId'
     WHERE t."partyId" = :partyId AND t.state <> :canceledState
      AND te."endDate" IS NULL`,
      ctx.tenantId,
    ),
    {
      partyId,
      appointmentCategory: DALTypes.TaskCategories.APPOINTMENT,
      canceledState: DALTypes.TaskStates.CANCELED,
    },
  );

// eslint-disable-next-line
export const getAppointmentByIdQuery = (ctx, appointmentId) =>
  knex.raw(
    prepareRawQuery(
      `SELECT
       t.*,
       u.id as "userId",
       u."preferredName",
       u."fullName",
       u.metadata ->> 'businessTitle' as "businessTitle",
       p.settings -> 'appointment' ->> 'editUrl' as "editUrl",
       p."timezone" as "propertyTimeZone",
       te."timeZone" as timezone,
       JSON_BUILD_OBJECT(
        'displayName', p."displayName" ,
        'leasingOfficeAddress', p."leasingOfficeAddress",
        'address',
        JSON_BUILD_OBJECT('addressLine1', a."addressLine1",
        'addressLine2', a."addressLine2",
        'city', a."city",
        'state', a."state",
        'postalCode', a."postalCode")
        ) as property
     FROM db_namespace."Tasks" as t
       INNER JOIN db_namespace."Property" as p ON t.category = :appointmentCategory AND p.id::TEXT = (t.metadata ->> 'selectedPropertyId')::TEXT
       INNER JOIN db_namespace."Address" as a ON a.id = p."addressId"
       INNER JOIN db_namespace."Users" u ON t."userIds"::TEXT[] = string_to_array(u.id::TEXT, ',')
       INNER JOIN db_namespace."Teams" te ON te.id::TEXT = t.metadata ->> 'teamId'
     WHERE t.id = :appointmentId
      AND te."endDate" IS NULL
     LIMIT 1`,
      ctx.tenantId,
    ),
    {
      appointmentId,
      appointmentCategory: DALTypes.TaskCategories.APPOINTMENT,
    },
  );

export const getAppointmentById = async (ctx, appointmentId) => {
  const query = `SELECT
   t.*,
   u.id as "userId",
   u."preferredName",
   u."fullName",
   u.metadata ->> 'businessTitle' as "businessTitle",
   p."leasingOfficeAddress",
   p.settings -> 'appointment' ->> 'editUrl' as "editUrl",
   p."timezone" as "propertyTimeZone",
   te."timeZone" as timezone
 FROM db_namespace."Tasks" as t
   INNER JOIN db_namespace."Property" as p ON t.category = :appointmentCategory AND p.id::TEXT = (t.metadata ->> 'selectedPropertyId')::TEXT
   INNER JOIN db_namespace."Users" u ON t."userIds"::TEXT[] = string_to_array(u.id::TEXT, ',')
   INNER JOIN db_namespace."Teams" te ON te.id::TEXT = t.metadata ->> 'teamId'
 WHERE t.id = :appointmentId
  AND te."endDate" IS NULL
 LIMIT 1`;

  const { rows } = await rawStatement(ctx, query, [
    {
      appointmentId,
      appointmentCategory: DALTypes.TaskCategories.APPOINTMENT,
    },
  ]);
  return rows[0];
};

export const loadAppointmentsForParties = async (ctx, partyIds) =>
  await initQuery(ctx)
    .from('Tasks')
    .whereIn('Tasks.partyId', partyIds)
    .andWhere('Tasks.category', DALTypes.TaskCategories.APPOINTMENT)
    .andWhereNot('Tasks.state', DALTypes.TaskStates.CANCELED);

export const loadFutureAppointmentsForPartyAndUser = async (ctx, partyId, userId) => {
  const query = `SELECT *
                FROM db_namespace."Tasks"
                WHERE "partyId" = :partyId
                AND "userIds" @> :userId
                AND "category" = :appt_category
                AND "state" != :completed
                AND "state" != :canceled
                AND (metadata->>'startDate')::timestamptz > now()`;

  const { rows } = await rawStatement(ctx, query, [
    {
      partyId,
      userId: [userId],
      appt_category: DALTypes.TaskCategories.APPOINTMENT,
      completed: DALTypes.TaskStates.COMPLETED,
      canceled: DALTypes.TaskStates.CANCELED,
    },
  ]);
  return rows;
};

export const getFirstCompletedTourDate = async (ctx, personId) =>
  await initQuery(ctx)
    .from('Tasks')
    .where('Tasks.category', DALTypes.TaskCategories.APPOINTMENT)
    .andWhere('Tasks.state', DALTypes.TaskStates.COMPLETED)
    .andWhereRaw('"Tasks"."metadata" -> \'partyMembers\' @> ?', [JSON.stringify(personId)])
    .orderBy('dueDate')
    .first('dueDate');

export const getFirstCompletedPartyTour = async (ctx, partyId) =>
  await initQuery(ctx)
    .from('Tasks')
    .where('Tasks.category', DALTypes.TaskCategories.APPOINTMENT)
    .andWhere('Tasks.state', DALTypes.TaskStates.COMPLETED)
    .andWhere('Tasks.partyId', partyId)
    .orderBy('created_at')
    .first();

const getAppointmentPartyMembers = (partyMemberIds, allPartyMembers) =>
  partyMemberIds.map(id => {
    const member = allPartyMembers.find(pm => pm.id === id);
    // how do we get into this situation?
    if (!member) {
      const msg = `Member with id: ${id} not found in the partyMembers set`;
      const err = new Error(msg);

      logger.error({ err, partyMemberIds, allPartyMembers }, msg);
      throw err;
    }

    return member.preferredName || member.fullName || member.contactInfo.defaultEmail || member.contactInfo.defaultPhone;
  });

const getAppointmentProperties = (inventoryIds, allInventories) =>
  inventoryIds
    .filter(id => id)
    .map(id => {
      const inventory = allInventories.find(i => i.id === id);
      return { inventoryId: inventory.id, name: inventory.name, unitFullQualifiedName: inventory.unitFullQualifiedName || '' };
    });

// days is an array of the following format: [{ year, month, day }]
// options can be an object in which case it will expect to have
// the timezone prop set to a valid timezone. If a string it will be interpreted as timezoneDifference
export const loadAppointmentsForUserAndDays = async (ctx, userIds, days, options) => {
  let timezoneQueryPart = '';

  const { timezone } = options || {};
  // if it is a valid timezone
  if (isValidTimezone(timezone)) {
    // check if this is enough to sanitize the query
    timezoneQueryPart = ` AT TIME ZONE 'UTC' AT TIME ZONE '${timezone}' `;
  }

  const appointments = await initQuery(ctx)
    .from('Tasks')
    .whereNot('Tasks.state', DALTypes.TaskStates.CANCELED)
    .andWhere('Tasks.category', DALTypes.TaskCategories.APPOINTMENT)
    .andWhereRaw('? && "Tasks"."userIds"::text[]', [userIds])
    .andWhereRaw(`DATE(("Tasks"."metadata" ->> 'startDate'):: TIMESTAMP ${timezoneQueryPart}) = ANY(?)`, [days]);

  const partyMembers = new Set(appointments.map(appointment => appointment.metadata.partyMembers).reduce((a, b) => (!b ? a : a.concat(b)), []));
  const inventories = new Set(appointments.map(appointment => appointment.metadata.inventories).reduce((a, b) => (!b ? a : a.concat(b)), []));
  const guests = partyMembers.size ? await loadPartyMembersBy(ctx, q => q.whereIn('PartyMember.id', [...partyMembers])) : [];
  const activePartyMembers = partyMembers.size ? await getActivePartyMembers(ctx, partyMembers) : [];

  const query = `SELECT inventory.id, inventory.name, f.c_fullqualifiedname AS "unitFullQualifiedName"
                  FROM db_namespace."Inventory" inventory
                INNER JOIN db_namespace.getinventoryfullqualifiedname(ARRAY[inventory.id::VARCHAR(36)]) f ON true
                  WHERE inventory.id IN (${[...inventories].map(id => `'${id}'`).join(',')})
                `;
  const { rows: units = [] } = inventories.size ? await rawStatement(ctx, query, []) : [];

  const result = appointments.map(appointment => ({
    ...appointment,
    guests: appointment.metadata.partyMembers
      ? getAppointmentPartyMembers(
          intersection(
            appointment.metadata.partyMembers,
            activePartyMembers.map(m => m.id),
          ),
          guests,
        )
      : [],
    units: appointment.metadata.inventories ? getAppointmentProperties(appointment.metadata.inventories, units) : [],
  }));
  return result;
};

export const loadDaysWithAppointments = async (ctx, { salesPersonIds, timezone, minDate }) => {
  const results = await initQuery(ctx)
    .from('Tasks')
    .distinct(knex.raw('DATE(("Tasks"."metadata" ->> \'startDate\')::TIMESTAMP AT TIME ZONE \'UTC\' at TIME ZONE ? )::TEXT as "date"', timezone))
    .whereNot('Tasks.state', DALTypes.TaskStates.CANCELED)
    .andWhere('Tasks.category', DALTypes.TaskCategories.APPOINTMENT)
    .whereRaw('? && "Tasks"."userIds"::text[]', [salesPersonIds])
    .whereRaw('DATE("Tasks"."metadata" ->> \'startDate\') >= ? ', minDate.utc().format(DATE_ONLY_FORMAT))
    .whereRaw('"Tasks"."metadata" IS NOT NULL AND ("Tasks"."metadata" ->> \'startDate\') IS NOT NULL')
    .orderBy('date', 'asc');

  return results.map(r => r.date);
};

export const getAllAppointmentsForPartyMember = async (ctx, partyMemberId) => {
  const query = `
    SELECT task.*
    FROM db_namespace."Tasks" task
    LEFT JOIN LATERAL (SELECT ARRAY(SELECT jsonb_array_elements_text( task."metadata"->'partyMembers'))) pm (val) ON TRUE
    WHERE task.state = :active
    AND task.name = :taskName
    AND ARRAY[:partyMemberId::text] <@ pm.val`;
  const { rows } = await rawStatement(ctx, query, [{ partyMemberId, active: DALTypes.TaskStates.ACTIVE, taskName: DALTypes.TaskNames.APPOINTMENT }]);
  return rows;
};
