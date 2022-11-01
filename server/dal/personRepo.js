/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import stringify from 'json-stringify-safe';
import { knex, runInTransaction, initQuery, insertInto, rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { saveContactInfo, updateContactInfoForPerson, contactInfoAggregation, getContactInfoDiff } from './contactInfoRepo';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { isEmailValid } from '../../common/helpers/validations/email';
import loggerModule from '../../common/helpers/logger';
import { prepareRawQuery, common } from '../common/schemaConstants';
import { isSuspiciousContent, removeSpaces } from './helpers/person';
import config from '../config';
import { hasOwnProp } from '../../common/helpers/objUtils';
import { isAnonymousEmail } from '../../common/helpers/anonymous-email';

const logger = loggerModule.child({ subtype: 'personRepo' });
// eslint-disable-next-line
export const getRecipientQuery = (ctx, { personId, partyId, commonUserId, quoteId = null }) => {
  if (commonUserId) {
    return knex.raw(
      prepareRawQuery(
        `
        SELECT u."fullName" FROM db_namespace."Users" u
          WHERE u.id = :commonUserId
        `,
        common.id,
      ),
      { commonUserId },
    );
  }

  return knex.raw(
    prepareRawQuery(
      `
      SELECT  r -> 'partyMemberId' as "partyMemberId",
              r -> 'quotePropertyId' as "quotePropertyId",
              r -> 'commonUser' as "commonUser",
              r -> 'personApplicationId' as "personApplicationId"
      FROM json_build_object(
      'partyMemberId', (SELECT pm.id FROM db_namespace."PartyMember" pm
                         WHERE pm."personId" = :personId AND pm."partyId" = :partyId AND pm."endDate" is null),

      'quotePropertyId', (SELECT p.id FROM db_namespace."Quote" q
                            INNER JOIN db_namespace."Inventory" i ON q."inventoryId" = i.id
                            INNER JOIN db_namespace."Property" p ON p.id = i."propertyId"
                            WHERE q.id = :quoteId),

      'commonUser', (SELECT row_to_json(u.*) FROM :commonSchema:."Users" u
                     INNER JOIN :commonSchema:."UserPerson" up ON up."userId" = u.id
                       AND up."personId" = :personId
                       AND up."tenantId" = :tenantId),

      'personApplicationId', (SELECT pa.id FROM db_namespace."rentapp_PersonApplication" pa
                              WHERE pa."personId" = :personId AND pa."partyId" = :partyId AND pa."endedAsMergedAt" is null)) as r

    `,
      ctx.tenantId,
    ),
    { personId, quoteId, tenantId: ctx.tenantId, partyId, commonSchema: common.id },
  );
};

// eslint-disable-next-line
export const getResidentQuery = (ctx, { personId, commonUserId }) => {
  if (commonUserId && !personId) {
    return knex.raw(
      prepareRawQuery(
        `
        SELECT u.email, u.id "commonUserId" FROM :commonSchema:."Users" u
          WHERE u.id = :commonUserId
        `,
        common.id,
      ),
      { commonUserId, commonSchema: common.id },
    );
  }

  const query = `SELECT u.email, up."personId", up."userId" "commonUserId"
         FROM :commonSchema:."Users" u
         INNER JOIN :commonSchema:."UserPerson" up ON up."userId" = u.id AND up."personId" = :personId AND up."tenantId" = :tenantId`;

  return knex.raw(prepareRawQuery(query, ctx.tenantId), { personId, tenantId: ctx.tenantId, commonSchema: common.id });
};

export const getPersonsByFullName = async (ctx, nameWithMiddleInitial, nameWithoutMiddleInitial) => {
  logger.trace({ ctx, nameWithMiddleInitial, nameWithoutMiddleInitial }, 'getPersonsByFullName');
  const middleInitialFilter = nameWithMiddleInitial !== nameWithoutMiddleInitial ? 'OR "fullName" ILIKE :nameWithMiddleInitial' : '';
  const query = `
      SELECT * FROM db_namespace."Person"
      WHERE "fullName" ILIKE :nameWithoutMiddleInitial
      ${middleInitialFilter}
      `;
  const { rows } = await rawStatement(ctx, query, [{ nameWithoutMiddleInitial, nameWithMiddleInitial }]);
  return rows;
};

export const getPersonsWithoutContactInfo = async ctx => await initQuery(ctx).from('Person').select();

export const getPersons = async (ctx, filter) => {
  const strongMatchesQuery = `
  LEFT JOIN LATERAL (
  SELECT COUNT("PersonStrongMatches".*) AS "strongMatchCount"
  FROM db_namespace."PersonStrongMatches"
  WHERE ("PersonStrongMatches"."firstPersonId" = "Person"."id" OR "PersonStrongMatches"."secondPersonId" = "Person"."id") AND "PersonStrongMatches"."status" = '${DALTypes.StrongMatchStatus.NONE}') "strongMatches" ON true`;
  const query = initQuery(ctx)
    .select('Person.*', contactInfoAggregation(), knex.raw('"strongMatches"."strongMatchCount"'))
    .from('Person')
    .leftJoin('ContactInfo', 'ContactInfo.personId', 'Person.id')
    .joinRaw(prepareRawQuery(strongMatchesQuery, ctx.tenantId))
    .groupByRaw('"Person".id, "strongMatches"."strongMatchCount"')
    .orderBy('Person.updated_at', 'desc');

  const result = filter ? await filter(query) : await query;
  if (!result) return result;

  const enhanceContactInfoWithIsAnonymousEmail = m => {
    const contactInfo = (m.contactInfo || []).map(ci => {
      if (ci.type === DALTypes.ContactInfoType.EMAIL) {
        ci.isAnonymous = isAnonymousEmail(ci.value);
      }
      return ci;
    });
    return {
      ...m,
      contactInfo: enhance(contactInfo),
    };
  };
  return Array.isArray(result) ? result.map(enhanceContactInfoWithIsAnonymousEmail) : enhanceContactInfoWithIsAnonymousEmail(result);
};

export const getRawLeadsPersons = async ctx => {
  const partyMembers = await initQuery(ctx).select('PartyMember.*').from('PartyMember').where({ memberState: DALTypes.PartyStateType.CONTACT });
  const idValues = partyMembers.map(member => member.personId);
  const filter = q => q.whereIn('Person.id', idValues);
  return await getPersons(ctx, filter);
};

export const getPersonById = (ctx, id) => getPersons(ctx, q => q.where({ 'Person.id': id }).first());

export const getPersonByEmailAddress = (ctx, emailAddress) => getPersons(ctx, q => q.where({ 'ContactInfo.value': emailAddress.toLowerCase() }).first());

export const getPersonsByIds = (ctx, ids) => getPersons(ctx, q => q.whereIn('Person.id', ids));

export const getPersonsByPartyMemberIds = async (ctx, partyMemberIds) => {
  const query = `
    SELECT p.* FROM db_namespace."Person" p
      INNER JOIN db_namespace."PartyMember" pm ON p.id = pm."personId"
      WHERE ARRAY[pm.id] <@ :partyMemberIds`;

  const { rows } = await rawStatement(ctx, query, [{ partyMemberIds }]);

  return rows;
};

export const addPersonsToResidents = async (ctx, personIds, meta = {}) => {
  logger.trace({ personIds }, 'add person to ExistingResidents table');
  const userName = ctx.authUser.fullName;
  const metadata = { userName, ...meta };
  return await insertInto(
    ctx.tenantId,
    'ExistingResidents',
    personIds.map(personId => ({ personId, metadata })),
    { outerTrx: ctx.trx },
  );
};

export const getExistingResidentsByPersonIds = async (ctx, ids) => await initQuery(ctx).from('ExistingResidents').whereIn('personId', ids);

export const deleteExistingResidents = async (ctx, personIds) => await initQuery(ctx).from('ExistingResidents').whereIn('personId', personIds).del();

export const createPerson = async (ctx, body, imported = false) => {
  const { fullName, contactInfo } = body;
  const personId = getUUID();

  const create = async innerCtx => {
    const idType = DALTypes.PersonIdType.STATE;

    const person = {
      id: personId,
      fullName: removeSpaces(fullName),
      idType,
      modified_by: ctx.authUser && ctx.authUser.id,
    };

    hasOwnProp(body, 'companyName') && Object.assign(person, { companyName: body.companyName });
    hasOwnProp(body, 'preferredName') && Object.assign(person, { preferredName: body.preferredName });

    await initQuery(innerCtx).insert(person).into('Person').returning('*');

    if (contactInfo && contactInfo.all.length) {
      await saveContactInfo(innerCtx, contactInfo.all, personId, imported);
    }
  };

  await runInTransaction(async trx => await create({ trx, ...ctx }), ctx);
  return await getPersonById(ctx, personId);
};

export const updatePerson = async (ctx, id, payload) => {
  logger.trace({ ctx, id, updatePersonPayload: stringify(payload) }, 'updatePerson');
  const { contactInfo } = payload;

  const update = async innerCtx => {
    if (contactInfo) {
      const contactInfoDiff = await getContactInfoDiff(ctx, contactInfo.all, id);
      await updateContactInfoForPerson(innerCtx, contactInfoDiff, id);
    }

    const person = {
      fullName: removeSpaces(payload.fullName),
      dob: payload.dob,
      isSuspiciousContent: isSuspiciousContent(config.app.party.forbiddenLegalNames, payload.fullName),
      ssn: payload.ssn,
      modified_by: ctx.authUser && ctx.authUser.id,
    };

    hasOwnProp(payload, 'companyName') && Object.assign(person, { companyName: payload.companyName });
    hasOwnProp(payload, 'preferredName') && Object.assign(person, { preferredName: payload.preferredName });

    if (Object.values(person).every(v => typeof v === 'undefined') || (Object.values(person).every(v => !v) && !contactInfo)) {
      logger.warn({ ctx, id, person }, 'updatePerson: skipping DB save as object is invalid');
      return person;
    }

    return await initQuery(innerCtx).from('Person').where({ id }).update(person).returning('*');
  };

  await runInTransaction(async trx => await update({ trx, ...ctx }), ctx);

  const updatedPerson = await getPersonById(ctx, id);
  logger.trace({ ctx, id, updatedPerson }, 'updatePerson: result');
  return updatedPerson;
};

export const getPersonsBySenderData = async (ctx, from) => {
  const sanitizedFrom = from.toLowerCase().trim();
  const filter = isEmailValid(from)
    ? q =>
        q.where({
          'ContactInfo.type': 'email',
          'ContactInfo.value': sanitizedFrom,
        })
    : q =>
        q
          .where({
            'ContactInfo.type': 'phone',
            'ContactInfo.value': sanitizedFrom,
          })
          .andWhereRaw('"Person"."mergedWith" IS NULL');

  return await getPersons(ctx, filter);
};

export const markPersonAsMerged = async (ctx, basePersonId, otherPersonId) => {
  logger.trace({ ctx, basePersonId, otherPersonId }, 'markPersonAsMerged');
  await initQuery(ctx)
    .from('Person')
    .where({ id: otherPersonId })
    .update({
      mergedWith: basePersonId,
      modified_by: ctx.authUser && ctx.authUser.id,
    });

  await initQuery(ctx)
    .from('Person')
    .where({ mergedWith: otherPersonId })
    .update({
      mergedWith: basePersonId,
      modified_by: ctx.authUser && ctx.authUser.id,
    });
};

export const getLastMergeWithByPersonId = async (ctx, personId) => {
  const statement = `
    WITH RECURSIVE lastMergedPerson AS (
     SELECT id, "mergedWith", 0 as acumulator FROM db_namespace."Person" WHERE id = :personId
     UNION ALL
     SELECT p.id, p."mergedWith", acumulator + 1 FROM db_namespace."Person" p
     INNER JOIN lastMergedPerson mp ON mp."mergedWith" = p."id"
     WHERE acumulator < :maxDeepRecursive
    )
    SELECT * FROM lastMergedPerson WHERE "mergedWith" IS NULL;
  `;
  const results = await rawStatement(ctx, statement, [{ personId, maxDeepRecursive: 20 }]);
  return results && results.rows && results.rows[0];
};

export const getPersonByPersonApplicationId = async (ctx, personApplicationId) => {
  const query = `
    SELECT * FROM db_namespace."Person" p
    INNER JOIN db_namespace."rentapp_PersonApplication" pa ON pa."personId" = p.id
    WHERE pa.id = :personApplicationId
  `;
  const results = await rawStatement(ctx, query, [{ personApplicationId }]);
  return results && results.rows && results.rows[0];
};

export const getContactInfo = async (ctx, personId) => {
  const query = `
    SELECT * FROM db_namespace."ContactInfo"
    WHERE "personId" = :personId
  `;

  const results = await rawStatement(ctx, query, [{ personId }]);

  return results?.rows || [];
};

export const getPersonResidentStates = async (ctx, personId, propertyIds) => {
  logger.trace({ ctx, personId, propertyIds }, 'getPersonResidentStates');

  const assignedPropertyIdFilter = propertyIds?.length ? 'AND p."assignedPropertyId" = ANY(:propertyIds)' : '';

  const query = `
    SELECT
      p."workflowName",
      p."workflowState",
      p.state,
      pm."endDate",
      pm."vacateDate",
      pr.id "propertyId",
      pr."displayName" as "propertyName",
      pr.settings->'marketingLocation'->>'city' as "propertyCity",
      pr.settings->'marketingLocation'->>'state' as "propertyState",
      pr.settings->'rxp'->'features' as "features",
      pr.timezone as "propertyTimezone"
    FROM db_namespace."Party" p
    INNER JOIN db_namespace."PartyMember" pm ON (p.id = pm."partyId")
    INNER JOIN db_namespace."Property" pr ON (pr.id = p."assignedPropertyId")
    WHERE (
      (p."workflowName" = :workflowNameActiveLease AND p."workflowState" = :workflowStateActive AND pm."endDate" IS NULL)
      OR (p."workflowName" = :workflowNameNewLease AND p.state = :residentState)
      OR (p."workflowName" = :workflowNameActiveLease AND p."workflowState" = :workflowStateArchived)
      OR (p."workflowName" = :workflowNameActiveLease AND pm."vacateDate" IS NOT NULL)
      OR (p.state = :futureResidentState OR p.state = :leaseState)
    )
    AND pm."personId" = :personId
    ${assignedPropertyIdFilter}
  `;

  const { rows } =
    (await rawStatement(ctx, query, [
      {
        personId,
        propertyIds,
        workflowNameActiveLease: DALTypes.WorkflowName.ACTIVE_LEASE,
        workflowNameNewLease: DALTypes.WorkflowName.NEW_LEASE,
        workflowStateActive: DALTypes.WorkflowState.ACTIVE,
        workflowStateArchived: DALTypes.WorkflowState.ARCHIVED,
        residentState: DALTypes.PartyStateType.RESIDENT,
        futureResidentState: DALTypes.PartyStateType.FUTURERESIDENT,
        leaseState: DALTypes.PartyStateType.LEASE,
      },
    ])) || {};

  return rows;
};

export const filterPartyMemberPersons = async (ctx, { personIds, partyIds }) => {
  const query = `
    SELECT DISTINCT "personId"
    FROM db_namespace."PartyMember"
    WHERE ARRAY["partyId"] <@ :partyIds AND  ARRAY["personId"] <@ :personIds`;

  const { rows } = await rawStatement(ctx, query, [{ partyIds, personIds }]);

  return rows.map(r => r.personId);
};
