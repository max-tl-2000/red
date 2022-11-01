/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement, getAllWhere, getOneWhere, insertInto, insertOrUpdate, updateOne, knex, initQuery, saveJSONBData } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { loadPartyMembers } from './partyRepo';
import { ServiceError } from '../common/errors';
import { prepareRawQuery } from '../common/schemaConstants';
import { obscureLeaseSubmission } from '../services/leases/leaseFormatters';
import config from '../config';

import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subtype: 'leaseRepo' });

// eslint-disable-next-line
export const getPartyLeaseQuery = ctx => {
  // Make sure do not call knex methods in the body of the modules
  // doing that will open a connection even when this is still not
  // needed as this will be used as part of another query
  const query = prepareRawQuery(
    `
    SELECT
      id,
      "partyId",
      "quoteId",
      "leaseTermId",
      "leaseTemplateId",
      "leaseData",
      status,
      created_at,
      updated_at,
      "baselineData",
      "signDate",
      external,
      modified_by,
      "externalLeaseId",
      signatures.signatures
    FROM db_namespace."Lease" l
    LEFT JOIN LATERAL (
      SELECT json_agg(
        row_to_json(ls.*)
      ) as "signatures"
      FROM db_namespace."LeaseSignatureStatus" ls
      WHERE ls."leaseId" = l.id
      AND ls.status <> :voided
    ) signatures ON true
    `,
    ctx.tenantId,
  );
  return query;
};

export const getPartiesLeases = async (ctx, partyIds, { statusToNotMatch } = {}) => {
  const query = getPartyLeaseQuery(ctx);
  const leasesForPartyQuery = `${query}
                               WHERE ARRAY["partyId"::varchar(36)] <@ :party_ids
                               `;
  const leasesFilterQuery = statusToNotMatch
    ? `${leasesForPartyQuery}
      AND "status" <> :statusToNotMatch
      `
    : leasesForPartyQuery;

  const queryParams = {
    voided: DALTypes.LeaseSignatureStatus.VOIDED,
    party_ids: partyIds,
    statusToNotMatch,
  };
  const { rows } = await rawStatement(ctx, leasesFilterQuery, [queryParams]);
  return rows;
};

export const getPartyLeases = (ctx, partyId) => getPartiesLeases(ctx, [partyId]);

export const getLeasesThatDoNotMatchStatus = (ctx, partyId, statusToNotMatch) => getPartiesLeases(ctx, [partyId], { statusToNotMatch });

export const getLeaseById = (ctx, leaseId) => getOneWhere(ctx, 'Lease', { id: leaseId });

export const getSubmittedOrExecutedLeaseByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getSubmittedOrExecutedLeaseByPartyId');

  const { rows } = await knex.raw(
    prepareRawQuery(
      `
      SELECT * FROM db_namespace."Lease"
      WHERE status in ('${DALTypes.LeaseStatus.EXECUTED}', '${DALTypes.LeaseStatus.SUBMITTED}')
      AND "partyId" = :partyId
    `,
      ctx.tenantId,
    ),
    {
      partyId,
    },
  );

  return rows[0];
};

export const getLeaseTermById = (ctx, id) => getOneWhere(ctx.tenantId, 'LeaseTerm', { id });

export const saveLease = async (ctx, lease) =>
  await insertInto(ctx.tenantId, 'Lease', { ...lease, modified_by: ctx.authUser && ctx.authUser.id }, { outerTrx: ctx.trx });

const maskFadvCredentials = (leaseSubmissionTracking, requestOrResponse) => {
  if (!leaseSubmissionTracking[requestOrResponse]) return leaseSubmissionTracking;
  return { ...leaseSubmissionTracking, [requestOrResponse]: obscureLeaseSubmission(leaseSubmissionTracking[requestOrResponse]) };
};

const maskLeaseSubmission = leaseSubmissionTracking =>
  ['request', 'response'].reduce((acc, requestOrResponse) => maskFadvCredentials(acc, requestOrResponse), { ...leaseSubmissionTracking });

export const saveLeaseSubmission = (ctx, leaseSubmissionTracking, masking = true) =>
  insertInto(ctx.tenantId, 'LeaseSubmissionTracking', masking ? maskLeaseSubmission(leaseSubmissionTracking) : leaseSubmissionTracking);

export const updateLeaseSubmission = (ctx, leaseSubmissionTracking, masking = true) =>
  updateOne(
    ctx.tenantId,
    'LeaseSubmissionTracking',
    leaseSubmissionTracking.id,
    masking ? maskLeaseSubmission(leaseSubmissionTracking) : leaseSubmissionTracking,
  );

export const updateLease = (ctx, lease, trx) => updateOne(ctx.tenantId, 'Lease', lease.id, { ...lease, modified_by: ctx.authUser && ctx.authUser.id }, trx);

export const saveLeaseExternalId = (ctx, leaseId, externalId, trx) => updateOne(ctx.tenantId, 'Lease', leaseId, { externalLeaseId: externalId }, trx);

export const insertOrUpdateLeaseTemplate = (ctx, leaseTemplateData, masking = true) => {
  const { request, response } = leaseTemplateData;
  let obscuredLTData = request ? { ...leaseTemplateData, request: masking ? obscureLeaseSubmission(request) : request } : leaseTemplateData;
  obscuredLTData = response ? { ...obscuredLTData, response: masking ? obscureLeaseSubmission(response) : request } : obscuredLTData;

  return insertOrUpdate(ctx, 'LeaseTemplate', obscuredLTData, {
    conflictColumns: ['propertyId'],
  });
};

export const getPropertyLeaseTemplates = (ctx, propertyId) => getAllWhere(ctx, 'LeaseTemplate', { propertyId });

export const getLeaseTemplateById = async (ctx, templateId) => {
  const template = await initQuery(ctx).from('LeaseTemplate').where({ id: templateId }).first();
  return template;
};

export const deleteAllLeaseTemplates = async ctx => await initQuery(ctx).from('LeaseTemplate').del();

export const saveLeaseSignatures = (ctx, signatures) => insertInto(ctx.tenantId, 'LeaseSignatureStatus', signatures, { outerTrx: ctx.trx });

export const updateLeaseSignature = async (ctx, signature, where) =>
  await initQuery(ctx).from('LeaseSignatureStatus').where(where).update(signature).returning('*');

export const markAsSigned = async (ctx, envelopeId, clientUserId, signature) => {
  const placeholder = '?';
  return await initQuery(ctx)
    .from('LeaseSignatureStatus')
    .where({ envelopeId })
    .andWhereRaw(`"LeaseSignatureStatus"."metadata"->>'clientUserId' = ${placeholder}`, [clientUserId])
    .update(signature)
    .returning('*');
};

export const updateSignerName = async (ctx, signatureId, userName) =>
  await rawStatement(
    ctx,
    `UPDATE db_namespace."LeaseSignatureStatus"
     SET metadata = jsonb_set(metadata, '{userName}', to_jsonb(:userName::text))
     WHERE id = :signatureId`,
    [{ signatureId, userName }],
  );

export const updateCounterSignerSignature = async (ctx, signature, user) => {
  try {
    const {
      rows: [updatedSignature],
    } = await rawStatement(
      ctx,
      `UPDATE db_namespace."LeaseSignatureStatus"
       SET metadata = metadata || '{"userName": "${user.fullName}", "email": "${user.email}"}'::jsonb,
       "userId" = :userId
       WHERE id = :signatureId
       RETURNING *`,
      [{ signatureId: signature.id, userId: user.id }],
    );
    logger.trace({ ctx, updatedSignature }, 'updateCounterSignerSignature');
    return updatedSignature;
  } catch (error) {
    logger.trace({ ctx, error, signature, user }, 'updateCounterSignerSignature --error');
    throw error;
  }
};

export const updateBMPendingSignatures = async (ctx, oldEnvelopeId, clientUserId, { signUrl, newEnvelopeId }) =>
  await rawStatement(
    ctx,
    `UPDATE db_namespace."LeaseSignatureStatus"
     SET metadata = jsonb_set(metadata, '{token}', to_jsonb(:signUrl::text)),
         "signUrl" = :signUrl,
         "envelopeId" = :newEnvelopeId
     WHERE "clientUserId" = :clientUserId
      AND "envelopeId" = :oldEnvelopeId`,
    [{ clientUserId, signUrl, oldEnvelopeId, newEnvelopeId }],
  );

export const getLeaseSignatureStatuses = async (ctx, leaseId) =>
  await initQuery(ctx).from('LeaseSignatureStatus').where({ leaseId }).andWhereNot({ status: DALTypes.LeaseSignatureStatus.VOIDED });

export const deleteSignaturesForLease = async (ctx, leaseId, trx) =>
  await initQuery(ctx).from('LeaseSignatureStatus').where({ leaseId }).del().transacting(trx);

export const updateLeaseVersions = async (ctx, leaseId, version) => await saveJSONBData(ctx, 'Lease', leaseId, 'versions', version, ctx.trx);

export const getLeaseByEnvelopeId = async (ctx, envelopeId) => {
  const { leaseId } = (await initQuery(ctx).from('LeaseSignatureStatus').select('leaseId').where({ envelopeId }).first()) || {};

  if (!leaseId) {
    throw new ServiceError({
      token: 'LEASE_NO_LONGER_EXISTS',
      status: 412,
    });
  }

  return await getLeaseById(ctx, leaseId);
};

export const getLeaseSignaturesByEnvelopeId = async (ctx, envelopeId) => await initQuery(ctx).from('LeaseSignatureStatus').where({ envelopeId });

export const getLeaseSignatureById = async (ctx, signatureId) => await initQuery(ctx).from('LeaseSignatureStatus').where({ id: signatureId }).first();

export const getLeaseSignatureByEnvelopeIdAndClientUserId = async (ctx, envelopeId, clientUserId) =>
  await initQuery(ctx)
    .from('LeaseSignatureStatus')
    .where({ envelopeId })
    .andWhereRaw('"LeaseSignatureStatus"."metadata"->>\'clientUserId\' = ?', [clientUserId])
    .first();

export const getPropertyForLease = async (ctx, leaseId) =>
  await initQuery(ctx)
    .from('Property')
    .innerJoin('LeaseTemplate', 'LeaseTemplate.propertyId', 'Property.id')
    .innerJoin('Lease', 'Lease.leaseTemplateId', 'LeaseTemplate.id')
    .where('Lease.id', leaseId)
    .returning('*')
    .first();

export const getExternalPropertyIdForLease = async (ctx, leaseId) => {
  const property = await getPropertyForLease(ctx, leaseId);
  return {
    ...property.settings.lease,
    ...property.settings.integration.lease,
    revaPropertyId: property.propertyId,
    revaPropertyDisplayName: property.displayName,
  };
};

export const getStartDateForActiveLeaseByPartyId = async (ctx, partyId) => {
  const query = `
    SELECT l."baselineData" -> 'publishedLease' ->> 'leaseStartDate' as "leaseStartDate"
      FROM db_namespace."Lease" l
      WHERE l."partyId" = :partyId
      AND l.status in ('${DALTypes.LeaseStatus.EXECUTED}', '${DALTypes.LeaseStatus.SUBMITTED}')
    `;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows[0] && rows[0].leaseStartDate;
};

export const getLeaseWithStatusNotUpdated = async ctx => {
  logger.trace({ ctx }, 'getLeaseWithStatusNotUpdated');

  const { rows } = await rawStatement(
    ctx,
    `
      SELECT l.id as "leaseId", envelopes."envelopeId"
      FROM db_namespace."Lease" l
      left join lateral (
          SELECT distinct "envelopeId" as "envelopeId"
          FROM db_namespace."LeaseSignatureStatus" ls WHERE ls."leaseId" = l.id
      ) envelopes on true
      WHERE NOT EXISTS (SELECT 1 FROM db_namespace."LeaseSignatureStatus" ls WHERE ls."leaseId" = l.id AND (status not in ('${DALTypes.LeaseSignatureStatus.SIGNED}', '${DALTypes.LeaseSignatureStatus.WET_SIGNED}', '${DALTypes.LeaseSignatureStatus.VOIDED}')))
      and l.status = 'submitted'
  `,
    [],
  );

  return rows;
};

export const getDataForFetchLeaseStatus = async ctx => {
  const { periodUnit } = config.fetchLeaseStatus;

  logger.trace({ ctx, periodUnit }, 'getDataForFetchLeaseStatus');

  const { rows } = await rawStatement(
    ctx,
    `
    SELECT DISTINCT lss."leaseId", lss."envelopeId"
    FROM db_namespace."LeaseSubmissionTracking" lst
    INNER JOIN db_namespace."LeaseSignatureStatus" lss ON (lss."clientUserId" = lst."clientUserId" AND lss."leaseId" = lst."leaseId")
    INNER JOIN db_namespace."Lease" l ON lss."leaseId" = l.id
    WHERE (lst.type = :signerTrackingType OR lst.type = :countersignerTrackingType)
    AND lst.response IS NOT NULL
    AND lst.updated_at > now() - interval '${periodUnit}' hour
    AND l.status = :status
    AND (lss.status <> :voidedSignatureStatus AND lss.status <> :signedSignatureStatus AND lss.status <> :wetSignedSignatureStatus);`,
    [
      {
        signerTrackingType: DALTypes.FADVCallMethod.GET_SIGNER_TOKEN,
        countersignerTrackingType: DALTypes.FADVCallMethod.GET_COUNTERSIGNER_TOKEN,
        status: DALTypes.LeaseStatus.SUBMITTED,
        voidedSignatureStatus: DALTypes.LeaseSignatureStatus.VOIDED,
        signedSignatureStatus: DALTypes.LeaseSignatureStatus.SIGNED,
        wetSignedSignatureStatus: DALTypes.LeaseSignatureStatus.WET_SIGNED,
      },
    ],
  );

  return rows;
};

export const getLeasesForBMSyncByPropertyId = async (ctx, propertyId) => {
  logger.trace({ ctx, propertyId }, 'getLeasesForBMSyncByPropertyId');

  const { rows } = await rawStatement(
    ctx,
    `
    SELECT DISTINCT ON (lease.id) lease.*, lss."envelopeId",
        CASE WHEN (EXISTS (SELECT 1 FROM db_namespace."LeaseSignatureStatus" lss3 WHERE lss3."envelopeId" = lss."envelopeId" AND lss3.status = :wetSignedSignatureStatus)) THEN TRUE
        ELSE FALSE
          END AS "hasWetSignedEnvelope"
      FROM db_namespace."Lease" lease
      INNER JOIN db_namespace."LeaseSignatureStatus" lss ON lss."leaseId" = lease.id
      INNER JOIN db_namespace."Party" p ON p.id = lease."partyId"
      INNER JOIN db_namespace."LeaseTemplate" lt ON lt.id = lease."leaseTemplateId"
      INNER JOIN db_namespace."Property" prop ON prop.id = lt."propertyId"
        WHERE lease.status IN ('${DALTypes.LeaseStatus.EXECUTED}', '${DALTypes.LeaseStatus.SUBMITTED}')
      AND prop.id = :propertyId
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND lss.status <> :voidedSignatureStatus
      AND NOT EXISTS (
       	SELECT 1 FROM db_namespace."LeaseSignatureStatus" lss2
          WHERE lss2."envelopeId" = lss."envelopeId"
      	  AND lss2."clientUserId" LIKE '%${DALTypes.MemberType.GUARANTOR}%'
      );`,
    [
      {
        propertyId,
        voidedSignatureStatus: DALTypes.LeaseSignatureStatus.VOIDED,
        wetSignedSignatureStatus: DALTypes.LeaseSignatureStatus.WET_SIGNED,
      },
    ],
  );

  return rows;
};

export const getInventoryLeasePartyMembers = async (ctx, inventoryId) => {
  const lease = await initQuery(ctx)
    .from('Lease')
    .whereIn('status', [DALTypes.LeaseStatus.EXECUTED, DALTypes.LeaseStatus.SUBMITTED])
    .andWhereRaw('"Lease"."baselineData"->\'quote\'->>\'inventoryId\' = ?', [inventoryId])
    .first();

  const partyMembers = lease && (await loadPartyMembers(ctx, lease.partyId));

  return partyMembers || [];
};

export const getLeaseNamesToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `LeaseName.${field}`);
  const foreignKeysToSelect = ['Property.name as property'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('LeaseName')
    .innerJoin('Property', 'LeaseName.propertyId', 'Property.id')
    .whereIn('Property.id', propertyIdsToExport);
};

// eslint-disable-next-line
export const getLastExecutedLeaseByQuoteIdQuery = (ctx, quoteId, propertyId, seedPartyAllowedWorkflowStates = []) => {
  const knexQuery = knex.raw(
    prepareRawQuery(
      `
        SELECT
        COALESCE(lw."leaseData"->> 'computedExtensionEndDate', lw."leaseData"->> 'leaseEndDate') AS "leaseEndDate",
        lw."leaseData"->>'leaseTerm' AS "leaseTermLength",
        (SELECT settings -> 'residentservices' ->> 'moveoutNoticePeriod' AS "residentMoveoutNoticePeriod" FROM db_namespace."Property" WHERE id = :propertyId) AS "residentMoveoutNoticePeriod"
        FROM db_namespace."ActiveLeaseWorkflowData" lw
        INNER JOIN db_namespace."Party" p ON lw."partyId" = p."seedPartyId"
        INNER JOIN db_namespace."Party" ap ON p."seedPartyId" = ap."id"
        INNER JOIN db_namespace."Quote" q ON q."partyId" = p.id
        WHERE ARRAY[ap."workflowState" ] <@ :activeState
        AND q.id = :quoteId LIMIT 1
    `,
      ctx.tenantId,
    ),
    {
      activeState: seedPartyAllowedWorkflowStates.length ? seedPartyAllowedWorkflowStates : [DALTypes.WorkflowState.ACTIVE],
      quoteId,
      propertyId,
    },
  );
  return ctx.trx ? knexQuery.transacting(ctx.trx) : knexQuery;
};

export const getLastExecutedLeaseByInventoryId = async (ctx, inventoryId, partyId) => {
  const query = `SELECT party."partyGroupId" FROM db_namespace."Party" party WHERE party.id = '${partyId}'`;

  const { rows } = await rawStatement(
    ctx,
    `
    SELECT l."partyId",
           l."baselineData"->'publishedLease'->> 'leaseEndDate' as "leaseEndDate",
           u."fullName" as "agentName"
    FROM db_namespace."Lease" l
    INNER JOIN db_namespace."Users" u ON l.modified_by = u.id
    INNER JOIN db_namespace."Party" p ON p.id = l."partyId"
    WHERE l.status = :executedStatus
    AND l."baselineData"->'quote'->> 'inventoryId' = :inventoryId
    AND p."partyGroupId" != (${query})
    ORDER BY l.updated_at DESC
    LIMIT 1
    `,
    [
      {
        executedStatus: DALTypes.LeaseStatus.EXECUTED,
        inventoryId,
      },
    ],
  );

  return (rows || [])[0];
};

// Eligible leases for Active Lease Workflow are leases from New Lease or Renewal workflows (parties)
// that are submitted or executed and the lease start date is in the past
export const getEligibleLeasesForActiveLeaseWorkflow = async (
  ctx,
  workflowName,
  { propertyIdsFilter, partyGroupIdFilter } = {},
  externalPartyMemberInfoRequired = false,
) => {
  logger.trace({ ctx, workflowName, propertyIdsFilter, partyGroupIdFilter }, 'getEligibleLeasesForActiveLeaseWorkflow - params');

  const propertyFilter = propertyIdsFilter ? 'AND party."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND party."partyGroupId" = :partyGroupIdFilter' : '';
  const externalInfoQuery = `
    AND ((pro.settings->'integration'->'import'->>'residentData')::boolean IS FALSE
      OR EXISTS(SELECT 1 FROM db_namespace."ExternalPartyMemberInfo" AS epmi WHERE epmi."partyId" = party.id AND epmi."externalId" IS NOT NULL))
  `;

  const query = `
  SELECT DISTINCT lease.id AS "leaseId", lease."partyId", lease."baselineData", lease."externalLeaseId", lt."termLength", party."assignedPropertyId"
  FROM db_namespace."Lease" AS lease
    INNER JOIN db_namespace."Party" party on party.id = lease."partyId"
    INNER JOIN db_namespace."LeaseTerm" lt ON lease."leaseTermId" = lt.id
    ${externalPartyMemberInfoRequired ? 'INNER JOIN db_namespace."Property" pro ON party."assignedPropertyId" = pro.id AND pro."endDate" IS NULL' : ''}
    ${!externalPartyMemberInfoRequired ? 'INNER JOIN db_namespace."Property" pro ON party."assignedPropertyId" = pro.id AND pro."endDate" IS NULL' : ''}
    WHERE party."workflowName" = :workflowName
      ${propertyFilter} ${partyGroupFilter}
      AND party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND NOT EXISTS (SELECT 1 FROM db_namespace."ActiveLeaseWorkflowData" alwd WHERE alwd."leaseId" = lease.id)
      AND (lease.status = '${DALTypes.LeaseStatus.SUBMITTED}' OR lease.STATUS = '${DALTypes.LeaseStatus.EXECUTED}')
      ${externalPartyMemberInfoRequired ? externalInfoQuery : ''}
      AND ((lease."baselineData"->'publishedLease'->>'leaseStartDate')::timestamptz < now())`;

  const { rows } = await rawStatement(ctx, query, [{ workflowName, propertyIdsFilter, partyGroupIdFilter }]);

  return rows;
};

// Eligible active parties that can be archived (New Lease and Renewal workflows in this func) are the one that
// don't have any active task (excluding migrate move in documents)
// and the lease associated with the party has the lease start date < now() and lease status is executed
export const getEligibleResidentPartyIdsByWfToArchive = async (ctx, workflowName, { propertyIdsFilter, partyGroupIdFilter } = {}) => {
  logger.trace({ ctx, workflowName, propertyIdsFilter, partyGroupIdFilter }, 'getEligibleResidentPartyIdsByWfToArchive - params');

  const propertyFilter = propertyIdsFilter ? 'AND party."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND party."partyGroupId" = :partyGroupIdFilter' : '';

  const executedLeaseQuery = `AND lease.status = '${DALTypes.LeaseStatus.EXECUTED}'
                              AND (lease."baselineData"->'publishedLease'->>'leaseStartDate')::timestamptz < now()
  `;

  const query = `
    SELECT party.id FROM db_namespace."Party" AS party
      WHERE party."workflowName" = :workflowName
        AND party."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
        AND (party.state = '${DALTypes.PartyStateType.FUTURERESIDENT}' OR party.state = '${DALTypes.PartyStateType.RESIDENT}')
        ${propertyFilter} ${partyGroupFilter}
        AND NOT EXISTS (SELECT 1 FROM db_namespace."Tasks" task
          WHERE task.state = '${DALTypes.TaskStates.ACTIVE}'
          AND task."partyId" = party.id)
        AND NOT EXISTS (SELECT 1 FROM db_namespace."Lease" AS lease
          WHERE lease."partyId" = party.id
          AND lease.status = '${DALTypes.LeaseStatus.EXECUTED}'
          AND (lease."baselineData"->'publishedLease'->>'leaseStartDate')::timestamptz > now())
        AND (
              (SELECT COUNT(DISTINCT alwd."leaseId") FROM db_namespace."Party" active_lease_party
                INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON alwd."partyId" = active_lease_party.id
                INNER JOIN db_namespace."Lease" lease ON lease.id = alwd."leaseId"
              WHERE active_lease_party."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}'
                AND active_lease_party."seedPartyId" = party.id
                AND lease."partyId" = party.id
                ${executedLeaseQuery}
              ) = (SELECT count(*) FROM db_namespace."Lease" AS lease
                    WHERE lease."partyId" = party.id
                    ${executedLeaseQuery}
                  )
            );`;

  const { rows } = await rawStatement(ctx, query, [{ workflowName, propertyIdsFilter, partyGroupIdFilter }]);

  return rows && rows.map(row => row.id);
};

// Renewal parties that don't have a published quote and the current active lease end date is in the past
export const getRenewalPartyIdsWithoutPublishedQuoteToArchive = async ctx => {
  const query = `
    SELECT renewal_party.id FROM (
      SELECT p.id FROM db_namespace."Party" AS p
      INNER JOIN db_namespace."ActiveLeaseWorkflowData" alwd ON alwd."partyId" = p."seedPartyId"
        WHERE p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
        AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
        AND alwd.state <> '${DALTypes.ActiveLeaseState.MOVING_OUT}'
        AND ( ((alwd."isExtension" = FALSE OR p."metadata" ->> 'creationType' = '${DALTypes.PartyCreationTypes.SYSTEM}')
              AND (alwd."leaseData" ->> 'leaseEndDate')::timestamptz < now())
          OR (alwd."isExtension" = TRUE AND (alwd."leaseData" ->> 'computedExtensionLeaseEndDate')::timestamptz <now())
        )
      ) renewal_party
      LEFT JOIN LATERAL (
        SELECT 1 FROM db_namespace."Quote" AS q
        WHERE q."partyId" = renewal_party.ID
        AND q."publishDate" IS NOT NULL
        LIMIT 1
        ) published_quote ON TRUE
    WHERE published_quote IS NULL `;

  const { rows } = await rawStatement(ctx, query);

  return rows && rows.map(row => row.id);
};

export const getFirstLeaseSignatureByEnvelopeId = async (ctx, envelopeId) => {
  const { rows } = await rawStatement(
    ctx,
    `
    SELECT *
      FROM db_namespace."LeaseSignatureStatus"
      WHERE "envelopeId" = :envelopeId
      AND metadata->>'counterSigner' = 'false'
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [
      {
        envelopeId,
      },
    ],
  );

  return (rows || [])[0];
};

export const getRenewalLeasesToBeVoidedOnVacateDate = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, partyGroupIdFilter, propertyIdsFilter }, 'getRenewalLeasesToBeVoidedOnVacateDate - params');

  const propertyFilter = propertyIdsFilter ? 'AND p."assignedPropertyId" = ANY(:propertyIdsFilter)' : '';
  const partyGroupFilter = partyGroupIdFilter ? 'AND p."partyGroupId" = :partyGroupIdFilter' : '';

  const { rows } = await rawStatement(
    ctx,
    `SELECT l.id from db_namespace."Lease" l
      INNER JOIN db_namespace."Party" p ON l."partyId" = p.id
      INNER JOIN db_namespace."ActiveLeaseWorkflowData" a ON p."seedPartyId" = a."partyId"
      INNER JOIn db_namespace."Property" prop on p."assignedPropertyId" = prop.id AND prop."endDate" IS NULL
      WHERE p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}'
        AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
        AND l.status <> '${DALTypes.LeaseStatus.VOIDED}'
        AND a.state = '${DALTypes.ActiveLeaseState.MOVING_OUT}'
      ${propertyFilter} ${partyGroupFilter}
	`,
    [{ propertyIdsFilter, partyGroupIdFilter }],
  );
  return rows && rows.map(row => row.id);
};

export const cleanupLeaseSubmissions = async (ctx, batchSize, versionsToKeep, daysToKeep) => {
  logger.trace({ ctx, batchSize, versionsToKeep, daysToKeep }, 'cleanupLeaseSubmissionTracking');

  await knex.raw(
    prepareRawQuery(
      `
      SELECT db_namespace.cleanupleasesubmissiontracking(:batchSize, :versionsToKeep, :daysToKeep);
      `,
      ctx.tenantId,
    ),
    { batchSize, versionsToKeep, daysToKeep },
  );
};

export const getUnitNameForActiveLeaseByPartyIds = async (ctx, partyIds) => {
  const query = `
    SELECT l."baselineData" -> 'quote' ->> 'unitName' as "unitName"
      FROM db_namespace."Lease" l
      WHERE l."partyId" = ANY(:partyIds)
      AND l.status = :status;
    `;

  const { rows } = await rawStatement(ctx, query, [{ partyIds, status: DALTypes.LeaseStatus.EXECUTED }]);

  return rows;
};

export const getActiveLeaseByPartyId = async (ctx, partyId) => {
  const query = `
    SELECT l.*
      FROM db_namespace."Lease" l
      WHERE l."partyId" = :partyId
      AND l.status = :status;
    `;

  const { rows } = await rawStatement(ctx, query, [{ partyId, status: DALTypes.LeaseStatus.EXECUTED }]);

  return rows;
};

// Returns true if there is at least one wet signature in the lease
export const doesLeaseHaveWetSignedEnvelope = async (ctx, leaseId) => {
  const query = `
    SELECT l.*
      FROM db_namespace."LeaseSignatureStatus" l
      WHERE l."leaseId" = :leaseId
      AND l.status = :wetSignedStatus
      AND "partyMemberId" IS NOT NULL;
    `;

  const { rows } = await rawStatement(ctx, query, [{ leaseId, wetSignedStatus: DALTypes.LeaseSignatureStatus.WET_SIGNED }]);
  return !!rows.length;
};

export const getAllExecutedLeases = async ctx => {
  const query = `
    SELECT epmi."externalId", l.id AS "leaseId", l."partyId"
      FROM db_namespace."Lease" l 
      INNER JOIN db_namespace."ExternalPartyMemberInfo" epmi ON l."partyId" = epmi."partyId" 
      WHERE epmi."externalId" IS NOT NULL 
      AND epmi."endDate" IS NULL
      AND l.status = :status;
    `;

  const { rows } = await rawStatement(ctx, query, [{ status: DALTypes.LeaseStatus.EXECUTED }]);

  return rows;
};

export const getAllActiveLeases = async ctx => {
  const query = `
  SELECT epmi."externalId", p.id, p."workflowName", p."workflowState", p."partyGroupId", l.id AS "leaseId"
    FROM db_namespace."ExternalPartyMemberInfo" epmi
    INNER JOIN db_namespace."Party" p ON epmi."partyId" = p.id
    LEFT JOIN db_namespace."Lease" l ON l."partyId" = p.id and l.status = :status
    WHERE epmi."externalId" IS NOT NULL 
    AND epmi."endDate" IS NULL;`;

  const { rows } = await rawStatement(ctx, query, [{ status: DALTypes.LeaseStatus.EXECUTED }]);

  return rows;
};
