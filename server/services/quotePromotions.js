/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ActionTypes } from '../../common/enums/actionTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import * as partyRepo from '../dal/partyRepo';
import { getQuoteById, isRenewalQuote } from '../dal/quoteRepo';
import { runInTransaction } from '../database/factory';
import { validateActionOnInventory } from './inventories';
import { sendApplicationDeclinedMsg } from './mjmlEmails/applicationEmails';
import { performPartyStateTransition } from './partyStatesTransitions';
import { createLease } from './leases/leaseService';
import { getQuotePromotionLogEntry } from '../helpers/quotes';
import { sendMessageToProcessNotifyConditionalApproval } from '../helpers/taskUtils';
import { logEntity } from './activityLogService';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';

import logger from '../../common/helpers/logger';
import { loadPartyById } from './party';
import { isCorporateLeaseType } from './helpers/party';
import { setCachedEntity, getCachedEntity } from '../helpers/cacheHelper';
import * as eventService from './partyEvent';
import { now } from '../../common/helpers/moment-utils';
import { getCommunicationsForPartyByCategory } from '../dal/communicationRepo';
import { getSenderInfo } from '../helpers/mails';

import { nonNullishProps } from '../../common/assert';

const getPropertyIdForQuote = async (ctx, quoteId) => {
  const quote = await getQuoteById(ctx, quoteId);
  return quote.inventory.property.id;
};

const processApprovalPromotion = async (ctx, partyId, updatedQuotePromotion, conditions, party) => {
  const { quoteId, id: quotePromotionId } = updatedQuotePromotion;
  const {
    inventory: {
      id: inventoryId,
      property: { displayName: propertyName },
    },
  } = await getQuoteById(ctx, quoteId);
  const myLogCtx = {
    ctx,
    partyId,
    inventoryId,
    conditions,
    quotePromotionId,
  };
  logger.info(myLogCtx, 'processApprovalPromotion');

  await validateActionOnInventory(ctx, ActionTypes.CREATE_LEASE, {
    inventoryId,
    partyId,
  });

  const lease = await createLease(ctx, quotePromotionId, conditions);
  const propertyId = await getPropertyIdForQuote(ctx, lease.quoteId);
  if (party.assignedPropertyId !== propertyId) {
    logger.info({ ...myLogCtx, assignedPropertyId: propertyId }, 'processApprovalPromotion updating assigned property');
    await partyRepo.updateParty(ctx, {
      id: partyId,
      assignedPropertyId: propertyId,
    });
    await logEntity(ctx, {
      entity: {
        id: partyId,
        primaryProperty: propertyName,
        reason: 'Approved application for promoted quote',
        CreatedByType: DALTypes.CreatedByType.SYSTEM,
      },
      activityType: ACTIVITY_TYPES.UPDATE,
      component: COMPONENT_TYPES.PARTY,
    });
  }
  await eventService.saveQuotePromotionUpdatedEvent(ctx, {
    partyId,
    userId: (ctx.authUser || {}).id,
    metadata: {
      quotePromotionId,
      leaseId: lease.id,
    },
  });

  const idAdditionalDeposit = conditions && conditions.additionalDeposit;
  if (idAdditionalDeposit) {
    logger.info(myLogCtx, 'sending message to create notify additional deposit required');
    await sendMessageToProcessNotifyConditionalApproval(ctx, partyId, quotePromotionId, conditions);
  }

  const logEntry = await getQuotePromotionLogEntry(ctx, updatedQuotePromotion, conditions);
  await logEntity(ctx, {
    entity: {
      ...logEntry,
      ...(idAdditionalDeposit
        ? {
            deposit: conditions.additionalDepositAmount,
          }
        : {}),
    },
    activityType: ACTIVITY_TYPES.APPROVE,
    component: COMPONENT_TYPES.APPLICATION,
  });

  logger.info(myLogCtx, 'processApprovalPromotion complete');

  return lease;
};

export const getAllScreeningResultsForParty = (ctx, partyId) => {
  // TODO: properly factorize this module so it doesn't require party from
  // services/screening
  const { getScreeningResultsForParty } = require('../../rentapp/server/services/screening'); // eslint-disable-line global-require
  return getScreeningResultsForParty(ctx, partyId);
};

export const loadAllQuotePromotions = (ctx, partyId) => partyRepo.loadAllQuotePromotions(ctx, partyId);

export const approvedQuotePromotionsExist = async (ctx, partyId, status) => {
  const approvedPromotions = await partyRepo.getQuotePromotionsByStatus(ctx, partyId, status);
  return approvedPromotions && !!approvedPromotions.length;
};

export const loadQuotePromotion = (ctx, quotePromotionId) => partyRepo.loadQuotePromotion(ctx, quotePromotionId);

export const getNonCanceledQuotePromotionByPartyId = (ctx, partyId) => partyRepo.getNonCanceledQuotePromotionByPartyId(ctx, partyId);

export const getQuotePromotionsByQuoteId = (tenantId, partyId) => partyRepo.getQuotePromotionsByQuoteId(tenantId, partyId);

const processDeclinePromotion = async (req, partyId, updatedQuotePromotion, conditions) => {
  const logEntry = await getQuotePromotionLogEntry(req, updatedQuotePromotion, conditions);
  await logEntity(req, { entity: logEntry, activityType: ACTIVITY_TYPES.DECLINE, component: COMPONENT_TYPES.APPLICATION });
};

export const sendApplicationDeclinedComm = async (req, emailInfo) => {
  // "from" here is the userId of the sender
  nonNullishProps(emailInfo, ['partyId', 'personIds', 'templateName', 'senderId']);
  const { partyId, personIds, templateName, senderId } = emailInfo;

  logger.trace({ ctx: req, partyId, personIds, templateName, senderId }, 'sendApplicationDeclinedComm');

  const appplicationDeniedComms = await getCommunicationsForPartyByCategory(req, partyId, DALTypes.CommunicationCategory.APPLICATION_DECLINED);

  if (appplicationDeniedComms.length) {
    logger.trace({ ctx: req, partyId, personIds }, 'sendApplicationDeclinedComm - an application declined communication was already sent, will not send again');
    return;
  }

  const sender = await getSenderInfo(req, emailInfo);
  const emailTemplateData = { partyId, personIds, sender };

  await sendApplicationDeclinedMsg(req, emailTemplateData, templateName);
};

const enhanceQuotePromotion = (ctx, quotePromotion) => {
  const userId = (ctx.authUser || {}).id;
  const enhancedQuotePromotion =
    quotePromotion.promotionStatus === DALTypes.PromotionStatus.APPROVED ? { ...quotePromotion, approvedBy: userId, approvalDate: now() } : quotePromotion;
  enhancedQuotePromotion.modified_by = userId;
  return enhancedQuotePromotion;
};

const shouldCreateConditionalApprovalTask = conditions => {
  if (!conditions) return false;

  if (conditions.additionalDeposit || conditions.npsRentAssurance || conditions.sureDeposit) return true;

  return false;
};

// TODO: rename to reflect it also can update
export const insertQuotePromotion = async (ctx, quotePromotion, createApprovalTask, conditions) => {
  const { quoteId, leaseTermId, promotionStatus } = quotePromotion;
  const quote = await getQuoteById(ctx, quoteId);
  setCachedEntity(ctx, { type: 'quote', id: quoteId, entity: quote });
  const {
    inventory: {
      id: inventoryId,
      property: { id: propertyId },
    },
    partyId,
  } = quote;

  const promotionLogCtx = {
    ctx,
    inventoryId,
    partyId,
    quoteId,
    leaseTermId,
    promotionStatus,
    createApprovalTask,
    conditions,
  };
  logger.info(promotionLogCtx, 'insert quote promotion');

  await validateActionOnInventory(ctx, ActionTypes.PROMOTE_QUOTE, {
    inventoryId,
    partyId,
  });

  const result = await runInTransaction(async trx => {
    // TODO: decompose this inner code
    const innerCtx = { ...ctx, trx };
    const isCorporateParty = await isCorporateLeaseType(innerCtx, partyId);
    if (!isCorporateParty) {
      // TODO: single query
      const promotionWithRequireWorkStatus = (
        getCachedEntity(ctx, { type: 'quotePromotions', id: partyId }) || (await loadAllQuotePromotions(innerCtx, quotePromotion.partyId))
      ).find(promotion => promotion.promotionStatus === DALTypes.PromotionStatus.REQUIRES_WORK);
      if (promotionWithRequireWorkStatus) {
        logger.info({ ctx, quotePromotion: promotionWithRequireWorkStatus }, 'updateQuotePromotion');
        await partyRepo.updateQuotePromotion(innerCtx, promotionWithRequireWorkStatus.id, { promotionStatus: DALTypes.PromotionStatus.CANCELED });
      }
    }

    const enhancedQuotePromotion = enhanceQuotePromotion(innerCtx, quotePromotion);
    const newPromotion = await partyRepo.insertQuotePromotion(innerCtx, enhancedQuotePromotion);

    const logEntry = await getQuotePromotionLogEntry(innerCtx, newPromotion, conditions);

    let lease;
    if (promotionStatus === DALTypes.PromotionStatus.APPROVED) {
      const createConditionalApprovalTask = shouldCreateConditionalApprovalTask(conditions);
      if (createConditionalApprovalTask) {
        logger.info(promotionLogCtx, 'sending message to create notify additional deposit required');
        await sendMessageToProcessNotifyConditionalApproval(ctx, partyId, newPromotion.id, conditions);
      }

      logger.trace(promotionLogCtx, 'creating lease for approved promotion');
      lease = await createLease(innerCtx, newPromotion.id, conditions);

      logger.info({ ctx: innerCtx, partyId, propertyId }, 'updating assignedPropertyId after approval');
      await partyRepo.updateParty(innerCtx, {
        id: partyId,
        assignedPropertyId: propertyId,
      });
    }

    // TODO: this should be a part of the updateParty flow, not specific to quote promotions!
    logger.trace(promotionLogCtx, 'notifying party details changed');
    const party = getCachedEntity(ctx, { type: 'party', id: partyId }) || (await loadPartyById(innerCtx, partyId));
    notify({
      ctx: innerCtx,
      event: eventTypes.PARTY_DETAILS_UPDATED,
      data: { partyId },
      routing: { teams: party.teams },
    });

    const isRenewalParty = await isRenewalQuote(ctx, quoteId);
    if (!isCorporateParty && !isRenewalParty) await performPartyStateTransition(innerCtx, partyId);

    await logEntity(innerCtx, { entity: logEntry, activityType: ACTIVITY_TYPES.UPDATE, component: COMPONENT_TYPES.QUOTE });
    logger.info({ ...promotionLogCtx, quotePromotionId: newPromotion.id }, 'insert quote promotion complete');

    return {
      quotePromotion: newPromotion,
      lease,
    };
  }, ctx);

  await eventService.saveQuotePromotionUpdatedEvent(ctx, {
    partyId,
    userId: (ctx.authUser || {}).id,
    metadata: {
      quotePromotionId: result.quotePromotion.id,
      leaseId: result.lease?.id || null,
      handleReviewApplicationTask: !!createApprovalTask,
    },
  });

  return result;
};

export const updateQuotePromotion = async (ctx, partyId, quotePromotionId, promotionStatus, conditions) => {
  logger.info(
    {
      ctx,
      partyId,
      quotePromotionId,
      promotionStatus,
      leaseTermId: conditions.leaseTermId,
    },
    'updateQuotePrommotion',
  );
  const party = await partyRepo.loadPartyById(ctx, partyId);

  const result = await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };

    const enhancedQuotePromotion = enhanceQuotePromotion(ctx, { promotionStatus });

    const updatedQuotePromotion = await partyRepo.updateQuotePromotion(innerCtx, quotePromotionId, {
      promotionStatus: enhancedQuotePromotion.promotionStatus,
      leaseTermId: conditions.leaseTermId,
      modifiedBy: enhancedQuotePromotion.modified_by,
      approvedBy: enhancedQuotePromotion.approvedBy,
      approvalDate: enhancedQuotePromotion.approvalDate,
    });
    let lease;

    switch (promotionStatus) {
      case DALTypes.PromotionStatus.APPROVED:
        lease = await processApprovalPromotion(innerCtx, partyId, updatedQuotePromotion, conditions, party);
        break;
      case DALTypes.PromotionStatus.CANCELED:
        await processDeclinePromotion(innerCtx, partyId, updatedQuotePromotion, conditions);
        break;
      case DALTypes.PromotionStatus.REQUIRES_WORK:
        break;
      default:
        logger.warn({ ctx, partyId, quotePromotionId, promotionStatus }, 'unknown promotion status');
    }

    const partyEvent = {
      partyId,
      userId: (ctx.authUser || {}).id,
      metadata: {
        ...(enhancedQuotePromotion?.modified_by ? { promoterUserId: enhancedQuotePromotion.modified_by } : {}),
        applicationStatus: promotionStatus,
        ...(conditions?.skipEmail ? { skipEmail: conditions.skipEmail } : {}),
        ...(conditions?.createDeclinedTask ? { createDeclinedTask: conditions.createDeclinedTask } : {}),
      },
    };

    await eventService.saveApplicationStatusUpdatedEvent(innerCtx, partyEvent);

    notify({
      ctx: innerCtx,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId },
      routing: { teams: party.teams },
    });
    return { quotePromotion: updatedQuotePromotion, lease };
  }, ctx);

  return result;
};
