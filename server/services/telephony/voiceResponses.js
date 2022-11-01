/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import range from 'lodash/range';
import { Response } from 'plivo';
import * as resources from './resources';
import config from '../../config';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import loggerModule from '../../../common/helpers/logger';
import * as voiceMessages from './voiceMessages';
import { formatVoiceRecordingUrl } from '../../workers/upload/uploadUtil';

const { telephony } = config;
const logger = loggerModule.child({ subType: 'voiceResponses' });

const isMessageMp3 = message => message.endsWith('.mp3');
const getVoiceMessageUrl = (ctx, filePath) => formatVoiceRecordingUrl(ctx.tenantId, filePath);

const repeatCountForDigitsMesage = 10;
const repeatCountForDigitsAndRecordingMessage = 1;

export const addVoiceMessageToResponse = (ctx, response, message) => {
  isMessageMp3(message) ? response.addPlay(getVoiceMessageUrl(ctx, message)) : response.addSpeak(message, resources.speakParams);
};

const addRecordToResponse = ({ response, callRecordingUrl, commId, extraHeaders }) =>
  response.addRecord({
    action: addParamsToUrl(callRecordingUrl, { isVoiceMail: true, commId, ...extraHeaders }),
    maxLength: telephony.voiceMailMaxRecordingDuration,
    finishOnKey: telephony.stopRecordingVoiceMailKey,
  });

const getResponseWithDigits = ({ ctx, digitsPressedUrl, commId, programId, teamMemberId, teamId, messageType, message, repeat }) => {
  const digitsUrl = addParamsToUrl(digitsPressedUrl, {
    commId,
    programId,
    teamMemberId,
    teamId,
    voiceMessageType: messageType,
  });
  const response = new Response();
  const digits = response.addGetDigits({ action: digitsUrl, numDigits: 1, timeout: 1 });

  range(repeat).forEach(() => {
    addVoiceMessageToResponse(ctx, digits, message);
    const delayInSeconds = 5;
    digits.addWait({ length: delayInSeconds });
  });
  return response;
};

const createVoiceMailWithIVRResponse = async ({
  ctx,
  commId,
  message = resources.DEFAULT_UNAVAILABLE_MESSAGE,
  programId,
  teamMemberId,
  teamId,
  messageType,
  ...extraHeaders
}) => {
  logger.trace({ ctx, message }, 'creating interactive voice response for call with recording');

  const { digitsPressedUrl, callRecordingUrl } = await getTelephonyConfigs(ctx);

  const response = await getResponseWithDigits({
    ctx,
    digitsPressedUrl,
    commId,
    programId,
    teamMemberId,
    teamId,
    messageType,
    message,
    repeat: repeatCountForDigitsAndRecordingMessage,
  });

  const voiceMessage = '';
  // based on CPM-16287 : we need to be able to accept voice messages that accept both digits pressed and recording
  // so in order to do this we join up the normal voice message with keys and another one with one with recording
  // the one with recording has doesn't have text and after it "plays" nothing, it starts recording

  addVoiceMessageToResponse(ctx, response, voiceMessage);

  addRecordToResponse({ response, callRecordingUrl, commId, extraHeaders });
  return response.toXML();
};

export const createVoiceMailResponse = async ({ ctx, commId, message = resources.DEFAULT_UNAVAILABLE_MESSAGE, ...extraHeaders }) => {
  logger.trace({ ctx, message }, 'creating voicemail response for call');

  const response = new Response();
  const voiceMessage = message || resources.DEFAULT_UNAVAILABLE_MESSAGE;
  addVoiceMessageToResponse(ctx, response, voiceMessage);

  const { callRecordingUrl } = await getTelephonyConfigs(ctx);
  addRecordToResponse({ response, callRecordingUrl, commId, extraHeaders });

  return response.toXML();
};

const createInteractiveVoiceResponse = async ({ ctx, commId, message, messageType, programId, teamMemberId, teamId }) => {
  logger.trace({ ctx, message }, 'creating interactive voice response for call');

  const { digitsPressedUrl } = await getTelephonyConfigs(ctx);

  const response = await getResponseWithDigits({
    ctx,
    digitsPressedUrl,
    commId,
    programId,
    teamMemberId,
    teamId,
    messageType,
    message,
    repeat: repeatCountForDigitsMesage,
  });
  return response.toXML();
};

export const createVoiceResponse = async (ctx, { commId, programId, teamMemberId, teamId, messageType, ...extraHeaders }) => {
  logger.trace({ ctx, commId, programId, teamMemberId, teamId, messageType, ...extraHeaders }, 'createResponse - params');
  const { message, shouldRecord, hasIVR } = await voiceMessages.getVoiceMessage(ctx, { programId, teamMemberId, teamId, messageType });

  if (shouldRecord && hasIVR) return createVoiceMailWithIVRResponse({ ctx, commId, message, messageType, programId, teamMemberId, teamId, ...extraHeaders });

  if (shouldRecord) return createVoiceMailResponse({ ctx, commId, message, ...extraHeaders });
  return createInteractiveVoiceResponse({ ctx, commId, message, messageType, programId, teamMemberId, teamId });
};
