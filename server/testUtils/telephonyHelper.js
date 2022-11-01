/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import { setTelephonyOps } from '../services/telephony/providerApiOperations';
import app from '../api/api';
import config from '../config';
import { tenant } from './setupTestGlobalContext';
import { setUserWSConnectionFunc } from '../services/users';

const makeEndpointsOnline = idsSet =>
  setTelephonyOps({
    getEndpoint: id => ({ sipRegistered: idsSet.has(id) }),
  });

export const makeUsersSipEndpointsOnline = users => {
  setUserWSConnectionFunc(() => true);
  const endpointIds = new Set(users.reduce((acc, u) => [...u.sipEndpoints.map(e => e.endpointId), ...acc], []));
  makeEndpointsOnline(endpointIds);
};

export const makeSipEndpointsOnline = sipEndpoints => {
  setUserWSConnectionFunc(() => true);
  const endpointIds = new Set(sipEndpoints.map(e => e.endpointId));
  makeEndpointsOnline(endpointIds);
};

const tokenQuery = () => `?token=${tenant.authorization_token}&api-token=${config.telephonyApiToken}`;
const webhookUrl = fn => `/webhooks/${fn}${tokenQuery()}`;

export const post = url => request(app).post(webhookUrl(url)).type('form');

export const postCallbackBasic = () => post('callbackDial');

export const postCallback = ({ id: userId }, { id: partyId }, commId) => postCallbackBasic().send({ DialAction: 'answer' }).send({ userId, partyId, commId });

export const postSms = () => post('sms');

export const postDirect = () => post('directDial');

export const postPostDialBasic = () => post('postDial');

export const postDigitsPressed = () => post('digitsPressed');

export const postCallReadyForDequeue = (commId, teamId, programId) => post('callReadyForDequeue').send({ commId, teamId, programId });

export const postPostDial = ({ id: userId }, { id: partyId }, CallUUID, DialStatus, commId) =>
  postPostDialBasic().send({ userId, partyId, CallUUID, DialStatus, commId });

export const postCallRecording = ({ commId, RecordUrl = 'the-recording-url', RecordingID = 'the-recording-id', RecordingDuration = '30', isSpam = false }) =>
  post('callRecording').send({ RecordUrl }).send({ RecordingID }).send({ RecordingDuration }).send({ isSpam }).send({ commId });

export const postRecordingConferenceCallback = ({ callId, RecordUrl = 'the-recording-url', RecordingID = 'the-recording-id', RecordingDuration = '30' }) =>
  post('callRecording').send({ RecordUrl }).send({ RecordingID }).send({ RecordingDuration }).send({ CallUUID: callId });

export const postTransferFromQueue = () => post('transferFromQueue');

export const transferToVoicemail = () => post('transferToVoicemail');

export const postAgentCallForQueue = () => post('agentCallForQueue');

export const expectToContainDialToUser = (text, user) => {
  expect(text).to.contain('<Dial');
  expect(text).to.contain(`<User>sip:${user.sipEndpoints[0].username}@phone.plivo.com</User>`);
};
