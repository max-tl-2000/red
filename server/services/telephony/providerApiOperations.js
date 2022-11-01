/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Client } from 'plivo';
import config from '../../config';
import loggerModule from '../../../common/helpers/logger';

const { telephony, isIntegration } = config;

const logger = loggerModule.child({ subType: 'telephony-plivo' });

const client = ({ authId, authToken } = telephony.plivoAuth) => new Client(authId, authToken);

const handleNotFoundTransfer = error => {
  logger.error({ err: error }, 'error when calling plivo apis - transfer');
  if (error.message && error.message.includes('not found')) return { notFound: true };
  throw error;
};

const handleNotFoundLiveCall = error => {
  // Muting this error for now. It still happens but not as ogten, and we need to reduce noise in slack channel
  logger.warn({ err: error }, 'error when calling plivo apis - livecall');
  if (error.message && error.message.includes('not found')) return { notFound: true };
  throw error;
};

const handleNotFound = error => {
  if (error.message && error.message.includes('not found')) return { notFound: true };
  throw error;
};

const plivoOps = {
  transferCall: (auth, { callId, ...params }) => client(auth).calls.transfer(callId, params).catch(handleNotFoundTransfer),
  makeCall: (auth, { from, to, answerUrl, ...params }) => client(auth).calls.create(from, to, answerUrl, params),
  stopRecording: (auth, { callId, ...params }) => client(auth).calls.stopRecording(callId, params).catch(handleNotFound),
  holdCall: (auth, { callId, holdingMusicUrl, ...params }) => client(auth).calls.playMusic(callId, holdingMusicUrl, params).catch(handleNotFound),
  unholdCall: (auth, { callId }) => client(auth).calls.stopPlayingMusic(callId).catch(handleNotFound),
  deleteRecording: (auth, { id }) => client(auth).recordings.delete(id).catch(handleNotFound),
  getEndpoint: id => client().endpoints.get(id), // shouldn't this also need the auth object?
  getLiveCalls: auth => client(auth).calls.listLiveCalls(),
  getLiveCall: (auth, { callId }) => client(auth).calls.getLiveCall(callId).catch(handleNotFoundLiveCall),
  getCallDetails: (auth, { callId }) => client(auth).calls.get(callId).catch(handleNotFound),
  hangupCall: (auth, { callId }) => client(auth).calls.hangup(callId),
  getLiveConference: (auth, { conferenceId }) => client(auth).conferences.get(conferenceId).catch(handleNotFound),
  hangupConferenceMember: (auth, { conferenceId, memberId }) => client(auth).conferences.hangupMember(conferenceId, memberId),

  sendMessage: ({ src, dst, text, params }) => client().messages.create(src, dst, text, params),
};

const integrationOps = {
  transferCall: () => ({}),
  makeCall: () => ({}),
  stopRecording: () => ({}),
  holdCall: () => ({}),
  unholdCall: () => ({}),
  deleteRecording: () => ({}),
  getEndpoint: () => ({}),
  getLiveCalls: () => [],
  getLiveCall: () => ({}),
  getCallDetails: () => ({}),
  hangupCall: () => ({}),
  getLiveConference: () => ({}),
  hangupConferenceMember: () => ({}),
  sendMessage: () => ({}),
};

let operations = isIntegration ? integrationOps : plivoOps;

export const setTelephonyOps = ops => {
  operations = { ...operations, ...ops };
};

export const getTelephonyOps = () => operations;
