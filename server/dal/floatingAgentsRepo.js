/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../database/factory';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { DALTypes } from '../../common/enums/DALTypes';

export const getUsersAvailabilities = async (ctx, userIds, startDate, endDate) => {
  const query = `SELECT "day", "teamId", "userId" FROM db_namespace."FloatingMemberAvailability"
                JOIN  db_namespace."TeamMembers" ON "teamMemberId" = db_namespace."TeamMembers" ."id"
                WHERE  ARRAY["userId"::varchar(36)] <@ :userIds AND "day" >= :startDate AND "day" <= :endDate`;
  const { rows } = await rawStatement(ctx, query, [{ userIds, startDate, endDate }]);
  return rows;
};

export const saveAvailability = async (ctx, userAvailability) => {
  const query = `INSERT INTO db_namespace."FloatingMemberAvailability"
               ("id", "teamMemberId", "day", "modifiedBy") VALUES
               ("public".gen_random_uuid(), :teamMemberId, :day, :modifiedBy)`;

  const { teamMemberId, day, modifiedBy } = userAvailability;

  const { rows } = await rawStatement(ctx, query, [
    {
      teamMemberId,
      day,
      modifiedBy,
    },
  ]);
  return rows[0];
};

export const deleteUserAvailability = async (ctx, teamMemberIds, day) => {
  const query = `DELETE FROM db_namespace."FloatingMemberAvailability"
                WHERE ARRAY["teamMemberId"::varchar(36)] <@ :teamMemberIds
                AND "day" = :day`;
  const { rows } = await rawStatement(ctx, query, [{ teamMemberIds, day }]);

  return rows;
};

export const deleteAllTeamMemberAvailabilities = async (ctx, teamMemberIds) => {
  const query = `DELETE FROM db_namespace."FloatingMemberAvailability"
                WHERE ARRAY["teamMemberId"::varchar(36)] <@ :teamMemberIds`;
  const { rows } = await rawStatement(ctx, query, [{ teamMemberIds }]);

  return rows;
};

export const getActiveAgentsFromTeamForSlotDay = async (ctx, { teamId, slotStartTime, timezone, excludedModule = DALTypes.ModuleType.RESIDENT_SERVICES }) => {
  const query = `
    WITH "multiTeamAgents" AS (
      SELECT "userId" FROM db_namespace."Users" u
      INNER JOIN db_namespace."TeamMembers" tm ON u.id = tm."userId"
      INNER JOIN db_namespace."Teams" t on tm."teamId" = t.id
      WHERE "functionalRoles" @> '{${FunctionalRoleDefinition.LWA.name}}'
      AND "inactive" = false
      AND t.module <> :excludedModule
      AND t."endDate" is NULL
      GROUP BY "userId"
      HAVING count(*) > 1
    ),
    "availabilitiesForDay" AS (
      SELECT "teamMemberId" FROM db_namespace."FloatingMemberAvailability"
      WHERE date(:slotStartTime at TIME ZONE :timezone) = "day"
    )
    SELECT "userId" FROM db_namespace."TeamMembers" tm
    JOIN db_namespace."Teams" t on t.id = tm."teamId"
    WHERE "functionalRoles" @> '{${FunctionalRoleDefinition.LWA.name}}'
    AND "inactive" = false
    AND "teamId" = :teamId
    AND t."endDate" is NULL
    AND (t."module" = :excludedModule OR
    (
      "userId" NOT IN (SELECT "userId" FROM "multiTeamAgents")
      OR ("userId"  IN (SELECT "userId" FROM "multiTeamAgents")  AND  tm."id" IN (SELECT "teamMemberId" FROM "availabilitiesForDay")))
    )`;
  const { rows } = await rawStatement(ctx, query, [{ timezone, teamId, slotStartTime, excludedModule }]);
  return rows.map(row => row.userId);
};
