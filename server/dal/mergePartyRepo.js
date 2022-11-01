/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loadPartyMembersBy } from './partyRepo';
import { knex, getAllWhere, getOne, initQuery, rawStatement } from '../database/factory';
import { prepareRawQuery } from '../common/schemaConstants';

export const getPartiesForPersons = async (ctx, partiesForPersonsData) => {
  const query = async () =>
    await knex.raw(
      prepareRawQuery(
        `
        SELECT
            DISTINCT party.id,
            party."workflowName",
            party."partyGroupId",
            (CASE WHEN count(q.id) > 0 THEN 1 ELSE 0 END) as "hasPublishedQuotes",
            (CASE WHEN count(app.id) > 0 THEN 1 ELSE 0 END) as "hasOriginalApplications"
        FROM db_namespace."PartyMember" party_member
            INNER JOIN db_namespace."Party" party ON party_member."partyId" = party.id
            INNER JOIN db_namespace."Property" prop ON party."assignedPropertyId" = prop.id
            LEFT JOIN db_namespace."Quote" q ON q."partyId" = party.id AND q."publishDate" IS NOT NULL
            LEFT JOIN db_namespace."rentapp_PersonApplication" app ON app."partyId" = party.id AND app."copiedFrom" IS NULL
        WHERE
            ARRAY [ party_member. "personId"::varchar (36) ] <@ :personIds
            AND party."endDate" IS NULL
            AND prop."partyCohortId" = :partyCohortId
            AND party."leaseType" = :leaseType
            AND NOT party."partyGroupId" = :partyGroupId
            AND NOT party."workflowState" = :excludedWorkflowState
            AND ARRAY [ party. "state"::varchar (36) ] <@ :validPartyStatesForMerge
            AND party_member."endDate" IS NULL
            AND party_member."isSpam" = false
            GROUP BY party.id, party."workflowName", party."partyGroupId";
        `,
        ctx.tenantId,
      ),
      {
        ...partiesForPersonsData,
      },
    );

  const { rows } = await loadPartyMembersBy(ctx, query);

  return rows;
};

export const getOriginalApplicationsByPartyId = async (ctx, partyId) => {
  const query = `
        SELECT *
        FROM db_namespace."rentapp_PersonApplication" rpa
        WHERE rpa."partyId" = :partyId
          AND rpa."copiedFrom" IS NULL
          AND rpa."paymentCompleted" IS TRUE
       `;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows;
};

export const saveMergePartySession = async (ctx, session) => {
  const [savedSession] = await initQuery(ctx).insert(session).into('MergePartySessions').returning('*');
  return savedSession;
};

export const getAllMergeSessions = async ctx => await getAllWhere(ctx, 'MergePartySessions', {});

export const getMergePartySession = async (ctx, sessionId) => {
  const session = await getOne(ctx, 'MergePartySessions', sessionId);
  const sessionMatches = await getAllWhere(ctx, 'MergePartyMatches', {
    sessionId,
  });

  return {
    ...session,
    matches: sessionMatches,
  };
};

export const saveMergePartyMatch = async (ctx, match) => {
  const [savedMatch] = await initQuery(ctx).insert(match).into('MergePartyMatches').returning('*');
  return savedMatch;
};

export const updateMergePartyMatch = async (ctx, matchId, delta) => {
  const [updatedMatch] = await initQuery(ctx).from('MergePartyMatches').where('id', matchId).where({ id: matchId }).update(delta).returning('*');
  return updatedMatch;
};

export const getMergePartyMatch = async (ctx, matchId) => await getOne(ctx, 'MergePartyMatches', matchId);

export const getAllPartyMembers = async (ctx, partyId, includeInactive = false) => {
  // include inactive is used only in migration file and tests for now
  let query = 'SELECT * FROM db_namespace."PartyMember" pm WHERE pm."partyId" = :partyId';
  query = includeInactive ? query : `${query} AND pm."endDate" is null`;
  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows || [];
};

export const getQuotes = async (ctx, partyId) => await initQuery(ctx).from('Quote').where({ partyId });

export const getQuotePromotions = async (ctx, partyId) => await initQuery(ctx).from('PartyQuotePromotions').where({ partyId });

export const saveMember = async (ctx, member) => {
  const [savedMember] = await initQuery(ctx).insert(member).into('PartyMember').returning('*');
  return savedMember;
};

export const saveActivityLog = async (ctx, member) => {
  const [savedLog] = await initQuery(ctx).insert(member).into('ActivityLog').returning('*');
  return savedLog;
};

export const savePartyApplication = async (ctx, application) => {
  const [partyApplication] = await initQuery(ctx).insert(application).into('rentapp_PartyApplication').returning('*');
  return partyApplication;
};

export const getPersonApplicationsByPartyId = async (ctx, partyId, { includeMerged = false, excludeRemovedMembers = false } = {}) => {
  const includeMergedFilter = !includeMerged ? 'AND pa."endedAsMergedAt" IS NULL' : '';
  const excludeRemovedMembersFilter = excludeRemovedMembers ? 'AND pm."endDate" IS NULL' : '';

  const query = `SELECT pa.*
    FROM db_namespace."rentapp_PersonApplication" pa
      INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = pa."partyId" AND pm."personId" = pa."personId"
    WHERE pa."partyId" = :partyId
      ${includeMergedFilter}
      ${excludeRemovedMembersFilter}
    ;`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows || [];
};

export const getApplicationInvoicesByPersonApplicationIds = async (ctx, personApplicationIds) =>
  await initQuery(ctx).from('rentapp_ApplicationInvoices').whereIn('personApplicationId', personApplicationIds);

export const getApplicationInvoicesByPartyApplicationId = async (ctx, partyApplicationId) =>
  await initQuery(ctx).from('rentapp_ApplicationInvoices').where({ partyApplicationId });

export const getPartyApplicationByPartyId = async (ctx, partyId) => {
  const { rows } = await rawStatement(ctx, 'SELECT * FROM db_namespace."rentapp_PartyApplication" WHERE "partyId" = :partyId;', [{ partyId }]);

  return rows && rows[0];
};

export const getPartyApplicationDocumentsByPartyApplicationId = async (ctx, partyApplicationId) => {
  const query = 'SELECT * FROM db_namespace."rentapp_partyApplicationDocuments" WHERE "partyApplicationId" = :partyApplicationId;';
  const { rows } = await rawStatement(ctx, query, [{ partyApplicationId }]);

  return rows;
};

export const getActivityLogs = async (ctx, partyId) =>
  await initQuery(ctx).from('ActivityLog').whereRaw(`"ActivityLog"."context" -> 'parties' @> '"${partyId}"'`);

const updateEntity = async (ctx, table, entity) => {
  const [updatedEntity] = await initQuery(ctx).from(table).where({ id: entity.id }).update(entity).returning('*');
  return updatedEntity;
};

const updateEntities = async (ctx, table, ids, delta) => await initQuery(ctx).from(table).whereIn('id', ids).update(delta).returning('*');

export const updateTask = async (ctx, task) => await updateEntity(ctx, 'Tasks', task);
export const updateQuote = async (ctx, quote) => await updateEntity(ctx, 'Quote', quote);
export const updatePromotion = async (ctx, quotePromotion) => await updateEntity(ctx, 'PartyQuotePromotions', quotePromotion);
export const updateParty = async (ctx, party) => await updateEntity(ctx, 'Party', party);
export const updateMember = async (ctx, member) => await updateEntity(ctx, 'PartyMember', member);
export const updateActivityLog = async (ctx, activityLog) => await updateEntity(ctx, 'ActivityLog', activityLog);

export const updatePersonApplication = async (ctx, application) => await updateEntity(ctx, 'rentapp_PersonApplication', application);

export const updatePartyApplication = async (ctx, application) => await updateEntity(ctx, 'rentapp_PartyApplication', application);

export const updateApplicationInvoice = async (ctx, applicationInvoice) => await updateEntity(ctx, 'rentapp_ApplicationInvoices', applicationInvoice);

export const updatePersonApplicationsBulk = async (ctx, applicationIds, delta) => await updateEntities(ctx, 'rentapp_PersonApplication', applicationIds, delta);

export const updatePartyApplicationDocumentsBulk = async (ctx, documentIds, delta) =>
  await updateEntities(ctx, 'rentapp_partyApplicationDocuments', documentIds, delta);

export const updateApplicationInvoicesBulk = async (ctx, invoiceIds, delta) => await updateEntities(ctx, 'rentapp_ApplicationInvoices', invoiceIds, delta);

export const getAllPartyData = async (ctx, partyId) => {
  const query = `SELECT json_build_object(
     'party', "party",
     'members', "members",
     'comms', "comms",
     'tasks', "tasks",
     'activityLogs', "activityLogs",
     'invOnHolds', "invOnHolds",
     'quotes', "quotes",
     'promotions', "promotions",
     'partyApplications', "partyApplications",
     'personApplications', "personApplications",
     'invoices', "invoices",
     'transactions', "transactions"
   ) as result
  FROM :schema:."Party" party
  LEFT JOIN LATERAL (SELECT json_agg(member) as "members"
    FROM :schema:."PartyMember" member
      WHERE member."partyId" = party.id) member ON true
  LEFT JOIN LATERAL (SELECT json_agg(comm) as "comms"
    FROM :schema:."Communication" comm
      WHERE ARRAY[party.id::varchar(36)] <@ comm.parties) comm ON true
  LEFT JOIN LATERAL (SELECT json_agg(task) as tasks
    FROM :schema:."Tasks" task
    WHERE task."partyId" = party.id) task ON true
  LEFT JOIN LATERAL (SELECT json_agg(log) as "activityLogs"
    FROM :schema:."ActivityLog" log
    WHERE context->'parties' \\? party.id::text) log ON true
  LEFT JOIN LATERAL (SELECT json_agg(invOnHold) as "invOnHolds"
    FROM :schema:."InventoryOnHold" invOnHold
      WHERE invOnHold."partyId" = party.id) invOnHold ON true
  LEFT JOIN LATERAL (SELECT json_agg(quote) as quotes
    FROM :schema:."Quote" quote
    WHERE quote."partyId" = party.id) quote ON true
  LEFT JOIN LATERAL (SELECT json_agg(promotion) as "promotions"
    FROM :schema:."PartyQuotePromotions" promotion
    WHERE promotion."partyId" = party.id) promotion ON true
  LEFT JOIN LATERAL (SELECT json_agg(partyApp) as "partyApplications"
    FROM :schema:."rentapp_PartyApplication" partyApp
    WHERE partyApp."partyId" = party.id) partyApp ON true
  LEFT JOIN LATERAL (SELECT json_agg(personApp) as "personApplications"
    FROM :schema:."rentapp_PersonApplication" personApp
    WHERE personApp."partyId" = party.id) personApp ON true
  LEFT JOIN LATERAL (SELECT json_agg(invoice) as "invoices"
    FROM :schema:."rentapp_ApplicationInvoices" invoice
    inner join :schema:."rentapp_PartyApplication" partyApp ON invoice."partyApplicationId" = partyApp.id
    WHERE partyApp."partyId" = party.id) invoice ON true
  LEFT JOIN LATERAL (SELECT json_agg(transaction) as "transactions"
    FROM :schema:."rentapp_ApplicationTransactions" transaction
    inner join :schema:."rentapp_ApplicationInvoices" invoice ON transaction."invoiceId" = invoice.id
    inner join :schema:."rentapp_PartyApplication" partyApp ON invoice."partyApplicationId" = partyApp.id
    WHERE partyApp."partyId" = party.id) transaction ON true
  WHERE party."id" = :partyId`;

  const { rows } = await knex.raw(query, { schema: ctx.tenantId, partyId });
  return rows[0].result;
};

export const getPersonApplicationDocumentsByPartyId = async (ctx, partyId) => {
  const query = `SELECT doc.* FROM db_namespace."rentapp_personApplicationDocuments" doc
  JOIN db_namespace."rentapp_PersonApplication" app ON doc."personApplicationId" = app.id
  INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = app."partyId" AND pm."personId" = app."personId"
    WHERE app."partyId" = :partyId
  AND pm."endDate" IS NULL`;
  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows;
};

export const updatePersonApplicationDocumentsWithNewApplication = async (ctx, ids, personApplicationId) => {
  const query = `
      UPDATE db_namespace."rentapp_personApplicationDocuments"
      SET "personApplicationId" = :personApplicationId
      WHERE ARRAY[id::varchar(36)] <@ :ids
      RETURNING *;
    `;

  const { rows } = await rawStatement(ctx, query, [{ ids, personApplicationId }]);
  return rows;
};

export const updateUnreadCommsWithNewPartyId = async (ctx, unreadCommIds, partyId) => {
  const query = `UPDATE db_namespace."UnreadCommunication"
                 SET "partyId" = :partyId
                 WHERE ARRAY["id"::varchar(50)] <@ :unreadCommIds`;

  const { rows } = await rawStatement(ctx, query, [{ partyId, unreadCommIds }]);
  return rows;
};
