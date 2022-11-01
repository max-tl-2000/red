/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { DALTypes } from '../../common/enums/DALTypes';
import { APP_EXCHANGE, TASKS_MESSAGE_TYPE } from './message-constants';
import { sendMessage } from '../services/pubsub';
import { getTenantSettings } from '../services/tenantService';

let getMessageIdForTask = newId;
export const setGetMessageIdForTaskFunction = externalFunction => {
  getMessageIdForTask = externalFunction;
};

export const basicMessageContent = async ctx => {
  const tenantSettings = await getTenantSettings(ctx);

  return {
    id: getMessageIdForTask(),
    tenantId: ctx.tenantId,
    tenantName: ctx.tenantName,
    userId: ctx.authUser && ctx.authUser.id,
    authUser: ctx.authUser,
    tenantSettings,
  };
};

export const callSendMessage = async (messageType, messageContent, ctx) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: messageType,
    message: messageContent,
    ctx,
  });

export const sendMessageToCompleteFollowupPartyTasks = async (ctx, partyIds) => {
  const basicMessageContentData = await basicMessageContent(ctx);
  return await callSendMessage(
    TASKS_MESSAGE_TYPE.COMPLETE_ON_DEMAND,
    {
      ...basicMessageContentData,
      tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY],
      partyIds,
    },
    ctx,
  );
};

export const sendMessageToProcessNotifyConditionalApproval = async (ctx, partyId, promotedQuoteId, conditions) => {
  const basicMessageContentData = await basicMessageContent(ctx);
  return await callSendMessage(
    TASKS_MESSAGE_TYPE.PROCESS_ON_DEMAND,
    {
      ...basicMessageContentData,
      tasks: [DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL],
      partyIds: [partyId],
      metadata: {
        conditions,
        promotedQuoteId,
      },
    },
    ctx,
  );
};

export const sendMessageToCancelNotifyConditionalApprovalTask = async (ctx, partyId) => {
  const basicMessageContentData = await basicMessageContent(ctx);
  return await callSendMessage(
    TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND,
    {
      ...basicMessageContentData,
      tasks: [DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL],
      partyId,
    },
    ctx,
  );
};

export const sendMessageToProcessPlaceInventoryOnHoldTask = async (ctx, partyId, metadata) => {
  const basicMessageContentData = await basicMessageContent(ctx);
  return await callSendMessage(
    TASKS_MESSAGE_TYPE.PROCESS_ON_DEMAND,
    {
      ...basicMessageContentData,
      tasks: [DALTypes.TaskNames.HOLD_INVENTORY],
      partyIds: [partyId],
      metadata,
    },
    ctx,
  );
};

export const sendMessageToCompletePlaceInventoryOnHoldTask = async (ctx, partyId) => {
  const basicMessageContentData = await basicMessageContent(ctx);
  return await callSendMessage(
    TASKS_MESSAGE_TYPE.COMPLETE_ON_DEMAND,
    {
      ...basicMessageContentData,
      tasks: [DALTypes.TaskNames.HOLD_INVENTORY],
      partyIds: [partyId],
    },
    ctx,
  );
};

export const sendMessageToCancelAutomaticTaskBeforeQuotePromotion = async (ctx, partyId) => {
  const basicMessageContentData = await basicMessageContent(ctx);
  return await callSendMessage(
    TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND,
    {
      ...basicMessageContentData,
      tasks: [DALTypes.TaskNames.INTRODUCE_YOURSELF, DALTypes.TaskNames.FOLLOWUP_PARTY],
      partyId,
      skipAllowedTaskValidation: true, // We need to cancel existing tasks in a corporate party
    },
    ctx,
  );
};
