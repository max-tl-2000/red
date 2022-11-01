/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import replace from 'lodash/replace';
import { Response } from 'plivo';
import { APP_EXCHANGE, UPLOAD_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../pubsub';
import * as repo from '../../dal/voiceMessageRepo';
import { ServiceError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { addVoiceMessageToResponse } from './voiceResponses';

const logger = loggerModule.child({ subType: 'voiceMessages' });

const menuItemRegex = /%(\w+-?)*%/gm;
const getRawMenuItems = message => message.match(menuItemRegex) || [];
export const getMenuItemNames = message => getRawMenuItems(message).map(k => k.slice(1, k.length - 1));

const messageIsIVR = message => /%(\w+-?)*%/m.test(message);
export const shouldRecordAfterMessage = message => /\[record\]$/m.test(message);
const withoutRecordingMark = message => message.replace(/\[record\]$/m, '');

const enhanceMessageWithDialKeys = async (ctx, message) => {
  const messageMenuNames = getMenuItemNames(message);
  const menuItems = await repo.getMenuItemsByNames(ctx, messageMenuNames);

  return menuItems.reduce((completeMessage, currentItem) => {
    const { name, key } = currentItem;
    return replace(completeMessage, `%${name}%`, key);
  }, message);
};

const enhance = async (ctx, message) => {
  if (!messageIsIVR(message) && !shouldRecordAfterMessage(message)) return { message };
  let newMessage = {};
  if (shouldRecordAfterMessage(message)) {
    newMessage = { message: withoutRecordingMark(message), shouldRecord: true };
  }
  if (messageIsIVR(message)) {
    const messageWithDialKeys = await enhanceMessageWithDialKeys(ctx, newMessage.message || message);
    newMessage = { ...newMessage, message: messageWithDialKeys, hasIVR: true };
  }

  return newMessage;
};

const getRawMessages = async (ctx, { programId, teamMemberId, teamId }) => {
  if (programId) return await repo.getVoiceMessagesByProgramId(ctx, programId);
  if (teamMemberId) return await repo.getVoiceMessagesByTeamMemberId(ctx, teamMemberId);
  if (teamId) return repo.getVoiceMessagesByTeamId(ctx, teamId);

  throw new ServiceError({ token: 'INVALID_CALL_TARGET_TYPE', status: 412 });
};

export const getVoiceMessage = async (ctx, { messageType, ...target }) => {
  logger.trace({ ctx, messageType, ...target }, 'getVoiceMessage - params');
  const messages = await getRawMessages(ctx, target);
  return enhance(ctx, messages[messageType]);
};

export const getHoldingMusic = async (ctx, target) => {
  logger.trace({ ctx, ...target }, 'getHoldingMusic - params');
  const messages = await getRawMessages(ctx, target);
  return messages.holdingMusic;
};

export const getMenuItemsByTargetIdAndMsgType = async (ctx, { messageType, ...target }) => {
  logger.trace({ ctx, ...target, messageType }, 'getMenuItemsByTargetIdAndMsgType - params');
  const messages = await getRawMessages(ctx, target);
  const menuItemNames = getMenuItemNames(messages[messageType]);
  return await repo.getMenuItemsByNames(ctx, menuItemNames);
};

export const createCallBackRequestAckResponse = async (ctx, targetId) => {
  logger.trace({ ctx, ...targetId }, 'createCallBackRequestAckResponse - params');
  const response = new Response();
  const { message: callBackRequestAckMessage } = await getVoiceMessage(ctx, {
    ...targetId,
    messageType: DALTypes.VoiceMessageType.CALL_BACK_REQUEST_ACK,
  });

  addVoiceMessageToResponse(ctx, response, callBackRequestAckMessage);
  return response.toXML();
};

export const uploadVoiceMessages = async (ctx, files) => {
  const payload = {
    tenantId: ctx.tenantId,
    authUser: ctx.authUser,
    metadata: {
      files,
    },
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: UPLOAD_MESSAGE_TYPE.UPLOAD_VOICE_MESSAGE,
    message: payload,
  });

  return files;
};
