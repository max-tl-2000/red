/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { knex, runInTransaction, initQuery, insertInto, insertOrUpdate, rawStatement, bulkUpsert } from '../database/factory';
import { getPropertyByName } from './propertyRepo';
import { getTeamBy } from './teamsRepo';
import { getTenantReservedPhoneNumbers, markPhoneNumberAsUsed } from './tenantsRepo';
import { PhoneOwnerType } from '../../common/enums/enums';
import { DALTypes } from '../../common/enums/DALTypes';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'programsRepo' });

export const getTeamPropertyPrograms = async (ctx, filter) => {
  const baseQuery = initQuery(ctx).from('TeamPropertyProgram');
  return filter ? await filter(baseQuery) : await baseQuery;
};

export const getOutProgramByTeamAndProperty = async (ctx, teamId, propertyId) => {
  const query = `
    WITH
      out_program AS (
        SELECT p.*, FALSE AS "default" FROM db_namespace."Programs" p
          JOIN db_namespace."TeamPropertyProgram" tpg ON p.id = tpg."programId"
          WHERE tpg."propertyId" = :propertyId
          AND tpg."teamId" = :teamId
          AND tpg."commDirection" = :commDirection
          LIMIT 1),
      default_property_program AS (
          SELECT prog.*, TRUE AS "default" FROM db_namespace."Property" pr
          JOIN db_namespace."Programs" prog ON prog.id::text = (pr.SETTINGS -> 'comms' ->> 'defaultOutgoingProgram')
          WHERE pr.id = :propertyId),
      program AS (
          SELECT * FROM out_program
          UNION
          SELECT * FROM default_property_program
          ORDER BY "default" ASC LIMIT 1)
      SELECT program.*, :teamId AS "teamId", :propertyId AS "propertyId" FROM program;`;

  const { rows } = await rawStatement(ctx, query, [{ commDirection: DALTypes.CommunicationDirection.OUT, propertyId, teamId }]);
  return rows[0];
};

export const getPrograms = async (ctx, filter) => {
  const baseQuery = initQuery(ctx).from('Programs');
  return filter ? await filter(baseQuery) : await baseQuery;
};

export const getOutPrograms = async ctx =>
  await initQuery(ctx)
    .from('Programs')
    .innerJoin('TeamPropertyProgram', 'Programs.id', 'TeamPropertyProgram.programId')
    .where('commDirection', DALTypes.CommunicationDirection.OUT);

export const getInPrograms = async ctx =>
  await initQuery(ctx)
    .from('Programs')
    .innerJoin('TeamPropertyProgram', 'TeamPropertyProgram.programId', 'Programs.id')
    .where({ 'TeamPropertyProgram.commDirection': DALTypes.CommunicationDirection.IN });

export const loadPrograms = async (ctx, { includeInactive = true, propertyIds = [], programId } = {}) => {
  const propertyFilter = propertyIds.length ? ` AND p.id IN (${propertyIds.map(id => `'${id}'`).join(',')})` : '';
  const programFilter = programId ? ' AND prg.id = :programId' : '';
  let query = `
    SELECT prg.*, p.name as "primaryProperty", p.id as "primaryPropertyId", s.name as source,
    t.id as "teamId", vm.name as "voiceMessage", t.name as team, onSiteTeam.name as "onSiteLeasingTeam"
    FROM db_namespace."Programs" prg
      INNER JOIN db_namespace."TeamPropertyProgram" tpp on tpp."programId" = prg.id
      INNER JOIN db_namespace."Sources" s on s.id = prg."sourceId"
      INNER JOIN db_namespace."Property" p on p.id = tpp."propertyId"
      INNER JOIN db_namespace."Teams" t on t.id = tpp."teamId"
      INNER JOIN db_namespace."VoiceMessages" vm on vm.id = prg."voiceMessageId"
      LEFT JOIN db_namespace."Teams" onSiteTeam on onSiteTeam.id = prg."onSiteLeasingTeamId"
    WHERE tpp."commDirection" = :commDirection ${programFilter} ${propertyFilter}`;

  if (!includeInactive) {
    query = `${query} and prg."endDate" is null`;
  }

  const { rows } = await rawStatement(ctx, query, [{ commDirection: DALTypes.CommunicationDirection.IN, programId }]);
  return rows;
};

export const loadProgramByTeamPropertyProgramId = async (ctx, id) =>
  await initQuery(ctx)
    .select(
      'Programs.*',
      'TeamPropertyProgram.*',
      'Property.name as propertyName',
      'Property.displayName as propertyDisplayName',
      'Sources.name as sourceName',
      'Sources.type as sourceType',
      'Sources.displayName as sourceDisplayName',
      'Teams.name as teamName',
      'Teams.displayName as teamDisplayName',
      'Campaigns.displayName as campaignDisplayName',
    )
    .from('Programs')
    .innerJoin('TeamPropertyProgram', 'TeamPropertyProgram.programId', 'Programs.id')
    .innerJoin('Sources', 'Sources.id', 'Programs.sourceId')
    .innerJoin('Property', 'Property.id', 'TeamPropertyProgram.propertyId')
    .innerJoin('Teams', 'Teams.id', 'TeamPropertyProgram.teamId')
    .leftJoin('Campaigns', 'Campaigns.id', 'Programs.campaignId')
    .where({ 'TeamPropertyProgram.id': id })
    .first();

export const getProgramById = async (ctx, programId) => await initQuery(ctx).from('Programs').where('id', programId).first();

export const getProgramWithPropertyById = async (ctx, programId) => {
  const query = `
    SELECT tpp."propertyId", p.*
    FROM db_namespace."Programs" p
    INNER JOIN db_namespace."TeamPropertyProgram" tpp ON (tpp."programId" = p."id" AND tpp."commDirection" = :in)
    WHERE p.id = :programId
    LIMIT 1`;
  const {
    rows: [first],
  } = await rawStatement(ctx, query, [{ programId, in: DALTypes.CommunicationDirection.IN }]);
  return first;
};

export const getSourceById = async (ctx, id) => await initQuery(ctx).from('Sources').where({ id }).first();

export const getProgramByName = async (ctx, programName) => await initQuery(ctx).from('Programs').where('name', programName).first();

// this instance is used as a query builder
// eslint-disable-next-line red/dal-async
const loadProgramByMarketingSession = ctx =>
  initQuery(ctx)
    .select(
      'Programs.*',
      'TeamPropertyProgram.id as teamPropertyProgramId',
      'TeamPropertyProgram.teamId',
      'TeamPropertyProgram.propertyId',
      'Property.timezone',
      'Sources.name as sourceName',
      'MarketingContactData.marketingSessionId',
    )
    .from('Programs')
    .innerJoin('TeamPropertyProgram', 'Programs.id', 'TeamPropertyProgram.programId')
    .innerJoin('Property', 'TeamPropertyProgram.propertyId', 'Property.id')
    .innerJoin('Sources', 'Programs.sourceId', 'Sources.id')
    .innerJoin('MarketingContactData', 'MarketingContactData.programId', 'Programs.id');

export const loadProgramByMarketingSessionEmailIdentifier = async (ctx, marketingEmailIdentifier) =>
  await loadProgramByMarketingSession(ctx).whereRaw('"MarketingContactData"."contact"->>\'emailIdentifier\' = ?', [marketingEmailIdentifier]).first();

export const loadProgramByMarketingSessionId = async (ctx, marketingSessionId) =>
  await loadProgramByMarketingSession(ctx).where({ 'MarketingContactData.marketingSessionId': marketingSessionId }).first();

const loadQueryForProgramForIncomingComm = ({ includeInactiveQuery = '' }) => `
  SELECT "Programs".*,
  "TeamPropertyProgram".id as "teamPropertyProgramId",
  "TeamPropertyProgram"."teamId",
  "TeamPropertyProgram"."propertyId",
  "Property".timezone,
  "Sources".name as "sourceName"
  FROM db_namespace."Programs"
  INNER JOIN db_namespace."TeamPropertyProgram" ON "Programs".id = "TeamPropertyProgram"."programId"
  INNER JOIN db_namespace."Property" on "TeamPropertyProgram"."propertyId" = "Property".id
  INNER JOIN db_namespace."Sources" on "Programs"."sourceId" = "Sources".id
  WHERE "TeamPropertyProgram"."commDirection" = '${DALTypes.CommunicationDirection.IN}'
  ${includeInactiveQuery}
  `;

export const loadProgramForIncomingCommById = async (ctx, id, options) => {
  const { includeInactive = false } = options || {};
  const includeInactiveQuery = !includeInactive ? 'AND ( "Programs"."endDate" IS NULL OR "Programs"."endDate" >= now() )' : '';
  const baseQuery = loadQueryForProgramForIncomingComm({ includeInactiveQuery });
  const query = ` ${baseQuery}  AND "Programs"."id" = :id;`;

  const { rows } = await rawStatement(ctx, query, [{ id }]);
  return rows[0];
};

export const loadProgramForIncomingCommByEmail = async (ctx, emailIdentifier, options) => {
  const { includeInactive = false } = options || {};
  const includeInactiveQuery = !includeInactive ? 'AND ( "Programs"."endDate" IS NULL OR "Programs"."endDate" >= now() )' : '';
  const baseQuery = loadQueryForProgramForIncomingComm({ includeInactiveQuery });
  const query = ` ${baseQuery}  AND "Programs"."directEmailIdentifier" = :emailIdentifier;`;

  const { rows } = await rawStatement(ctx, query, [{ emailIdentifier: emailIdentifier.toLowerCase() }]);
  return rows[0];
};

export const loadProgramForIncomingCommByPhone = async (ctx, phoneIdentifier, options) => {
  const { includeInactive = false } = options || {};
  const includeInactiveQuery = !includeInactive ? 'AND ( "Programs"."endDate" IS NULL OR "Programs"."endDate" >= now() )' : '';
  const baseQuery = loadQueryForProgramForIncomingComm({ includeInactiveQuery });
  const query = ` ${baseQuery} AND "Programs"."directPhoneIdentifier" = :phoneIdentifier ORDER BY "Programs"."endDate" DESC;`;

  const { rows } = await rawStatement(ctx, query, [{ phoneIdentifier }]);
  return rows[0];
};

export const loadProgramForIncomingCommByTeamPropertyProgram = async (ctx, teamPropertyProgramId, options) => {
  const { includeInactive = false } = options || {};
  const includeInactiveQuery = !includeInactive ? 'AND ( "Programs"."endDate" IS NULL OR "Programs"."endDate" >= now() )' : '';
  const baseQuery = loadQueryForProgramForIncomingComm({ includeInactiveQuery });
  const query = ` ${baseQuery}  AND "TeamPropertyProgram".id = :teamPropertyProgramId; `;

  const { rows } = await rawStatement(ctx, query, [{ teamPropertyProgramId }]);
  return rows[0];
};

export const getProgramEmailIdentifierByOutsideDedicatedEmail = async (ctx, outsideDedicatedEmail) => {
  const program = await initQuery(ctx).from('Programs').where('outsideDedicatedEmails', '@>', `{${outsideDedicatedEmail}}`).first();
  return program && program.directEmailIdentifier;
};

export const getProgramEmailIdentifierByOutsideDedicatedEmails = async (ctx, outsideDedicatedEmails) => {
  const programs = await initQuery(ctx).from('Programs');
  const program = programs.find(c => c.outsideDedicatedEmails && c.outsideDedicatedEmails.some(email => outsideDedicatedEmails.includes(email)));
  return program && program.directEmailIdentifier;
};

export const saveTeamPropertyProgram = async (ctx, program) =>
  await insertInto(ctx.tenantId, 'TeamPropertyProgram', program, {
    outerTrx: ctx.trx,
  });

export const saveOrUpdateTeamPropertyProgram = async (ctx, program) => {
  const { id = newId() } = program;
  const query = `
  INSERT INTO db_namespace."TeamPropertyProgram" (id, "teamId", "propertyId", "programId", "commDirection")
  VALUES ( :id, :teamId, :propertyId, :programId, :commDirection)
  ON CONFLICT ("teamId", "propertyId") WHERE (("commDirection")::text = 'out'::text)
  DO
   UPDATE
     SET "programId" = :programId;
  `;
  await rawStatement(ctx, query, [{ ...program, id }]);
};

export const saveProgramReferrers = async (ctx, programReferrers) => bulkUpsert(ctx, 'ProgramReferrers', programReferrers);

export const saveProgramReferrer = async (ctx, { currentUrl, referrerUrl, ...referrerData }) => {
  const escapedReferrer = {
    currentUrl: knex.raw(':param1', { param1: currentUrl }),
    referrerUrl: knex.raw(':param2', { param2: referrerUrl }),
    ...referrerData,
  };

  const existingReferrer = await initQuery(ctx).from('ProgramReferrers').where({ order: referrerData.order }).first();

  if (existingReferrer) {
    const [res] = await initQuery(ctx).from('ProgramReferrers').update(escapedReferrer).where({ id: existingReferrer.id }).returning('*');
    return res;
  }

  const [res] = await initQuery(ctx)
    .insert({ id: newId(), ...escapedReferrer })
    .into('ProgramReferrers')
    .returning('*');

  return res;
};

export const getProgramReferrers = async ctx => await initQuery(ctx).from('ProgramReferrers');

export const saveOutgoingTeamPropertyProgram = async (ctx, teamPropertyProgram) => {
  const team = await getTeamBy(ctx, { name: teamPropertyProgram.team });
  const property = await getPropertyByName(ctx, teamPropertyProgram.property);
  const program = await getProgramByName(ctx, teamPropertyProgram.program);
  const outgoingProgram = {
    id: teamPropertyProgram.id,
    teamId: team.id,
    propertyId: property.id,
    programId: program.id,
    commDirection: DALTypes.CommunicationDirection.OUT,
  };

  await saveOrUpdateTeamPropertyProgram(ctx, outgoingProgram);
};

export const updateProgram = async (ctx, name, delta) => {
  const [row] = await initQuery(ctx).from('Programs').update(delta).where({ name }).returning('*');

  return row;
};

const shouldMarkDisplayPhoneAsUsed = (tenantReservedPhoneNumbers, programDirectPhoneNumber, programDisplayPhoneNumber) =>
  programDisplayPhoneNumber &&
  programDirectPhoneNumber !== programDisplayPhoneNumber &&
  tenantReservedPhoneNumbers.some(phone => phone.phoneNumber === programDisplayPhoneNumber);

const updateTenantReservedPhoneNumber = async (ctx, program, tenantReservedPhoneNumbers) => {
  if (program.endDate) return;

  const { directPhoneIdentifier, displayPhoneNumber } = program;
  directPhoneIdentifier &&
    (await markPhoneNumberAsUsed(ctx, ctx.tenantId, tenantReservedPhoneNumbers, PhoneOwnerType.PROGRAM, program.id, directPhoneIdentifier, ctx.trx));

  if (shouldMarkDisplayPhoneAsUsed(tenantReservedPhoneNumbers, directPhoneIdentifier, displayPhoneNumber)) {
    tenantReservedPhoneNumbers = await getTenantReservedPhoneNumbers(ctx);
    await markPhoneNumberAsUsed(ctx, ctx.tenantId, tenantReservedPhoneNumbers, PhoneOwnerType.PROGRAM, program.id, displayPhoneNumber, ctx.trx);
  }
};

export const saveProgram = async ({ ctx, program, dbProgram, teamId, propertyId }) => {
  logger.trace({ ctx, program }, 'saveProgram');

  const tenantReservedPhoneNumbers = await getTenantReservedPhoneNumbers(ctx);

  return runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const { id, endDate } = dbProgram || {};
    const isExistingProgram = !!id;
    const isEndDateAdded = isExistingProgram && program.endDate && !endDate;

    const result = await insertOrUpdate(
      innerCtx,
      'Programs',
      {
        id,
        ...(isEndDateAdded ? { ...program, endDate: null, metadata: { ...program.metadata, tentativeEndDate: program.endDate } } : program),
      },
      {
        conflictColumns: ['name'],
      },
    );

    if (!isExistingProgram) {
      const teamPropertyProgram = {
        teamId,
        propertyId,
        programId: result.id,
        commDirection: DALTypes.CommunicationDirection.IN,
      };
      await saveTeamPropertyProgram(innerCtx, teamPropertyProgram);
    }

    await updateTenantReservedPhoneNumber(innerCtx, result, tenantReservedPhoneNumbers);
    return result;
  }, ctx);
};

export const saveProgramReference = async (ctx, programReference) => {
  const query = `INSERT INTO db_namespace."ProgramReferences"
                 ("parentProgramId", "referenceProgramId", "referenceProgramPropertyId") VALUES
                 (:parentProgramId, :referenceProgramId, :referenceProgramPropertyId)`;
  await rawStatement(ctx, query, [
    {
      parentProgramId: programReference.parentProgramId,
      referenceProgramId: programReference.referenceProgramId,
      referenceProgramPropertyId: programReference.referenceProgramPropertyId,
    },
  ]);
};

export const deleteAllProgramReferences = async ctx => {
  const query = 'TRUNCATE TABLE db_namespace."ProgramReferences"';
  await rawStatement(ctx, query);
};

export const getProgramReferences = async ctx => {
  const query = 'SELECT * FROM db_namespace."ProgramReferences"';
  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getProgramReferencesByParentProgramAndPropertyIds = async (ctx, parentProgramId, propertyIds) => {
  const query = `SELECT * FROM db_namespace."ProgramReferences" cr
    JOIN db_namespace."Programs" c on cr."referenceProgramId" = c."id"
     WHERE cr."parentProgramId" = :parentProgramId AND ARRAY[cr."referenceProgramPropertyId"::varchar(36)] <@ :propertyIds`;
  const { rows } = await rawStatement(ctx, query, [{ parentProgramId, propertyIds }]);
  return rows;
};

export const getProgramsToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.filter(field => field !== 'name').map(field => `p."${field}"`);
  const foreignKeysToSelect = [
    '"Sources".name as source',
    '"VoiceMessages".name as "voiceMessage"',
    '"Property".name as "primaryProperty"',
    'teampp.name as team',
    '"Teams".name as "onSiteLeasingTeam"',
    '"Campaigns".name as campaign',
    's2.name AS "defaultMatchingSource"',
    'ARRAY(select "Property".name from db_namespace."Programs" p2 inner join db_namespace."Property" on ARRAY["Property".id] <@ p2."selectedPropertyIds" where p2.id = p.id) AS "selectedProperties"',
  ];

  const additionalFields = [
    'p."metadata"->>\'requireMatchingPath\' AS "requireMatchingPathFlag"',
    'p."metadata"->>\'defaultMatchingPath\' AS "defaultMatchingPath"',
    'p."metadata"->>\'requireMatchingSource\' AS "requireMatchingSourceFlag"',
    'p."metadata"->>\'activatePaymentPlan\' AS "activatePaymentPlan"',
    'p."metadata"->>\'gaIds\' AS "gaIds"',
    'p."metadata"->>\'gaActions\' AS "gaActions"',
    'p."metadata"->\'commsForwardingData\'->>\'forwardingEnabled\' AS "forwardingEnabledFlag"',
    'p."metadata"->\'commsForwardingData\'->>\'forwardEmailToExternalTarget\' AS "forwardEmailToExternalTarget"',
    'p."metadata"->\'commsForwardingData\'->>\'forwardCallToExternalTarget\' AS "forwardCallToExternalTarget"',
    'p."metadata"->\'commsForwardingData\'->>\'forwardSMSToExternalTarget\' AS "forwardSMSToExternalTarget"',
  ];
  const query = `
    SELECT DISTINCT p.name, ${simpleFieldsToSelect.join()}, ${foreignKeysToSelect.join()}, ${additionalFields.join()}
    FROM db_namespace."Programs" p
    INNER JOIN db_namespace."Sources" ON p."sourceId" = "Sources".id
    INNER JOIN db_namespace."VoiceMessages" ON p."voiceMessageId" = "VoiceMessages".id
    INNER JOIN db_namespace."TeamPropertyProgram" ON "TeamPropertyProgram"."programId" = p.id
    INNER JOIN db_namespace."Property" ON "TeamPropertyProgram"."propertyId" = "Property".id
    INNER JOIN db_namespace."Teams" AS teampp ON "TeamPropertyProgram"."teamId" = teampp.id
    INNER JOIN db_namespace."Teams" ON p."onSiteLeasingTeamId" = "Teams".id
    LEFT JOIN db_namespace."Campaigns" ON p."campaignId" = "Campaigns".id
    LEFT JOIN db_namespace."Sources" as s2 on p."metadata"->>'defaultMatchingSourceId' = s2.id::text
    WHERE "TeamPropertyProgram"."commDirection" = '${DALTypes.CommunicationDirection.IN}'
  `;

  const { rows } = await rawStatement(ctx, query);

  return rows;
};

export const getProgramReferrersToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `ProgramReferrers.${field}`);
  const foreignKeysToSelect = ['Programs.name as program'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx).select(allFieldsToSelect).from('ProgramReferrers').innerJoin('Programs', 'ProgramReferrers.programId', 'Programs.id');
};

export const getOutgoingCallsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `TeamPropertyProgram.${field}`);
  const foreignKeysToSelect = ['Property.name as property', 'Teams.name as team', 'Programs.name as program'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('TeamPropertyProgram')
    .innerJoin('Property', 'TeamPropertyProgram.propertyId', 'Property.id')
    .innerJoin('Teams', 'TeamPropertyProgram.teamId', 'Teams.id')
    .innerJoin('Programs', 'TeamPropertyProgram.programId', 'Programs.id')
    .whereIn('propertyId', propertyIdsToExport)
    .andWhere('commDirection', DALTypes.CommunicationDirection.OUT);
};

export const getProgramReferencesToExport = async ctx => {
  const query = `
    select
    min("Programs".name) filter (where "ProgramReferences"."parentProgramId" = "Programs".id and "Programs".name is not null) as "parentProgram",
    min("Programs".name) filter (where "ProgramReferences"."referenceProgramId" = "Programs".id and "Programs".name is not null) as "referenceProgram"
    from db_namespace."ProgramReferences"
    inner join db_namespace."Programs" on "Programs".id = "ProgramReferences"."parentProgramId" or "Programs".id = "ProgramReferences"."referenceProgramId"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getInactivePrograms = async ctx => {
  const query = `
  SELECT *
  FROM db_namespace."Programs"
  WHERE "endDate" IS NOT NULL
  AND "endDate" < now()
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getNewEndedPrograms = async ctx => {
  const query = `
  SELECT *
  FROM db_namespace."Programs"
  WHERE "endDate" IS NULL
  AND "metadata" ->> 'tentativeEndDate' IS NOT NULL
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
