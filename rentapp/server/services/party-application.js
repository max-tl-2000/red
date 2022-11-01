/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError, BadRequestError } from '../../../server/common/errors';
import * as dal from '../dal/party-application-repo';
import { fetchDocumentsMetadataTemplate } from './documents';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../../../server/helpers/message-constants';
import { sendMessage } from '../../../server/services/pubsub';
import { loadPartyById } from '../../../server/services/party';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { addItemToList, removeItemList, isEmptyList, convertToStringifyList } from '../../../common/helpers/list-utils';
import { getPublishedQuotesLengthByPartyId } from '../../../server/dal/quoteRepo';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'personApplicationService' });
import { getScreeningVersionOrdinal } from '../../../common/enums/screeningReportTypes';
import { getScreeningVersion } from '../helpers/screening-helper';

export const createPartyApplication = async (ctx, partyApplicationRaw) => {
  const { tenantId } = ctx;
  const { partyApplicationId, partyId } = partyApplicationRaw;
  logger.info({ ctx, partyApplicationId, partyId }, 'createPartyApplication');

  if (partyApplicationId) {
    throw new ServiceError({ token: 'ILLEGAL_PARAMETER_ID', status: 400 });
  }
  if (!tenantId) {
    throw new ServiceError({ token: 'MISSING_TENANT_ID', status: 400 });
  }
  if (!partyId) {
    throw new ServiceError({
      token: 'MISSING_PARTY_ID',
      status: 400,
    });
  }

  partyApplicationRaw.screeningVersion = getScreeningVersionOrdinal(await getScreeningVersion({ tenantId, partyId }));

  return await dal.upsertPartyApplication(ctx, partyApplicationRaw);
};

export const getPartyApplication = (ctx, partyApplicationId) => {
  logger.info({ ctx, partyApplicationId }, 'getPartyApplication');
  const { tenantId } = ctx;

  if (!partyApplicationId) {
    throw new ServiceError({
      token: 'MISSING_PARTY_APPLICATION_ID',
      status: 400,
    });
  }
  if (!tenantId) {
    throw new ServiceError({ token: 'MISSING_TENANT_ID', status: 400 });
  }
  return dal.getPartyApplication(ctx, partyApplicationId);
};

export const getPartyApplicationByPartyId = async (ctx, partyId) => await dal.getPartyApplicationByPartyId(ctx, partyId);

export const getDocumentsByPartyApplicationId = async (ctx, partyApplicationId) =>
  await fetchDocumentsMetadataTemplate(ctx, {
    validate: () => {
      if (!partyApplicationId) {
        throw new BadRequestError('MISSING_PARTY_APPLICATION_ID');
      }
      if (!ctx.tenantId) throw new BadRequestError('MISSING_TENANT_ID');
    },
    getDocumentList: async () => await dal.getPartyDocuments(ctx, partyApplicationId),
  });

export const createPartyApplicationDocument = (ctx, partyApplicationId, document) => {
  const metadata = {
    documentId: document.documentId,
    accessType: document.accessType,
    uploadingUser: document.metadata.document.uploadingUser,
    documentName: document.metadata.file.originalName,
  };

  return dal.createPartyApplicationDocument(ctx, {
    partyApplicationId,
    metadata,
  });
};

export const getPartyApplicationByDocumentId = async (ctx, documentId) => await dal.getPartyApplicationByDocumentId(ctx, documentId);

export const deletePartyApplicationDocument = async (ctx, partyApplicationId, documentId) =>
  await dal.deletePartyApplicationDocument(ctx, partyApplicationId, documentId);

export const updatePartyApplicationHold = async (ctx, { partyId, isHeld, holdReason = '' }) => {
  let partyApplication = (await getPartyApplicationByPartyId(ctx, partyId)) || {};
  if (isHeld) {
    holdReason = addItemToList(partyApplication.holdReason, holdReason);
  } else {
    holdReason = removeItemList(partyApplication.holdReason, holdReason);
    // if after remove the current reason we have more items, it means the party application will be still hold
    if (!isEmptyList(holdReason)) isHeld = true;
  }
  holdReason = convertToStringifyList(holdReason);
  if (holdReason === (partyApplication && partyApplication.holdReason)) {
    return { isHeld };
  }
  if (!Object.keys(partyApplication).length) {
    logger.debug({ ctx, partyId, isHeld, holdReason }, 'updatePartyApplicationHold no party application found -- creating');
    partyApplication = await createPartyApplication(ctx, { partyId, isHeld, holdReason });
  } else {
    logger.debug(
      {
        ctx,
        partyId,
        isHeld,
        holdReason,
        partyApplicationId: partyApplication.id,
      },
      'updatePartyApplicationHold party application found -- updating',
    );
    partyApplication = await dal.upsertPartyApplication(ctx, { ...partyApplication, isHeld, holdReason });
  }
  return partyApplication;
};

export const holdApplicationStatus = async (ctx, partyId, isHeld = true, holdReason = '') => {
  const { tenantId } = ctx;
  logger.info({ ctx, partyId, isHeld, holdReason }, 'holdApplicationStatus about to update status');
  const partyApplication = await updatePartyApplicationHold(ctx, { partyId, isHeld, holdReason });
  const areTherePublishedQuotes = !!(await getPublishedQuotesLengthByPartyId(ctx, partyId));
  if (!partyApplication.isHeld && areTherePublishedQuotes) {
    const message = { tenantId, partyId };
    logger.info(message, 'Resuming application screening');
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: SCREENING_MESSAGE_TYPE.APPLICATION_HOLD_STATUS_CHANGED,
      message,
      ctx,
    });
  }

  const party = await loadPartyById(ctx, partyId);
  notify({
    ctx,
    event: eventTypes.PARTY_DETAILS_UPDATED,
    data: { partyId },
    routing: { teams: party.teams },
  });

  return partyApplication;
};

export const rerunScreening = async (ctx, partyId) => {
  const { tenantId } = ctx;
  const message = { tenantId, partyId };

  notify({
    ctx,
    event: eventTypes.PARTY_DETAILS_UPDATED,
    data: { partyId }, // isn't teams missing here?
  });

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.RERUN_EXPIRED_SCREENING,
    message,
    ctx,
  });

  return true;
};

export const forceRescreening = async (ctx, partyId, screeningTypeRequested) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.FORCE_RESCREENING_REQUESTED,
    message: { tenantId: ctx.tenantId, authUser: ctx.authUser, partyId, screeningTypeRequested },
    ctx,
  });

export const getApplicationDataForPartyApplication = async (ctx, partyApplicationId) => {
  logger.debug({ ctx, partyApplicationId }, 'getApplicationDataForPartyApplication');

  return await dal.getApplicationDataForPartyApplication(ctx, partyApplicationId);
};

export const updatePartyApplicationApplicationData = (ctx, partyApplicationId, applicationData) => {
  logger.debug({ ctx, partyApplicationId }, 'updatePartyApplicationApplicationData');

  return dal.updatePartyApplicationApplicationData(ctx, partyApplicationId, applicationData);
};
