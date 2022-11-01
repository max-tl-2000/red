/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertInto, getOne, getOneForUpdate, runInTransaction, getOneWhere, getAllWhere, saveJSONBData } from '../../../server/database/factory';
import loggerModule from '../../../common/helpers/logger';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
const logger = loggerModule.child({ subType: 'partyApplicationRepo' });
const TABLE_NAME = 'rentapp_PartyApplication';
const PARTY_APP_DOC_TABLE_NAME = 'rentapp_partyApplicationDocuments';

export const createPartyApplication = async (ctx, partyApplicationRaw, options = {}) => await insertInto(ctx, TABLE_NAME, partyApplicationRaw, options);

export const getPartyApplication = async (ctx, partyApplicationId) => await getOne(ctx, TABLE_NAME, partyApplicationId);

export const getPartyApplicationByPartyId = async (ctx, partyId) => await initQuery(ctx).from(TABLE_NAME).where({ partyId }).first();

export const updatePartyApplication = async (ctx, id, applicationDecision, monthlyRent) =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    const partyApplication = await getOneForUpdate(innerCtx, TABLE_NAME, id, trx);
    if (!partyApplication) throw new Error('NO_PARTY_APPLICATION_FOR_ID');

    let newMaxApprovedAt = partyApplication.maxApprovedAt;
    let newMinDeniedAt = partyApplication.minDeniedAt;

    const maxApprovedAt = partyApplication.maxApprovedAt === null ? 0 : partyApplication.maxApprovedAt;
    const minDeniedAt = partyApplication.minDeniedAt === null ? 0 : partyApplication.minDeniedAt;

    if (applicationDecision === ScreeningDecision.APPROVED && monthlyRent > maxApprovedAt) {
      newMaxApprovedAt = monthlyRent;
    }

    if (applicationDecision !== ScreeningDecision.APPROVED && (monthlyRent < minDeniedAt || minDeniedAt <= 0)) {
      newMinDeniedAt = monthlyRent;
    }

    const data = {
      maxApprovedAt: newMaxApprovedAt,
      minDeniedAt: newMinDeniedAt,
      updated_at: new Date(),
    };

    return await initQuery(ctx).from(TABLE_NAME).where({ id }).update(data).returning('*').transacting(trx);
  }).catch(error => {
    logger.error({ error, ctx }, `[ERROR ON UPDATE PARTY APPLICATION] ${ctx.tenantId} ${TABLE_NAME} ${{ id }}`);
    throw error;
  });

export const upsertPartyApplication = async (ctx, partyApplicationRaw) =>
  await insertInto(ctx, TABLE_NAME, partyApplicationRaw, {
    updateOnConflict: true,
  });

export const getPartyDocuments = async (ctx, partyApplicationId) => await getAllWhere(ctx, PARTY_APP_DOC_TABLE_NAME, { partyApplicationId }, ['metadata']);

export const createPartyApplicationDocument = async (ctx, document) => await insertInto(ctx, PARTY_APP_DOC_TABLE_NAME, document);

export const getPartyApplicationByDocumentId = async (ctx, documentId) =>
  await initQuery(ctx)
    .from(PARTY_APP_DOC_TABLE_NAME)
    .join(TABLE_NAME, `${TABLE_NAME}.id`, `${PARTY_APP_DOC_TABLE_NAME}.partyApplicationId`)
    .whereRaw("metadata->>'documentId' = ?", [documentId])
    .first();

export const deletePartyApplicationDocument = async (ctx, partyApplicationId, documentId) =>
  await initQuery(ctx)
    .from(PARTY_APP_DOC_TABLE_NAME)
    .where('partyApplicationId', partyApplicationId)
    .whereRaw("metadata->>'documentId' = ?", [documentId])
    .del();

export const getApplicationDataForPartyApplication = async (ctx, id) => await getOneWhere(ctx, TABLE_NAME, { id }, ['applicationData']);

export const updatePartyApplicationApplicationData = async (ctx, id, applicationData) => {
  await saveJSONBData(ctx, TABLE_NAME, id, 'applicationData', applicationData);

  return await getPartyApplication(ctx, id);
};
