/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise, mapSeries } from 'bluebird';
import getUUID from 'uuid/v4';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';
import flattenDeep from 'lodash/flattenDeep';
import uniq from 'lodash/uniq';
import pick from 'lodash/pick';

import {
  knex,
  runInTransaction,
  insertInto,
  insertOrUpdate,
  updateOne,
  updateJSONBField,
  getOne,
  getAllWhere,
  getOneWhere,
  getAllWhereIn,
  initQuery,
  saveMetadata as savePartyMetadata,
  removeKeyFromJSONBField,
  rawStatement,
  saveJSONBData,
} from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { isAnonymousEmail } from '../../common/helpers/anonymous-email';
import {
  saveContactInfo,
  updateContactInfoForPerson,
  contactInfoAggregation,
  getContactInfoDiff,
  getContactsInfoByEmail,
  getContactsInfoByPhone,
} from './contactInfoRepo';
import { getExistingResidentsByPersonIds } from './personRepo';
import { getTeamsForUsers } from './teamsRepo';
import { getActiveProperties, getPropertiesAssociatedWithTeams, getPropertyTimezone } from './propertyRepo';
import loggerModule from '../../common/helpers/logger';
import { addPropertyToFilters, createMoveInFilter } from '../../common/helpers/filters';
import { prepareRawQuery } from '../common/schemaConstants';
import { isSuspiciousContent, removeSpaces } from './helpers/person';
import { hasOwnProp } from '../../common/helpers/objUtils';
import config from '../config';
import { getEmailIdentifierFromUuid } from '../../common/helpers/strings';

import { copyPersonApplication, existsPersonApplication, transformDALToApplicationsData } from '../../rentapp/server/services/shared/person-application';
import { LA_TIMEZONE } from '../../common/date-constants';
import { now, toMoment } from '../../common/helpers/moment-utils';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { createJsonCteFromQuery, formatColumnsToSelect } from '../helpers/repoHelper';
import { getRevaAdmin, isAdminOrDispatcherAgent } from './usersRepo';
import { revaAdminEmail } from '../../common/helpers/database';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { getExternalInfoByPartyMemberId } from './exportRepo';
import { partyWfStatesSubset } from '../../common/enums/partyTypes';
import { getObjectHash } from '../../common/server/hash-utils';
import { getCtxCache, setCtxCache } from '../../common/server/ctx-cache';
import { getPartySettings } from '../services/party-settings';

const logger = loggerModule.child({ subtype: 'partyRepo' });

const enhanceMemberContactInfo = partyMember => {
  const contactInfo = (partyMember.contactInfo || []).map(ci => {
    if (ci.type === DALTypes.ContactInfoType.EMAIL) {
      ci.isAnonymous = isAnonymousEmail(ci.value);
    }
    return ci;
  });
  return {
    ...partyMember,
    contactInfo: enhance(contactInfo),
  };
};

// return unique person's records (in a readded person scenario) associated to members at party level.
// for instance:
// - if the person was readded only the active member associated to the reaaded person should be returned.
// - if the person was just removed that record should be included in the results.
// eslint-disable-next-line
const getPartyMemberQuery = (ctx, orderBy = 'updated_at', sortOrder = 'desc') => {
  const activeMembers = initQuery(ctx)
    .from('PartyMember as pm')
    .whereNull('pm.endDate')
    .andWhereRaw('pm."partyId" = "PartyMember"."partyId"')
    .select('pm.personId');

  return initQuery(ctx)
    .select('PartyMember.*', 'Person.fullName', 'Person.preferredName', 'Company.displayName', 'Person.dob', contactInfoAggregation())
    .from('PartyMember')
    .innerJoin('Party', 'PartyMember.partyId', 'Party.id')
    .innerJoin('Person', 'PartyMember.personId', 'Person.id')
    .leftJoin('ContactInfo', 'Person.id', 'ContactInfo.personId')
    .leftJoin('Company', 'PartyMember.companyId', 'Company.id')
    .where(function uniquePerson() {
      this.whereNull('PartyMember.endDate').orWhere('PartyMember.personId', 'not in', activeMembers);
    })
    .groupBy('PartyMember.id', 'Person.id', 'Company.displayName')
    .orderBy(`PartyMember.${orderBy}`, sortOrder);
};

export const loadPartyMembersBy = async (ctx, filter, options = {}) => {
  const { excludeSpam = true, excludeInactive = true, orderBy, sortOrder } = options;
  let query = getPartyMemberQuery(ctx, orderBy, sortOrder);

  query = excludeSpam ? query.where({ 'PartyMember.isSpam': false }) : query;
  query = excludeInactive ? query.whereNull('PartyMember.endDate') : query;

  const result = filter ? await filter(query) : await query;
  if (!result) return result;

  return Array.isArray(result) ? result.map(enhanceMemberContactInfo) : enhanceMemberContactInfo(result);
};

export const getPartyMemberIdByPartyIdAndPersonId = async (ctx, { partyId, personId }) => {
  const query = `
  SELECT id FROM db_namespace."PartyMember"
    WHERE "partyId" = :partyId
      AND "personId" = :personId`;

  const { rows } = await rawStatement(ctx, query, [{ partyId, personId }]);
  return rows[0]?.id;
};

export const getPartyMemberWithNameById = async (ctx, partyMemberId) => {
  const { rows } = await rawStatement(
    ctx,
    `
    SELECT pm.*, person."fullName" FROM db_namespace."PartyMember" pm
      INNER JOIN db_namespace."Person" person ON pm."personId" = person.id
      WHERE pm.id = :partyMemberId;
    `,
    [{ partyMemberId }],
  );

  return rows[0];
};

export const loadInactivePartyMembers = async (ctx, filter) => {
  logger.trace({ ctx, filter }, 'loadInactivePartyMembers');
  const query = getPartyMemberQuery(ctx).whereNotNull('PartyMember.endDate');

  const result = filter ? await filter(query) : await query;
  if (!result) return result;

  const enhancePartyMemberContactInfo = m => ({
    ...m,
    contactInfo: enhance(m.contactInfo || []),
  });
  return Array.isArray(result) ? result.map(enhancePartyMemberContactInfo) : enhancePartyMemberContactInfo(result);
};

export const getActivePartyMembers = async (ctx, partyMembers) => {
  const partyMemberIds = [...partyMembers];
  const activePartyMembers = await rawStatement(
    ctx,
    `SELECT id FROM db_namespace."PartyMember"
      WHERE ARRAY["id"] <@ :partyMembersIds::uuid[]
      AND "endDate" is NULL
      `,
    [
      {
        partyMembersIds: partyMemberIds,
      },
    ],
  );
  return activePartyMembers.rows;
};

export const loadPartyMembersByContactInfo = (ctx, value) => loadPartyMembersBy(ctx, q => q.where('ContactInfo.value', value));

export const loadPartyMemberById = (ctx, partyMemberId, options) => loadPartyMembersBy(ctx, q => q.where('PartyMember.id', partyMemberId), options);

export const loadPartyMemberByIds = async (ctx, partyMemberIds, options) =>
  (partyMemberIds.length && (await loadPartyMembersBy(ctx, q => q.whereIn('PartyMember.id', partyMemberIds), options))) || [];

export const loadPartyMembers = (ctx, partyId, options) => loadPartyMembersBy(ctx, q => q.where({ 'PartyMember.partyId': partyId }), options);

export const getPartyOwner = async (ctx, partyId) => {
  const { userId } = await initQuery(ctx).select('userId').from('Party').where({ 'Party.id': partyId }).first();
  return userId;
};

export const getActivePartyMemberIdsByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getActivePartyMemberIdsByPartyId');

  const { rows } = await rawStatement(
    ctx,
    `SELECT pm.id FROM db_namespace."PartyMember" pm
      WHERE pm."partyId" = :partyId
      AND pm."endDate" IS NULL`,
    [{ partyId }],
  );
  return (rows && rows.map(r => r.id)) || [];
};

export const getPartyOwnersByPartyIds = async (ctx, partyIds) => {
  logger.trace({ ctx, partyIds }, 'getPartyOwnersByPartyIds');
  const userIds = await initQuery(ctx).from('Party').select('userId').whereIn('Party.id', partyIds);
  return userIds.map(p => p.userId);
};

const partyAgentQuery = ` 
    WITH
      party AS (SELECT * FROM db_namespace."Party" WHERE id = :partyId),
      out_program AS (
        SELECT p.id as "partyId", prg.*, FALSE AS default FROM party p
        JOIN db_namespace."TeamPropertyProgram" tpg ON tpg."teamId" = p."ownerTeam" AND tpg."propertyId" = p."assignedPropertyId"
        JOIN db_namespace."Programs" prg ON prg.id = tpg."programId"
        WHERE tpg."commDirection" = :communicationDirection),
      default_out_program AS (
        SELECT p.id as "partyId", prg.*, TRUE AS default FROM party p
        JOIN db_namespace."Property" pr ON pr.id = p."assignedPropertyId"
        JOIN db_namespace."Programs" prg ON prg.id::text = (pr.SETTINGS -> 'comms' ->> 'defaultOutgoingProgram')),
      program AS (
        SELECT * FROM out_program
        UNION
        SELECT * FROM default_out_program
        ORDER BY "default" ASC LIMIT 1)
      SELECT
        u.*, prg."displayEmail", prg."displayPhoneNumber", prg.DEFAULT AS "isDefaultProgram"
      FROM party as p
      INNER JOIN db_namespace."Users" u ON u.id = p."userId"
      LEFT JOIN program as prg on p.id = prg."partyId"`;

// eslint-disable-next-line
export const getPartyAgentQuery = (ctx, partyId) => {
  const knexQuery = knex.raw(prepareRawQuery(partyAgentQuery, ctx.tenantId), { partyId, communicationDirection: DALTypes.CommunicationDirection.OUT });
  return ctx.trx ? knexQuery.transacting(ctx.trx) : knexQuery;
};

export const loadPartyAgent = async (ctx, partyId) => {
  const { rows } = await rawStatement(ctx, partyAgentQuery, [{ partyId, communicationDirection: DALTypes.CommunicationDirection.OUT }]);
  return rows[0];
};

export const updatePartyCollaborators = async (ctx, partyId, collaboratorIds) => {
  const modifiedBy = (ctx.authUser && ctx.authUser.id) || null;
  logger.trace({ ctx, partyId, collaboratorIds, modifiedBy }, 'updatePartyCollaborators');
  const collaboratorIdsAsString = collaboratorIds.map(id => `'${id}'`).join(',');

  await rawStatement(
    ctx,
    `
        WITH "newCollaborators" AS (
          SELECT ARRAY(SELECT DISTINCT UNNEST (ARRAY_CAT("collaborators"::uuid[],ARRAY[${collaboratorIdsAsString}]::uuid[]))
          FROM db_namespace."Party"
          WHERE id = :party_id) as "newCollaboratorsArray"
        )
        UPDATE db_namespace."Party" p
          SET "collaborators" = "newCollaboratorsArray"::uuid[]
          ${modifiedBy ? ', "modified_by" = :modified_by' : ''}
        FROM "newCollaborators"
        WHERE p.id = :party_id
        AND NOT("collaborators"::uuid[] @> "newCollaboratorsArray"::uuid[] AND "collaborators"::uuid[] <@ "newCollaboratorsArray"::uuid[]);
        `,
    [{ party_id: partyId, modified_by: modifiedBy }],
  );

  const { rows } = await rawStatement(ctx, 'SELECT id FROM db_namespace."Party" WHERE id = :party_id AND metadata->>\'firstCollaborator\' IS NULL', [
    { party_id: partyId },
  ]);

  if (rows.length) {
    await rawStatement(
      ctx,
      `

          WITH "firstCollaborator" AS (         SELECT u.id
            FROM (SELECT DISTINCT UNNEST (ARRAY_CAT("collaborators"::uuid[],ARRAY[${collaboratorIdsAsString}]::uuid[])) as "userId"
            FROM db_namespace."Party" p
            WHERE p.id = :party_id) as col
            INNER JOIN db_namespace."Users" as u on col."userId" = u.id
            INNER JOIN db_namespace."TeamMembers" as tm on u.id = tm."userId"
            WHERE u."email" NOT ILIKE :revaAdminEmail
            AND NOT(tm."functionalRoles" @> '{${FunctionalRoleDefinition.LD.name}}')
            LIMIT 1
          )
          UPDATE db_namespace."Party" p
            SET
            metadata = jsonb_set(metadata, '{firstCollaborator}', ('"' || "userId" || '"')::jsonb)
            ${modifiedBy ? ', "modified_by" = :modified_by' : ''}
          FROM "firstCollaborator"
          WHERE p.id = :party_id AND "userId" IS NOT NULL;


        `,
      [{ party_id: partyId, modified_by: modifiedBy, revaAdminEmail }],
    );
  }
};

export const updatePartyTeams = async (ctx, partyId, teamIds) => {
  const modifiedBy = (ctx.authUser && ctx.authUser.id) || null;
  logger.trace({ ctx, partyId, teamIds, modifiedBy }, 'updatePartyTeams');
  const teamIdsAsString = teamIds.map(id => `'${id}'`).join(',');

  const { rows } = await rawStatement(
    ctx,
    `
        WITH "NewTeams" AS (
        SELECT ARRAY(SELECT DISTINCT UNNEST (ARRAY_CAT("teams"::uuid[],ARRAY[${teamIdsAsString}]::uuid[]))
        FROM db_namespace."Party"
        WHERE id = :party_id) AS "newTeamsArray"
        )
        UPDATE db_namespace."Party"
          SET "teams" = "newTeamsArray"::uuid[]
          ${modifiedBy ? ', "modified_by" = :modified_by' : ''}
        FROM "NewTeams"
        WHERE id = :party_id
        AND NOT ("teams"::uuid[] @> "newTeamsArray"::uuid[]
                 AND "teams"::uuid[] <@ "newTeamsArray"::uuid[])`,
    [{ party_id: partyId, modified_by: ctx.authUser ? ctx.authUser.id : null }],
  );
  return rows[0];
};

export const getPartyProgram = async (ctx, id) =>
  await initQuery(ctx)
    .select('Party.id AS partyId', 'Programs.displayName as program')
    .from('Party')
    .leftJoin('TeamPropertyProgram', 'Party.teamPropertyProgramId', 'TeamPropertyProgram.id')
    .leftJoin('Programs', 'Programs.id', 'TeamPropertyProgram.programId')
    .where('Party.id', id)
    .first();

export const loadParty = async (ctx, id) => {
  logger.trace({ ctx, id }, 'loadParty');
  const party = await initQuery(ctx).from('Party').where({ id }).first();

  if (party) {
    const partyMembers = await loadPartyMembers(ctx, id);
    party.partyMembers = partyMembers || [];
  }

  return party;
};

export const loadPartyById = (ctx, id) => getOne(ctx, 'Party', id);
export const getAssignedPropertyByPartyId = async (ctx, partyId) => {
  const { rows } = await rawStatement(
    ctx,
    `
      SELECT "assignedPropertyId" FROM db_namespace."Party" WHERE id = :partyId
    `,
    [{ partyId }],
  );
  return (rows && rows.length && rows[0].assignedPropertyId) || null;
};

export const getPartyWorkflowByPartyId = async (ctx, partyId) => {
  const { rows } = await rawStatement(
    ctx,
    `
      SELECT "workflowName" FROM db_namespace."Party" WHERE id = :partyId
    `,
    [{ partyId }],
  );

  return (rows && rows.length && rows[0].workflowName) || null;
};

export const getPartyAssignedPropertyApplicationSettingsByPartyId = async (ctx, partyId) => {
  const query = `SELECT
      property.settings->'applicationSettings' AS "applicationSettings",
      property.id AS "propertyId"
    FROM db_namespace."Party" party
    LEFT JOIN db_namespace."Property" property ON property.id = party."assignedPropertyId"
    WHERE party.id = :partyId`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows;
};

export const getPartyGroupIdByPartyId = async (ctx, partyId) => {
  const { rows } = await rawStatement(
    ctx,
    `
      SELECT "partyGroupId" FROM db_namespace."Party" WHERE id = :partyId
    `,
    [{ partyId }],
  );

  return (rows && rows.length && rows[0].partyGroupId) || null;
};

export const getPartiesByPartyGroupId = async (ctx, partyGroupId) => {
  logger.trace({ ctx, partyGroupId }, 'getPartiesByPartyGroupId');

  const { rows } = await knex.raw(
    prepareRawQuery(
      `
      SELECT * FROM db_namespace."Party" party
      WHERE party."partyGroupId" = :partyGroupId
      ORDER BY created_at DESC
    `,
      ctx.tenantId,
    ),
    { partyGroupId },
  );

  return rows;
};

export const getActivePartiesByPartyGroupId = async (ctx, partyGroupId) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
      SELECT * FROM db_namespace."Party"
      WHERE "partyGroupId" = :partyGroupId
      AND "workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND "endDate" IS NULL
      ORDER BY created_at DESC
    `,
      ctx.tenantId,
    ),
    { partyGroupId },
  );
  logger.trace({ ctx, partyGroupId, activeParties: rows }, `Get active parties by group id ${partyGroupId}`);

  return rows;
};

export const getActivePartiesByPartyGroupIds = async (ctx, partyGroupIds) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
      SELECT * FROM db_namespace."Party"
      WHERE "partyGroupId" = ANY(:partyGroupIds)
      AND "workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      ORDER BY created_at DESC
    `,
      ctx.tenantId,
    ),
    { partyGroupIds },
  );

  return rows;
};

export const getPartyTypeByPartyId = async (ctx, partyId) => {
  const query = `SELECT "leaseType" FROM db_namespace."Party"
                 WHERE id = :partyId;`;
  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows?.[0]?.leaseType;
};

export const loadPartiesByIds = async (ctx, ids) => await initQuery(ctx).from('Party').whereIn('Party.id', ids).orderBy('updated_at', 'desc');

export const loadPartiesForCommunicationByIds = async (ctx, ids) => {
  const parties = await loadPartiesByIds(ctx, ids);

  return await Promise.reduce(
    parties,
    async (enhancedParties, party) => {
      const { id: revaAdminId } = (await getRevaAdmin(ctx)) || {};
      const partyCollaboratorsIncludingOwner = [party.userId, ...party.collaborators].filter(id => id !== revaAdminId);
      const teamsForUsers = await getTeamsForUsers(ctx, partyCollaboratorsIncludingOwner, { excludeInactiveTeams: false });
      const enhancedParty = {
        ...party,
        teams: [...new Set([...teamsForUsers.map(team => team.id), ...party.teams])],
      };
      return [...enhancedParties, enhancedParty];
    },
    [],
  );
};

export const loadParties = async (ctx, includedPartyStatesArray = partyWfStatesSubset.active, filter) => {
  logger.trace({ ctx, includedPartyStatesArray, filter }, 'loadParties');
  let query = initQuery(ctx)
    .from('Party')
    .leftJoin('Property', 'Party.assignedPropertyId', 'Property.id')
    .select('Party.*', 'Property.timezone')
    .orderBy('updated_at', 'desc');
  query = includedPartyStatesArray?.length ? query.whereIn('Party.workflowState', includedPartyStatesArray) : query;

  const parties = filter ? await filter(query) : await query;
  const ids = parties.map(p => p.id);

  const partyMembers = await loadPartyMembersBy(ctx, q => q.whereIn('PartyMember.partyId', ids));
  const members = partyMembers.reduce((acc, member) => {
    acc[member.partyId] = (acc[member.partyId] || []).concat(member);
    return acc;
  }, {});

  const result = parties.map(partyRow => {
    const party = partyRow;
    party.partyMembers = members[partyRow.id] || [];

    return party;
  });

  return result;
};

export const getPersonIdsbyPartyIds = async (ctx, partyIds, options = {}) => {
  logger.trace({ ctx, partyIds }, 'getPersonIdsbyPartyIds');
  const { excludeSpam = false, excludeInactive = false } = options;
  let query = initQuery(ctx).from('PartyMember').select('personId').whereIn('partyId', partyIds);

  query = excludeSpam ? query.where({ 'PartyMember.isSpam': false }) : query;
  query = excludeInactive ? query.whereNull('PartyMember.endDate') : query;

  const personIds = await query;
  return personIds.map(p => p.personId);
};

export const getARandomPersonIdByPartyId = async (ctx, partyId) => (await getPersonIdsbyPartyIds(ctx, [partyId], { excludeInactive: true }))[0];

export const getPartyMembersByPersonIds = async (ctx, personIds, includeClosedParties = true, excludeInactiveMember = true) => {
  logger.trace({ ctx, personIds, includeClosedParties }, 'getPartyMembersByPersonIds');
  const options = { excludeInactive: excludeInactiveMember };
  const query = includeClosedParties
    ? q => q.whereIn('PartyMember.personId', personIds)
    : q => q.whereIn('PartyMember.personId', personIds) && q.whereNull('Party.endDate');

  return await loadPartyMembersBy(ctx, query, options);
};

export const isPartyClosed = async (ctx, partyId) => {
  const party = await initQuery(ctx).from('Party').whereRaw('"Party"."id" = :partyId AND "Party"."endDate" IS NOT NULL', { partyId }).select(1).first();

  return !!party;
};

export const getPartyMemberByPartyIdAndPersonId = async (ctx, partyId, personId) => {
  const query = q => q.where({ 'PartyMember.partyId': partyId, 'PartyMember.personId': personId }).first();
  return await loadPartyMembersBy(ctx, query, { excludeInactive: false });
};

export const getPartyMembersByPartyIds = async (ctx, partyIds, options) => {
  const query = q => q.whereIn('PartyMember.partyId', partyIds);
  return await loadPartyMembersBy(ctx, query, options);
};

export const getPartyMembersById = async (ctx, partyMembersId, options) => {
  const query = q => q.whereIn('PartyMember.id', partyMembersId);
  return await loadPartyMembersBy(ctx, query, options);
};

export const getPersonIdsByFullNameAndPartyId = async (ctx, partyId, fullName) => {
  const query = `
    SELECT pm."personId"
      FROM db_namespace."PartyMember" AS pm
      INNER JOIN db_namespace."Person" AS p ON p.id = pm."personId"
    WHERE pm."partyId" = :partyId
      AND pm."endDate" IS NULL
      AND pm."isSpam" IS FALSE
      AND p."fullName" ILIKE :fullName
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      partyId,
      fullName,
    },
  ]);

  return rows.map(r => r.personId);
};

export const getPartyIdsByPersonIds = async (ctx, personIds, includeClosedParties = true, excludeInactiveMember = true) => {
  const partyMembers = await getPartyMembersByPersonIds(ctx, personIds, includeClosedParties, excludeInactiveMember);
  return partyMembers.map(p => p.partyId);
};

export const getPartyIdsByPartyState = async (ctx, partyState) => {
  const result = await initQuery(ctx).from('Party').where('Party.state', partyState).select('Party.id');
  return result.map(item => item.id);
};

export const getPartiesByPersonIdsAndTeamIds = async (ctx, personIds, teamIds) => {
  const partyIds = await getPartyIdsByPersonIds(ctx, personIds);
  const parties = await loadPartiesByIds(ctx, partyIds);

  const teams = new Set(teamIds);
  const result = parties.filter(p => p.teams.some(id => teams.has(id)));
  logger.trace({ ctx, result, personIds, teamIds }, 'getPartiesByPersonIdsAndTeamIds');
  return result;
};

export const getActiveApplicationsForPersons = async (ctx, personIds, excludedPartyId) => {
  const query = `
    SELECT pa.* FROM db_namespace."rentapp_PersonApplication" pa
    INNER JOIN db_namespace."Party" p ON pa."partyId" = p.id
    INNER JOIN db_namespace."Party" p2 ON p2.id = :excludedPartyId
    WHERE pa."personId" = ANY(:personIds)
      AND p.id <> :excludedPartyId
      AND p2."assignedPropertyId" = p."assignedPropertyId"
      AND p."endDate" IS NULL
      AND pa."paymentCompleted" IS true 
      AND pa."endedAsMergedAt" IS NULL
    ORDER BY pa.updated_at DESC
`;

  const { rows } = await rawStatement(ctx, query, [{ personIds, excludedPartyId }]);
  return rows;
};

const createPartyGroup = async ctx => {
  const groupId = getUUID();
  await insertInto(
    ctx.tenantId,
    'PartyGroup',
    {
      id: groupId,
    },
    { outerTrx: ctx.trx },
  );
  return groupId;
};

/**
 * Returns the copied personApplications on target parties if the person belongs to another party with the same assigned property
 * and the person already paid for an application on that party.
 * @param {Object} ctx - context
 * @param {string} personId - an existing person trying to be added to a target party.
 * @param {string[]} targetPartyIds - parties where the person is trying to be added
 * @param {func} validateFn - function to validate scenarios where is not valid to add the person to a target party.
 */
export const copyActiveApplicationForPerson = async (ctx, personId, targetPartyIds, validateFn) =>
  await mapSeries(targetPartyIds, async partyId => {
    logger.trace({ ctx, personId, partyId }, 'copyActiveApplicationForPerson');

    if (await existsPersonApplication(ctx, personId, partyId)) return null;

    const leaseType = await getPartyTypeByPartyId(ctx, partyId);
    const [partyApplicationSettings] = await getPartyAssignedPropertyApplicationSettingsByPartyId(ctx, partyId);

    const { applicationSettings } = partyApplicationSettings || {};

    const [activeApplication] = await getActiveApplicationsForPersons(ctx, [personId], partyId);

    if (!activeApplication) return null;

    const partyMember = await getPartyMemberByPartyIdAndPersonId(ctx, activeApplication.partyId, personId);
    if (!partyMember) {
      logger.error(
        {
          ctx,
          activeApplication: pick(activeApplication, [
            'id',
            'personId',
            'partyId',
            'partyApplicationId',
            'paymentCompleted',
            'applicationStatus',
            'endedAsMergedAt',
            'copiedFrom',
          ]),
          partyMember,
        },
        'copyActiveApplicationForPerson - could not find partyMember',
      );
    }

    const settings = partyMember && applicationSettings?.[leaseType]?.[partyMember.memberType.toLowerCase()];

    if (
      settings?.appFeePaymentValidForPeriod &&
      now().diff(toMoment(activeApplication.created_at), 'days') > parseInt(settings.appFeePaymentValidForPeriod, 10)
    ) {
      logger.trace(
        {
          ctx,
          personId,
          partyId: activeApplication.partyId,
          personApplicationId: activeApplication.id,
          targetPartyId: partyId,
          appFeePaymentValidForPeriod: settings.appFeePaymentValidForPeriod,
        },
        'Valid payment period has expired',
      );
      return null;
    }

    if (validateFn && !validateFn(activeApplication.partyId)) return null;

    logger.trace(
      { ctx, personId, partyId: activeApplication.partyId, personApplicationId: activeApplication.id, targetPartyId: partyId },
      'copyActiveApplicationForPerson',
    );
    return await copyPersonApplication(ctx, activeApplication, partyId);
  }).filter(result => result);

export const createParty = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'createParty');
  party.state = party.state || DALTypes.PartyStateType.CONTACT;
  party.collaborators = party.collaborators ? [...new Set([...party.collaborators, party.userId])] : [party.userId];

  const partyId = party.id || getUUID();
  const storedUnitsFilters = addPropertyToFilters(party.assignedPropertyId, party.storedUnitsFilters);

  const partyGroupId = party.partyGroupId || (await createPartyGroup(ctx));
  const firstCollaborator = party.userId || (ctx.authUser && ctx.authUser.id);
  const isInvalidCollaborator = firstCollaborator && (await isAdminOrDispatcherAgent(ctx, firstCollaborator));

  return await insertInto(
    ctx.tenantId,
    'Party',
    {
      ...party,
      id: partyId,
      emailIdentifier: getEmailIdentifierFromUuid(partyId),
      storedUnitsFilters,
      modified_by: ctx.authUser && ctx.authUser.id,
      partyGroupId,
      metadata: {
        ...(party.metadata || {}),
        originalTeam: party.ownerTeam,
        firstCollaborator: !isInvalidCollaborator && firstCollaborator ? firstCollaborator : undefined,
      },
    },
    { outerTrx: ctx.trx },
  );
};

const filterNonExistingContactInfo = async (innerCtx, contactInfo, personId) =>
  contactInfo.reduce(async (acc, info) => {
    const isEmail = info.type === DALTypes.ContactInfoType.EMAIL;
    const existingInfo = isEmail ? await getContactsInfoByEmail(innerCtx, info.value) : await getContactsInfoByPhone(innerCtx, info.value);
    const resolvedAcc = await acc;

    // we can have only one primary phone for a specific person
    const isNotPrimaryPhoneNumber = !!existingInfo && !isEmail && !existingInfo.some(i => i.isPrimary && i.personId === personId);
    if (!existingInfo.length || isNotPrimaryPhoneNumber) {
      resolvedAcc.push(info);
    }

    return resolvedAcc;
  }, Promise.resolve([]));

export const createPartyMember = async (ctx, member, partyId, shouldCopyApplication = true) => {
  logger.trace({ ctx, member: pick(member, ['fullName', 'memberType']), partyId }, 'createPartyMember');
  const modified_by = ctx.authUser && ctx.authUser.id; // eslint-disable-line

  const create = async innerCtx => {
    const idType = DALTypes.PersonIdType.STATE;
    const nowDate = now();

    const personId = member.personId || getUUID();
    const memberHasContactInfo = member.contactInfo && member.contactInfo.all.length;
    const contactInfoToSave = memberHasContactInfo && (await filterNonExistingContactInfo(innerCtx, member.contactInfo.all, personId));
    const shouldSaveContactInfo = contactInfoToSave && !!contactInfoToSave.length;
    let memberState = member.memberState || DALTypes.PartyStateType.LEAD;

    if (!member.personId) {
      const person = {
        id: personId,
        fullName: removeSpaces(member.fullName),
        isSuspiciousContent: isSuspiciousContent(config.app.party.forbiddenLegalNames, member.fullName),
        idType,
        modified_by,
      };

      hasOwnProp(member, 'preferredName') && Object.assign(person, { preferredName: member.preferredName });

      await initQuery(innerCtx).insert(person).into('Person');

      if (shouldSaveContactInfo) {
        await saveContactInfo(innerCtx, contactInfoToSave, personId);
      }
    } else {
      if (shouldSaveContactInfo) {
        // add new contact info to existing person
        await saveContactInfo(innerCtx, contactInfoToSave, personId);
      }

      // TODO: we should not reference rentapp services from leasing. Rentapp could listen for changes in leasing.
      const applicationsProcessed = shouldCopyApplication && (await copyActiveApplicationForPerson(innerCtx, personId, [partyId]));
      if (applicationsProcessed && applicationsProcessed.length) {
        memberState = DALTypes.PartyStateType.APPLICANT;
        logger.trace(
          { ctx, personId, targetPartyId: partyId, newPersonApplicationId: applicationsProcessed[0].id },
          'person application copied on create party member action',
        );
      }
    }

    const partyMember = {
      id: member.id || getUUID(),
      memberState,
      memberType: member.memberType,
      personId,
      created_at: nowDate.toJSON(),
      updated_at: nowDate.toJSON(),
      modified_by,
      vacateDate: member.vacateDate,
      companyId: member.companyId || null,
    };

    if (member.guaranteedBy) partyMember.guaranteedBy = member.guaranteedBy;
    if (partyId) {
      partyMember.partyId = partyId;
    }

    const epmi = await getExternalInfoByPartyMemberId(ctx, partyMember.id);
    const isCreate = !member.personId || !epmi;
    const isUpdate = member.personId;

    if (isCreate) {
      await initQuery(innerCtx).insert(partyMember).into('PartyMember');
    }

    if (isUpdate) {
      await updateOne(innerCtx, 'PartyMember', partyMember.id, partyMember, innerCtx.trx);
    }

    if (partyId) {
      // this will update "updated_at"
      await updateOne(innerCtx.tenantId, 'Party', partyId, { modified_by }, innerCtx.trx);
    }

    return partyMember.id;
  };

  const partyMemberId = await runInTransaction(async innerTrx => await create({ trx: innerTrx, ...ctx }), ctx);

  return await loadPartyMembersBy(ctx, q => q.where({ 'PartyMember.id': partyMemberId }).first());
};

export const getUnitsFiltersFromQuestions = (qualificationQuestions, { timezone } = {}) => {
  if (qualificationQuestions) {
    const filter = {
      numBedrooms: qualificationQuestions.numBedrooms || {},
    };
    if (qualificationQuestions.moveInTime) {
      filter.moveInDate = createMoveInFilter(qualificationQuestions.moveInTime, { timezone });
    }
    return filter;
  }
  return {};
};

export const getAssignedPropertyIdForParty = async (ctx, teamIds) => {
  const properties = await getPropertiesAssociatedWithTeams(ctx, teamIds);
  const uniquePropertyIds = [...new Set(properties.map(p => p.id))];
  return uniquePropertyIds.length === 1 ? uniquePropertyIds[0] : undefined;
};

export const getAssignedPropertyNameByPartyId = async (ctx, partyId) => {
  const { rows } = await knex.raw(
    `
    SELECT property.name FROM :tenantId:."Property" property
      INNER JOIN :tenantId:."Party" party ON property.id = party."assignedPropertyId"
      WHERE party.id = :partyId;
    `,
    { tenantId: ctx.tenantId, partyId },
  );

  return rows && rows[0].name;
};

const getTeamOriginalProgramId = (program, originalProgram) =>
  (originalProgram && originalProgram.teamPropertyProgramId) || (program && program.teamPropertyProgramId) || null;

export const createRawLead = async ({
  ctx,
  personData,
  collaboratorTeams: teamIds,
  teamsForParty,
  userId,
  program,
  originalProgram,
  channel,
  teamMemberSource,
  propertyId,
  transferAgentSource,
}) => {
  logger.trace({ ctx, personData, teamIds, userId, program, channel, teamMemberSource, transferAgentSource }, 'createRawLead');

  const existingResident = personData.personId ? await getExistingResidentsByPersonIds(ctx, [personData.personId]) : [];
  const isExistingResident = !!existingResident.length;
  const residentInfo = isExistingResident
    ? {
        created_at: existingResident[0].created_at,
        ...existingResident[0].metadata,
      }
    : {};

  const create = async innerCtx => {
    const partyId = getUUID();
    const assignedPropertyId = propertyId || (program && program.propertyId) || (await getAssignedPropertyIdForParty(innerCtx, teamsForParty));
    let timezone;
    if (!assignedPropertyId) {
      logger.warn({ ctx, partyId, personData, teamIds, userId, program, channel, teamMemberSource }, 'Property not found at raw lead creation time');

      timezone = LA_TIMEZONE;
    } else {
      timezone = await getPropertyTimezone(innerCtx, assignedPropertyId);
    }
    const unitsFiltersFromQuestions = getUnitsFiltersFromQuestions(personData.qualificationQuestions, { timezone });

    const programSelectedProperties = program?.selectedPropertyIds || [];
    const activeProperties = await getActiveProperties(ctx);
    const activeProgramSelectedProperties = programSelectedProperties.filter(id => activeProperties.find(prop => prop.id === id));
    const propertyIdsForstoredUnitsFilters = Array.from(
      new Set([...(unitsFiltersFromQuestions.propertyIds || []), ...activeProgramSelectedProperties, assignedPropertyId].filter(id => !!id)),
    );

    const storedUnitsFilters = { ...unitsFiltersFromQuestions, propertyIds: propertyIdsForstoredUnitsFilters };
    const partyGroupId = await createPartyGroup(innerCtx);

    const ownerTeam = teamsForParty[0];
    const firstCollaborator = userId || (ctx.authUser && ctx.authUser.id);
    const isInvalidCollaborator = firstCollaborator && (await isAdminOrDispatcherAgent(innerCtx, firstCollaborator));
    // TODO: this check to verify if qualification questions are completed is wrong we
    // should use the same method we have in the frontend since we need to check all questions
    // not just the existance of the object as it might be empty
    const qualQuestionsCompleted = personData.qualificationQuestions ? now().toJSON() : null;
    const partyData = {
      id: partyId,
      emailIdentifier: getEmailIdentifierFromUuid(partyId),
      state: DALTypes.PartyStateType.CONTACT,
      collaborators: userId ? [userId] : [],
      teams: teamIds,
      userId,
      metadata: {
        teamMemberSource,
        transferAgentSource,
        propertyId: assignedPropertyId,
        leadFromExistingResident: isExistingResident,
        residentInfo: { ...residentInfo },
        firstContactedDate: now().toJSON(),
        firstContactChannel: channel,
        creationType: DALTypes.PartyCreationTypes.SYSTEM,
        qualQuestionsCompleted,
        marketingSessionId: program && program.marketingSessionId,
        originalTeam: ownerTeam,
        firstCollaborator: !isInvalidCollaborator && firstCollaborator ? firstCollaborator : undefined,
        activatePaymentPlanDate: program?.metadata?.activatePaymentPlan ? now({ timezone }).toJSON() : undefined,
      },
      qualificationQuestions: personData.qualificationQuestions || {},
      score: DALTypes.LeadScore.PROSPECT,
      storedUnitsFilters,
      assignedPropertyId,
      ownerTeam,
      partyGroupId,
      modified_by: ctx.authUser && ctx.authUser.id,
      teamPropertyProgramId: getTeamOriginalProgramId(program, originalProgram),
      fallbackTeamPropertyProgramId: originalProgram ? program.teamPropertyProgramId : null,
    };

    const party = await insertInto(innerCtx.tenantId, 'Party', partyData, {
      outerTrx: innerCtx.trx,
    });

    personData.memberType = DALTypes.MemberType.RESIDENT;
    personData.memberState = DALTypes.PartyStateType.CONTACT;
    await createPartyMember(innerCtx, personData, party.id);
    return party.id;
  };

  const partyId = await runInTransaction(async innerTrx => await create({ trx: innerTrx, ...ctx }), ctx);
  return loadParty(ctx, partyId);
};

export const updatePartyMember = async (ctx, partyMemberId, member) => {
  logger.trace({ ctx, partyMemberId, member }, 'updatePartyMember');
  const modified_by = ctx.authUser ? ctx.authUser.id : undefined; //eslint-disable-line
  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const nowDate = now().toJSON();

    if (member.personId && (member.companyName || member.fullName || member.preferredName)) {
      const person = {
        fullName: removeSpaces(member.fullName),
        updated_at: nowDate,
        modified_by,
      };

      hasOwnProp(member, 'companyName') && Object.assign(person, { companyName: member.companyName });
      hasOwnProp(member, 'preferredName') && Object.assign(person, { preferredName: member.preferredName });

      await initQuery(innerCtx).from('Person').where({ id: member.personId }).update(person).returning('*');
    }

    const partyMember = {
      memberState: member.memberState,
      memberType: member.memberType,
      updated_at: nowDate,
      isSpam: member.isSpam,
      partyId: member.partyId,
      guaranteedBy: member.guaranteedBy,
      endDate: member.endDate,
      vacateDate: member.vacateDate,
      companyId: member.companyId,
      modified_by,
    };

    await initQuery(innerCtx).from('PartyMember').where({ id: partyMemberId }).update(partyMember).returning('*');

    if (member.contactInfo) {
      const contactInfoDiff = await getContactInfoDiff(innerCtx, member.contactInfo.all, member.personId);
      await updateContactInfoForPerson(innerCtx, contactInfoDiff, member.personId);
    }

    if (member.partyId) {
      // this will update "updated_at"
      await initQuery(innerCtx).from('Party').where({ id: member.partyId }).update({ updated_at: nowDate, modified_by }).returning('*');
    }
  }, ctx);

  const memberIdFilter = q => q.where({ 'PartyMember.id': partyMemberId }).first();
  return await loadPartyMembersBy(ctx, memberIdFilter, {
    excludeInactive: false,
    excludeSpam: false,
  });
};

export const getPartyMemberByEmailAddress = (ctx, email) =>
  loadPartyMembersBy(ctx, q => q.where('ContactInfo.type', 'email').where('ContactInfo.value', email).first(), { excludeInactive: false });

export const getPartyMembersByEmailAddress = (ctx, email) =>
  loadPartyMembersBy(ctx, q => q.where('ContactInfo.type', 'email').where('ContactInfo.value', email), { excludeInactive: false });

export const getPartyMemberByPhoneNumber = (ctx, phone) =>
  loadPartyMembersBy(ctx, q => q.where('ContactInfo.type', 'phone').where('ContactInfo.value', phone), { excludeInactive: false });

export const getPartyMemberByContactInfo = (ctx, contactInfoId) => loadPartyMembersBy(ctx, q => q.where({ 'ContactInfo.id': contactInfoId }).first());

const getPartyMembersByPartyIdAndContactInfoType = (ctx, partyId, contactInfoType) =>
  loadPartyMembersBy(ctx, q =>
    q.where({
      'PartyMember.partyId': partyId,
      'ContactInfo.type': contactInfoType,
    }),
  );

export const getPartyMembersByPartyIdAndContactInfoEmailType = (ctx, partyId) => getPartyMembersByPartyIdAndContactInfoType(ctx, partyId, 'email');

// when we update the party we only send the information we are updating and in some cases where the assignedPropertyId or storedUnitsFilters
// is not in the payload we don't need to do anything related to the unitfilters, for that reason we return undefined
// and it means use the entire paylod do not override the storedUnitsFilters
const getStoredUnitFiltersAndQualificationQuestions = async (ctx, party) => {
  if (!party.storedUnitsFilters && !party.qualificationQuestions) return undefined;

  const { storedUnitsFilters = {}, qualificationQuestions = {} } =
    (await initQuery(ctx).from('Party').select('storedUnitsFilters', 'qualificationQuestions').where({ id: party.id }).first()) || {};

  const unitFilters =
    party.assignedPropertyId || party.storedUnitsFilters
      ? addPropertyToFilters(party.assignedPropertyId, { ...storedUnitsFilters, ...(party.storedUnitsFilters || {}) })
      : undefined;

  return {
    storedUnitsFilters: unitFilters,
    qualificationQuestions: party.qualificationQuestions ? { ...qualificationQuestions, ...party.qualificationQuestions } : undefined,
  };
};

export const updateParty = async (ctx, party) => {
  const loggedParty = { ...party };
  const numBedrooms = JSON.stringify(loggedParty.storedUnitsFilters?.numBedrooms);
  loggedParty.storedUnitsFilters = { ...loggedParty.storedUnitsFilters, numBedrooms };
  logger.trace({ ctx, loggedParty }, 'updateParty');
  const { partyMembers, metadata, ...restProps } = party;

  const executeUpdate = async innerCtx => {
    logger.trace({ ctx: innerCtx }, 'updateParty - updating party members');
    await execConcurrent(partyMembers || [], async member => await updatePartyMember(innerCtx, member.id, member));

    if (metadata) {
      const { firstContactedDate, ...restProperties } = metadata;

      if (firstContactedDate) {
        logger.trace({ ctx: innerCtx, firstContactedDate }, 'updateParty - updating firstContactedDate');

        await initQuery(innerCtx)
          .from('Party')
          .where({ id: party.id })
          .update({
            metadata: knex.raw('metadata::jsonb || :param', { param: { firstContactedDate } }),
          });
      }

      logger.trace({ ctx: innerCtx }, 'updateParty - updating metadata');
      await savePartyMetadata(ctx, 'Party', party.id, restProperties, innerCtx.trx);
    }

    const filtersAndQuestions = await getStoredUnitFiltersAndQualificationQuestions(innerCtx, party);
    const delta = {
      ...restProps,
      ...(filtersAndQuestions && filtersAndQuestions.storedUnitsFilters ? { storedUnitsFilters: filtersAndQuestions.storedUnitsFilters } : {}),
      ...(filtersAndQuestions && filtersAndQuestions.qualificationQuestions ? { qualificationQuestions: filtersAndQuestions.qualificationQuestions } : {}),
    };
    delete delta.id;

    if (Object.keys(delta).length) {
      await initQuery(innerCtx)
        .from('Party')
        .where({ id: party.id })
        .update({ ...delta, modified_by: ctx.authUser && ctx.authUser.id })
        .returning('*');
    }

    return await loadParty(innerCtx, party.id);
  };

  return await runInTransaction(async trx => await executeUpdate({ trx, ...ctx }), ctx);
};

export const saveMetadata = (ctx, partyId, metadata) =>
  execConcurrent(Object.keys(metadata), async key => {
    const value = metadata[key] === undefined ? null : metadata[key];
    return await updateJSONBField({
      schema: ctx.tenantId,
      table: 'Party',
      tableId: partyId,
      field: 'metadata',
      key,
      value,
      outerTrx: ctx.trx,
    });
  });

export const savePartyAdditionalInfo = (ctx, additionalInfo) => insertInto(ctx, 'Party_AdditionalInfo', additionalInfo);

export const getPartyAdditionalInfoByPartyId = async (ctx, id) => {
  const query = `
    SELECT * FROM db_namespace."Party_AdditionalInfo" WHERE "partyId" = :id AND "endDate" IS NULL`;

  const { rows } = await rawStatement(ctx, query, [{ id }]);
  return rows;
};

export const getPartyAdditionalInfo = async (ctx, id) => {
  const query = `
    SELECT * FROM db_namespace."Party_AdditionalInfo" WHERE id = :id AND "endDate" IS NULL`;

  const { rows } = await rawStatement(ctx, query, [{ id }]);
  return rows.length && rows[0];
};

export const updatePartyAdditionalInfo = async (ctx, id, additionalInfo) => {
  await saveJSONBData(ctx, 'Party_AdditionalInfo', id, 'info', additionalInfo);

  return await getPartyAdditionalInfo(ctx, id);
};

export const removePartyAdditionalInfo = async (ctx, additionalInfoId) => {
  logger.trace({ ctx, additionalInfoId }, 'removePartyAdditionalInfo');

  const result = await rawStatement(
    ctx,
    `
    UPDATE db_namespace."Party_AdditionalInfo" SET "endDate" = now()
      WHERE id = :additionalInfoId
    RETURNING *;
    `,
    [
      {
        additionalInfoId,
      },
    ],
  );

  return result.rows && result.rows[0];
};

export const getAdditionalInfoByPartyAndType = async (ctx, partyId, type) => {
  const typeFilter = type ? `AND type = '${type}'` : '';

  const query = `
    SELECT * from db_namespace."Party_AdditionalInfo"
    WHERE "partyId" = :partyId
    AND "endDate" IS NULL 
    ${typeFilter}`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

export const getPartyMembersByQuoteId = async (ctx, quoteId) =>
  await initQuery(ctx)
    .select('PartyMember.personId', 'Person.fullName', 'Person.preferredName', 'PartyMember.partyId')
    .from('Quote')
    .innerJoin('Party', 'Quote.partyId', 'Party.id')
    .innerJoin('PartyMember', 'Party.id', 'PartyMember.partyId')
    .innerJoin('Person', 'PartyMember.personId', 'Person.id')
    .where({ 'Quote.id': quoteId });

export const markMemberAsRemoved = async (ctx, id, memberEndDate = null) => {
  const query = `
    UPDATE db_namespace."PartyMember" pm
      SET "endDate" = :endDate,
          modified_by = :modifiedBy
      FROM db_namespace."Person" p
    WHERE pm.id = :id
      AND pm."personId" = p.id
    RETURNING pm.*, p."fullName";
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      endDate: memberEndDate || new Date(),
      modifiedBy: ctx?.authUser?.id || null,
      id,
    },
  ]);

  return rows[0];
};

export const closeParty = async (ctx, partyId, closeReasonId) => {
  const updateFields = async innerCtx => {
    await saveMetadata(innerCtx, partyId, {
      closeReasonId,
      closeAgentId: innerCtx.authUser?.id,
    });

    await updateParty(innerCtx, {
      id: partyId,
      endDate: new Date(),
      modified_by: ctx.authUser && ctx.authUser.id,
      workflowState: DALTypes.WorkflowState.CLOSED,
    });
  };

  await runInTransaction(async innerTrx => await updateFields({ trx: innerTrx, ...ctx }), ctx);

  return await loadParty(ctx, partyId);
};

export const archiveParty = async (ctx, partyId, archiveReasonId) => {
  const updateFields = async innerCtx => {
    await saveMetadata(innerCtx, partyId, {
      archiveReasonId,
      archiveAgentId: innerCtx?.authUser?.id || null,
    });

    await updateParty(innerCtx, {
      id: partyId,
      archiveDate: new Date(),
      workflowState: DALTypes.WorkflowState.ARCHIVED,
    });
  };

  await runInTransaction(async innerTrx => await updateFields({ trx: innerTrx, ...ctx }), ctx);

  return await loadParty(ctx, partyId);
};

export const openParty = async (ctx, partyId) => {
  const updateFields = async innerCtx => {
    await removeKeyFromJSONBField({
      schema: innerCtx.tenantId,
      table: 'Party',
      tableId: partyId,
      field: 'metadata',
      key: 'closeReasonId',
      outerTrx: innerCtx.trx,
    });

    await removeKeyFromJSONBField({
      schema: innerCtx.tenantId,
      table: 'Party',
      tableId: partyId,
      field: 'metadata',
      key: 'closeAgentId',
      outerTrx: innerCtx.trx,
    });

    await updateParty(innerCtx, { id: partyId, endDate: null, modified_by: ctx.authUser && ctx.authUser.id, workflowState: DALTypes.WorkflowState.ACTIVE });
  };

  await runInTransaction(async innerTrx => await updateFields({ trx: innerTrx, ...ctx }), ctx);
  return await loadParty(ctx, partyId);
};

export const getPartyMembersByExternalIds = async (ctx, externalIds) =>
  await initQuery(ctx)
    .select('PartyMember.*')
    .from('PartyMember')
    .innerJoin('ExternalPartyMemberInfo', 'PartyMember.id', 'ExternalPartyMemberInfo.partyMemberId')
    .whereIn('ExternalPartyMemberInfo.externalId', externalIds);

export const getPrimaryTenantByExternalIds = async (ctx, externalId, prospectId) => {
  const { rows } = await knex.raw(
    `
    SELECT p.metadata->>'creationType' as "creationType", pm.* FROM :tenantId:."PartyMember" pm
      INNER JOIN :tenantId:."Party" p on pm."partyId" = p.id
      INNER JOIN :tenantId:."ExternalPartyMemberInfo" epmi ON pm.id = epmi."partyMemberId"
      WHERE epmi."endDate" IS NULL
            AND (epmi."externalId" = :externalId OR epmi."externalProspectId" = :prospectId)
  `,
    { tenantId: ctx.tenantId, externalId, prospectId },
  );

  return rows[0];
};

export const getPartyMemberByPersonId = (ctx, personId) => loadPartyMembersBy(ctx, q => q.where('PartyMember.personId', personId).first());

export const getPartyMemberByPartyAndExternalIds = async (ctx, partyId, externalId, roommateId) =>
  await initQuery(ctx)
    .select('PartyMember.*')
    .from('PartyMember')
    .innerJoin('ExternalPartyMemberInfo', 'PartyMember.id', 'ExternalPartyMemberInfo.partyMemberId')
    .where('PartyMember.partyId', partyId)
    .andWhereRaw('("ExternalPartyMemberInfo"."externalId" = :externalId OR "ExternalPartyMemberInfo"."externalRoommateId" = :roommateId)', {
      externalId,
      roommateId,
    })
    .andWhereRaw('"ExternalPartyMemberInfo"."endDate" IS NULL')
    .first();

export const getPartyMemberByPartyAndEmail = async (ctx, partyId, email) =>
  await initQuery(ctx)
    .select('PartyMember.*')
    .from('PartyMember')
    .innerJoin('Person', 'PartyMember.personId', 'Person.id')
    .innerJoin('ContactInfo', 'Person.id', 'ContactInfo.personId')
    .whereRaw('"PartyMember"."partyId" = :partyId', { partyId })
    .andWhereRaw('"ContactInfo"."type" = ?', [DALTypes.ContactInfoType.EMAIL])
    .andWhereRaw('"ContactInfo"."value" ilike :email', { email })
    .first();

export const getPartyMemberByProspectId = async (ctx, prospectId) =>
  await initQuery(ctx)
    .select('PartyMember.*', 'Person.fullName')
    .from('PartyMember')
    .innerJoin('ExternalPartyMemberInfo', 'PartyMember.id', 'ExternalPartyMemberInfo.partyMemberId')
    .innerJoin('Person', 'PartyMember.personId', 'Person.id')
    .whereRaw('"ExternalPartyMemberInfo"."endDate" IS NULL')
    .andWhereRaw('("ExternalPartyMemberInfo"."externalId" = :prospectId OR "ExternalPartyMemberInfo"."externalProspectId" = :prospectId)', {
      prospectId,
    })
    .first();

export const getAllApplicationStatusByPartyAndType = async (ctx, partyIds, { returnSsn, type } = {}) => {
  const query = initQuery(ctx)
    .select('PartyMember.id AS partyMemberId', 'rentapp_PersonApplication.*')
    .from('PartyMember')
    .innerJoin('Person', 'PartyMember.personId', 'Person.id')
    .innerJoin('rentapp_PersonApplication', 'Person.id', 'rentapp_PersonApplication.personId')
    .whereIn('PartyMember.partyId', partyIds)
    .andWhereRaw('"PartyMember"."partyId" = "rentapp_PersonApplication"."partyId"')
    .andWhereRaw('"rentapp_PersonApplication"."endedAsMergedAt" IS NULL');

  const applications = await (type ? query.andWhere({ memberType: type }) : query);
  return returnSsn ? transformDALToApplicationsData(applications) : applications;
};

const partyQuotePromotionsFields = ['id', 'partyId', 'quoteId', 'leaseTermId', 'promotionStatus', 'updated_at'];

export const loadAllQuotePromotions = (ctx, partyId) => getAllWhere(ctx, 'PartyQuotePromotions', { partyId }, partyQuotePromotionsFields);

export const loadAllQuotePromotionsForParties = (ctx, partyIds) =>
  getAllWhereIn(ctx.tenantId, 'PartyQuotePromotions', {
    column: 'partyId',
    array: partyIds,
  });

export const insertQuotePromotion = (ctx, quotePromotion) =>
  insertInto(ctx.tenantId, 'PartyQuotePromotions', quotePromotion, {
    outerTrx: ctx.trx,
  });

export const loadQuotePromotion = (ctx, quotePromotionId) => getOne(ctx, 'PartyQuotePromotions', quotePromotionId);

export const getQuotePromotionsByStatus = async (ctx, partyId, status = DALTypes.PromotionStatus.APPROVED) => {
  const query = `
    SELECT * FROM db_namespace."PartyQuotePromotions" qp
    WHERE "partyId" = :partyId AND "promotionStatus" = :status
  `;
  const { rows } = await rawStatement(ctx, query, [{ partyId, status }]);
  return rows;
};

export const getQuotePromotionsByQuoteId = async (ctx, quoteId) =>
  await initQuery(ctx).select('*').from('PartyQuotePromotions').where('PartyQuotePromotions.quoteId', quoteId);

export const updateQuotePromotion = (ctx, quotePromotionId, { promotionStatus, leaseTermId, modifiedBy, approvedBy, approvalDate }) =>
  updateOne(
    ctx.tenantId,
    'PartyQuotePromotions',
    quotePromotionId,
    { promotionStatus, leaseTermId, modified_by: modifiedBy, approvedBy, approvalDate },
    ctx.trx,
  );

export const getPartyIdByLeaseId = async (ctx, leaseId) => {
  const result = await getOneWhere(ctx.tenantId, 'Lease', { id: leaseId }, ['partyId']);
  return result && result.partyId;
};

export const getActivePartyMemberByPartyIdAndPersonId = async (ctx, partyId, personId) =>
  await initQuery(ctx).select('*').from('PartyMember').where({ partyId, personId }).andWhereRaw('"endDate" IS NULL').first();

export const getNonCanceledQuotePromotionByPartyId = async (ctx, partyId) =>
  await initQuery(ctx)
    .select('*')
    .from('PartyQuotePromotions')
    .whereNot('promotionStatus', DALTypes.PromotionStatus.CANCELED)
    .andWhere({ partyId })
    .orderBy('created_at', 'desc')
    .first();

export const getAllQuotePromotionsByPartyId = async (ctx, partyId) => await initQuery(ctx).select('*').from('PartyQuotePromotions').andWhere({ partyId });

export const getPublishedLeaseTermsByPartyIdAndQuoteId = async (ctx, { partyId, quoteId = '' }) => {
  const paramsHash = await getObjectHash({ partyId, quoteId });

  const cachePath = `dal.party.getPublishedLeaseTermsByPartyIdAndQuoteId.${paramsHash}`;
  const publishedLeaseTermsByPartyIdAndQuoteIdCache = getCtxCache(ctx, cachePath);
  if (publishedLeaseTermsByPartyIdAndQuoteIdCache) {
    return publishedLeaseTermsByPartyIdAndQuoteIdCache;
  }

  const query = `
    SELECT q."publishedQuoteData"::json->'leaseTerms' AS "leaseTerms"
      FROM db_namespace."Party" p
      INNER JOIN db_namespace."Quote" q ON q."partyId" = p."id"
    WHERE p."id" = :partyId
      AND q."publishedQuoteData"::text <> '{}'::text
      AND q."id"::text = :quoteId :: text`;

  const results = await rawStatement(ctx, query, [{ partyId, quoteId }]);

  if (!results || !results.rows.length) return [];

  const resultLeaseTerms = flatten(results.rows.map(row => row.leaseTerms));

  const result = uniqBy(resultLeaseTerms, 'id');

  setCtxCache(ctx, cachePath, result);

  return result;
};

export const removeGuaranteedByLink = async (ctx, partyId, partyMemberId) =>
  await initQuery(ctx)
    .from('PartyMember')
    .where({ partyId, guaranteedBy: partyMemberId })
    .andWhereRaw('"endDate" IS NULL')
    .update({ guaranteedBy: null, modified_by: ctx.authUser && ctx.authUser.id })
    .returning('*');

export const getPartyProspectId = async (ctx, partyId) => await initQuery(ctx).from('PartyMember').where({ partyId }).andWhereRaw('"endDate" IS NULL').first();

export const updatePersonIdForPartyMember = async (ctx, basePersonId, otherPersonId) =>
  await initQuery(ctx)
    .from('PartyMember')
    .where({ personId: otherPersonId })
    .andWhereRaw('"endDate" IS NULL')
    .update({ personId: basePersonId, modified_by: ctx.authUser && ctx.authUser.id })
    .returning('*');

export const updateMemberStateForParty = async (ctx, partyId, personId, memberState) =>
  await initQuery(ctx)
    .from('PartyMember')
    .where({ personId, partyId })
    .andWhereRaw('"endDate" IS NULL')
    .update({ memberState, modified_by: ctx.authUser && ctx.authUser.id })
    .returning('*');

export const markPartyMemberAsRemovedForParties = async (ctx, partyIds, personId) =>
  await initQuery(ctx)
    .from('PartyMember')
    .whereIn('partyId', partyIds)
    .andWhere({ personId })
    .update({ endDate: now().toJSON(), modified_by: ctx.authUser && ctx.authUser.id });

export const loadPartiesByPersonIds = async (ctx, personIds, includedPartyStatesArray = partyWfStatesSubset.active) => {
  const includeClosedParties = includedPartyStatesArray.includes(DALTypes.WorkflowState.CLOSED);
  const partyIds = await getPartyIdsByPersonIds(ctx, personIds, includeClosedParties);
  return await loadParties(ctx, includedPartyStatesArray, q => q.whereIn('Party.id', partyIds));
};

export const getImportedPartiesWithoutActivity = async (ctx, propertyIds, activityDate) => {
  const query = `
    SELECT p."id",
      p."assignedPropertyId",
      pro."displayName"
    FROM db_namespace."Party" as p
    INNER JOIN db_namespace."Property" as pro ON p."assignedPropertyId" = pro."id"
    WHERE p."assignedPropertyId" IN (${propertyIds.map(id => `'${id}'`).join(',')})
    AND p."endDate" IS NULL
    AND date_trunc('day', (p."metadata"->>'firstContactedDate')::TIMESTAMP) < date_trunc('day', :activityDate::TIMESTAMP AT TIME ZONE pro."timezone")
    AND p."metadata"->>'creationType' = :creationType
    AND NOT EXISTS
    (SELECT c."id"
    FROM db_namespace."Communication" as c
    WHERE c."type" = :communicationType
      AND c."parties" @> array[p."id"::CHARACTER varying(36)]
      AND NULLIF(c."message"->>'eventDateTime', '') IS NOT NULL
      AND date_trunc('day', (c."message"->>'eventDateTime')::TIMESTAMP) >= date_trunc('day', :activityDate::TIMESTAMP AT TIME ZONE pro."timezone"))
    AND NOT EXISTS
    (SELECT t."id"
    FROM db_namespace."Tasks" as t
    WHERE "category" = :category
      AND t."partyId" = p."id"
      AND t."dueDate" IS NOT NULL
      AND date_trunc('day', t."dueDate") >= date_trunc('day', :activityDate::TIMESTAMP AT TIME ZONE pro."timezone"))
    ORDER BY pro."displayName" ASC
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      creationType: DALTypes.PartyCreationTypes.IMPORT,
      category: DALTypes.TaskCategories.APPOINTMENT,
      communicationType: DALTypes.CommunicationMessageType.CONTACTEVENT,
      activityDate,
    },
  ]);

  return rows;
};

export const updatePartyMetadata = async (ctx, partyId, metadata) =>
  await initQuery(ctx)
    .from('Party')
    .where({ id: partyId })
    .update({
      metadata,
      modified_by: ctx.authUser && ctx.authUser.id,
    });

// We ingore the timezone in the above clause, since it was decided that it doesn't matter at the scale of 30 days.
export const getPartiesToReassignFromInactiveUser = async (ctx, userId, teamId) => {
  const { rows } = await rawStatement(
    ctx,
    `
      SELECT p.* FROM db_namespace."Party" p
        INNER JOIN db_namespace."Property" prop ON prop.id = p."assignedPropertyId"
      WHERE p."userId" = :userId
        AND p."ownerTeam" = :ownerTeam
        AND prop."endDate" IS NULL
        AND (p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
          OR (p."endDate" IS NOT NULL AND (p."endDate" > now() - interval '30 days'))
          OR (p."endDate" IS NOT NULL AND EXISTS (SELECT 1 from db_namespace."UnreadCommunication" uc WHERE p.id = uc."partyId"))
        )
      `,
    [
      {
        userId,
        ownerTeam: teamId,
      },
    ],
  );

  return rows;
};

export const getOwnersForParties = async (ctx, partyIds) => await initQuery(ctx).from('Party').select('id', 'userId').whereIn('id', partyIds);

export const getOwnerTeamsForParties = async (ctx, partyIds) => {
  const { rows } = await rawStatement(
    ctx,
    `
      SELECT p.id, p."ownerTeam", p."workflowName", t."module" FROM db_namespace."Party" p
      INNER JOIN db_namespace."Teams" t on p."ownerTeam" = t.id
      WHERE ARRAY[p.id::varchar(36)] <@ :partyIds
      `,
    [
      {
        partyIds,
      },
    ],
  );

  return rows;
};

export const getOwnersForPartiesWithNames = async (ctx, partyIds) => {
  const { rows } = await rawStatement(
    ctx,
    `
      SELECT p.id, p."userId", u."fullName" FROM db_namespace."Party" p
      JOIN  db_namespace."Users" u on p."userId" = u.id
      WHERE ARRAY[p.id::varchar(36)] <@ :partyIds
      `,
    [
      {
        partyIds,
      },
    ],
  );

  return rows;
};

export const getPartyBy = async (ctx, filter) => await initQuery(ctx).from('Party').where(filter).first();

export const getCollaboratorsForParties = async (ctx, partyIds) => {
  const rows = await initQuery(ctx).from('Party').columns('collaborators').whereIn('id', partyIds);

  if (rows) {
    return uniq(flattenDeep(rows.map(row => row.collaborators)));
  }

  return [];
};

export const getLeaseTypeByPartyId = async (ctx, partyId) => {
  const { leaseType } = (await getOne(ctx, 'Party', partyId, {}, ['leaseType'])) || {};
  return leaseType;
};

export const isCorporateLeaseType = async (ctx, partyId) => {
  const leaseType = await getLeaseTypeByPartyId(ctx, partyId);
  return leaseType === DALTypes.PartyTypes.CORPORATE;
};

export const getTeamsForParties = async (ctx, partyIds) => {
  const parties = await loadPartiesByIds(ctx, partyIds);
  const teams = uniq(flattenDeep(parties.map(party => party.teams)));
  return teams;
};

export const getTeamsAllowedToModifyParty = async (ctx, partyId) => {
  const query = `SELECT distinct(tm."teamId") FROM db_namespace."Party" p
                 LEFT JOIN db_namespace."Users" u ON ARRAY[u.id] <@ p.collaborators
                 INNER JOIN db_namespace."TeamMembers" tm ON tm."userId" = u.id
                 WHERE p.id = :partyId;`;
  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows.map(r => r.teamId);
};

export const getOwnerTeamByPartyId = async (ctx, partyId) => {
  const query = `SELECT t.* FROM db_namespace."Party" p
                 INNER JOIN db_namespace."Teams" t ON t.id = p."ownerTeam"
                 WHERE p.id = :partyId;`;
  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows && rows[0];
};

export const getTimezoneForParty = async (ctx, partyId) => {
  const res = await initQuery(ctx)
    .from('Party')
    .join('Property', 'Party.assignedPropertyId', 'Property.id')
    .where('Party.id', partyId)
    .select('Property.timezone')
    .first();

  return (res || {}).timezone;
};

export const getPartyStateData = async (ctx, partyId, activeLeasePartyId) => {
  const quotesCTEName = 'quotes';
  const quotesJsonCTE = createJsonCteFromQuery({
    query: `SELECT *
            FROM :tenantId:."Quote"
            WHERE "partyId" = :partyId`,
    cteName: quotesCTEName,
    jsonName: 'partyQuotes',
    isFirstCte: true,
  });

  const promotionsCTEName = 'promotions';
  const quotePromotionsJsonCTE = createJsonCteFromQuery({
    query: `SELECT ${formatColumnsToSelect({ columns: partyQuotePromotionsFields, format: '"{0}"' })}
            FROM :tenantId:."PartyQuotePromotions"
            WHERE "partyId" = :partyId`,
    cteName: promotionsCTEName,
    jsonName: 'quotePromotions',
    isFirstCte: false,
  });

  const leasesCTEName = 'leases';
  const leasesJsonCTE = createJsonCteFromQuery({
    query: `${require('./leaseRepo').getPartyLeaseQuery(ctx)} WHERE "partyId" = :partyId`, // eslint-disable-line global-require
    cteName: leasesCTEName,
    jsonName: 'partyLeases',
    isFirstCte: false,
  });

  const tasksCTEName = 'tasks';
  const tasksJsonCTE = createJsonCteFromQuery({
    query: `SELECT *
            FROM :tenantId:."Tasks"
            WHERE "partyId" = :partyId`,
    cteName: tasksCTEName,
    jsonName: 'partyTasks',
    isFirstCte: false,
  });

  const activeLeaseDataCTEName = 'activeLeaseData';
  const activeLeaseDataJsonCTE = createJsonCteFromQuery({
    query: `SELECT *
            FROM :tenantId:."ActiveLeaseWorkflowData"
            WHERE "partyId" = :activeLeasePartyId`,
    cteName: activeLeaseDataCTEName,
    jsonName: 'activeLeaseData',
    isFirstCte: false,
  });

  const {
    rows: [row],
  } = await (ctx.trx || knex).raw(
    `
    ${quotesJsonCTE},
    ${quotePromotionsJsonCTE},
    ${leasesJsonCTE},
    ${tasksJsonCTE},
    ${activeLeaseDataJsonCTE}
    SELECT q.* , p.*, l.*, t.*, ald.* FROM ${quotesCTEName} q, ${promotionsCTEName} p, ${leasesCTEName} l, ${tasksCTEName} t, "${activeLeaseDataCTEName}" ald;`,
    { tenantId: ctx.tenantId, partyId, activeLeasePartyId, voided: DALTypes.LeaseSignatureStatus.VOIDED, signed: DALTypes.LeaseSignatureStatus.SIGNED },
  );

  const { partyQuotes, quotePromotions, partyLeases, partyTasks, activeLeaseData } = row || {};
  const partySettings = await getPartySettings(ctx);
  return {
    partyQuotes: partyQuotes || [],
    quotePromotions: quotePromotions || [],
    partyLeases: partyLeases || [],
    partyTasks: partyTasks || [],
    activeLeaseData: activeLeaseData?.[0] || {},
    partySettings,
  };
};

export const getPartyIdsByMemberType = async (ctx, type = DALTypes.MemberType.GUARANTOR) => {
  const query = `SELECT distinct(p.id) FROM db_namespace."Party" p
               INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = p.id
               WHERE pm."memberType" = :type;`;
  const { rows } = await rawStatement(ctx, query, [{ type }]);
  return rows.map(r => r.id);
};

export const getActivePartyIdsByPersonId = async (ctx, personId) => {
  const query = `SELECT
      party.id AS "partyId"
    FROM db_namespace."Party" party
    INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = party.id
    INNER JOIN db_namespace."Person" person ON person.id = pm."personId"
    WHERE person.id = :personId
    AND pm."endDate" IS NULL
    AND party."endDate" IS NULL
    AND party."mergedWith" IS NULL;`;

  const { rows } = await rawStatement(ctx, query, [{ personId }]);

  return rows.map(res => res.partyId);
};

export const saveFirstCompletedTourData = async (ctx, partyId, appointmentInventory) => {
  logger.trace({ ctx, partyId, inventoryId: appointmentInventory.inventoryId }, 'saveFirstCompletedTourData');

  return await rawStatement(
    ctx,
    `
    UPDATE db_namespace."Party"
      SET metadata = jsonb_set(metadata, '{appointmentInventory}', :appointmentInventory)
      WHERE id = :partyId;
    `,
    [{ partyId, appointmentInventory }],
  );
};

export const getEligibleRenewalMovingOutPartyIdsToArchive = async ctx => {
  const query = `
  SELECT party.id FROM db_namespace."Party" party
    INNER JOIN db_namespace."ActiveLeaseWorkflowData" activeLease ON activeLease."partyId" = party."seedPartyId"
    WHERE party."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
      AND activeLease.state = '${DALTypes.ActiveLeaseState.MOVING_OUT}'
      AND (activeLease."metadata" ->> 'vacateDate')::TIMESTAMPTZ < NOW()`;

  const { rows } = await rawStatement(ctx, query);

  return rows.map(({ id }) => id);
};

export const getCorrespondingRenewalPartyMember = async (ctx, personId) => {
  const query = `
  SELECT *
  FROM db_namespace."PartyMember" pm
  WHERE pm."personId" = :personId
    AND EXISTS
      (SELECT id FROM db_namespace."Party" AS party
      WHERE party.id = pm."partyId"
        AND party."workflowName" = '${DALTypes.WorkflowName.RENEWAL}')`;

  const { rows } = await rawStatement(ctx, query, [{ personId }]);

  return rows[0];
};

export const getChildIdByPartyIdAndInfo = async (ctx, { partyId, info }) => {
  const query = `
    SELECT id FROM db_namespace."Party_AdditionalInfo"
      WHERE "partyId" = :partyId
      AND type = '${DALTypes.AdditionalPartyMemberType.CHILD}'
      AND info ->> 'fullName' = :fullName
      AND info ->> 'preferredName' = :preferredName`;

  const { rows } = await rawStatement(ctx, query, [{ partyId, fullName: info.fullName, preferredName: info.preferredName }]);
  return rows[0]?.id;
};

// eslint-disable-next-line
export const getPartyByIdQuery = (ctx, partyId) =>
  knex.raw(
    prepareRawQuery(
      `
      SELECT
      p.id,
      p."partyGroupId",
      p."seedPartyId",
      p."emailIdentifier",
      json_agg(
        json_build_object(
          'applicationData',  pa."applicationData"
          )
        ) FILTER (WHERE pa.id IS NOT NULL) AS "applications"
      FROM db_namespace."Party" AS p
      LEFT JOIN db_namespace."rentapp_PersonApplication" AS pa ON p.id = pa."partyId"
      WHERE p.id = :partyId
      AND pa."endedAsMergedAt" is null
      GROUP BY p.id
      LIMIT 1
  `,
      ctx.tenantId,
    ),
    { partyId },
  );

export const setPartyMembersEndDateFromVacateDate = async ctx => {
  const query = `
  WITH vacated_party_members AS(
    UPDATE db_namespace."PartyMember"
      SET	"endDate" = "vacateDate"
      WHERE "vacateDate" <= NOW()
      AND "endDate" IS NULL
      AND NOT EXISTS
        (SELECT id
        FROM db_namespace."Party" AS party
        WHERE party.id="partyId"
        AND party."workflowName" = '${DALTypes.WorkflowName.RENEWAL}')
      RETURNING * ),
  external_info_updates AS (
    UPDATE db_namespace."ExternalPartyMemberInfo" epi
      SET	"endDate" = "vacateDate"
      FROM vacated_party_members vpm
      WHERE vpm.id = epi."partyMemberId" )
  SELECT id, "vacateDate", "endDate" FROM vacated_party_members`;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getRenewalPartyIdBySeedPartyId = async (ctx, seedPartyId) => {
  const query = `
    SELECT p.id
    FROM db_namespace."Party" p
    WHERE p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND p."seedPartyId" = :seedPartyId
      LIMIT 1
    `;

  const { rows } = await rawStatement(ctx, query, [{ seedPartyId }]);
  return rows[0] && rows[0].id;
};

export const getSeededPartyByParentId = async (ctx, parentPartyId) => {
  const query = `
    WITH parentParty as (select p2.id ,p2."partyGroupId"
      FROM db_namespace."Party" as p2
      WHERE p2.id = :parentPartyId
    )
    SELECT * FROM db_namespace."Party" p
    WHERE p."partyGroupId" IN (SELECT "partyGroupId" FROM parentParty)
      AND p."seedPartyId" = :parentPartyId
      LIMIT 1
  `;
  const { rows } = await rawStatement(ctx, query, [{ parentPartyId }]);
  return rows[0];
};

export const setPartyMemberVacateDate = async (ctx, memberId, vacateDate) => {
  const query = `
  UPDATE db_namespace."PartyMember" SET "vacateDate" = :vacateDate, "endDate" = NULL
    WHERE "id" = :memberId
  RETURNING id, "vacateDate", "endDate" `;

  const { rows } = await rawStatement(ctx, query, [{ vacateDate, memberId }]);
  return rows;
};

export const getActivePartyIdsByPersonIdsAndPropertyId = async (ctx, personIds, propertyId) => {
  const query = `SELECT
      party.id AS "partyId"
    FROM db_namespace."Party" party
    INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = party.id
    INNER JOIN db_namespace."Person" person ON person.id = pm."personId"
    WHERE ARRAY[person.id::varchar(36)] <@ :personIds
    AND pm."endDate" IS NULL
    AND party."endDate" IS NULL
    AND party."mergedWith" IS NULL
    AND party."assignedPropertyId" = :propertyId;`;

  const { rows } = await rawStatement(ctx, query, [{ personIds, propertyId }]);

  return (rows || []).map(res => res.partyId);
};

export const getActiveLeaseIdByRenewalPartyId = async (ctx, renewalPartyId) => {
  const query = `
    SELECT "seedPartyId"
    FROM db_namespace."Party" p
    WHERE p."id" = :renewalPartyId
    `;

  const { rows } = await rawStatement(ctx, query, [{ renewalPartyId }]);

  return rows[0] && rows[0].seedPartyId;
};

export const updateLeaseTypeQuestionForActiveLease = async (ctx, activeLeaseId, leaseTypeAnswer) => {
  logger.trace({ ctx, partyId: activeLeaseId, leaseTypeAnswer }, 'updateActiveLeaseLeaseTypeQuestion');

  await rawStatement(
    ctx,
    `
    UPDATE db_namespace."Party"
      SET "qualificationQuestions" = jsonb_set("qualificationQuestions", '{groupProfile}', to_jsonb(:leaseTypeAnswer::text))
      WHERE id = :activeLeaseId
    `,
    [
      {
        activeLeaseId,
        leaseTypeAnswer,
      },
    ],
  );
};

export const getActivePartyIdsByPersonIdsPropertyIdAndState = async (ctx, personIds, propertyId, states) => {
  const stateFilter = states
    ? `AND ( party.state IN (${states.map(state => `'${state}'`).join(',')})
  OR party."workflowName"  = '${DALTypes.WorkflowName.RENEWAL}' )
  `
    : '';

  const query = `SELECT
    party.id AS "partyId"
    FROM db_namespace."Party" party
    INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = party.id
    INNER JOIN db_namespace."Person" person ON person.id = pm."personId"
    WHERE ARRAY[person.id::varchar(36)] <@ :personIds
    AND pm."endDate" IS NULL
    AND party."workflowState"  = '${DALTypes.WorkflowState.ACTIVE}'
    AND party."mergedWith" IS NULL
    AND party."assignedPropertyId" = :propertyId
    ${stateFilter}
    ;`;

  const { rows } = await rawStatement(ctx, query, [{ personIds, propertyId }]);

  return (rows || []).map(res => res.partyId);
};

export const getPartyIdsByPersonIdsPropertyIdAndState = async (ctx, personIds, propertyId, states) => {
  logger.trace({ ctx, personIds, propertyId, states }, 'getPartyIdsByPersonIdsPropertyIdAndState');

  const partyFilter = states
    ? `AND (party.state IN (${states.map(state => `'${state}'`).join(',')}) OR party."workflowName" = '${DALTypes.WorkflowName.RENEWAL}')`
    : '';

  const query = `SELECT
    party.id AS "partyId"
    FROM db_namespace."Party" party
    INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = party.id
    INNER JOIN db_namespace."Person" person ON person.id = pm."personId"
    WHERE ARRAY[person.id::varchar(36)] <@ :personIds
    AND party."assignedPropertyId" = :propertyId
    ${partyFilter}
    ;`;

  const { rows } = await rawStatement(ctx, query, [{ personIds, propertyId }]);

  return (rows || []).map(res => res.partyId);
};

export const getPromotedQuotesInformationByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getPromotedQuotesInformationByPartyId');

  const query = `SELECT
    l.id, rs."applicationDecision", pqp."promotionStatus", p."leaseType", pqp.created_at, u."fullName" as user, 
    l."baselineData"->'additionalConditions'->'additionalNotes' AS notes,
    l."baselineData"->'additionalConditions'->'additionalDeposit' AS "additionalDeposit",
    l."baselineData"->'additionalConditions'->'additionalDepositAmount' AS "additionalDepositAmount",
    l."baselineData"->'additionalConditions'->'additionalDepositDecision' AS "additionalDepositDecision",
    l."baselineData"->'additionalConditions'->'sureDeposit' AS "sureDeposit",
    l."baselineData"->'additionalConditions'->'npsRentAssurance' AS "npsRentAssurance"
    FROM db_namespace."PartyQuotePromotions" pqp
    INNER JOIN db_namespace."Users" u 
    ON u.id  = ( CASE WHEN (pqp."approvedBy" IS NOT NULL ) THEN pqp."approvedBy" ELSE (pqp.modified_by ) END)
    LEFT JOIN db_namespace."Lease" l 
    ON l."quoteId"  = ( CASE WHEN  (pqp."approvedBy" IS NOT NULL ) THEN pqp."quoteId" ELSE (pqp.modified_by ) END)
    INNER JOIN db_namespace."Party" p on p.id = pqp."partyId" 
    inner JOIN db_namespace."rentapp_SubmissionRequest" rsr on rsr."quoteId" = pqp."quoteId"
    inner JOIN db_namespace."rentapp_SubmissionResponse" rs on rs."submissionRequestId" = rsr.id
    AND pqp."partyId" = :partyId 
  `;
  return await rawStatement(ctx, query, [{ partyId }]);
};

export const getPartiesByWorkflowAndState = async (ctx, workflowName, workflowState) => {
  logger.trace({ ctx, workflowName, workflowState }, 'getPartiesByWorkflowAndState');

  const query = `SELECT *
    FROM db_namespace."Party" p
    WHERE "workflowName" = :workflowName 
    AND "workflowState" = :workflowState `;

  const { rows } = await rawStatement(ctx, query, [{ workflowName, workflowState }]);
  return rows || [];
};

export const getOriginPartyIdByPartyId = async (ctx, partyId) => {
  const query = `
    WITH parentParty as (select p2.id ,p2."partyGroupId"
      FROM db_namespace."Party" as p2
      WHERE p2.id = :partyId
    )
    SELECT * FROM db_namespace."Party" p
    WHERE p."partyGroupId" IN (SELECT "partyGroupId" FROM parentParty)
    AND p."seedPartyId" is null
`;
  const { rows = [] } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

export const getPartyBySeedPartyId = async (ctx, seedPartyId) => {
  const query = `
    SELECT * FROM db_namespace."Party" p
    WHERE p.id = :seedPartyId
`;
  const { rows = [] } = await rawStatement(ctx, query, [{ seedPartyId }]);
  return (rows && rows.length && rows[0]) || null;
};

export const getAllPartiesByPartyId = async (ctx, partyId) => {
  const query = `
  WITH RECURSIVE seedParties AS (
    SELECT * FROM db_namespace."Party"
    WHERE
      id = :partyId
    UNION SELECT p.*  FROM  db_namespace."Party" p
    INNER JOIN seedParties s ON s."seedPartyId" = p.id 
  ) SELECT
    *
  FROM
    seedParties;
`;
  const { rows = [] } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

export const getActivePartiesFromSoldProperties = async (ctx, propertyIds) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
    SELECT party.id FROM db_namespace."Party" AS party
      INNER JOIN db_namespace."Property" prop ON party."assignedPropertyId" = prop.id
    WHERE party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND prop."endDate" IS NOT NULL
      AND prop.id IN (${propertyIds.map(id => `'${id}'`).join(',')})
      `,
      ctx.tenantId,
    ),
  );

  return rows.map(({ id }) => id);
};

export const cancelTasksForArchivedParties = async ctx => {
  logger.trace({ ctx }, 'cancel active tasks for archived parties - start');

  await knex.raw(
    prepareRawQuery(
      `
        UPDATE db_namespace."Tasks" t
          SET state = '${DALTypes.TaskStates.CANCELED}'
          FROM db_namespace."Party" p
        WHERE p.id = t."partyId"
          AND t.state = '${DALTypes.TaskStates.ACTIVE}'
          AND p."workflowState" = '${DALTypes.WorkflowState.ARCHIVED}'
      `,
      ctx.tenantId,
    ),
  );

  logger.trace({ ctx }, 'cancel active tasks for archived parties - done');
};

export const getExternalPartyMemberInfoExternalIdsByPropertyId = async (ctx, propertyId) => {
  logger.trace({ ctx, propertyId }, 'getExternalIdsExternalPartyMemberInfoByPropertyId');

  const query = `
    SELECT DISTINCT(epmi."externalId") "externalId"
    FROM db_namespace."ExternalPartyMemberInfo" epmi
    WHERE epmi."propertyId" = :propertyId AND epmi."endDate" IS NULL
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows;
};
export const loadPartyMembersApplicantInfo = async (ctx, partyId) => {
  const query = `
  SELECT "pm".id, pm."memberState" , pm."memberType" , pm."personId", per."fullName", per."preferredName", per."dob", 
           JSON_AGG(
             json_build_object(
               'id', "ContactInfo".id,
               'type', "ContactInfo".type,
               'value', "ContactInfo".value,
               'personId', "ContactInfo"."personId",
               'isSpam', "ContactInfo"."isSpam",
               'isPrimary', "ContactInfo"."isPrimary"
             )
           ) FILTER (WHERE "ContactInfo".id IS NOT NULL) AS "contactInfo" 
           FROM db_namespace."PartyMember" pm
           INNER JOIN db_namespace."Party" p ON "pm"."partyId" = p."id"
           INNER JOIN db_namespace."Person" per ON "pm"."personId" = per."id"
           LEFT JOIN db_namespace."ContactInfo" ON per."id" = "ContactInfo"."personId"
           WHERE "pm"."endDate" IS NULL
           AND "pm"."isSpam" = false 
           AND "pm"."partyId" = :partyId
           GROUP BY "pm"."id", per."id" 
`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows ? rows.map(enhanceMemberContactInfo) : [];
};

export const getPartiesToReassignForInactiveTeams = async (ctx, teamIds) => {
  logger.trace({ ctx, teamIds }, 'getPartiesToReassignForInactiveTeams');

  const query = `
    SELECT p.*
      FROM db_namespace."Party" p
    INNER JOIN db_namespace."Teams" t ON t.id = p."ownerTeam"
    INNER JOIN db_namespace."Property" prop ON prop.id = p."assignedPropertyId"
      WHERE prop."endDate" IS NULL
      AND t."endDate" IS NOT NULL
      AND t.id IN (${teamIds.map(id => `'${id}'`).join(',')})
      AND (p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
        OR (p."endDate" IS NOT NULL AND (p."endDate" > now() - interval '30 days'))
        OR (p."endDate" IS NOT NULL AND EXISTS (SELECT 1 from db_namespace."UnreadCommunication" uc WHERE p.id = uc."partyId"))
      )
    `;

  const { rows } = await rawStatement(ctx, query, []);
  return rows || [];
};

export const createCompany = async (ctx, displayName) => {
  const company = {
    id: getUUID(),
    displayName,
  };

  return await insertInto(ctx, 'Company', company);
};

export const updateCompany = async (ctx, company) => {
  logger.trace({ ctx, company }, 'updateCompany');

  return await updateOne(ctx, 'Company', company.id, company);
};

export const updateCompanyIdForPartyMember = async (ctx, partyMemberId, newCompanyId) => {
  logger.trace({ ctx, partyMemberId, newCompanyId }, 'updateCompanyIdForPartyMember');

  const query = `
  UPDATE db_namespace."PartyMember" SET "companyId" = :newCompanyId
    WHERE "id" = :partyMemberId
  RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ partyMemberId, newCompanyId }]);
  return rows;
};

export const getCompanyByDisplayName = async (ctx, companyDisplayName) => {
  logger.trace({ ctx, companyDisplayName }, 'getCompanyByDisplayName');

  const query = `
      SELECT * FROM db_namespace."Company"
      WHERE "displayName" = :companyDisplayName
      `;
  const { rows } = await rawStatement(ctx, query, [{ companyDisplayName }]);
  return rows && rows[0];
};

export const addCompany = async (ctx, companyName) => await insertOrUpdate(ctx, 'Company', { displayName: companyName });

export const resetLegalStipulationFlag = async ctx => {
  const query = `
    UPDATE db_namespace."ActiveLeaseWorkflowData"
    SET metadata = jsonb_set(metadata, '{legalStipulationInEffect}', 'false')
    WHERE metadata ->> 'legalStipulationInEffect' = 'true'`;

  await rawStatement(ctx, query);
};

export const getPartyIdsWithActiveLeaseAndPropertyMismatch = async (ctx, propertyId) => {
  logger.trace({ ctx, propertyId }, 'getPartyIdsWithActiveLeaseAndPropertyMismatch');

  const query = `
    SELECT p.id FROM db_namespace."Party" p
    INNER JOIN db_namespace."Lease" l ON p.id = l."partyId" AND l.status IN ('${DALTypes.LeaseStatus.SUBMITTED}', '${DALTypes.LeaseStatus.EXECUTED}')
    INNER JOIN db_namespace."Inventory" i  ON i.id::text = l."baselineData" -> 'quote' ->> 'inventoryId'
    INNER JOIN db_namespace."Property" prop ON i."propertyId" = prop.id AND prop."endDate" IS NOT NULL
    WHERE i."propertyId" = :propertyId
    AND p."assignedPropertyId" != i."propertyId"
    AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows.map(({ id }) => id);
};

export const unarchiveParty = async (ctx, partyId) => {
  const updateFields = async innerCtx => {
    await removeKeyFromJSONBField({
      schema: innerCtx.tenantId,
      table: 'Party',
      tableId: partyId,
      field: 'metadata',
      key: 'archiveReasonId',
      outerTrx: innerCtx.trx,
    });

    await removeKeyFromJSONBField({
      schema: innerCtx.tenantId,
      table: 'Party',
      tableId: partyId,
      field: 'metadata',
      key: 'archiveAgentId',
      outerTrx: innerCtx.trx,
    });

    await updateParty(innerCtx, { id: partyId, archiveDate: null, modified_by: ctx.authUser && ctx.authUser.id, workflowState: DALTypes.WorkflowState.ACTIVE });
  };

  await runInTransaction(async innerTrx => await updateFields({ trx: innerTrx, ...ctx }), ctx);
  return await loadParty(ctx, partyId);
};
