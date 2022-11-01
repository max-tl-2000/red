/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';
import { now } from '../../../../common/helpers/moment-utils';
import { makeUsersSipEndpointsOnline, postTransferFromQueue, transferToVoicemail, postAgentCallForQueue } from '../../../testUtils/telephonyHelper';
import {
  testCtx as ctx,
  createATeam,
  createACommunicationEntry,
  createAUser,
  createATeamMember,
  createAParty,
  createATeamPropertyProgram,
  createAProperty,
  createVoiceMessages,
} from '../../../testUtils/repoHelper';
import * as callQueueRepo from '../../../dal/callQueueRepo';
import { getEventsByParty } from '../../../dal/partyEventsRepo';
import { loadMessageById } from '../../../dal/communicationRepo';
import { loadParty } from '../../../dal/partyRepo';
import { transferCallToVoicemail } from '../../../services/telephony/callActions';
import { callAgentsForQueue, setMarkCallAsReadyForDequeueFunc, getMarkCallAsReadyForDequeueFunc } from '../../../services/telephony/callQueuing';
import { TransferTargetType, CallStatus, ConferenceEvents } from '../../../services/telephony/enums';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { toQualifiedSipEndpoint, toCommIdSipHeader } from '../../../services/helpers/telephonyHelpers';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import { setNotificationFunction, resetNotificationFunction } from '../../../../common/server/notificationClient';
import eventTypes from '../../../../common/enums/eventTypes';
import { loadUserById, loadUsersByIds, updateUserStatus } from '../../../services/users';
import { DALTypes } from '../../../../common/enums/DALTypes';
import config from '../../../config';
import { setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { RESTRICTED_PHONE_REPLACEMENT } from '../../../helpers/phoneUtils';
import { getVoiceMessage } from '../../../services/telephony/voiceMessages';

const { telephony } = config;
chai.use(sinonChai);
const expect = chai.expect;

const CALL_TOPICS = ['calls'];

describe('/webhooks/transferFromQueue', () => {
  const from = '12025550199';

  const setup = async ({
    shouldSetPartyOwner = true,
    callerId,
    userHasRingPhones = true,
    userHasOnlineSipEndpoints = true,
    commIsTransferToTeam = false,
    commIsTransferToUser = false,
    userStatus = DALTypes.UserStatus.BUSY,
    notAvailableSetAt = '',
  } = {}) => {
    const { name: teamVoiceMessage } = await createVoiceMessages(ctx, {
      withIvrMessages: true,
      messages: { callQueueUnavailable: 'team specific call queue message' },
    });

    const team = await createATeam({
      phone: '12025550196',
      metadata: {
        callQueue: {
          enabled: true,
          timeToVoiceMail: 10,
        },
      },
      voiceMessage: teamVoiceMessage,
    });

    const sipEndpoints = [
      { endpointId: 'inAppEndpointForFirstUser', username: 'inAppEndpointForFirstUser', isUsedInApp: true },
      { endpointId: 'externalEndpoint', username: 'externalEndpoint' },
    ];
    const ringPhones = userHasRingPhones ? ['12025550199'] : [];
    const user = await createAUser({ sipEndpoints, ringPhones, status: userStatus, notAvailableSetAt });

    const { id: teamMemberVoiceMessageId } = await createVoiceMessages(ctx, { withIvrMessages: true, messages: { voicemail: 'team member specific message' } });
    const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId: user.id, voiceMessageId: teamMemberVoiceMessageId });

    const secondUser = await createAUser({
      sipEndpoints: [{ endpointId: 'inAppEndpointForSecondUser', username: 'inAppEndpointForSecondUser', isUsedInApp: true }],
      status: DALTypes.UserStatus.BUSY,
    });
    await createATeamMember({ teamId: team.id, userId: secondUser.id });

    makeUsersSipEndpointsOnline(userHasOnlineSipEndpoints ? [user, secondUser] : [secondUser]);

    const { id: propertyId } = await createAProperty();
    const { id: teamPropertyProgramId, programId } = await createATeamPropertyProgram({
      teamId: team.id,
      propertyId,
      commDirection: DALTypes.CommunicationDirection.IN,
    });
    const partyOwner = shouldSetPartyOwner ? { userId: user.id } : {};
    const { id: partyId } = await createAParty({ ...partyOwner, teams: [team.id] });

    const transferToTeamParams = commIsTransferToTeam ? { transferTarget: team.id, transferTargetType: TransferTargetType.TEAM } : {};
    const transferToUserParams = commIsTransferToUser ? { transferTarget: user.id, transferTargetType: TransferTargetType.USER } : {};

    const comm = await createACommunicationEntry({
      teams: [team.id],
      parties: [partyId],
      message: { from: callerId || from, ...transferToTeamParams, ...transferToUserParams },
      type: DALTypes.CommunicationMessageType.CALL,
      teamPropertyProgramId,
    });

    const getLiveCall = sinon.spy(() => ({ callUuid: comm.messageId }));

    const firedCallsToUserEndpoints = (userHasOnlineSipEndpoints ? sipEndpoints : []).map(() => newId());
    const firedCallsToUserRingPhones = ringPhones.map(() => newId());
    const firedCallsToUser = [...firedCallsToUserEndpoints, ...firedCallsToUserRingPhones];
    const firedCallsToSecondUser = secondUser.sipEndpoints.map(() => newId());

    await callQueueRepo.addCallToQueue(ctx, { commId: comm.id, teamId: team.id, lockedForDequeue: true });
    await callQueueRepo.addCallQueueStats(ctx, { id: newId(), communicationId: comm.id, entryTime: now() });

    const transferCall = sinon.spy(() => ({}));
    const makeCall = sinon.spy((auth, { to }) => {
      if (to.includes(sipEndpoints[0].username)) return { requestUuid: firedCallsToUserEndpoints };
      if (to.includes(ringPhones[0])) return { requestUuid: firedCallsToUserRingPhones };
      if (to.includes(secondUser.sipEndpoints[0].username)) return { requestUuid: firedCallsToSecondUser };
      return { requestUuid: [] };
    });

    const hangupCall = sinon.spy();

    setTelephonyOps({ transferCall, makeCall, hangupCall, getLiveCall });

    return { team, user, teamMemberId, secondUser, comm, transferCall, makeCall, firedCallsToUser, firedCallsToSecondUser, hangupCall, partyId, programId };
  };

  describe('given a request to connect an agent for transferring a queued call', () => {
    it('should make calls to all online agent endpoints, and to external phones with machine detection', async () => {
      const { user, comm, makeCall } = await setup({ userHasRingPhones: true, userHasOnlineSipEndpoints: true });
      await callAgentsForQueue(ctx, [user.id], comm.id);

      const { agentCallForQueueUrl, auth } = await getTelephonyConfigs(ctx);
      const url = addParamsToUrl(agentCallForQueueUrl, { commId: comm.id, userId: user.id });

      expect(makeCall).to.have.been.twice;

      expect(makeCall).to.have.been.calledWith(auth, {
        from: comm.message.from,
        callerName: user.sipEndpoints.map(() => comm.message.from).join('<'),
        to: user.sipEndpoints.map(toQualifiedSipEndpoint).join('<'),
        answerUrl: url,
        machineDetection: 'false',
        sipHeaders: user.sipEndpoints.map(() => toCommIdSipHeader(comm.id)).join('<'),
        ringTimeout: telephony.ringTimeBeforeVoicemail,
      });

      expect(makeCall).to.have.been.calledWith(auth, {
        from: comm.message.from,
        callerName: user.ringPhones.map(() => comm.message.from).join('<'),
        to: user.ringPhones.join('<'),
        answerUrl: url,
        machineDetection: 'hangup',
        machineDetectionTime: 3000,
        ringTimeout: telephony.ringTimeBeforeVoicemail,
      });
    });

    describe('when agent has a ring phone set up but no SIP endpoint online', () => {
      it("should make a call to agent's ring phone", async () => {
        const { user, comm, makeCall } = await setup({ userHasRingPhones: true, userHasOnlineSipEndpoints: false });
        await callAgentsForQueue(ctx, [user.id], comm.id);

        const { agentCallForQueueUrl, auth } = await getTelephonyConfigs(ctx);
        const url = addParamsToUrl(agentCallForQueueUrl, { commId: comm.id, userId: user.id });

        expect(makeCall).to.have.been.calledOnce;

        expect(makeCall).to.have.been.calledWith(auth, {
          from: comm.message.from,
          callerName: user.ringPhones.map(() => comm.message.from).join('<'),
          to: user.ringPhones.join('<'),
          answerUrl: url,
          machineDetection: 'hangup',
          machineDetectionTime: 3000,
          ringTimeout: telephony.ringTimeBeforeVoicemail,
        });
      });
    });

    describe('when agent has SIP endpoint(s) online and no ring phone set up', () => {
      it("should make call(s) to agent's sip endpoint(s)", async () => {
        const { user, comm, makeCall } = await setup({ userHasRingPhones: false, userHasOnlineSipEndpoints: true });
        await callAgentsForQueue(ctx, [user.id], comm.id);

        const { agentCallForQueueUrl, auth } = await getTelephonyConfigs(ctx);
        const url = addParamsToUrl(agentCallForQueueUrl, { commId: comm.id, userId: user.id });

        expect(makeCall).to.have.been.calledOnce;

        expect(makeCall).to.have.been.calledWith(auth, {
          from: comm.message.from,
          callerName: user.sipEndpoints.map(() => comm.message.from).join('<'),
          to: user.sipEndpoints.map(toQualifiedSipEndpoint).join('<'),
          answerUrl: url,
          machineDetection: 'false',
          sipHeaders: user.sipEndpoints.map(() => toCommIdSipHeader(comm.id)).join('<'),
          ringTimeout: telephony.ringTimeBeforeVoicemail,
        });
      });

      describe('when incoming call is from "Restricted" caller ID', () => {
        it("should make call(s) to agent's sip endpoint(s) using RESTRICTED_PHONE_REPLACEMENT as caller ID", async () => {
          const { user, comm, makeCall } = await setup({ userHasRingPhones: false, userHasOnlineSipEndpoints: true, callerId: 'Restricted' });
          await callAgentsForQueue(ctx, [user.id], comm.id);

          const { agentCallForQueueUrl, auth } = await getTelephonyConfigs(ctx);
          const url = addParamsToUrl(agentCallForQueueUrl, { commId: comm.id, userId: user.id });

          expect(makeCall).to.have.been.calledOnce;

          expect(makeCall).to.have.been.calledWith(auth, {
            from: RESTRICTED_PHONE_REPLACEMENT,
            callerName: user.sipEndpoints.map(() => comm.message.from).join('<'),
            to: user.sipEndpoints.map(toQualifiedSipEndpoint).join('<'),
            answerUrl: url,
            machineDetection: 'false',
            sipHeaders: user.sipEndpoints.map(() => toCommIdSipHeader(comm.id)).join('<'),
            ringTimeout: telephony.ringTimeBeforeVoicemail,
          });
        });
      });

      describe('when makeCall function fails', () => {
        it('should remove the call from queue, update stats and send the call to voicemail', async () => {
          const { user, comm, transferCall } = await setup({ userHasRingPhones: false, userHasOnlineSipEndpoints: true, callerId: 'Restricted' });

          const makeCall = sinon.spy(() => {
            throw new Error('telephony api failure');
          });
          setTelephonyOps({ makeCall });

          await callAgentsForQueue(ctx, [user.id], comm.id);
          expect(makeCall).to.have.been.calledOnce;

          const call = await callQueueRepo.getQueuedCallByCommId(ctx, comm.id);
          expect(call).not.to.be.ok;

          const stats = await callQueueRepo.getCallQueueStatsByCommId(ctx, comm.id);
          expect(stats).to.be.ok;
          expect(stats.exitTime).to.be.ok;

          const { auth, transferToVoicemailUrl } = await getTelephonyConfigs(ctx);
          const url = addParamsToUrl(transferToVoicemailUrl, { commId: comm.id, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });

          expect(transferCall).to.have.been.calledOnce;
          expect(transferCall).to.have.been.calledWith(auth, { callId: comm.messageId, alegUrl: url });
        });

        describe('and transferCall function fails too', () => {
          it('should not remove the call from queue', async () => {
            const { user, comm } = await setup({ userHasRingPhones: false, userHasOnlineSipEndpoints: true, callerId: 'Restricted' });

            const makeCall = sinon.spy(() => {
              throw new Error('telephony api failure');
            });

            const transferCall = sinon.spy(() => {
              throw new Error('telephony api failure');
            });

            setTelephonyOps({ makeCall, transferCall });

            await callAgentsForQueue(ctx, [user.id], comm.id);
            expect(makeCall).to.have.been.calledOnce;
            expect(transferCall).to.have.been.calledOnce;

            const call = await callQueueRepo.getQueuedCallByCommId(ctx, comm.id);
            expect(call).be.ok;
          });
        });
      });
    });

    it('should save fired calls ids with call queue record', async () => {
      const { user, comm, firedCallsToUser } = await setup();
      await callAgentsForQueue(ctx, [user.id], comm.id);

      const { firedCallsToAgents } = await callQueueRepo.getQueuedCallByCommId(ctx, comm.id);
      expect(firedCallsToAgents).to.deep.equal({ [user.id]: firedCallsToUser });
    });

    describe('when incoming call is from "Restricted" caller ID', () => {
      it("should make call(s) to agent's sip endpoint(s) using RESTRICTED_PHONE_REPLACEMENT as caller ID", async () => {
        const { user, comm, makeCall } = await setup({ userHasRingPhones: false, userHasOnlineSipEndpoints: true, callerId: 'Restricted' });
        await callAgentsForQueue(ctx, [user.id], comm.id);

        const { agentCallForQueueUrl, auth } = await getTelephonyConfigs(ctx);
        const url = addParamsToUrl(agentCallForQueueUrl, { commId: comm.id, userId: user.id });

        expect(makeCall).to.have.been.calledOnce;

        expect(makeCall).to.have.been.calledWith(auth, {
          from: RESTRICTED_PHONE_REPLACEMENT,
          callerName: user.sipEndpoints.map(() => comm.message.from).join('<'),
          to: user.sipEndpoints.map(toQualifiedSipEndpoint).join('<'),
          answerUrl: url,
          machineDetection: 'false',
          sipHeaders: user.sipEndpoints.map(() => toCommIdSipHeader(comm.id)).join('<'),
          ringTimeout: telephony.ringTimeBeforeVoicemail,
        });
      });
    });

    describe('when makeCall function fails', () => {
      it('should remove the call from queue, send it to voicemail, and user should be available', async () => {
        const { user, comm, transferCall } = await setup({ userHasRingPhones: false, userHasOnlineSipEndpoints: true, callerId: 'Restricted' });
        await updateUserStatus(ctx, user.id, DALTypes.UserStatus.AVAILABLE);

        const makeCall = sinon.spy(() => {
          throw new Error('telephony api failure');
        });
        setTelephonyOps({ makeCall });

        await callAgentsForQueue(ctx, [user.id], comm.id);
        expect(makeCall).to.have.been.calledOnce;

        const call = await callQueueRepo.getQueuedCallByCommId(ctx, comm.id);
        expect(call).not.to.be.ok;

        const { transferToVoicemailUrl, auth } = await getTelephonyConfigs(ctx);
        const url = addParamsToUrl(transferToVoicemailUrl, { commId: comm.id, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });

        expect(transferCall).to.have.been.calledOnce;
        expect(transferCall).to.have.been.calledWith(auth, { callId: comm.messageId, alegUrl: url });

        const updatedUser = await loadUserById(ctx, user.id);
        expect(updatedUser.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
      });
    });

    describe('and call is no longer queued by the time the agent gets called', () => {
      it('should hangup the calls fired to all endpoints and mark the agent available', async () => {
        const { user, comm, firedCallsToUser, hangupCall } = await setup();

        await updateUserStatus(ctx, user.id, DALTypes.UserStatus.BUSY);

        await callQueueRepo.removeCallFromQueue(ctx, comm.id);
        await callAgentsForQueue(ctx, [user.id], comm.id);

        const {
          metadata: { status },
        } = await loadUserById(ctx, user.id);
        expect(status).to.equal(DALTypes.UserStatus.AVAILABLE);

        const { auth } = await getTelephonyConfigs(ctx);
        firedCallsToUser.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
      });
    });

    describe('when agent does not answer the call', () => {
      const dontAnswerCall = async () => {
        const { user, comm, firedCallsToUser, team } = await setup();
        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [unansweredCall] = firedCallsToUser;

        const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === comm.id], CALL_TOPICS);

        await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.HANGUP })
          .send({ CallStatus: CallStatus.NO_ANSWER })
          .send({ CallUUID: unansweredCall })
          .expect(200);

        await callQueueMessages;

        return { commId: comm.id, userId: user.id, teamId: team.id };
      };

      it('should unlock the call for dequeuing', async () => {
        const { teamId } = await dontAnswerCall();

        const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, teamId);
        expect(queuedCall.lockedForDequeue).to.not.be.ok;
      });

      describe('on multiple endpoints', () => {
        it('should unlock the call for dequeue only once', async () => {
          const { user, comm, firedCallsToUser, hangupCall, team } = await setup();
          await callAgentsForQueue(ctx, [user.id], comm.id);

          const initialFunction = getMarkCallAsReadyForDequeueFunc();
          setMarkCallAsReadyForDequeueFunc(sinon.spy((...args) => initialFunction(...args)));
          const markCallAsReadyForDequeueFunc = getMarkCallAsReadyForDequeueFunc();

          const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === comm.id], CALL_TOPICS);

          const results = await Promise.all(
            firedCallsToUser.map(callId =>
              postAgentCallForQueue()
                .send({ commId: comm.id })
                .send({ userId: user.id })
                .send({ Event: ConferenceEvents.HANGUP })
                .send({ CallStatus: CallStatus.NO_ANSWER })
                .send({ CallUUID: callId }),
            ),
          );

          results.forEach(result => expect(result.status).to.equal(200));

          await callQueueMessages;

          expect(markCallAsReadyForDequeueFunc).to.have.been.calledOnce;

          const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, team.id);
          expect(queuedCall.lockedForDequeue).to.not.be.ok;

          // hangup should be called only when first 'no-answer' event is received for the rest of the calls for the user
          expect(hangupCall).to.have.callCount(firedCallsToUser.length - 1);
        });
      });
    });

    describe('when a call to agent ends before answering because queued call ended and there are no more live calls fired to agent', () => {
      it('should make the user available', async () => {
        const {
          user,
          comm,
          firedCallsToUser: [callIdThatEnds],
        } = await setup({ userHasOnlineSipEndpoints: false, userHasRingPhones: true });
        await callAgentsForQueue(ctx, [user.id], comm.id);
        setTelephonyOps({ getLiveCalls: () => [] });

        await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.HANGUP })
          .send({ CallStatus: CallStatus.COMPLETED })
          .send({ Duration: '0' })
          .send({ CallUUID: callIdThatEnds })
          .expect(200);

        const updatedUser = await loadUserById(ctx, user.id);

        expect(updatedUser.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
      });
    });

    describe('when a call to agent ends before answering because queued call ended and there are no more live calls fired to agent', () => {
      it('should make the user not available in case that he marked himself not available before answering the call', async () => {
        const {
          user,
          comm,
          firedCallsToUser: [callIdThatEnds],
        } = await setup({ userHasOnlineSipEndpoints: false, userHasRingPhones: true, userStatus: DALTypes.UserStatus.NOT_AVAILABLE, notAvailableSetAt: now() });
        await callAgentsForQueue(ctx, [user.id], comm.id);
        setTelephonyOps({ getLiveCalls: () => [] });

        await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.HANGUP })
          .send({ CallStatus: CallStatus.COMPLETED })
          .send({ Duration: '0' })
          .send({ CallUUID: callIdThatEnds })
          .expect(200);

        const updatedUser = await loadUserById(ctx, user.id);
        expect(updatedUser.metadata.status).to.equal(DALTypes.UserStatus.NOT_AVAILABLE);
      });
    });

    describe('when a call to agent ends because call failed and there are no more live calls fired to agent', () => {
      it('should make the user available', async () => {
        const {
          user,
          comm,
          firedCallsToUser: [callIdThatEnds],
        } = await setup({ userHasOnlineSipEndpoints: false, userHasRingPhones: false });
        await callAgentsForQueue(ctx, [user.id], comm.id);
        setTelephonyOps({ getLiveCalls: () => [] });

        await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.HANGUP })
          .send({ CallStatus: CallStatus.FAILED })
          .send({ Duration: '0' })
          .send({ CallUUID: callIdThatEnds })
          .expect(200);

        const updatedUser = await loadUserById(ctx, user.id);
        expect(updatedUser.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
      });
    });

    describe('when agent call ends because machine was detected', () => {
      const defaultFunc = getMarkCallAsReadyForDequeueFunc();
      afterEach(() => setMarkCallAsReadyForDequeueFunc(defaultFunc));

      describe('when there are no other live calls fired to agent and queued call is still live', () => {
        it('should make the user available and unlock call for dequeue', async () => {
          const {
            user,
            comm,
            team,
            firedCallsToUser: [machineDetectedCallId],
          } = await setup({ userHasRingPhones: true, userHasOnlineSipEndpoints: false });
          await callAgentsForQueue(ctx, [user.id], comm.id);
          setTelephonyOps({ getLiveCalls: () => [], getLiveCall: () => ({ callStatus: CallStatus.IN_PROGRESS }) });

          const initialFunction = getMarkCallAsReadyForDequeueFunc();
          setMarkCallAsReadyForDequeueFunc(sinon.spy((...args) => initialFunction(...args)));
          const markCallAsReadyForDequeueFunc = getMarkCallAsReadyForDequeueFunc();

          const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === comm.id], CALL_TOPICS);

          await postAgentCallForQueue()
            .send({ commId: comm.id })
            .send({ userId: user.id })
            .send({ Event: ConferenceEvents.HANGUP })
            .send({ CallStatus: CallStatus.COMPLETED })
            .send({ Duration: '6' })
            .send({ Machine: 'true' })
            .send({ CallUUID: machineDetectedCallId })
            .expect(200);

          await callQueueMessages;

          expect(markCallAsReadyForDequeueFunc).to.have.been.calledOnce;

          const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, team.id);
          expect(queuedCall.lockedForDequeue).to.not.be.ok;

          const updatedUser = await loadUserById(ctx, user.id);

          expect(updatedUser.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
        });
      });
    });

    describe('when agent declines call on one endpoint', () => {
      const declineCall = async () => {
        const { user, comm, firedCallsToUser, hangupCall, team } = await setup();
        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [declinedCallId, ...otherCalls] = firedCallsToUser;

        const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === comm.id], CALL_TOPICS);

        await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.HANGUP })
          .send({ CallStatus: CallStatus.BUSY })
          .send({ CallUUID: declinedCallId })
          .expect(200);

        await callQueueMessages;

        return { otherCalls, hangupCall, commId: comm.id, userId: user.id, teamId: team.id };
      };

      it('should hangup the calls fired to other endpoints', async () => {
        const { otherCalls, hangupCall } = await declineCall();

        const { auth } = await getTelephonyConfigs(ctx);
        otherCalls.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
      });

      it('should save the user that rejected the call', async () => {
        const { userId, teamId } = await declineCall();

        const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, teamId);
        expect(queuedCall.declinedByUserIds).to.include(userId);
      });

      it('should unlock the call for dequeuing', async () => {
        const { teamId } = await declineCall();

        const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, teamId);
        expect(queuedCall.lockedForDequeue).to.not.be.ok;
      });

      it('should make the user available', async () => {
        const { userId } = await declineCall();

        const user = await loadUserById(ctx, userId);

        expect(user.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
      });
    });

    describe('when agent answers on one endpoint', () => {
      it('should add the agent endpoint to a new conference room', async () => {
        const { user, comm, firedCallsToUser } = await setup();
        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [pickedUpCall] = firedCallsToUser;

        const { status, text } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ CallUUID: pickedUpCall });

        expect(status).to.equal(200);
        expect(text).to.contain('<Conference');
        expect(text).to.contain(`room_${comm.id}`);

        const { conferenceCallbackUrl } = await getTelephonyConfigs(ctx);
        const callbackUrl = addParamsToUrl(conferenceCallbackUrl, { commId: comm.id }).replace(/&/g, '&amp;');

        expect(text).to.contain(callbackUrl);
      });

      it('should notify if answered from external endpoint', async () => {
        const notify = sinon.spy();
        setNotificationFunction(notify);

        const { user, comm, firedCallsToUser } = await setup();

        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [pickedUpCall] = firedCallsToUser;

        const { status } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ To: 'sip:externalEndpoint@phone.plivo.com' })
          .send({ CallUUID: pickedUpCall });

        expect(status).to.equal(200);

        expect(notify).to.have.been.calledWith(
          sinon.match({
            event: eventTypes.CALL_ANSWERED,
            data: { commId: comm.id, isPhoneToPhone: true },
            routing: { users: [user.id] },
          }),
        );

        resetNotificationFunction();
      });

      it('should remove the call from the call queue', async () => {
        const { user, comm, team, firedCallsToUser } = await setup();
        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [pickedUpCall] = firedCallsToUser;

        const { status } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ CallUUID: pickedUpCall });

        expect(status).to.equal(200);

        const queuedCalls = await callQueueRepo.getQueuedCallsByTeamId(ctx, team.id);
        expect(queuedCalls.find(c => c.commId)).to.not.be.ok;
      });

      it('should update comm user and call queue statistics', async () => {
        const { user, comm, firedCallsToUser } = await setup();
        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [pickedUpCall] = firedCallsToUser;

        const { status } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ CallUUID: pickedUpCall });

        expect(status).to.equal(200);

        const updatedComm = await loadMessageById(ctx, comm.id);
        expect(updatedComm.userId).to.equal(user.id);

        const stats = await callQueueRepo.getCallQueueStatsByCommId(ctx, comm.id);
        expect(stats).to.be.ok;
        expect(stats.userId).to.equal(user.id);
        expect(stats.exitTime).to.be.ok;
      });

      it('should set the party owner', async () => {
        const { user, comm, firedCallsToUser, partyId } = await setup({ shouldSetPartyOwner: false });
        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [pickedUpCall] = firedCallsToUser;

        const unassignedParty = await loadParty(ctx, partyId);
        expect(unassignedParty.userId).to.not.be.ok;

        const { status } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ CallUUID: pickedUpCall });

        expect(status).to.equal(200);

        const assignedParty = await loadParty(ctx, partyId);
        expect(assignedParty.userId).to.equal(user.id);
      });

      describe('when agent call ends because he answered on another endpoint', () => {
        const defaultFunc = getMarkCallAsReadyForDequeueFunc();
        afterEach(() => setMarkCallAsReadyForDequeueFunc(defaultFunc));

        it('should not make the user available and should not unlock the call for dequeue again', async () => {
          const {
            user,
            comm,
            firedCallsToUser: [pickedUpCall, callIdThatEnds],
          } = await setup();
          await callAgentsForQueue(ctx, [user.id], comm.id);
          setTelephonyOps({ getLiveCalls: () => [{ id: pickedUpCall }] });

          setMarkCallAsReadyForDequeueFunc(sinon.spy(() => {}));
          const markCallAsReadyForDequeueFunc = getMarkCallAsReadyForDequeueFunc();

          await postAgentCallForQueue()
            .send({ commId: comm.id })
            .send({ userId: user.id })
            .send({ Event: ConferenceEvents.START_APP })
            .send({ CallUUID: pickedUpCall })
            .expect(200);

          await postAgentCallForQueue()
            .send({ commId: comm.id })
            .send({ userId: user.id })
            .send({ Event: ConferenceEvents.HANGUP })
            .send({ CallStatus: CallStatus.COMPLETED })
            .send({ Duration: '0' })
            .send({ CallUUID: callIdThatEnds })
            .expect(200);

          const updatedUser = await loadUserById(ctx, user.id);

          expect(updatedUser.metadata.status).to.equal(DALTypes.UserStatus.BUSY);

          expect(markCallAsReadyForDequeueFunc).to.not.have.been.called;
        });
      });

      it('should transfer the queued call to the conference room with the agent', async () => {
        const { user, comm, firedCallsToUser, transferCall } = await setup();
        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [pickedUpCall] = firedCallsToUser;

        const { status } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ CallUUID: pickedUpCall });

        expect(status).to.equal(200);

        const { auth, transferFromQueueUrl } = await getTelephonyConfigs(ctx);

        expect(transferCall).to.have.been.calledOnce;

        const alegUrl = addParamsToUrl(transferFromQueueUrl, { commId: comm.id });
        expect(transferCall).to.have.been.calledWith(auth, { callId: comm.messageId, alegUrl });
      });

      it('should add an activity log entry and add the user as party collaborator', async () => {
        const { user, comm, firedCallsToUser, partyId } = await setup();

        await callAgentsForQueue(ctx, [user.id], comm.id);
        const [pickedUpCall] = firedCallsToUser;

        const { status } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ CallUUID: pickedUpCall });

        expect(status).to.equal(200);

        const { collaborators } = await loadParty(ctx, partyId);
        expect(collaborators).to.deep.include(user.id);
      });

      describe('and caller hangs up the call before the agent gets connected', () => {
        it('should hangup the call picked up by agent and mark her available', async () => {
          const {
            user,
            comm,
            firedCallsToUser: [pickedUpCall],
            hangupCall,
          } = await setup();

          const getLiveCall = sinon.spy(() => ({ notFound: true }));
          setTelephonyOps({ getLiveCall });
          await updateUserStatus(ctx, user.id, DALTypes.UserStatus.BUSY);

          await callAgentsForQueue(ctx, [user.id], comm.id);

          const { status, text } = await postAgentCallForQueue()
            .send({ commId: comm.id })
            .send({ userId: user.id })
            .send({ Event: ConferenceEvents.START_APP })
            .send({ CallUUID: pickedUpCall });

          expect(status).to.equal(200);

          const { metadata } = await loadUserById(ctx, user.id);
          expect(metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);

          const { auth } = await getTelephonyConfigs(ctx);

          expect(hangupCall).to.have.been.calledWith(auth, { callId: pickedUpCall });
          expect(text).to.not.contain('<Conference');
        });
      });

      describe('and the transfer fails', () => {
        it('should hangup the call picked up by agent and mark her available', async () => {
          const {
            user,
            comm,
            firedCallsToUser: [pickedUpCall],
            hangupCall,
          } = await setup();

          const getLiveCall = sinon.spy(() => ({ callStatus: CallStatus.IN_PROGRESS }));
          const transferCall = sinon.spy(() => {
            throw new Error('transfer failed');
          });
          setTelephonyOps({ getLiveCall, transferCall });

          await updateUserStatus(ctx, user.id, DALTypes.UserStatus.BUSY);

          await callAgentsForQueue(ctx, [user.id], comm.id);

          const { status, text } = await postAgentCallForQueue()
            .send({ commId: comm.id })
            .send({ userId: user.id })
            .send({ Event: ConferenceEvents.START_APP })
            .send({ CallUUID: pickedUpCall });

          expect(status).to.equal(200);

          const { metadata } = await loadUserById(ctx, user.id);
          expect(metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);

          const { auth } = await getTelephonyConfigs(ctx);

          expect(hangupCall).to.have.been.calledWith(auth, { callId: pickedUpCall });
          expect(text).to.not.contain('<Conference');
        });
      });

      describe('when queued call is transferred', () => {
        it('should answer with conference room instructions', async () => {
          const { comm } = await setup();

          const { status, text } = await postTransferFromQueue().send({ CallUUID: comm.messageId }).send({ commId: comm.id });

          expect(status).to.equal(200);
          expect(text).to.contain('<Conference');
          expect(text).to.contain(`room_${comm.id}`);

          const { conferenceCallbackUrl } = await getTelephonyConfigs(ctx);
          const callbackUrl = addParamsToUrl(conferenceCallbackUrl, { commId: comm.id }).replace(/&/g, '&amp;');

          expect(text).to.contain(callbackUrl);
        });
      });
    });
  });

  describe('given a request to connect multiple agents for transferring a queued call', () => {
    it("should make calls to all online agents' endpoints", async () => {
      const { user, secondUser, comm, makeCall } = await setup({ userHasRingPhones: false });
      await callAgentsForQueue(ctx, [user.id, secondUser.id], comm.id);

      const { agentCallForQueueUrl, auth } = await getTelephonyConfigs(ctx);

      expect(makeCall).to.have.been.twice;

      expect(makeCall).to.have.been.calledWith(auth, {
        from: comm.message.from,
        callerName: user.sipEndpoints.map(() => comm.message.from).join('<'),
        to: user.sipEndpoints.map(toQualifiedSipEndpoint).join('<'),
        answerUrl: addParamsToUrl(agentCallForQueueUrl, { commId: comm.id, userId: user.id }),
        machineDetection: 'false',
        sipHeaders: user.sipEndpoints.map(() => toCommIdSipHeader(comm.id)).join('<'),
        ringTimeout: telephony.ringTimeBeforeVoicemail,
      });

      expect(makeCall).to.have.been.calledWith(auth, {
        from: comm.message.from,
        callerName: secondUser.sipEndpoints.map(() => comm.message.from).join('<'),
        to: secondUser.sipEndpoints.map(toQualifiedSipEndpoint).join('<'),
        answerUrl: addParamsToUrl(agentCallForQueueUrl, { commId: comm.id, userId: secondUser.id }),
        machineDetection: 'false',
        sipHeaders: secondUser.sipEndpoints.map(() => toCommIdSipHeader(comm.id)).join('<'),
        ringTimeout: telephony.ringTimeBeforeVoicemail,
      });
    });

    it('should save fired calls ids with call queue record', async () => {
      const { user, secondUser, comm, firedCallsToUser, firedCallsToSecondUser } = await setup();
      await callAgentsForQueue(ctx, [user.id, secondUser.id], comm.id);

      const { firedCallsToAgents } = await callQueueRepo.getQueuedCallByCommId(ctx, comm.id);
      expect(firedCallsToAgents).to.deep.equal({ [user.id]: firedCallsToUser, [secondUser.id]: firedCallsToSecondUser });
    });

    describe('and call is no longer queued by the time the agents get called', () => {
      it("should hangup the calls fired to all agents' endpoints and mark the agents available", async () => {
        const { user, secondUser, comm, firedCallsToUser, firedCallsToSecondUser, hangupCall } = await setup();

        await updateUserStatus(ctx, user.id, DALTypes.UserStatus.BUSY);

        await callQueueRepo.removeCallFromQueue(ctx, comm.id);
        await callAgentsForQueue(ctx, [user.id, secondUser.id], comm.id);

        const updatedUsers = await loadUsersByIds(ctx, [user.id, secondUser.id]);
        expect(updatedUsers.map(u => u.metadata.status)).to.deep.equal([DALTypes.UserStatus.AVAILABLE, DALTypes.UserStatus.AVAILABLE]);

        const { auth } = await getTelephonyConfigs(ctx);
        [...firedCallsToUser, ...firedCallsToSecondUser].forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
      });
    });

    describe('when one agent does not answer the call', () => {
      const dontAnswerCall = async () => {
        const { user, secondUser, comm, firedCallsToUser, team } = await setup();
        await callAgentsForQueue(ctx, [user.id, secondUser.id], comm.id);
        const [unansweredCall] = firedCallsToUser;

        await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.HANGUP })
          .send({ CallStatus: CallStatus.NO_ANSWER })
          .send({ CallUUID: unansweredCall })
          .expect(200);

        return { commId: comm.id, userId: user.id, teamId: team.id };
      };

      it('should save the user that rejected the call', async () => {
        const { userId, teamId } = await dontAnswerCall();

        const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, teamId);
        expect(queuedCall.declinedByUserIds).to.include(userId);
      });

      it('should NOT unlock the call for dequeuing because the other user is still being called', async () => {
        const { teamId } = await dontAnswerCall();

        const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, teamId);
        expect(queuedCall.lockedForDequeue).to.be.ok;
      });

      it('should make the user available', async () => {
        const { userId } = await dontAnswerCall();

        const user = await loadUserById(ctx, userId);

        expect(user.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
      });
    });

    describe('when one agent call ends because machine was detected', () => {
      describe('when there are no other live calls fired to agent but there are calls to other agents', () => {
        it('should make the user available and NOT unlock call for dequeue', async () => {
          const {
            user,
            secondUser,
            comm,
            team,
            firedCallsToUser: [machineDetectedCallId],
            firedCallsToSecondUser,
          } = await setup({
            userHasRingPhones: true,
            userHasOnlineSipEndpoints: false,
          });
          await callAgentsForQueue(ctx, [user.id, secondUser.id], comm.id);
          setTelephonyOps({ getLiveCalls: () => [{ id: firedCallsToSecondUser }], getLiveCall: () => ({ callStatus: CallStatus.IN_PROGRESS }) });

          await postAgentCallForQueue()
            .send({ commId: comm.id })
            .send({ userId: user.id })
            .send({ Event: ConferenceEvents.HANGUP })
            .send({ CallStatus: CallStatus.COMPLETED })
            .send({ Duration: '6' })
            .send({ Machine: 'true' })
            .send({ CallUUID: machineDetectedCallId })
            .expect(200);

          const [queuedCall] = await callQueueRepo.getQueuedCallsByTeamId(ctx, team.id);
          expect(queuedCall.lockedForDequeue).to.be.ok;

          const updatedUser = await loadUserById(ctx, user.id);

          expect(updatedUser.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
        });
      });
    });

    describe('when one agent answers on one endpoint', () => {
      it("should hangup the calls fired to agent's other endpoints and to other agents' endpoints", async () => {
        const { user, secondUser, comm, firedCallsToUser, firedCallsToSecondUser, hangupCall } = await setup();
        await callAgentsForQueue(ctx, [user.id, secondUser.id], comm.id);
        const [pickedUpCall, ...otherUserCalls] = firedCallsToUser;

        await postTransferFromQueue().send({ CallUUID: comm.messageId }).send({ commId: comm.id });

        const { status } = await postAgentCallForQueue()
          .send({ commId: comm.id })
          .send({ userId: user.id })
          .send({ Event: ConferenceEvents.START_APP })
          .send({ CallUUID: pickedUpCall });

        const partyEvents = await getEventsByParty(ctx, comm.parties[0]);

        expect(partyEvents.filter(x => x.event === DALTypes.PartyEventType.COMMUNICATION_ANSWERED_CALL).length).to.equal(1);

        expect(status).to.equal(200);

        const { auth } = await getTelephonyConfigs(ctx);
        expect(hangupCall).to.not.have.been.calledWith(auth, { callId: pickedUpCall });
        [...otherUserCalls, ...firedCallsToSecondUser].forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
      });

      describe('when all other calls end because of this', () => {
        const defaultFunc = getMarkCallAsReadyForDequeueFunc();
        afterEach(() => setMarkCallAsReadyForDequeueFunc(defaultFunc));

        it('should not unlock the call for dequeue again and only make second user available', async () => {
          const { user, secondUser, comm, firedCallsToUser, firedCallsToSecondUser } = await setup();

          const [pickedUpCall, ...otherCallsToUser] = firedCallsToUser;

          await callAgentsForQueue(ctx, [user.id, secondUser.id], comm.id);
          setTelephonyOps({ getLiveCalls: () => [{ id: pickedUpCall }] });

          setMarkCallAsReadyForDequeueFunc(sinon.spy(() => {}));
          const markCallAsReadyForDequeueFunc = getMarkCallAsReadyForDequeueFunc();

          await postAgentCallForQueue()
            .send({ commId: comm.id })
            .send({ userId: user.id })
            .send({ Event: ConferenceEvents.START_APP })
            .send({ CallUUID: pickedUpCall })
            .expect(200);

          await Promise.all(
            otherCallsToUser.map(
              async callId =>
                await postAgentCallForQueue()
                  .send({ commId: comm.id })
                  .send({ userId: user.id })
                  .send({ Event: ConferenceEvents.HANGUP })
                  .send({ CallStatus: CallStatus.COMPLETED })
                  .send({ Duration: '0' })
                  .send({ CallUUID: callId })
                  .expect(200),
            ),
          );

          await Promise.all(
            firedCallsToSecondUser.map(
              async callId =>
                await postAgentCallForQueue()
                  .send({ commId: comm.id })
                  .send({ userId: secondUser.id })
                  .send({ Event: ConferenceEvents.HANGUP })
                  .send({ CallStatus: CallStatus.COMPLETED })
                  .send({ Duration: '0' })
                  .send({ CallUUID: callId })
                  .expect(200),
            ),
          );

          expect(markCallAsReadyForDequeueFunc).to.not.have.been.called;

          const {
            metadata: { status: firstUserStatus },
          } = await loadUserById(ctx, user.id);
          expect(firstUserStatus).to.equal(DALTypes.UserStatus.BUSY);

          const {
            metadata: { status: secondUserStatus },
          } = await loadUserById(ctx, secondUser.id);
          expect(secondUserStatus).to.equal(DALTypes.UserStatus.AVAILABLE);
        });
      });
    });
  });

  describe('given a request to transfer a call from the call queue to voicemail', () => {
    it('should direct to voicemail', async () => {
      const { comm, transferCall } = await setup();
      await transferCallToVoicemail(ctx, { commId: comm.id, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });

      const conf = await getTelephonyConfigs(ctx);
      const url = addParamsToUrl(conf.transferToVoicemailUrl, { commId: comm.id, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });

      expect(transferCall).to.have.been.calledOnce;
      expect(transferCall).to.have.been.calledWith(conf.auth, { callId: comm.messageId, alegUrl: url });
    });

    describe('when target is a program', () => {
      it('should respond with voicemail instructions and program message', async () => {
        const { comm, programId } = await setup();
        const res = await transferToVoicemail().send({
          From: '12025550197',
          messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE,
          CallUUID: comm.messageId,
          commId: comm.id,
          programId,
        });

        expect(res.status).to.equal(200);
        expect(res.text).to.contain('<Speak');
        const { message: unavailableMessage } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });
        expect(res.text).to.contain(unavailableMessage);
      });
    });

    describe('when target is a team', () => {
      it('should respond with voicemail instructions and team message', async () => {
        const { comm, team } = await setup();
        const res = await transferToVoicemail().send({
          From: '12025550197',
          messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE,
          CallUUID: comm.messageId,
          commId: comm.id,
          teamId: team.id,
        });

        expect(res.status).to.equal(200);
        expect(res.text).to.contain('<Speak');
        const { message: unavailableMessage } = await getVoiceMessage(ctx, { teamId: team.id, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });
        expect(res.text).to.contain(unavailableMessage);
      });
    });

    describe('when target is not specified in request body', () => {
      it('should determine target from comm and respond with voicemail instructions', async () => {
        const { comm, programId } = await setup();
        const res = await transferToVoicemail().send({
          From: '12025550197',
          messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE,
          CallUUID: comm.messageId,
          commId: comm.id,
        });

        expect(res.status).to.equal(200);
        expect(res.text).to.contain('<Speak');
        const { message: unavailableMessage } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });
        expect(res.text).to.contain(unavailableMessage);
      });

      describe('when call is a transfer to team', () => {
        it('should determine target team from comm and respond with voicemail instructions for team', async () => {
          const { comm, team } = await setup({ commIsTransferToTeam: true });
          const res = await transferToVoicemail().send({
            From: '12025550197',
            messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE,
            CallUUID: comm.messageId,
            commId: comm.id,
          });

          expect(res.status).to.equal(200);
          expect(res.text).to.contain('<Speak');
          const { message: unavailableMessage } = await getVoiceMessage(ctx, {
            teamId: team.id,
            messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE,
          });
          expect(res.text).to.contain(unavailableMessage);
        });
      });

      describe('when call is a transfer to user', () => {
        it('should determine target team member from comm and respond with voicemail instructions for team member', async () => {
          const { comm, teamMemberId } = await setup({ commIsTransferToUser: true });
          const res = await transferToVoicemail().send({
            From: '12025550197',
            messageType: DALTypes.VoiceMessageType.VOICEMAIL,
            CallUUID: comm.messageId,
            commId: comm.id,
          });

          expect(res.status).to.equal(200);
          expect(res.text).to.contain('<Speak');
          const { message } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.VOICEMAIL });
          expect(res.text).to.contain(message);
        });
      });
    });
  });
});
