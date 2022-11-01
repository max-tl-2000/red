/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { initQuery, insertInto, getOne, updateOne, getAllWhere, getOneWhere, rawStatement, saveJSONBData } from '../../../server/database/factory';
import { encryptFieldsInObject, decryptFieldsInObject } from '../../../common/server/crypto-helper';
import { applicationWithMaskedSSN } from '../../../common/helpers/utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { prepareRawQuery } from '../../../server/common/schemaConstants';
import { knex } from '../../../server/database/knex';
import { now } from '../../../common/helpers/moment-utils';
import { STRICT_SOCIAL_SECURITY_NUMBER } from '../../../common/regex';

const TABLE_NAME = 'rentapp_PersonApplication';
const PARTY_APP_TABLE_NAME = 'rentapp_PartyApplication';
const PERSON_APP_DOC_TABLE_NAME = 'rentapp_personApplicationDocuments';
const PARTY_APPLICATION_TABLE_NAME = 'rentapp_PartyApplication';
const PARTY_MEMBER_TABLE_NAME = 'PartyMember';
const ENCRYPTED_FIELDS = ['applicationData.ssn', 'applicationData.itin'];
export const ENCRYPTION_KEY_NAME = 'rentapp.encryptionKey';
export const OLD_ENCRYPTION_KEY_NAME = 'rentapp.oldEncryptionKey';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'personApplicationRepo' });

const encryptApplication = application => encryptFieldsInObject(application, ENCRYPTED_FIELDS, ENCRYPTION_KEY_NAME);
const decryptApplication = application => {
  let app = null;

  app = decryptFieldsInObject(application, ENCRYPTED_FIELDS, ENCRYPTION_KEY_NAME);
  const { applicationData } = app || {};
  if (
    (applicationData?.ssn && !applicationData.ssn.match(STRICT_SOCIAL_SECURITY_NUMBER)) ||
    (applicationData?.itin && !applicationData.itin.match(STRICT_SOCIAL_SECURITY_NUMBER))
  ) {
    logger.info('Decrypting with old key');
    app = decryptFieldsInObject(application, ENCRYPTED_FIELDS, OLD_ENCRYPTION_KEY_NAME);
  }

  return app;
};

const getApplicationDataWithSsn = application => {
  const { ssn, itin, applicationData } = application;
  return { ...applicationData, ssn, itin };
};

const transformDALToApplicationData = (application, maskSsn) => {
  if (!application || (!application.ssn && !application.itin)) return application;

  const applicationDataWithSsn = getApplicationDataWithSsn(application);
  const decryptedApplicationData = decryptApplication({ applicationData: applicationDataWithSsn });

  const decryptedApplication = { ...application, ...decryptedApplicationData };
  return maskSsn ? applicationWithMaskedSSN(decryptedApplication) : decryptedApplication;
};

export const transformDALToApplicationsData = (applications, maskSsn) => applications.map(application => transformDALToApplicationData(application, maskSsn));

const hasSSN = (applicationData = {}) => 'ssn' in applicationData && applicationData.ssn;
const hasITIN = (applicationData = {}) => 'itin' in applicationData && applicationData.itin;

export const preparePersonApplicationWithSsn = personApplicationRaw => {
  let { applicationData: rawAppData } = personApplicationRaw;
  if (!rawAppData) return personApplicationRaw;

  const applicantHasSSN = hasSSN(rawAppData);
  const applicantHasITIN = hasITIN(rawAppData);

  if (!applicantHasSSN) {
    rawAppData = omit(rawAppData, ['ssn']);
    personApplicationRaw = { ...personApplicationRaw, ssn: null };
  }

  if (!applicantHasITIN) {
    rawAppData = omit(rawAppData, ['itin']);
    personApplicationRaw = { ...personApplicationRaw, itin: null };
  }

  if (!applicantHasSSN && !applicantHasITIN) {
    return { ...personApplicationRaw, applicationData: rawAppData };
  }

  const encryptedPersonApplication = encryptApplication(personApplicationRaw);
  const { itin, ssn } = encryptedPersonApplication.applicationData || {};
  const applicationData = encryptedPersonApplication.applicationData && omit(encryptedPersonApplication.applicationData, ['ssn', 'itin']);
  return { ...encryptedPersonApplication, itin, ssn, applicationData };
};

export const createPersonApplication = async (ctx, personApplicationRaw, options = {}, maskSsn = true) => {
  const personApplicationRawWithSsn = preparePersonApplicationWithSsn(personApplicationRaw);
  const application = await insertInto(ctx, TABLE_NAME, personApplicationRawWithSsn, options);
  return transformDALToApplicationData(application, maskSsn);
};

export const copyPersonApplication = async (ctx, personApplication, maskSsn = true) => {
  const query = `
    INSERT INTO db_namespace."${TABLE_NAME}"
    (id, created_at, updated_at, "personId", "partyId", "partyApplicationId", "paymentCompleted",
   "applicationData", "applicationStatus", "additionalData", "applicantId", ssn, itin,
    "isFeeWaived", "endedAsMergedAt", "sendSsnEnabled", "feeWaiverReason",  "tosEvents", "copiedFrom" )
    VALUES ("public".gen_random_uuid(), now(), now(), :personId, :partyId, :partyApplicationId, :paymentCompleted,
  :applicationData, :applicationStatus, :additionalData, :applicantId, :ssn, :itin, :isFeeWaived, :endedAsMergedAt, :sendSsnEnabled,
  :feeWaiverReason, :tosEvents::JSONB, :id)
  returning *;
  `;
  const {
    personId,
    partyId,
    partyApplicationId,
    paymentCompleted,
    applicationData,
    applicationStatus,
    additionalData,
    applicantId,
    ssn,
    itin,
    isFeeWaived,
    endedAsMergedAt,
    sendSsnEnabled,
    feeWaiverReason,
    tosEvents,
    id,
  } = personApplication;

  const { rows } = await rawStatement(ctx, query, [
    {
      personId,
      partyId,
      partyApplicationId,
      paymentCompleted,
      applicationData,
      applicationStatus,
      additionalData,
      applicantId,
      ssn,
      itin,
      isFeeWaived,
      endedAsMergedAt,
      sendSsnEnabled,
      feeWaiverReason,
      tosEvents: JSON.stringify(tosEvents),
      id,
    },
  ]);

  return transformDALToApplicationData(rows[0], maskSsn);
};

export const getPersonApplication = async (ctx, id, maskSsn = true) => {
  const application = await getOne(ctx, TABLE_NAME, id);
  return transformDALToApplicationData(application, maskSsn);
};

// eslint-disable-next-line
export const getApplicationDataByIdQuery = (ctx, personApplicationId) =>
  knex.raw(
    prepareRawQuery(
      `
  SELECT "applicationData" FROM db_namespace.:personApplicationTable: where id = :personApplicationId
  `,
      ctx.tenantId,
    ),
    { personApplicationId, personApplicationTable: TABLE_NAME },
  );

export const updatePersonApplication = async (ctx, id, personApplicationRaw, maskSsn = true) => {
  const personApplicationRawWithSsn = preparePersonApplicationWithSsn(personApplicationRaw);
  const application = await updateOne(ctx, TABLE_NAME, id, personApplicationRawWithSsn, ctx.trx);
  return transformDALToApplicationData(application, maskSsn);
};

export const getPersonApplicationsByFilter = async (
  ctx,
  filter,
  { maskSsn = true, includeMerged, includeApplicationsWherePartyMemberIsInactive = false } = {},
) => {
  // don´t retrieve tosEvents
  let query = `
  select distinct rpa.id,
    rpa."personId",
    rpa."partyId",
    rpa."partyApplicationId",
    rpa."paymentCompleted",
    rpa."applicationData",
    rpa."applicationStatus",
    rpa."additionalData",
    rpa."applicantId",
    rpa.ssn,
    rpa.itin,
    rpa."isFeeWaived",
    rpa."endedAsMergedAt",
    rpa."sendSsnEnabled",
    rpa."feeWaiverReason",
    rpa.created_at,
    rpa.updated_at from db_namespace."${TABLE_NAME}" rpa
    inner join db_namespace."Party" p on p.id = rpa."partyId"
    left join db_namespace."MergePartyMatches" mpm on mpm."secondPartyId" = rpa."partyId" 
  `;

  const pmIsInactiveQuery = ` inner join db_namespace."PartyMember" pm 
  on pm."personId" = rpa."personId" and pm."partyId" = rpa."partyId"
  where pm."endDate" is null 
  `;
  if (!includeApplicationsWherePartyMemberIsInactive) {
    query += pmIsInactiveQuery;
  }

  const queryFilters = Object.keys(filter).reduce((acc, key) => {
    acc.push(`rpa."${key}" = '${filter[key]}'`);
    return acc;
  }, []);

  query += ` ${!includeApplicationsWherePartyMemberIsInactive ? 'AND' : 'WHERE'} ${queryFilters.join(' AND ')}`;

  if (!includeMerged) {
    query += ' AND rpa."endedAsMergedAt" is NULL;';
  }
  const { rows } = await rawStatement(ctx, query);

  return transformDALToApplicationsData(rows, maskSsn);
};

export const getPersonApplicationByFilter = async (ctx, filter, { maskSsn = true, includeMerged } = {}) => {
  const [firstApplication] = await getPersonApplicationsByFilter(ctx, filter, { maskSsn, includeMerged });
  return firstApplication;
};

export const getPersonApplicationByPersonIdAndPartyApplicationId = async (
  ctx,
  personId,
  partyApplicationId,
  { maskSsn = true, includeMerged, includeApplicationsWherePartyMemberIsInactive } = {},
) => {
  const [firstApplication] = await getPersonApplicationsByFilter(
    ctx,
    { personId, partyApplicationId },
    { maskSsn, includeMerged, includeApplicationsWherePartyMemberIsInactive },
  );
  return firstApplication;
};

export const getPersonApplicationForApplicant = async (ctx, applicant, maskSsn = true) => {
  const { personId, partyId } = applicant;
  return await getPersonApplicationByFilter(ctx, { personId, partyId }, { maskSsn });
};

const buildInClause = (ids, type = 'uuid') => ids.map(_id => (type ? `?::${type}` : '?')).join(',');

export const getPersonApplicationsByPersonIds = async (ctx, personIds, maskSsn = true) => {
  const query = `SELECT *
                 FROM db_namespace."rentapp_PersonApplication"
                 WHERE "personId" IN (${buildInClause(personIds)})
                 AND "endedAsMergedAt" IS NULL`;
  const { rows } = await rawStatement(ctx, query, [personIds]);

  return transformDALToApplicationsData(rows, maskSsn);
};

export const countPersonApplicationsByFilter = async (ctx, filter) => await initQuery(ctx).from(TABLE_NAME).where(filter).count().first();

export const getPersonApplicationsByPartyId = async (ctx, partyId, { maskSsn = true, includeMerged } = {}) => {
  const query = initQuery(ctx)
    .from(TABLE_NAME)
    .join(PARTY_APP_TABLE_NAME, `${TABLE_NAME}.partyApplicationId`, `${PARTY_APP_TABLE_NAME}.id`)
    .join(PARTY_MEMBER_TABLE_NAME, `${TABLE_NAME}.personId`, `${PARTY_MEMBER_TABLE_NAME}.personId`);

  if (!includeMerged) {
    query.whereNull('endedAsMergedAt');
  }

  const applications = await query
    .whereNull(`${PARTY_MEMBER_TABLE_NAME}.endDate`)
    .andWhere(`${PARTY_APP_TABLE_NAME}.partyId`, partyId)
    .andWhere(`${PARTY_MEMBER_TABLE_NAME}.partyId`, partyId)
    .select(`${TABLE_NAME}.*`);
  return transformDALToApplicationsData(applications, maskSsn);
};

export const existsEmailPersonApplication = async (ctx, email, partyId, personApplicationId) => {
  let query = initQuery(ctx)
    .from(TABLE_NAME)
    .join(PARTY_MEMBER_TABLE_NAME, `${TABLE_NAME}.personId`, `${PARTY_MEMBER_TABLE_NAME}.personId`)
    .whereNull(`${PARTY_MEMBER_TABLE_NAME}.endDate`)
    .andWhere(`${TABLE_NAME}.partyId`, partyId)
    .andWhereRaw(`"${TABLE_NAME}"."endedAsMergedAt" IS NULL`)
    .andWhereRaw(
      `"${TABLE_NAME}"."applicationStatus" IN ('${DALTypes.PersonApplicationStatus.PAID}', '${DALTypes.PersonApplicationStatus.COMPLETED}') AND "${TABLE_NAME}"."applicationData"->>'email' ilike :email`,
      { email },
    )
    .count();

  query = personApplicationId ? query.andWhereRaw(`"${TABLE_NAME}"."id" <> :personApplicationId`, { personApplicationId }) : query;
  const [result] = await query;
  return +result.count > 0;
};

export const getPersonApplicationsByPartyIdPersonIds = async (ctx, partyId, personIds, maskSsn = true) => {
  const applications = await initQuery(ctx)
    .from(TABLE_NAME)
    .join(PARTY_APPLICATION_TABLE_NAME, `${TABLE_NAME}.partyApplicationId`, `${PARTY_APPLICATION_TABLE_NAME}.id`)
    .whereIn(`${TABLE_NAME}.personId`, personIds)
    .andWhere(`${PARTY_APPLICATION_TABLE_NAME}.partyId`, partyId)
    .select(`${TABLE_NAME}.*`);
  return await transformDALToApplicationsData(applications, maskSsn);
};

export const getDocumentsForPersonApplication = (ctx, personApplicationId) =>
  getAllWhere(ctx, PERSON_APP_DOC_TABLE_NAME, { personApplicationId }, ['metadata']);

export const getAdditionalDataForPersonApplication = (ctx, id) => getOneWhere(ctx, TABLE_NAME, { id }, ['additionalData']);

export const updatePersonApplicationAdditionalData = async (ctx, id, additionalData) => {
  await saveJSONBData(ctx, TABLE_NAME, id, 'additionalData', additionalData);
  return await getPersonApplication(ctx, id);
};

export const getPersonApplicationByDocumentId = async (ctx, documentId, maskSsn = true) => {
  const application = await initQuery(ctx)
    .from(PERSON_APP_DOC_TABLE_NAME)
    .join(TABLE_NAME, `${TABLE_NAME}.id`, `${PERSON_APP_DOC_TABLE_NAME}.personApplicationId`)
    .whereRaw(`"${PERSON_APP_DOC_TABLE_NAME}"."metadata"->>'documentId' = '${documentId}'`)
    .first();

  return transformDALToApplicationData(application, maskSsn);
};

export const deletePersonApplicationDocument = async (ctx, personApplicationId, documentId) =>
  await initQuery(ctx)
    .from(PERSON_APP_DOC_TABLE_NAME)
    .where(`${PERSON_APP_DOC_TABLE_NAME}.personApplicationId`, personApplicationId)
    .whereRaw(`"${PERSON_APP_DOC_TABLE_NAME}"."metadata"->>'documentId' = ?`, [documentId])
    .del();

export const getPersonApplicationDocumentsByPartyId = async (ctx, partyId) =>
  initQuery(ctx)
    .from(PERSON_APP_DOC_TABLE_NAME)
    .join(TABLE_NAME, `${PERSON_APP_DOC_TABLE_NAME}.personApplicationId`, `${TABLE_NAME}.id`)
    .where(`${TABLE_NAME}.partyId`, partyId)
    .select(`${PERSON_APP_DOC_TABLE_NAME}.*`);

export const getNumberOfDocumentsByPerson = async (ctx, partyId, personId) =>
  await initQuery(ctx)
    .from(PERSON_APP_DOC_TABLE_NAME)
    .join(TABLE_NAME, `${PERSON_APP_DOC_TABLE_NAME}.personApplicationId`, `${TABLE_NAME}.id`)
    .where(`${TABLE_NAME}.partyId`, partyId)
    .andWhere(`${TABLE_NAME}.personId`, personId)
    .count(`${PERSON_APP_DOC_TABLE_NAME}.id as documentCount`)
    .groupBy(`${TABLE_NAME}.personId`)
    .first();

export const updatePersonApplicationData = async (ctx, personApplicationId, applicationData) => {
  const encryptedApplicationData = applicationData.socSecNumber ? encryptApplication({ applicationData }).applicationData : applicationData;

  const applicationDataToSave = omit(encryptedApplicationData, ['socSecNumber']);
  await saveJSONBData(ctx, TABLE_NAME, personApplicationId, 'applicationData', applicationDataToSave);

  if (encryptedApplicationData.socSecNumber) {
    await updateOne(ctx, TABLE_NAME, personApplicationId, { ssn: encryptedApplicationData.socSecNumber });
  }
};

export const updatePersonIdForPersonApplication = async (ctx, basePersonId, otherPersonId, maskSsn = true) => {
  const application = await initQuery(ctx).from(TABLE_NAME).where({ personId: otherPersonId }).update({ personId: basePersonId }).returning('*');

  return transformDALToApplicationData(application, maskSsn);
};

export const existsPersonApplication = async (ctx, personId, partyId) => {
  const personApplication = await initQuery(ctx).from(TABLE_NAME).where({ personId, partyId }).select(1).first();

  return !!personApplication;
};

export const savePersonApplicationEvent = async (ctx, personApplicationId, event, timezone) => {
  const query = `
    UPDATE db_namespace."${TABLE_NAME}"
    SET "tosEvents" = (
      CASE
          WHEN "tosEvents" IS NULL THEN '[]'::JSONB
          ELSE "tosEvents"
      END
    ) || :event::JSONB
    WHERE id = :personApplicationId
  `;

  const { row } = await rawStatement(ctx, query, [
    {
      personApplicationId,
      event: JSON.stringify({ ...event, createdAt: now({ timezone }) }),
    },
  ]);
  return row;
};

export const savePaymentLink = async (ctx, personApplicationId, paymentLink) => {
  const query = `
    UPDATE db_namespace."${TABLE_NAME}"
    SET "paymentLink" = :paymentLink
    WHERE id = :personApplicationId
  `;

  const { row } = await rawStatement(ctx, query, [
    {
      personApplicationId,
      paymentLink,
    },
  ]);
  return row;
};

export const getPersonApplicationsByApplicantIds = async (ctx, applicantIds) => {
  const query = `SELECT id, "applicantId", "sendSsnEnabled"
                 FROM db_namespace."rentapp_PersonApplication"
                 WHERE "applicantId" IN (${buildInClause(applicantIds, '')})
                 `;
  const { rows } = await rawStatement(ctx, query, [applicantIds]);

  return rows || [];
};

export const enableSSNSubmissionForApplicants = async (ctx, personApplicationIds) => {
  const query = `
    UPDATE db_namespace."${TABLE_NAME}"
    SET "sendSsnEnabled" = TRUE
    WHERE id IN (${buildInClause(personApplicationIds)})
    RETURNING id;
  `;

  const { row } = await rawStatement(ctx, query, [personApplicationIds]);
  return row;
};
