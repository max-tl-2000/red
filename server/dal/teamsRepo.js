/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, runInTransaction, insertOrUpdate, initQuery, rawStatement, updateJsonColumn } from '../database/factory';
import { getPropertiesIdsWhereNameIn } from './propertyRepo';
import { getTenantReservedPhoneNumbers, markPhoneNumberAsUsed } from './tenantsRepo';
import loggerModule from '../../common/helpers/logger';
import { getVoiceMessageByName } from './voiceMessageRepo';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { DALTypes } from '../../common/enums/DALTypes';
import { PhoneOwnerType } from '../../common/enums/enums';
import { prepareRawQuery } from '../common/schemaConstants';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { extractValuesFromCommaSeparatedString } from '../../common/helpers/strings';
import { toMoment } from '../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'teamsRepo' });

export const getTeamBy = async (ctx, filter) => await initQuery(ctx).from('Teams').where(filter).first();

export const getTeamById = async (ctx, id) => await getTeamBy(ctx, { id });

export const teamExists = async (ctx, id) => !!(await getTeamById(ctx, id));

const processTeamSettings = async ({ ctx, name, callCenterPhoneNumber }) => {
  const { callCenterPhoneNumber: existingCallCenterPhoneNumber = '', metadata: existingMetadata } = (await getTeamBy(ctx, { name })) || {};

  const isNewCallCenterPhoneNumber = callCenterPhoneNumber !== existingCallCenterPhoneNumber;

  const {
    callRoutingStrategy: existingCallRoutingStrategy,
    partyRoutingStrategy: defaultPartyRoutingStrategy = DALTypes.PartyRoutingStrategy.ROUND_ROBIN,
    callRecordingSetup = DALTypes.CallRecordingSetup.NO_RECORDING,
  } = existingMetadata || {};

  const partyRoutingStrategy = isNewCallCenterPhoneNumber ? DALTypes.PartyRoutingStrategy.DISPATCHER : defaultPartyRoutingStrategy;

  const getCallRountingStrategy = () => {
    if (isNewCallCenterPhoneNumber) return DALTypes.CallRoutingStrategy.CALL_CENTER;
    if (existingCallRoutingStrategy) return existingCallRoutingStrategy;
    return DALTypes.CallRoutingStrategy.OWNER;
  };

  return {
    callRoutingStrategy: getCallRountingStrategy(),
    partyRoutingStrategy,
    callRecordingSetup,
  };
};

const saveTeam = async ({ ctx, data, callCenterPhoneNumber, associatedTeamNames, dbTeam }) => {
  logger.info({ ctx, teamData: data, callCenterPhoneNumber, associatedTeamNames }, 'saveTeam');

  const isCallQueueEnabled = !!((data.metadata || {}).callQueue || {}).enabled;

  const { callRoutingStrategy, partyRoutingStrategy, callRecordingSetup } = await processTeamSettings({
    ctx,
    name: data.name.trim(),
    callCenterPhoneNumber,
    isCallQueueEnabled,
  });

  const { id: voiceMessageId } = (data.voiceMessage && (await getVoiceMessageByName(ctx, data.voiceMessage))) || {};
  const { comms = {}, ...rest } = data.metadata || {};
  const dbTeamEndDate = dbTeam?.endDate && toMoment(dbTeam.endDate).toISOString();
  const endDate = data.inactiveFlag ? dbTeamEndDate || new Date().toISOString() : null;

  const team = {
    name: data.name.trim(),
    displayName: data.displayName.trim(),
    module: data.module.trim(),
    description: data.description.trim(),
    callCenterPhoneNumber: callCenterPhoneNumber.trim(),
    timeZone: data.timeZone.trim(),
    endDate,
    metadata: JSON.stringify({
      callRoutingStrategy,
      partyRoutingStrategy,
      callRecordingSetup,
      associatedTeamNames,
      comms: {
        sendCalendarCommsFlag: true,
        nativeCommsEnabled: true,
        ...comms,
      },
      ...rest,
    }),
    officeHours: JSON.stringify(data.officeHours),
    externalCalendars: data.externalCalendars,
    voiceMessageId,
  };

  return await insertOrUpdate(ctx, 'Teams', team, {
    conflictColumns: ['name'],
  });
};

const saveTeamProperties = async (ctx, properties, teamId) => {
  const propertyNames = extractValuesFromCommaSeparatedString(properties);
  if (!propertyNames.length) return; // TODO: this check can be removed after the 'DefaultTeam' imported from JSON is removed
  const propertyIds = await getPropertiesIdsWhereNameIn(ctx, propertyNames);

  await execConcurrent(propertyIds, async prop => {
    const property = {
      propertyId: prop.id,
      teamId,
    };

    return await insertOrUpdate(ctx, 'TeamProperties', property, {
      trx: ctx.trx,
    });
  });
};

// saves a team having the following shape:
// {
//   name: '', // required
//   displayName: '', // required
//   module: '', // required
//   description: '',
//   properties: '', // required string of comma separated values
//   callCenterPhoneNumber: '',
//   timezone: '', // required
//   afterHoursVoiceMessage: '', // required
//   unavailableVoiceMessage: '', // required
// }
export const saveTeamData = async (ctx, data, dbTeam) => {
  logger.debug(data, 'saving team data');
  const { properties } = data;
  const callCenterPhoneNumber = data.callCenterPhoneNumber ? data.callCenterPhoneNumber.toString().trim() : '';
  const associatedTeamNames = data.associatedTeamNames ? data.associatedTeamNames : '';

  return runInTransaction(async innerTrx => {
    const innerCtx = { ...ctx, trx: innerTrx };
    const team = await saveTeam({
      ctx: innerCtx,
      data,
      callCenterPhoneNumber,
      associatedTeamNames,
      dbTeam,
    });
    await saveTeamProperties(innerCtx, properties, team.id);
    return team;
  }, ctx);
};

export const getTeamMemberByTeamAndUser = async (ctx, teamId, userId) => await initQuery(ctx).from('TeamMembers').where({ teamId, userId }).first();

export const saveTeamMember = async (ctx, member) => {
  const tenantReservedPhoneNumbers = await getTenantReservedPhoneNumbers(ctx);

  return runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const teamMember = await insertOrUpdate(innerCtx.tenantId, 'TeamMembers', member, { outerTrx: innerCtx.trx });

    if (member.directPhoneIdentifier) {
      await markPhoneNumberAsUsed(
        ctx,
        innerCtx.tenantId,
        tenantReservedPhoneNumbers,
        PhoneOwnerType.TEAM_MEMBER,
        teamMember.id,
        member.directPhoneIdentifier,
        innerCtx.trx,
      );
    }

    return teamMember.id;
  }, ctx);
};

export const getTeamsForUsers = async (ctx, userIds, { includeTeamsWhereUserIsInactive = false, excludeInactiveTeams = true } = {}) => {
  logger.trace({ ctx, userIds }, 'getTeamsForUsers');
  const excludeInactiveTeamsFilter = excludeInactiveTeams ? 'AND t."endDate" IS NULL' : '';
  const includeTeamsWhereUserIsInactiveFilter = includeTeamsWhereUserIsInactive ? '' : 'AND tm."inactive" IS FALSE';

  const query = `
    SELECT t.*, tm."mainRoles", tm."functionalRoles", tm."laaAccessLevels", tm."userId"
      FROM db_namespace."Teams" t
    INNER JOIN db_namespace."TeamMembers" tm ON tm."teamId" = t.id
    INNER JOIN db_namespace."Users" u ON u.id = tm."userId"
      WHERE ARRAY[tm."userId"] <@ :userIds::uuid[]
    ${includeTeamsWhereUserIsInactiveFilter}
    ${excludeInactiveTeamsFilter}
    `;

  const { rows = [] } = await rawStatement(ctx, query, [{ userIds }]);
  return rows;
};

export const getTeamsForUser = async (ctx, userId, includeTeamsWhereUserIsInactive = false) =>
  getTeamsForUsers(ctx, [userId], { includeTeamsWhereUserIsInactive, excludeInactiveTeams: false });

export const getTeamsByIds = async (ctx, ids) => await initQuery(ctx).from('Teams').whereIn('id', ids);

export const getTeamsByNames = async (ctx, names) => await initQuery(ctx).from('Teams').whereIn('name', names);

const getTeams = async (tenantId, excludeInactiveTeams = true) => {
  const excludeInactiveTeamsFilter = excludeInactiveTeams ? 'WHERE t."endDate" IS NULL' : '';
  const query = `
    SELECT *
  FROM db_namespace."Teams" t
  ${excludeInactiveTeamsFilter}`;

  const { rows } = await rawStatement({ tenantId }, query, []);
  return rows;
};

export const getTeamsFromTenant = async (tenantId, excludeInactive = true) => {
  const teams = await getTeams(tenantId, excludeInactive);

  const teamMembers = await knex
    .withSchema(tenantId)
    .from('Users')
    .innerJoin('TeamMembers', 'TeamMembers.userId', 'Users.id')
    .innerJoin('Teams', 'TeamMembers.teamId', 'Teams.id')
    .where('TeamMembers.inactive', false)
    .select(
      'Users.*',
      'TeamMembers.teamId',
      'TeamMembers.mainRoles',
      'TeamMembers.functionalRoles',
      'TeamMembers.directPhoneIdentifier',
      'TeamMembers.directEmailIdentifier',
    )
    .orderBy('Users.fullName', 'asc');

  return teams.map(team => ({
    ...team,
    teamMembers: teamMembers.filter(p => p.teamId === team.id).map(p => p),
  }));
};

export const getTeamMembers = async (tenantId, excludeInactiveTeams = true) => {
  const excludeInactiveTeamsFilter = excludeInactiveTeams ? 'WHERE t."endDate" IS NULL' : '';
  const query = `
  SELECT
  tm.*, t."displayName" as "teamName", t.module
  FROM db_namespace."TeamMembers" tm
  INNER JOIN db_namespace."Teams" t ON tm."teamId" = t.id
  ${excludeInactiveTeamsFilter}`;

  const { rows = [] } = await rawStatement({ tenantId }, query, []);
  return rows;
};

export const getTeamProperties = async ctx => {
  const query = `
    SELECT t.id, array_agg(tp."propertyId") AS "propertyIds"
      FROM db_namespace."Teams" AS t
      INNER JOIN db_namespace."TeamProperties" AS tp ON tp."teamId" = t.id
      GROUP BY t.id`;

  const results = await rawStatement(ctx, query);

  return (results && results.rows) || [];
};

export const getAllTeamPropertyCombinations = async ctx =>
  await initQuery(ctx)
    .select('Teams.id as teamId', 'Teams.name as teamName', 'Property.id as propertyId', 'Property.name as propertyName')
    .from('Teams')
    .crossJoin('Property');

// eslint-disable-next-line
export const getPrimaryPropertyTeamQuery = (ctx, propertyId, teamId) => {
  const knexQuery = knex.raw(
    prepareRawQuery(
      `WITH
        out_program AS (
          SELECT p.*, FALSE AS "default" FROM db_namespace."Programs" p
            JOIN db_namespace."TeamPropertyProgram" tpg ON p.id = tpg."programId"
            WHERE tpg."propertyId" = :propertyId
            AND tpg."teamId" = :teamId
            AND tpg."commDirection" = :commDirection),
        default_out_program AS (
          SELECT prog.*, TRUE AS "default" FROM db_namespace."Property" pr
            JOIN db_namespace."Programs" prog ON prog.id::text = (pr.SETTINGS -> 'comms' ->> 'defaultOutgoingProgram')
            WHERE pr.id = :propertyId),
        program AS (
          SELECT * FROM out_program
          UNION
          SELECT * FROM default_out_program
          ORDER BY "default" ASC LIMIT 1)
        SELECT
          :teamId::uuid AS "teamId",
          prg.id AS "programId",
          prg."displayPhoneNumber",
          prg."displayEmail",
          prg.DEFAULT AS "isDefaultProgram" FROM program prg`,
      ctx.tenantId,
    ),
    { teamId, propertyId, commDirection: DALTypes.CommunicationDirection.OUT },
  );
  return ctx.trx ? knexQuery.transacting(ctx.trx) : knexQuery;
};

export const getTeamMembersBy = async (ctx, teamId, filter, sortColumn = 'fullName') => {
  const baseQuery = initQuery(ctx)
    .from('TeamMembers')
    .innerJoin('Teams', 'TeamMembers.teamId', 'Teams.id')
    .innerJoin('Users', 'TeamMembers.userId', 'Users.id')
    .innerJoin('UserStatus', 'Users.id', 'UserStatus.userId')
    .where({ teamId })
    .andWhere('TeamMembers.inactive', false)
    .orderBy(`Users.${sortColumn}`);
  return filter ? await filter(baseQuery) : await baseQuery;
};

export const getExtendedTeamMembers = async ctx => {
  const query = `
    SELECT u."externalUniqueId", tm.*, t.name as "teamName", t.module
    FROM db_namespace."TeamMembers" tm
    INNER JOIN db_namespace."Users" u ON u.id = tm."userId"
    INNER JOIN db_namespace."Teams" t ON t.id = tm."teamId"
    WHERE t."endDate" IS NULL
  `;

  const { rows = [] } = await rawStatement(ctx, query);

  return rows;
};

export const getAvailableOrBusyAgentIds = async (ctx, teamId, sortColumn = 'fullName', includeDispatcher = true) => {
  const query = `
    SELECT tm."userId"
    FROM db_namespace."TeamMembers" tm
    INNER JOIN db_namespace."Users" u ON u.id = tm."userId"
    INNER JOIN db_namespace."UserStatus" us ON us."userId" = u.id
    WHERE NOT tm.inactive
    AND tm."teamId" = :teamId
    AND tm."functionalRoles" @> :agentRoleDefinitions
    AND (:includeDispatcher OR NOT "functionalRoles" @> :dispatcherRoleDefinitions)
    AND (us."status" = :available OR us."status" = :busy)
    ORDER BY u."${sortColumn}"
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      teamId,
      includeDispatcher,
      agentRoleDefinitions: [FunctionalRoleDefinition.LWA.name],
      dispatcherRoleDefinitions: [FunctionalRoleDefinition.LD.name],
      available: DALTypes.UserStatus.AVAILABLE,
      busy: DALTypes.UserStatus.BUSY,
    },
  ]);
  return rows.map(r => r.userId);
};

export const getDispatcherId = async (ctx, teamId) => {
  const query = `
    SELECT "userId"
    FROM db_namespace."TeamMembers"
    WHERE NOT inactive
    AND "teamId" = :teamId
    AND "functionalRoles" @> :dispatcherRoleDefinitions
  `;

  const {
    rows: [row],
  } = await rawStatement(ctx, query, [
    {
      teamId,
      dispatcherRoleDefinitions: [FunctionalRoleDefinition.LD.name],
    },
  ]);

  if (!row) throw new Error(`Dispatcher entity not found for the teamId: ${teamId}`);

  return row.userId;
};

export const getAgentsForPhoneCalls = async ({ ctx, teamId, shouldBeAvailable = true, sortOrder = 'fullName' }) => {
  const availableQuery = shouldBeAvailable ? `"UserStatus"."status" = '${DALTypes.UserStatus.AVAILABLE}' and` : '';

  const query = q => q.where('functionalRoles', '@>', `{${FunctionalRoleDefinition.LWA.name}}`).whereRaw(`${availableQuery} "Users"."sipEndpoints" != '[]'`);
  return (await getTeamMembersBy(ctx, teamId, query, sortOrder)).map(p => p.userId);
};

export const lockAgentsForCallQueueSortedByLastCallTime = async ctx => {
  const teamAndMembersFilter = `
    AND tm."functionalRoles" @> '{${FunctionalRoleDefinition.LWA.name}}'
    AND tm."inactive" = false
    AND t."endDate" IS NULL
    AND t."metadata"->'callQueue'->'enabled' = 'true'`;

  const query = `
    WITH "lastCall" AS (
      SELECT "userId", max(jsonb_extract_path_text("message", 'rawMessage', 'EndTime')) AS "callEndTime"
      FROM :schema:."Communication" WHERE "type" = 'Call' AND created_at > current_date - interval '2' day
      GROUP BY "userId"
    ),
    "lwaUsers" AS (
      SELECT distinct u.id, u."fullName", us."status" as "status", coalesce(us."lockedForCallQueueRouting", false) as "lockedForCallQueueRouting"
      FROM :schema:."Users" u
        INNER JOIN :schema:."UserStatus" us ON us."userId" = u.id
        INNER JOIN :schema:."TeamMembers" tm ON tm."userId" = u."id"
        INNER JOIN :schema:."Teams" t ON tm."teamId" = t."id"
        ${teamAndMembersFilter}
    ),
    "teamsByUser" AS (
      SELECT tm."userId", array_agg(t.id) as teams
      FROM :schema:."TeamMembers" tm
        INNER JOIN :schema:."Teams" t ON tm."teamId" = t."id"
        ${teamAndMembersFilter}
      GROUP BY tm."userId"
    ),
    "updatedUsers" AS (
      UPDATE :schema:."UserStatus" AS upd SET "lockedForCallQueueRouting" = true
        FROM :schema:."Users" u
          LEFT JOIN "lastCall" lc ON u.id = lc."userId"
          INNER JOIN "teamsByUser" tbu ON tbu."userId" = u.id
          INNER JOIN :schema:."UserStatus" us ON us."userId" = u.id
        WHERE upd."userId" = u.id
          AND us."status" = '${DALTypes.UserStatus.AVAILABLE}'
          AND coalesce(us."lockedForCallQueueRouting", false)::boolean IS FALSE
          AND u."sipEndpoints" != '[]'
        RETURNING u.*, tbu.teams, lc."callEndTime", us."lockedForCallQueueRouting",
          u.metadata || jsonb_build_object(
            'status', us."status",
            'statusUpdatedAt', us."statusUpdatedAt",
            'notAvailableSetAt', us."notAvailableSetAt",
            'wrapUpCallTimeoutId', us."wrapUpCallTimeoutId",
            'loginTimeoutId', us."loginTimeoutId"
          ) AS "metadata"
      )
      SELECT
      	(SELECT array_to_json(array_agg("lwaUsers")) FROM "lwaUsers") "lwaUsers",
		    (SELECT array_to_json(coalesce(array_agg(users) filter (where users.id is not null), '{}')) FROM (select * from "updatedUsers" ORDER BY "callEndTime" IS NULL DESC, "callEndTime") as users) "targetedUsers"
  `;

  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId }]);
  return rows[0];
};

export const unlockAgentsForCallQueue = async (ctx, ids) => {
  if (!ids.length) return;
  const command = `
    UPDATE :schema:."UserStatus" AS upd SET "lockedForCallQueueRouting" = false
    WHERE ARRAY[upd."userId"::varchar(36)] <@ :ids
  `;
  await rawStatement(ctx, command, [{ schema: ctx.tenantId, ids }]);
};

export const getAvailableAgentsForPhoneCalls = async (ctx, teamId) => {
  const query = `
    SELECT u.*
    FROM :schema:."Users" u
      INNER JOIN :schema:."TeamMembers" tm ON tm."userId" = u."id"
      INNER JOIN :schema:."UserStatus" us ON us."userId" = u."id"
    WHERE us."status" != '${DALTypes.UserStatus.NOT_AVAILABLE}'
      AND u."sipEndpoints" != '[]'
      AND tm."functionalRoles" @> '{${FunctionalRoleDefinition.LWA.name}}'
      AND tm."inactive" = false
      AND tm."teamId" = :teamId
  `;
  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, teamId }]);
  return rows;
};

export const getTeamMemberById = async (ctx, id) => await initQuery(ctx).from('TeamMembers').where({ id }).first();

export const getTeamMemberEmailIdentifierByOutsideDedicatedEmail = async (ctx, outsideDedicatedEmail) => {
  const teamMember = await initQuery(ctx).from('TeamMembers').where('outsideDedicatedEmails', '@>', `{${outsideDedicatedEmail}}`).first();
  return teamMember && teamMember.directEmailIdentifier;
};

export const getTeamMemberEmailIdentifierByOutsideDedicatedEmails = async (ctx, outsideDedicatedEmails) => {
  const teamMembers = await initQuery(ctx).from('TeamMembers');
  const teamMember = teamMembers.find(tm => tm.outsideDedicatedEmails && tm.outsideDedicatedEmails.some(email => outsideDedicatedEmails.indexOf(email) >= 0));
  return teamMember && teamMember.directEmailIdentifier;
};

export const getTeamMemberByDirectEmailIdentifier = async (ctx, directEmailIdentifier) =>
  await initQuery(ctx).from('TeamMembers').where({ directEmailIdentifier: directEmailIdentifier.toLowerCase() }).first();

export const getTeamMemberByDirectPhoneIdentifier = async (ctx, directPhoneIdentifier) =>
  await initQuery(ctx).from('TeamMembers').where({ directPhoneIdentifier }).first();

export const getAgentsInTeam = async (ctx, teamId) =>
  await initQuery(ctx)
    .from('TeamMembers')
    .innerJoin('Teams', 'TeamMembers.teamId', 'Teams.id')
    .innerJoin('Users', 'TeamMembers.userId', 'Users.id')
    .where({ teamId })
    .andWhere('TeamMembers.inactive', false)
    .andWhere('functionalRoles', '@>', `{${FunctionalRoleDefinition.LWA.name}}`)
    .select('Users.*');

export const getTeamsWhereUserIsAgent = async (ctx, userId) =>
  await initQuery(ctx)
    .from('TeamMembers')
    .innerJoin('Teams', 'TeamMembers.teamId', 'Teams.id')
    .where('TeamMembers.userId', '=', userId)
    .andWhere('TeamMembers.inactive', false)
    .andWhere('functionalRoles', '@>', `{${FunctionalRoleDefinition.LWA.name}}`)
    .select('Teams.*');

export const updateTeam = async (ctx, id, team) => {
  const toDeltaWithJsonUpdates = delta => ({ ...delta, metadata: updateJsonColumn(ctx, 'metadata', delta.metadata) });

  const [updatedTeam] = await initQuery(ctx).from('Teams').where({ id }).update(toDeltaWithJsonUpdates(team)).returning('*');

  const teamMembers = await getTeamMembersBy(ctx, id);
  return { ...updatedTeam, teamMembers };
};

// This will change in a distant future when the roles will be loaded from DB
export const areAllRolesValid = names => names.every(role => MainRoleDefinition[role] || FunctionalRoleDefinition[role]);

export const getTeamEmailIdentifierByOutsideEmailAddress = async (ctx, address) => {
  const aliasName = await initQuery(ctx)
    .select('EmailAliases.name')
    .from('EmailAliases')
    .innerJoin('OutsideDedicatedEmails', 'OutsideDedicatedEmails.aliasTo', 'EmailAliases.name')
    .where('OutsideDedicatedEmails.name', address.toLowerCase())
    .first();
  return aliasName && aliasName.name;
};

export const getTeamEmailIdentifierByOutsideEmailAddresses = async (ctx, addressArray) => {
  const aliasName = await initQuery(ctx)
    .select('EmailAliases.name')
    .from('EmailAliases')
    .innerJoin('OutsideDedicatedEmails', 'OutsideDedicatedEmails.aliasTo', 'EmailAliases.name')
    .whereIn(
      'OutsideDedicatedEmails.name',
      addressArray.map(p => p.toLowerCase()),
    )
    .first();
  return aliasName && aliasName.name;
};

export const getPhoneAliases = async (ctx, filter) => {
  const baseQuery = initQuery(ctx).from('PhoneAliases');
  return filter ? await filter(baseQuery) : await baseQuery;
};

export const getPhoneAliasByImportValues = async (ctx, phoneAlias) =>
  await initQuery(ctx)
    .select('PhoneAliases.*')
    .from('PhoneAliases')
    .innerJoin('Teams', 'Teams.id', 'PhoneAliases.teamId')
    .innerJoin('Property', 'Property.id', 'PhoneAliases.propertyId')
    .innerJoin('Sources', 'Sources.name', 'PhoneAliases.source')
    .where('PhoneAliases.programId', phoneAlias.programID || '')
    .andWhere('Teams.name', phoneAlias.team || '')
    .andWhere('Property.name', phoneAlias.selectProperty || '')
    .andWhere('Sources.name', phoneAlias.selectSource || '')
    .first();

export const getTeamsUsingCalendarAccount = async (ctx, calendarAccount) => {
  const query = `SELECT * FROM db_namespace."Teams"
                 WHERE "externalCalendars"->>'calendarAccount' = :calendarAccount
                  AND "endDate" IS NULL`;
  const { rows } = await rawStatement(ctx, query, [{ calendarAccount }]);
  return rows;
};

export const getTeamMemberId = async (ctx, teamId, userId) => {
  const query = 'SELECT id FROM db_namespace."TeamMembers" WHERE "userId" = :userId AND "teamId" = :teamId';

  const { rows } = await rawStatement(ctx, query, [{ userId, teamId }]);

  const [{ id: teamMemberId } = {}] = rows;
  return teamMemberId;
};

export const getTeamMembersByUserId = async (ctx, userId) => {
  const query = 'SELECT * FROM db_namespace."TeamMembers" WHERE "userId" = :userId';

  const { rows } = await rawStatement(ctx, query, [{ userId }]);

  return rows;
};

export const getTeamMembersToExport = async ctx => {
  const { tenantId } = ctx;
  const result = await knex.raw(
    `select
      "TeamMembers".inactive,
      "TeamMembers"."directEmailIdentifier",
      "TeamMembers"."outsideDedicatedEmails",
      "TeamMembers"."directPhoneIdentifier",
      "TeamMembers"."mainRoles" || "TeamMembers"."functionalRoles" as roles,
      "Users"."externalUniqueId" as "userUniqueId",
      "Teams"."name" as team,
      "VoiceMessages"."name" as "voiceMessage"
    from :tenantId:."TeamMembers"
    inner join :tenantId:."Users" on "TeamMembers"."userId" = "Users".id
    inner join :tenantId:."Teams" on "TeamMembers"."teamId" = "Teams".id
    inner join :tenantId:."VoiceMessages" on "TeamMembers"."voiceMessageId" = "VoiceMessages".id`,
    {
      tenantId,
    },
  );

  return result.rows;
};

export const getTeamsToExport = async ctx => {
  const { tenantId } = ctx;
  const result = await knex.raw(
    `select
      "Teams"."name",
      "Teams"."displayName",
      "Teams"."module",
      "Teams"."description",
      "Teams"."timeZone",
      "Teams"."endDate",
      "Teams"."externalCalendars"->>'calendarAccount' as "calendarAccount",
      "Teams"."externalCalendars"->>'calendarName' as "calendarName",
      "Teams"."metadata"->>'associatedTeamNames' as "associatedTeamNames",
      "VoiceMessages".name as "voiceMessage",
      ARRAY(select "Property".name
        from :tenantId:."TeamProperties"
        inner join :tenantId:."Property" on "TeamProperties"."propertyId" = "Property".id
        where "Teams".id = "TeamProperties"."teamId") as properties
    from :tenantId:."Teams"
    inner join :tenantId:."VoiceMessages" on "VoiceMessages".id = "Teams"."voiceMessageId"`,
    {
      tenantId,
    },
  );

  return result.rows;
};

export const getTeamSettingsToExport = async ctx => {
  const { tenantId } = ctx;
  const result = await knex.raw(
    `select
      "Teams".name as Team,
      "Teams"."metadata"->'callQueue'->>'timeToVoiceMail' as "callQueue timeToVoiceMail",
      "Teams"."metadata"->'callQueue'->>'enabled' as "callQueue enabled",
      "Teams"."metadata"->'call'->>'wrapUpDelayAfterCallEnds' as "call wrapUpDelayAfterCallEnds",
      "Teams"."metadata"->'comms'->>'allowBlockContactFlag' as "comms allowBlockContactFlag",
      "Teams"."metadata"->'features'->>'disableNewLeasePartyCreation' as "features disableNewLeasePartyCreation"
    from :tenantId:."Teams"
    where ("Teams"."metadata"->'teamId') is not null`,
    {
      tenantId,
    },
  );

  return result.rows;
};

export const getTeamsByIdsWhereIn = async (ctx, teamIds) => await initQuery(ctx).select('name').from('Teams').whereIn('id', teamIds);

export const getTeamsOfficeHoursToExport = async (ctx, propertyIdsToExport) => {
  const simpleFieldsToSelect = ['name', 'officeHours'];

  return await initQuery(ctx)
    .select(simpleFieldsToSelect)
    .distinct('name')
    .from('Teams')
    .innerJoin('TeamProperties', 'Teams.id', 'TeamProperties.teamId')
    .whereIn('TeamProperties.propertyId', propertyIdsToExport);
};

export const getCalledTeamIdByPhone = async (ctx, phoneNumber) => {
  const query = `
    SELECT
    t.id
    FROM db_namespace."Teams" t
    JOIN db_namespace."TeamPropertyProgram" tpp ON tpp."teamId" = t.id
    JOIN db_namespace."Programs" cmp ON cmp.id = tpp."programId"
    WHERE tpp."commDirection" = 'in' AND cmp."directPhoneIdentifier" = :phoneNumber
    ;`;

  const { rows = [] } = await rawStatement(ctx, query, [{ phoneNumber }]);
  return rows[0] && rows[0].id;
};

export const getFirstTeamIdByModuleForProperty = async (ctx, propertyId, module) => {
  const query = `
      SELECT t."id" from db_namespace."Teams" t
      INNER JOIN db_namespace."TeamProperties" tp on t."id" = tp."teamId"
      WHERE tp."propertyId" = :propertyId
      AND t."module" = '${module}'
      AND t."endDate" IS NULL
      LIMIT 1
    ;`;

  const { rows = [] } = await rawStatement(ctx, query, [{ propertyId }]);

  return rows[0] && rows[0].id;
};

export const getAllDispatchers = async ctx => {
  const query = `
  SELECT "userId", "teamId", u."fullName"
  FROM db_namespace."TeamMembers" tm
  JOIN db_namespace."Users" u on tm."userId" = u.id
  WHERE NOT inactive
  AND "functionalRoles" @> :dispatcherRoleDefinitions
`;

  const { rows } = await rawStatement(ctx, query, [
    {
      dispatcherRoleDefinitions: [FunctionalRoleDefinition.LD.name],
    },
  ]);
  return rows || [];
};

export const getReassignableTeamMembersForInactiveTeams = async (ctx, propertyId, userId) => {
  const query = `
    SELECT t.module AS "teamModule", tm."teamId", tm."userId", tm."functionalRoles"
    FROM db_namespace."TeamProperties" tp
      INNER JOIN db_namespace."Teams" t ON t.id = tp."teamId"
      INNER JOIN db_namespace."TeamMembers" tm on tm."teamId" = t.id
    WHERE tp."propertyId" = :propertyId
    AND (tm."userId" = :userId OR tm."functionalRoles" @> :dispatcherRoleDefinitions)
    AND t."endDate" IS NULL
    AND tm.inactive IS FALSE
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      propertyId,
      userId,
      dispatcherRoleDefinitions: [FunctionalRoleDefinition.LD.name],
    },
  ]);
  return rows || [];
};

export const getNewInactiveTeams = async ctx => {
  const query = `
    SELECT t.*
    FROM db_namespace."Teams" t
      WHERE t."endDate"::date = NOW()::date
  `;

  const { rows } = await rawStatement(ctx, query, []);
  return rows || [];
};
