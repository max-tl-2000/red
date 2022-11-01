/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import config from '../../config';
import { initQuery, insertInto, update, getAllWhere, getOne, knex, rawStatement } from '../../../server/database/factory';
import { prepareRawQuery } from '../../../server/common/schemaConstants';
import { FadvRequestTypes } from '../../../common/enums/fadvRequestTypes';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import { getPastFormattedDateFromDelta } from '../../../common/helpers/date-utils';
import { maskSSNInApplicants } from '../helpers/fadv-mask-applicant-ssn';
import { FADV_RESPONSE_STATUS } from '../../common/screening-constants';
import { applicationDecisionHasErrorOther, obscureFadvRawRequestData, maskSubmissionResponse } from '../helpers/screening-helper';
import { FADV_TO_DATABASE_SERVICE_STATUS_TRANS } from '../../common/enums/fadv-service-status';
import { now } from '../../../common/helpers/moment-utils';
import { ScreeningResponseOrigin } from '../helpers/applicant-types';
import tryParse from '../../../common/helpers/try-parse';
import logger from '../../../common/helpers/logger';

const REQUEST_TABLE_NAME = 'rentapp_SubmissionRequest';
const RESPONSE_TABLE_NAME = 'rentapp_SubmissionResponse';
const PARTY_APPLICATION_TABLE_NAME = 'rentapp_PartyApplication';
const { minOrphanedScreeningResponseAge } = config.fadv;

const maskSsnInSubmissionRequestApplicantData = submissionRequest => {
  const { applicantData } = submissionRequest;
  if (!applicantData) return submissionRequest;

  return {
    ...submissionRequest,
    applicantData: maskSSNInApplicants(applicantData),
  };
};

const maskSubmissionRequest = submissionRequest => {
  const maskedRequest = maskSsnInSubmissionRequestApplicantData(submissionRequest);
  if (maskedRequest.rawRequest) {
    maskedRequest.rawRequest = obscureFadvRawRequestData(maskedRequest.rawRequest);
  }
  return maskedRequest;
};

export const createSubmissionRequest = (ctx, submissionRequest) => insertInto(ctx, REQUEST_TABLE_NAME, maskSubmissionRequest(submissionRequest));

export const updateSubmissionRequest = async (ctx, id, submissionRequest) => {
  logger.trace({ ctx, id }, 'updateSubmissionRequest');
  return await update(ctx, REQUEST_TABLE_NAME, { id }, maskSubmissionRequest(submissionRequest));
};

export const updateSubmissionResponse = (ctx, id, submissionResponse) => update(ctx, RESPONSE_TABLE_NAME, { id }, maskSubmissionResponse(submissionResponse));

export const createSubmissionResponse = (ctx, submissionResponse) => insertInto(ctx, RESPONSE_TABLE_NAME, maskSubmissionResponse(submissionResponse));

export const getSubmissionRequest = async (ctx, id) => await getOne(ctx, REQUEST_TABLE_NAME, id);

export const getSubmissionRequests = (ctx, partyApplicationId) => getAllWhere(ctx, REQUEST_TABLE_NAME, { partyApplicationId });

export const getSubmissionResponseBySubmissionRequestId = async (ctx, submissionRequestId, onlyIfComplete = true) => {
  const query = initQuery(ctx)
    .from(RESPONSE_TABLE_NAME)
    .where({ submissionRequestId })
    .orderBy('created_at', 'desc')
    .first(knex.raw('"rentapp_SubmissionResponse".*, "rentapp_SubmissionResponse"."rawResponse"::json'));

  if (onlyIfComplete) query.where({ status: 'Complete' });
  return await query;
};

export const existsSubmissionResponse = async (ctx, submissionRequestId) => {
  const query = `
    SELECT count(*)
    FROM db_namespace."rentapp_SubmissionResponse"
    WHERE "submissionRequestId" = :submissionRequestId
  `;
  const params = [{ submissionRequestId }];
  const result = await rawStatement(ctx, query, params);
  return Number(result.rows[0].count) > 0;
};

export const getLatestServiceStatusBySubmissionRequestId = async (ctx, submissionRequestId) => {
  const query = `SELECT "serviceStatus"
    FROM db_namespace."${RESPONSE_TABLE_NAME}"
    WHERE "submissionRequestId" = :submissionRequestId
    ORDER BY created_at DESC
    LIMIT 1;`;

  const result = await rawStatement(ctx, query, [{ submissionRequestId }]);

  return get(result, 'rows[0].serviceStatus', {}) || {};
};

export const getLatestBlockedServiceStatusBySubmissionRequestId = async (ctx, submissionRequestId) => {
  const query = `SELECT "rawResponse"
    FROM db_namespace."${RESPONSE_TABLE_NAME}"
    WHERE "submissionRequestId" = :submissionRequestId
    ORDER BY created_at DESC
    LIMIT 1;`;

  const result = await rawStatement(ctx, query, [{ submissionRequestId }]);
  const rawResponse = get(result, 'rows[0].rawResponse', {});
  return get(tryParse(rawResponse, {}), 'ApplicantScreening.Response[0].BlockedStatus[0]', '');
};

// TODO: comment on exactly what this fn does
export const getAllScreeningResultsForParty = async (ctx, partyId, { excludeObsolete = true } = {}) => {
  const query = initQuery(ctx)
    .select(
      'rentapp_SubmissionRequest.rentData',
      'rentapp_SubmissionRequest.applicantData',
      'rentapp_SubmissionRequest.id as submissionRequestId',
      'rentapp_SubmissionResponse.id',
      'rentapp_SubmissionResponse.submissionRequestId',
      'rentapp_SubmissionResponse.applicationDecision',
      'rentapp_SubmissionResponse.applicantDecision',
      'rentapp_SubmissionResponse.criteriaResult',
      'rentapp_SubmissionResponse.recommendations',
      'rentapp_SubmissionRequest.created_at',
      'rentapp_SubmissionResponse.created_at as submissionResponseCreatedAt',
      'rentapp_SubmissionResponse.externalId',
      knex.raw(`
        COALESCE("rentapp_SubmissionResponse"."status", '') as "status"
      `),
      'rentapp_SubmissionResponse.serviceStatus',
      'rentapp_SubmissionRequest.quoteId',
      'rentapp_SubmissionRequest.propertyId',
      'Property.timezone',
      'rentapp_SubmissionRequest.isObsolete',
      'rentapp_SubmissionRequest.requestType',
      'rentapp_SubmissionRequest.transactionNumber',
    )
    .select(knex.raw('"rentapp_SubmissionResponse"."rawResponse"::json'))
    .select(knex.raw('("rentapp_SubmissionResponse"."backgroundReport" <> \'\') IS NOT TRUE as "isBackgroundReportEmpty"'))
    .select(
      knex.raw(
        `"${ctx.tenantId}"."get_application_first_submitted_date"("rentapp_SubmissionRequest"."partyApplicationId", "rentapp_SubmissionRequest"."created_at") as "applicationCreatedAt"`,
      ),
    )
    .from('rentapp_PartyApplication')
    .innerJoin('rentapp_SubmissionRequest', 'rentapp_PartyApplication.id', 'rentapp_SubmissionRequest.partyApplicationId')
    .leftOuterJoin('rentapp_SubmissionResponse', 'rentapp_SubmissionRequest.id', 'rentapp_SubmissionResponse.submissionRequestId')
    .leftOuterJoin('Property', 'Property.id', 'rentapp_SubmissionRequest.propertyId')
    .where('rentapp_PartyApplication.partyId', partyId);
  if (excludeObsolete) query.andWhere('rentapp_SubmissionRequest.isObsolete', false);

  return await query;
};

// TODO: this should not be needed anymore - it's all covered by the above screeningResults
export const getAllScreeningRequestsForParty = async (ctx, partyId, { excludeObsolete = true } = {}) => {
  const query = initQuery(ctx)
    .select(
      'rentapp_SubmissionRequest.id',
      'rentapp_SubmissionRequest.rentData',
      'rentapp_SubmissionRequest.applicantData',
      'rentapp_SubmissionRequest.created_at',
      'rentapp_SubmissionRequest.quoteId',
      'rentapp_SubmissionRequest.transactionNumber',
      'rentapp_SubmissionRequest.isObsolete',
      'rentapp_SubmissionRequest.requestType',
      'Property.timezone',
    )
    .from('rentapp_PartyApplication')
    .innerJoin('rentapp_SubmissionRequest', 'rentapp_PartyApplication.id', 'rentapp_SubmissionRequest.partyApplicationId')
    .innerJoin('Property', 'Property.id', 'rentapp_SubmissionRequest.propertyId')
    .where('rentapp_PartyApplication.partyId', partyId);
  if (excludeObsolete) query.andWhere('rentapp_SubmissionRequest.isObsolete', false);

  return await query;
};

const getDateRangeForOrphanedRequests = (minTime, maxTime, timeFrame, initialDate) => [
  getPastFormattedDateFromDelta(maxTime, timeFrame, initialDate),
  getPastFormattedDateFromDelta(minTime, timeFrame, initialDate),
];

export const getOrphanedScreeningRequestIds = async (ctx, { time, onlyUnalertedRequests = false, initialDate = new Date() }) => {
  const { minTime, maxTime, timeFrame = 'hours' } = time;
  logger.trace({ ctx, minTime, maxTime, timeFrame, onlyUnalertedRequests, initialDate }, 'getOrphanedScreeningRequestIds');

  const query = initQuery(ctx)
    .select(`${REQUEST_TABLE_NAME}.id`)
    .from(REQUEST_TABLE_NAME)
    .leftJoin(RESPONSE_TABLE_NAME, `${REQUEST_TABLE_NAME}.id`, 'submissionRequestId')
    .innerJoin(PARTY_APPLICATION_TABLE_NAME, `${PARTY_APPLICATION_TABLE_NAME}.id`, 'partyApplicationId')
    .where('isObsolete', false)
    .whereBetween(`${REQUEST_TABLE_NAME}.created_at`, getDateRangeForOrphanedRequests(minTime, maxTime, timeFrame, initialDate))
    .where(pred => pred.whereNull(`${RESPONSE_TABLE_NAME}.id`).orWhere('applicationDecision', ScreeningDecision.ERROR_OTHER));

  if (onlyUnalertedRequests) {
    query.andWhere('isAlerted', false);
  }

  return await query;
};

export const getOrphanedIncompleteRequestIds = async (ctx, { time, onlyUnalertedRequests = false }) => {
  const { minTime, maxTime, timeFrame = 'hours', initialDate = new Date() } = time;

  logger.trace({ ctx, orphanedRequestsTime: time, onlyUnalertedRequests }, 'getOrphanedIncompleteRequestIds');

  const onlyUnalertedRequestsPredicate = onlyUnalertedRequests ? 'AND req."isAlerted" = false' : '';
  const [from, to] = getDateRangeForOrphanedRequests(minTime, maxTime, timeFrame, initialDate);

  const query = `SELECT DISTINCT
      req.id
    FROM db_namespace."${REQUEST_TABLE_NAME}" req
    INNER JOIN db_namespace."${RESPONSE_TABLE_NAME}" res ON res."submissionRequestId" = req.id
    WHERE req."isObsolete" = false
    GROUP BY req.id, res.id
    HAVING COUNT(CASE WHEN res.status = :completeStatus THEN 1 END) = 0
    AND (SELECT rest.id FROM db_namespace."${RESPONSE_TABLE_NAME}" rest
      WHERE rest."submissionRequestId" = req.id ORDER BY rest.created_at DESC LIMIT 1
    ) = res.id
    AND (SELECT rest.created_at FROM db_namespace."${RESPONSE_TABLE_NAME}" rest
      WHERE res.id = rest.id
      and rest.created_at < NOW() - INTERVAL '${minOrphanedScreeningResponseAge} MIN'
      order by rest.created_at DESC LIMIT 1
    ) IS NOT NULL
    ${onlyUnalertedRequestsPredicate}
    AND res."applicationDecision" <> :errorAddressUnparsable
    AND req.created_at <@ '[:from:, :to:]'::tstzrange;`;

  const { rows } = await rawStatement(ctx, query, [
    {
      from,
      to,
      errorAddressUnparsable: ScreeningDecision.ERROR_ADDRESS_UNPARSABLE,
      completeStatus: FADV_RESPONSE_STATUS.COMPLETE,
    },
  ]);

  return rows;
};

export const getOrphanedScreeningRequests = async (ctx, time, onlyUnalertedRequests = false) => {
  logger.trace({ ctx, orphanedRequestsTime: time, onlyUnalertedRequests }, 'getOrphanedScreeningRequests');

  time.initialDate = new Date();

  const submissionRequestIds = await Promise.all([
    getOrphanedScreeningRequestIds(ctx, { time, onlyUnalertedRequests }),
    getOrphanedIncompleteRequestIds(ctx, { time, onlyUnalertedRequests }),
  ]).then(results => results.reduce((acc, val) => acc.concat(val), []).map(request => request.id));

  const query = initQuery(ctx)
    .select(
      `${REQUEST_TABLE_NAME}.created_at`,
      `${REQUEST_TABLE_NAME}.id`,
      `${REQUEST_TABLE_NAME}.partyApplicationId`,
      `${REQUEST_TABLE_NAME}.transactionNumber`,
      `${REQUEST_TABLE_NAME}.requestEndedAt`,
      `${PARTY_APPLICATION_TABLE_NAME}.partyId`,
      `${REQUEST_TABLE_NAME}.applicantData`,
    )
    .from(REQUEST_TABLE_NAME)
    .innerJoin(PARTY_APPLICATION_TABLE_NAME, `${PARTY_APPLICATION_TABLE_NAME}.id`, `${REQUEST_TABLE_NAME}.partyApplicationId`)
    .whereIn(`${REQUEST_TABLE_NAME}.id`, submissionRequestIds);

  return await query;
};

export const getScreeningCreationDate = async (ctx, partyId) =>
  await initQuery(ctx)
    .select(`${REQUEST_TABLE_NAME}.created_at`)
    .from(PARTY_APPLICATION_TABLE_NAME)
    .innerJoin(REQUEST_TABLE_NAME, `${PARTY_APPLICATION_TABLE_NAME}.id`, `${REQUEST_TABLE_NAME}.partyApplicationId`)
    .where(`${PARTY_APPLICATION_TABLE_NAME}.partyId`, partyId)
    .andWhere(`${REQUEST_TABLE_NAME}.requestType`, FadvRequestTypes.NEW)
    .orderBy(`${REQUEST_TABLE_NAME}.created_at`, 'desc')
    .first();

export const getFirstScreeningForParty = async (ctx, partyId) =>
  await initQuery(ctx)
    .select(`${REQUEST_TABLE_NAME}.id`, `${REQUEST_TABLE_NAME}.transactionNumber`, `${RESPONSE_TABLE_NAME}.status`)
    .from(REQUEST_TABLE_NAME)
    .innerJoin(PARTY_APPLICATION_TABLE_NAME, `${PARTY_APPLICATION_TABLE_NAME}.id`, `${REQUEST_TABLE_NAME}.partyApplicationId`)
    .leftJoin(RESPONSE_TABLE_NAME, `${REQUEST_TABLE_NAME}.id`, `${RESPONSE_TABLE_NAME}.submissionRequestId`)
    .where({ isObsolete: false })
    .where(`${PARTY_APPLICATION_TABLE_NAME}.partyId`, partyId)
    .where({ isObsolete: false })
    .whereNotNull(`${REQUEST_TABLE_NAME}.transactionNumber`)
    .orderBy(`${REQUEST_TABLE_NAME}.created_at`)
    .first();

export const markAllScreeningRequestsForPartyAsObsolete = async (ctx, partyId) =>
  // KNEX does not support FROM, needed for update with inner join
  await knex.raw(
    prepareRawQuery(
      `UPDATE
        db_namespace."rentapp_SubmissionRequest" AS req
      SET
        "isObsolete" = true
      FROM
        db_namespace."rentapp_PartyApplication" AS pa
      WHERE
        req."partyApplicationId" = pa.id
        AND pa."partyId" = :partyId`,
      ctx.tenantId,
    ),
    { partyId },
  );

export const getPendingRequests = async (ctx, partyId) => {
  const query = initQuery(ctx)
    .select(
      `${REQUEST_TABLE_NAME}.created_at`,
      `${REQUEST_TABLE_NAME}.id`,
      `${REQUEST_TABLE_NAME}.partyApplicationId`,
      `${REQUEST_TABLE_NAME}.transactionNumber`,
      `${REQUEST_TABLE_NAME}.requestEndedAt`,
      `${REQUEST_TABLE_NAME}.requestResult`,
      `${PARTY_APPLICATION_TABLE_NAME}.partyId`,
    )
    .from(REQUEST_TABLE_NAME)
    .innerJoin(PARTY_APPLICATION_TABLE_NAME, `${PARTY_APPLICATION_TABLE_NAME}.id`, `${REQUEST_TABLE_NAME}.partyApplicationId`)
    .where(`${PARTY_APPLICATION_TABLE_NAME}.partyId`, partyId)
    .whereNull(`${REQUEST_TABLE_NAME}.requestEndedAt`);

  return await query;
};

export const getParentSubmissionRequestId = async (ctx, partyApplicationId) => {
  const { id } =
    (await initQuery(ctx)
      .select(`${REQUEST_TABLE_NAME}.id`)
      .from(REQUEST_TABLE_NAME)
      .where(`${REQUEST_TABLE_NAME}.partyApplicationId`, partyApplicationId)
      .where(`${REQUEST_TABLE_NAME}.isObsolete`, false)
      .orderBy('created_at', 'asc')
      .first()) || {};

  return id;
};

export const getPrevSubmissionRequestData = async (ctx, partyApplicationId) => {
  const query = `SELECT "${REQUEST_TABLE_NAME}".id, "partyApplicationId", "rentData", "applicantData", "applicationDecision"
    FROM db_namespace."${REQUEST_TABLE_NAME}"
    LEFT JOIN db_namespace."${RESPONSE_TABLE_NAME}" ON "submissionRequestId" = "${REQUEST_TABLE_NAME}".id
    WHERE "partyApplicationId" = :partyApplicationId
    ORDER BY "${REQUEST_TABLE_NAME}".created_at DESC LIMIT 1`;

  const { rows } = await rawStatement(ctx, query, [{ partyApplicationId }]);
  return rows[0];
};

export const getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm = async (ctx, partyApplicationId, quoteId, leaseTermMonths) => {
  const query = `SELECT "${REQUEST_TABLE_NAME}".id, "partyApplicationId", "rentData", "applicantData", "applicationDecision"
    FROM db_namespace."${REQUEST_TABLE_NAME}"
    LEFT JOIN db_namespace."${RESPONSE_TABLE_NAME}" ON "submissionRequestId" = "${REQUEST_TABLE_NAME}".id
    WHERE "partyApplicationId" = :partyApplicationId
    AND "isObsolete" = true
    AND "quoteId" = :quoteId
    AND "rentData" ->> 'leaseTermMonths' = :leaseTermMonths
    ORDER BY "${REQUEST_TABLE_NAME}".created_at DESC LIMIT 1`;

  const { rows } = await rawStatement(ctx, query, [{ partyApplicationId, quoteId, leaseTermMonths }]);
  return rows[0];
};

export const getStuckSubmissionRequests = async (ctx, options = { responseInterval: true }) => {
  const { responseInterval, minTime, maxTime, timeframe } = options;

  const onlyResponsesWithCompletedServiceStatuses = (response = {}) => {
    if (
      !response.status ||
      applicationDecisionHasErrorOther(response.applicationDecision) ||
      response.status === FADV_RESPONSE_STATUS.INCOMPLETE_INCORRECT_MEMBERS
    ) {
      return true;
    }

    if (!response.serviceStatus) return false;

    const isResponseStatusComplete = response.status === FADV_RESPONSE_STATUS.COMPLETE;

    const allServicesStatuses = Object.keys(response.serviceStatus || {})
      .map(applicant => response.serviceStatus[applicant].map(service => service.status))
      .reduce((acc, val) => acc.concat(val), []);

    if (!isResponseStatusComplete && !allServicesStatuses.length) return true;

    const isServiceStatusCompleted = status => status === FADV_TO_DATABASE_SERVICE_STATUS_TRANS.COMPLETED;
    const allServiceStatusComplete = allServicesStatuses.length && allServicesStatuses.every(isServiceStatusCompleted);
    const isServiceStatusPartiallyComplete = !allServiceStatusComplete && allServicesStatuses.some(isServiceStatusCompleted);

    if (isResponseStatusComplete) {
      return isServiceStatusPartiallyComplete || !response.applicationDecision || !!response.incompleteDecision;
    }

    return (
      allServiceStatusComplete ||
      (isServiceStatusPartiallyComplete && response.applicationDecision && response.applicationDecision !== ScreeningDecision.PENDING)
    );
  };

  const params = [
    {
      errorOther: ScreeningDecision.ERROR_OTHER,
      parsingError: '%unable to parse applicant section%',
      incompleteResponseStatus: FADV_RESPONSE_STATUS.INCOMPLETE,
      incompleteIncorrectMembersStatus: FADV_RESPONSE_STATUS.INCOMPLETE_INCORRECT_MEMBERS,
      completeResponseStatus: FADV_RESPONSE_STATUS.COMPLETE,
    },
  ];

  const responseTimeInterval = " AND (res.created_at > NOW() - INTERVAL '1 DAY' AND res.created_at < NOW() - INTERVAL '2 MINUTES')";
  const requestTimeIntervalPredicate = ` AND (req.created_at > NOW() - INTERVAL '${maxTime} ${timeframe}' AND req.created_at < NOW() - INTERVAL '${minTime} ${timeframe}')`;
  const intervalPredicateFilter = responseInterval ? responseTimeInterval : requestTimeIntervalPredicate;

  const query = `SELECT
      req.id,
      "applicationDecision",
      "serviceStatus",
      "partyId",
      "quoteId",
      "rentData",
      "partyApplicationId",
      res.status,
      CASE
        WHEN res."applicantDecision" IS NULL OR res."applicantDecision"::text = '{}'::text THEN 0
        WHEN res.status = :completeResponseStatus AND jsonb_array_length(to_jsonb(res."applicantDecision")) <> jsonb_array_length(req."applicantData"->'applicants') THEN 1
        ELSE 0
      END AS "incompleteDecision"
    FROM db_namespace."${REQUEST_TABLE_NAME}" AS req
    INNER JOIN (select *, rank() OVER (PARTITION BY r."submissionRequestId" ORDER BY r.created_at DESC) as ran from db_namespace."${RESPONSE_TABLE_NAME}" AS r) AS res ON res."submissionRequestId" = req.id
    INNER JOIN db_namespace."${PARTY_APPLICATION_TABLE_NAME}" AS pa ON pa.id = req."partyApplicationId"
    WHERE req."isObsolete" = false
    AND res.ran = 1
    ${intervalPredicateFilter}
    AND CASE
          WHEN COALESCE(res.status, '') = '' OR res.status = :incompleteResponseStatus  OR res.status = :incompleteIncorrectMembersStatus THEN
            CASE
              WHEN res.status = :incompleteIncorrectMembersStatus THEN 1
              WHEN COALESCE(res."applicationDecision", '') = '' THEN 1
              WHEN res."applicationDecision" = :errorOther AND LOWER(res."rawResponse") LIKE :parsingError THEN 1
              WHEN res.status = :incompleteResponseStatus AND COALESCE(res."applicationDecision", '') <> '' THEN 1
              WHEN res.status = :incompleteResponseStatus AND res."serviceStatus"::text = '{}'::text THEN 0
              ELSE 0
            END
          WHEN res.status = :completeResponseStatus THEN
            CASE
              WHEN COALESCE(res."applicationDecision", '') = '' THEN 1
              WHEN res."serviceStatus" IS NOT NULL AND res."serviceStatus"::text <> '{}'::text THEN 1
              WHEN res."applicantDecision" IS NULL OR res."applicantDecision"::text = '{}'::text THEN 0
              WHEN jsonb_array_length(to_jsonb(res."applicantDecision")) <> jsonb_array_length(req."applicantData"->'applicants') THEN 1
              ELSE 0
            END
          ELSE 0
        END = 1
    `;

  const { rows } = await rawStatement(ctx, query, params);

  return rows.filter(onlyResponsesWithCompletedServiceStatuses);
};

export const getAmountOfNewSubmissionRequestsByPartyApplication = async (ctx, partyApplicationId, options = { interval: 1, timeFrame: 'hours' }) => {
  const { interval, timeFrame } = options;
  const requestType = FadvRequestTypes.NEW;

  const query = `SELECT COUNT(*)
    FROM db_namespace."${REQUEST_TABLE_NAME}"
    WHERE "partyApplicationId" = :partyApplicationId
    AND "requestType" = :requestType
    AND created_at > NOW() - INTERVAL '${interval} ${timeFrame}'`;

  const results = await rawStatement(ctx, query, [{ partyApplicationId, requestType }]);
  const submissionsCount = (results && results.rows && results.rows.length && results.rows[0].count) || 0;

  return parseInt(submissionsCount, 10);
};

export const getPropertiesWithCompleteScreeningsAndNoPushes = async (ctx, minTime = 0, maxTime = 24, timeFrame = 'hours', initialDate = now()) => {
  const [from, to] = [getPastFormattedDateFromDelta(maxTime, timeFrame, initialDate), getPastFormattedDateFromDelta(minTime, timeFrame, initialDate)];

  const query = `SELECT DISTINCT
      property.id,
      property.name
    FROM db_namespace."Property" property
    INNER JOIN db_namespace."${REQUEST_TABLE_NAME}" req ON req."propertyId" = property.id
    INNER JOIN db_namespace."${RESPONSE_TABLE_NAME}" res ON res."submissionRequestId" = req.id
    WHERE req.created_at <@ '[:from:, :to:]'::tstzrange
    GROUP BY property.id
    HAVING COUNT(CASE WHEN res.origin = :pushResponseOrigin THEN 1 END) = 0
    AND COUNT(CASE WHEN res.status = :completeResponseStatus THEN 1 END) > 0;`;

  const { rows } = await rawStatement(ctx, query, [
    {
      to,
      from,
      pushResponseOrigin: ScreeningResponseOrigin.PUSH,
      completeResponseStatus: FADV_RESPONSE_STATUS.COMPLETE,
    },
  ]);

  return rows;
};

export const getLastSubmissionRequestsByPartyApplication = async (ctx, partyApplicationId, options = { limit: 3 }) => {
  const { limit = 3 } = options;

  const query = `SELECT *
    FROM db_namespace."${REQUEST_TABLE_NAME}"
    WHERE "partyApplicationId" = :partyApplicationId
    ORDER BY created_at DESC
    LIMIT :limit`;

  const { rows } = await rawStatement(ctx, query, [{ partyApplicationId, limit }]);

  return rows || [];
};

export const getPreviousSubmissionResponse = async (ctx, partyId, screeningRequestId, offset) => {
  const query = `SELECT res.*
    FROM db_namespace."${RESPONSE_TABLE_NAME}" res
    JOIN db_namespace."${REQUEST_TABLE_NAME}" req ON req.id = :screeningRequestId
    JOIN db_namespace."${PARTY_APPLICATION_TABLE_NAME}" pa ON pa.id = req."partyApplicationId"
    WHERE pa."partyId" = :partyId
    ORDER BY created_at DESC
    LIMIT 1`;

  const queryWithOffset = offset ? `${query} OFFSET :offset` : query;

  const { rows } = await rawStatement(ctx, queryWithOffset, [{ partyId, screeningRequestId, offset }]);

  return (rows || [])[0];
};

export const getPreviousTenantIdFromLatestNewRequest = async (ctx, applicantId) => {
  const query = `SELECT "applicantData"->'tenantId' as "tenantId"
    FROM db_namespace."rentapp_SubmissionRequest"
    WHERE "partyApplicationId" = (SELECT "partyApplicationId" FROM db_namespace."rentapp_PersonApplication" WHERE "applicantId" = :applicantId)
    AND "requestType" = :requestType
    ORDER BY created_at DESC
    LIMIT 1`;

  const { rows } = await rawStatement(ctx, query, [{ applicantId, requestType: FadvRequestTypes.NEW }]);
  return (rows[0] || {}).tenantId;
};
