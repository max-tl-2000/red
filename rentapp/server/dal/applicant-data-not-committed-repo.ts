/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertInto, rawStatement, update } from '../../../server/database/factory';
import { IDbContext } from '../../../common/types/base-types';
import { IApplicantDataNotCommitted } from '../helpers/applicant-types';

const APPLICANT_DATA_NOT_COMMITTED_TABLE_NAME = 'ApplicantDataNotCommitted';

export const createApplicantDataNotCommitted = async (ctx: IDbContext, applicantData: IApplicantDataNotCommitted): Promise<IApplicantDataNotCommitted> =>
  (await insertInto(ctx, APPLICANT_DATA_NOT_COMMITTED_TABLE_NAME, applicantData)) as IApplicantDataNotCommitted;

export const updateApplicantDataNotCommitted = async (
  ctx: IDbContext,
  id: string,
  applicantData: IApplicantDataNotCommitted,
): Promise<IApplicantDataNotCommitted[]> => (await update(ctx, APPLICANT_DATA_NOT_COMMITTED_TABLE_NAME, { id }, applicantData)) as IApplicantDataNotCommitted[];

export const getApplicantDataNotCommittedByPersonIdAndPartyId = async (
  ctx: IDbContext,
  personId: string,
  partyId: string,
): Promise<IApplicantDataNotCommitted> => {
  const query = `SELECT * FROM db_namespace."${APPLICANT_DATA_NOT_COMMITTED_TABLE_NAME}"
    WHERE "personId" = :personId
    AND "partyId" = :partyId
    ORDER BY created_at DESC
    LIMIT 1;`;

  const { rows } = await rawStatement(ctx, query, [{ personId, partyId }] as never[]);

  return rows[0] as IApplicantDataNotCommitted;
};

export const getApplicantDataNotCommittedByPersonIdAndPartyApplicationId = async (
  ctx: IDbContext,
  personId: string,
  partyApplicationId: string,
): Promise<IApplicantDataNotCommitted> => {
  const query = `SELECT * FROM db_namespace."${APPLICANT_DATA_NOT_COMMITTED_TABLE_NAME}"
    WHERE "personId" = :personId
    AND "partyApplicationId" = :partyApplicationId
    ORDER BY created_at DESC
    LIMIT 1;`;

  const { rows } = await rawStatement(ctx, query, [{ personId, partyApplicationId }] as never[]);

  return rows[0] as IApplicantDataNotCommitted;
};

export const getApplicantDataNotCommittedByPersonId = async (ctx: IDbContext, personId: string): Promise<IApplicantDataNotCommitted[]> => {
  const query = `SELECT * FROM db_namespace."${APPLICANT_DATA_NOT_COMMITTED_TABLE_NAME}"
    WHERE "personId" = :personId
    ORDER BY created_at DESC`;

  const { rows } = await rawStatement(ctx, query, [{ personId }] as never[]);

  return rows as IApplicantDataNotCommitted[];
};

export const getApplicantDataNotCommittedById = async (ctx: IDbContext, id: string): Promise<IApplicantDataNotCommitted> => {
  const query = `SELECT * FROM db_namespace."${APPLICANT_DATA_NOT_COMMITTED_TABLE_NAME}" WHERE id = :id`;

  const { rows } = await rawStatement(ctx, query, [{ id }] as never[]);

  return rows[0] as IApplicantDataNotCommitted;
};

export const hasPaidApplication = async (ctx: IDbContext, personId: string, partyId: string): Promise<boolean> =>
  (await getApplicantDataNotCommittedByPersonIdAndPartyId(ctx, personId, partyId)).paymentCompleted || false;
