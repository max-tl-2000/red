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
import {
  testCtx as ctx,
  createATeam,
  createACommunicationEntry,
  createAParty,
  createAUser,
  createATeamMember,
  officeHoursAlwaysOff,
  createAProperty,
  createATeamPropertyProgram,
} from '../../testUtils/repoHelper';
import config from '../../config';
import * as repo from '../../dal/callQueueRepo';
import { loadParty } from '../../dal/partyRepo';
import { updateTeam } from '../../dal/teamsRepo';
import { getRecurringJobByName, updateRecurringJobStatus } from '../../dal/jobsRepo';
import { setupQueueToWaitFor } from '../../testUtils/apiHelper';
import * as queuing from '../telephony/callQueuing';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getAllComms, loadMessageById, getCommunicationsByMessageId } from '../../dal/communicationRepo';
import { setTelephonyOps } from '../telephony/providerApiOperations';
import { TransferTargetType } from '../telephony/enums';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import { waitFor } from '../../common/utils';
import { setDequeueCallAfterTimeoutFunc, resetDequeueCallAfterTimeoutFunc, dequeueCallAfterTimeout } from '../../workers/communication/callQueueHandler';
import { updateUserStatus, loadUsersByIds } from '../users';
import { updateOwner } from '../party';
import { makeUsersSipEndpointsOnline } from '../../testUtils/telephonyHelper';
import { now } from '../../../common/helpers/moment-utils';
import { toQualifiedSipEndpoint, toCommIdSipHeader } from '../helpers/telephonyHelpers';
import parseBoolean from '../../../common/helpers/booleanParser';

chai.use(sinonChai);
const expect = chai.expect;

const CALL_TOPICS = ['calls'];

describe('call queue', () => {
  beforeEach(() => setTelephonyOps({ hangupCall: () => {} }));

  const createALiveCall = async params => {
    const comm = await createACommunicationEntry(params);
    const getLiveCall = sinon.spy(() => ({ callUuid: comm.messageId }));
    setTelephonyOps({ getLiveCall });
    return comm;
  };

  const createTeamForCallQueuing = async ({
    timeToVoiceMail = 5,
    name,
    phone = '12025550196',
    callRoutingStrategy = DALTypes.CallRoutingStrategy.ROUND_ROBIN,
    inactiveFlag = false,
  } = {}) =>
    await createATeam({
      name,
      phone,
      inactiveFlag,
      metadata: {
        callQueue: {
          enabled: true,
          timeToVoiceMail,
          callBackRequestAckMessage: 'Call back request registered',
        },
        callRoutingStrategy,
      },
    });

  const createTestEntities = async ({ timeToVoiceMail, teamAttributes, userStatus = DALTypes.UserStatus.BUSY, userRole = MainRoleDefinition.LA.name } = {}) => {
    const team = await createTeamForCallQueuing({ ...teamAttributes, timeToVoiceMail });
    const user = await createAUser({ status: userStatus });
    makeUsersSipEndpointsOnline([user]);
    await createATeamMember({
      teamId: team.id,
      userId: user.id,
      roles: {
        mainRoles: [userRole],
        functionalRoles:
          userRole === MainRoleDefinition.LA.name ? [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name] : [FunctionalRoleDefinition.LD.name],
      },
    });
    const IVRExternalNumber = '16502736660';

    const { id: propertyId } = await createAProperty();
    const teamPropertyProgram = await createATeamPropertyProgram({
      teamId: team.id,
      propertyId,
      commDirection: DALTypes.CommunicationDirection.IN,
      transferToNumber: IVRExternalNumber,
    });
    const { id: teamPropertyProgramId, programId } = teamPropertyProgram;

    const party = await createAParty();
    const { id: commId, messageId: callId } = await createALiveCall({ teams: [team.id], parties: [party.id], teamPropertyProgramId });

    return { team, commId, party, user, callId, programId, IVRExternalNumber };
  };

  describe('given a call that is enqueued', () => {
    beforeEach(() => setDequeueCallAfterTimeoutFunc(() => {}));
    afterEach(resetDequeueCallAfterTimeoutFunc);

    const sendToQueueAndWaitForTasks = async (commId, team, programId) => {
      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamId === team.id && msg.commId === commId], CALL_TOPICS);

      await queuing.sendCallToQueue(ctx, { commId, team, programId });
      await callQueueMessage;
    };

    it('should save call into CallQueue table', async () => {
      const { commId, team, programId } = await createTestEntities();

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);

      expect(queuedCalls.length).to.equal(1);
      expect(queuedCalls[0].commId).to.equal(commId);
    });

    it('should save the call queue entry time in the CallQueueStatistics', async () => {
      const { commId, team, programId } = await createTestEntities();

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const stats = await repo.getCallQueueStatsByCommId(ctx, commId);
      expect(stats).to.be.ok;
      expect(stats.entryTime).to.be.ok;
      expect(stats.exitTime).to.not.be.ok;
    });

    it('should lock the call for dequeue', async () => {
      const { commId, team, programId } = await createTestEntities();

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);

      expect(queuedCalls.length).to.equal(1);
      expect(queuedCalls[0].commId).to.equal(commId);
      expect(queuedCalls[0].lockedForDequeue).to.be.ok;
    });

    it('should return the count of calls and the teamId for the user team', async () => {
      const { commId, team, programId } = await createTestEntities();
      await sendToQueueAndWaitForTasks(commId, team, programId);
      const queuedCalls = await repo.getCallQueueCountByTeamIds(ctx, [team.id]);

      const [firstRow] = queuedCalls || [];
      expect(firstRow.count).to.equal('1');
      expect(firstRow.teamId).to.equal(team.id);
    });

    it('should return zero count for calls', async () => {
      const { commId, team, programId } = await createTestEntities({ teamAttributes: { inactiveFlag: true } });
      await sendToQueueAndWaitForTasks(commId, team, programId);
      const queuedCalls = await repo.getCallQueueCountByTeamIds(ctx, [team.id]);
      expect(queuedCalls.length).to.equal(0);
    });
  });

  describe('given a call that is ready for dequeue', () => {
    it('should unlock the call for dequeue', async () => {
      setTelephonyOps({ transferCall: () => {} });
      const { commId, team } = await createTestEntities();

      await repo.addCallToQueue(ctx, { commId, teamId: team.id, lockedForDequeue: true });

      const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
      await queuing.markCallAsReadyForDequeue(ctx, commId);
      await callQueueMessages;

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);

      expect(queuedCalls.length).to.equal(1);
      expect(queuedCalls[0].commId).to.equal(commId);
      expect(queuedCalls[0].lockedForDequeue).to.not.be.ok;
    });

    describe('when an agent is available', () => {
      it('should lock the call for dequeuing and call the agent', async () => {
        const makeCall = sinon.spy(() => ({ requestUuid: [newId()] }));
        setTelephonyOps({ makeCall });

        const team = await createTeamForCallQueuing();
        const user = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
        makeUsersSipEndpointsOnline([user]);
        await createATeamMember({
          teamId: team.id,
          userId: user.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name],
          },
        });

        const party = await createAParty();
        const { id: commId } = await createALiveCall({ teams: [team.id], parties: [party.id] });

        await repo.addCallToQueue(ctx, { commId, teamId: team.id, lockedForDequeue: true });

        const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
        await queuing.markCallAsReadyForDequeue(ctx, commId);
        await callQueueMessages;

        const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
        expect(queuedCalls.find(c => c.commId === commId).lockedForDequeue).to.be.ok;
        expect(makeCall).to.have.been.called;
      });
    });

    describe('when two agents are available', () => {
      const setupForMultipleAgents = async (callRoutingStrategy = DALTypes.CallRoutingStrategy.ROUND_ROBIN) => {
        const makeCallParams = [];
        const makeCall = sinon.spy((auth, params) => {
          makeCallParams.push(params);
          return { requestUuid: [newId()] };
        });
        setTelephonyOps({ makeCall });

        const team = await createTeamForCallQueuing({ callRoutingStrategy });
        const otherAgent = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
        const owningAgent = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
        makeUsersSipEndpointsOnline([owningAgent, otherAgent]);
        await createATeamMember({
          teamId: team.id,
          userId: owningAgent.id,
          roles: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name] },
        });
        await createATeamMember({
          teamId: team.id,
          userId: otherAgent.id,
          roles: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name] },
        });

        const party = await createAParty({ userId: owningAgent.id });
        const { id: commId } = await createALiveCall({ teams: [team.id], parties: [party.id] });

        const { id: commId2 } = await createALiveCall({ teams: [team.id], parties: [party.id] });

        return { commId, commId2, teamId: team.id, makeCall, makeCallParams, otherAgent, owningAgent };
      };

      describe('when call routing strategy is Round Robin', () => {
        describe('when caller is unknown', () => {
          it('should lock the call for dequeuing and call agent with the earliest end up call', async () => {
            const { teamId, makeCall, makeCallParams, owningAgent: agentA, otherAgent: agentB } = await setupForMultipleAgents();

            await createACommunicationEntry({
              type: DALTypes.CommunicationMessageType.CALL,
              userId: agentA.id,
              message: { rawMessage: { EndTime: '2018-03-27 13:05:47' } },
            });
            await createACommunicationEntry({
              type: DALTypes.CommunicationMessageType.CALL,
              userId: agentB.id,
              message: { rawMessage: { EndTime: '2018-03-27 12:05:47' } },
            });

            const party = await createAParty();
            const { id: commId } = await createALiveCall({ teams: [teamId], parties: [party.id] });

            await repo.addCallToQueue(ctx, { commId, teamId, lockedForDequeue: true });

            const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
            await queuing.markCallAsReadyForDequeue(ctx, commId);
            await callQueueMessages;

            const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, teamId);
            expect(queuedCalls.find(c => c.commId === commId).lockedForDequeue).to.be.ok;
            expect(makeCall).to.have.been.calledOnce;

            expect(makeCallParams[0].to).to.include(agentB.sipEndpoints[0].username);
          });
        });

        describe('when caller is known', () => {
          it('should lock the call for dequeuing and call the agent that owns the calling party', async () => {
            const { commId, teamId, makeCall, makeCallParams, owningAgent } = await setupForMultipleAgents();

            await repo.addCallToQueue(ctx, { commId, teamId, lockedForDequeue: true });

            const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
            await queuing.markCallAsReadyForDequeue(ctx, commId);
            await callQueueMessages;

            const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, teamId);
            expect(queuedCalls.find(c => c.commId === commId).lockedForDequeue).to.be.ok;
            expect(makeCall).to.have.been.calledOnce;

            expect(makeCallParams[0].to).to.include(owningAgent.sipEndpoints[0].username);
          });
        });

        describe('when agent that owns the calling party already declined the call', () => {
          it('should lock the call for dequeuing and call the other agent', async () => {
            const { commId, teamId, makeCall, makeCallParams, otherAgent, owningAgent } = await setupForMultipleAgents();
            await repo.addCallToQueue(ctx, { commId, teamId, lockedForDequeue: true, declinedByUserIds: [owningAgent.id] });

            const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
            await queuing.markCallAsReadyForDequeue(ctx, commId);
            await callQueueMessages;

            const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, teamId);
            expect(queuedCalls.find(c => c.commId === commId).lockedForDequeue).to.be.ok;
            expect(makeCall).to.have.been.calledOnce;

            expect(makeCallParams[0].to).to.include(otherAgent.sipEndpoints[0].username);
          });
        });
      });

      describe('when call routing strategy is Everybody', () => {
        it('should lock the call for dequeuing and call both agents', async () => {
          const { teamId, makeCall, makeCallParams, owningAgent: agentA, otherAgent: agentB } = await setupForMultipleAgents(
            DALTypes.CallRoutingStrategy.EVERYBODY,
          );

          const party = await createAParty();
          const { id: commId } = await createALiveCall({ teams: [teamId], parties: [party.id] });

          await repo.addCallToQueue(ctx, { commId, teamId, lockedForDequeue: true });

          const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
          await queuing.markCallAsReadyForDequeue(ctx, commId);
          await callQueueMessages;

          const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, teamId);
          expect(queuedCalls.find(c => c.commId === commId).lockedForDequeue).to.be.ok;
          expect(makeCall).to.have.been.calledTwice;

          expect(makeCallParams.find(p => p.to.includes(agentA.sipEndpoints[0].username))).to.be.ok;
          expect(makeCallParams.find(p => p.to.includes(agentB.sipEndpoints[0].username))).to.be.ok;
        });

        describe('when one agent already declined the call', () => {
          it('should lock the call for dequeuing and call the other agent', async () => {
            const { commId, teamId, makeCall, makeCallParams, otherAgent: agentA, owningAgent: agentB } = await setupForMultipleAgents(
              DALTypes.CallRoutingStrategy.EVERYBODY,
            );
            await repo.addCallToQueue(ctx, { commId, teamId, lockedForDequeue: true, declinedByUserIds: [agentB.id] });

            const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
            await queuing.markCallAsReadyForDequeue(ctx, commId);
            await callQueueMessages;

            const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, teamId);
            expect(queuedCalls.find(c => c.commId === commId).lockedForDequeue).to.be.ok;
            expect(makeCall).to.have.been.calledOnce;

            expect(makeCallParams[0].to).to.include(agentA.sipEndpoints[0].username);
          });
        });

        describe('when there are 2 queued calls, and one agent already declined the oldest call', () => {
          it('should lock both calls for dequeuing and call each agent', async () => {
            const { commId, commId2, teamId, makeCall, makeCallParams, otherAgent: agentA, owningAgent: agentB } = await setupForMultipleAgents(
              DALTypes.CallRoutingStrategy.EVERYBODY,
            );

            await repo.addCallToQueue(ctx, { commId, teamId, lockedForDequeue: true, declinedByUserIds: [agentB.id] });
            await repo.addCallToQueue(ctx, { commId: commId2, teamId, lockedForDequeue: false });

            const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
            await queuing.markCallAsReadyForDequeue(ctx, commId);
            await callQueueMessages;

            const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, teamId);
            expect(queuedCalls.find(c => c.commId === commId).lockedForDequeue).to.be.ok;
            expect(queuedCalls.find(c => c.commId === commId2).lockedForDequeue).to.be.ok;
            expect(makeCall).to.have.been.calledTwice;

            expect(makeCallParams[0].to).to.include(agentA.sipEndpoints[0].username);
            expect(makeCallParams[0].answerUrl).to.include(commId);

            expect(makeCallParams[1].to).to.include(agentB.sipEndpoints[0].username);
            expect(makeCallParams[1].answerUrl).to.include(commId2);
          });
        });
      });
    });

    describe('when all online agents already declined the call', () => {
      const makeDeclinedCallReadyForDequeue = async () => {
        const { commId, callId, party, team, user: firstUserThatDeclined } = await createTestEntities();

        const secondUserThatDeclined = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
        await createATeamMember({ teamId: team.id, userId: secondUserThatDeclined.id });

        const offlineUser = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
        await createATeamMember({ teamId: team.id, userId: offlineUser.id });

        makeUsersSipEndpointsOnline([firstUserThatDeclined, secondUserThatDeclined]);

        const transferCall = sinon.spy();
        setTelephonyOps({ transferCall });

        await repo.addCallToQueue(ctx, { commId, teamId: team.id, lockedForDequeue: true, declinedByUserIds: [firstUserThatDeclined.id] });
        await repo.addCallQueueStats(ctx, { id: newId(), communicationId: commId, entryTime: now() });

        const { task: callQueueMessages } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
        await queuing.markCallAsReadyForDequeue(ctx, commId, secondUserThatDeclined.id);
        await callQueueMessages;

        return { commId, callId, team, party, transferCall };
      };

      it('should remove the call from the CallQueue table', async () => {
        const { commId, team } = await makeDeclinedCallReadyForDequeue();
        const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
        expect(queuedCalls.map(c => c.commId)).to.not.include(commId);
      });

      it('should return zero count for calls and the teamId of the user team', async () => {
        const { team } = await makeDeclinedCallReadyForDequeue();
        const queuedCalls = await repo.getCallQueueCountByTeamIds(ctx, [team.id]);
        const [firstRow] = queuedCalls || [];
        expect(firstRow.count).to.equal('0');
        expect(firstRow.teamId).to.equal(team.id);
      });

      it('should assign the party of the caller', async () => {
        const { party } = await makeDeclinedCallReadyForDequeue();

        const assignedParty = await loadParty(ctx, party.id);
        expect(assignedParty.userId).to.be.ok;
      });

      it('should mark the call as missed and as an unread comm', async () => {
        const { commId } = await makeDeclinedCallReadyForDequeue();
        const { message, unread } = await loadMessageById(ctx, commId);

        expect(message.missedCallReason).to.equal(DALTypes.MissedCallReason.QUEUE_DECLINED_BY_ALL);

        expect(message.isMissed).to.be.ok;
        expect(unread).to.be.ok;
      });

      it('should save the exit time and set "transferredToVoiceMail" in the CallQueueStatistics', async () => {
        const { commId } = await makeDeclinedCallReadyForDequeue();

        const stats = await repo.getCallQueueStatsByCommId(ctx, commId);

        expect(stats).to.be.ok;
        expect(stats.entryTime).to.be.ok;
        expect(stats.exitTime).to.be.ok;
        expect(stats.transferredToVoiceMail).to.be.true;
      });

      it('should transfer call to voicemail', async () => {
        const { commId, callId, transferCall } = await makeDeclinedCallReadyForDequeue();

        const { auth, transferToVoicemailUrl } = await getTelephonyConfigs(ctx);
        const url = addParamsToUrl(transferToVoicemailUrl, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });

        expect(transferCall).to.have.been.calledOnce;
        expect(transferCall).to.have.been.calledWith(auth, { callId, alegUrl: url });
      });
    });
  });

  const setupQueuedCall = async () => {
    const { commId, team, user, ...rest } = await createTestEntities();
    const firedCallsToAgent = [newId(), newId()];
    await repo.addCallToQueue(ctx, { commId, teamId: team.id, firedCallsToAgents: { [user.id]: firedCallsToAgent } });
    await repo.addCallQueueStats(ctx, {
      id: newId(),
      communicationId: commId,
      entryTime: now(),
    });

    return { team, commId, user, firedCallsToAgent, ...rest };
  };

  describe('given a request for callback via IVR', () => {
    const requestCallbackAndWaitForTasks = async (commId, programId) => {
      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
      await queuing.requestCallback(ctx, { commId, programId });
      await callQueueMessage;
    };

    it('should remove the call from the CallQueue table', async () => {
      const { team, commId, programId } = await setupQueuedCall();

      await requestCallbackAndWaitForTasks(commId, programId);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
      expect(queuedCalls.map(c => c.commId)).to.not.include(commId);
    });

    it('should assign the party of the caller', async () => {
      const { commId, party, user, programId } = await setupQueuedCall();

      expect(party.userId).to.not.be.ok;

      await requestCallbackAndWaitForTasks(commId, programId);

      const assignedParty = await loadParty(ctx, party.id);
      expect(assignedParty.userId).to.equal(user.id);
    });

    it('should mark the call as missed and as an unread comm', async () => {
      const { commId, programId } = await setupQueuedCall();

      await requestCallbackAndWaitForTasks(commId, programId);

      const [{ message, unread }] = await getAllComms(ctx);

      expect(message.isMissed).to.be.ok;
      expect(unread).to.be.ok;
      expect(message.missedCallReason).to.equal(DALTypes.MissedCallReason.CALLBACK_REQUESTED);
    });

    it('should save the exit time and set "callerRequestedAction" in the CallQueueStatistics', async () => {
      const { commId, programId } = await setupQueuedCall();

      await requestCallbackAndWaitForTasks(commId, programId);

      const stats = await repo.getCallQueueStatsByCommId(ctx, commId);

      expect(stats).to.be.ok;
      expect(stats.entryTime).to.be.ok;
      expect(stats.exitTime).to.be.ok;
      expect(stats.callerRequestedAction).to.equal(DALTypes.CallerRequestedAction.CALL_BACK);
    });

    it('should hangup all calls fired to connect an agent', async () => {
      const hangupCall = sinon.spy();
      setTelephonyOps({ hangupCall });

      const { commId, firedCallsToAgent, programId } = await setupQueuedCall();

      await requestCallbackAndWaitForTasks(commId, programId);

      const { auth } = await getTelephonyConfigs(ctx);
      firedCallsToAgent.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
    });
  });

  describe('given a request to be transferred to voicemail via IVR', () => {
    const requestTransferAndWaitForTasks = async commId => {
      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
      await queuing.requestVoicemail(ctx, { commId });
      await callQueueMessage;
    };

    it('should remove the call from the CallQueue table', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { team, commId } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
      expect(queuedCalls.map(c => c.commId)).to.not.include(commId);
    });

    it('should assign the party of the caller', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId, party, user } = await setupQueuedCall();

      expect(party.userId).to.not.be.ok;

      await requestTransferAndWaitForTasks(commId);

      const assignedParty = await loadParty(ctx, party.id);
      expect(assignedParty.userId).to.equal(user.id);
    });

    it('should mark the call as missed and as an unread comm', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId);

      const [{ message, unread }] = await getAllComms(ctx);
      expect(message.missedCallReason).to.equal(DALTypes.MissedCallReason.VOICEMAIL_REQUEST);

      expect(message.isMissed).to.be.ok;
      expect(unread).to.be.ok;
    });

    it('should save the exit time and set "callerRequestedAction" in the CallQueueStatistics', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId);

      const stats = await repo.getCallQueueStatsByCommId(ctx, commId);

      expect(stats).to.be.ok;
      expect(stats.entryTime).to.be.ok;
      expect(stats.exitTime).to.be.ok;
      expect(stats.callerRequestedAction).to.equal(DALTypes.CallerRequestedAction.VOICEMAIL);
    });

    it('should transfer call to voicemail', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId, callId } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId);

      const { auth, transferToVoicemailUrl } = await getTelephonyConfigs(ctx);
      const url = addParamsToUrl(transferToVoicemailUrl, { commId, messageType: DALTypes.VoiceMessageType.VOICEMAIL });

      expect(transferCall).to.have.been.calledOnce;
      expect(transferCall).to.have.been.calledWith(auth, { callId, alegUrl: url });
    });

    it('should hangup all calls fired to connect an agent', async () => {
      const hangupCall = sinon.spy();
      setTelephonyOps({ hangupCall });

      const { commId, firedCallsToAgent } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId);

      const { auth } = await getTelephonyConfigs(ctx);
      firedCallsToAgent.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
    });
  });

  describe('given a request to be transferred to phone number via IVR', () => {
    const requestTransferAndWaitForTasks = async (commId, number) => {
      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
      await queuing.requestTransferToNumber(ctx, commId, number);
      await callQueueMessage;
    };

    it('should remove the call from the CallQueue table', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { team, commId, IVRExternalNumber } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId, IVRExternalNumber);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
      expect(queuedCalls.map(c => c.commId)).to.not.include(commId);
    });

    it('should assign the party of the caller', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId, party, user, IVRExternalNumber } = await setupQueuedCall();

      expect(party.userId).to.not.be.ok;

      await requestTransferAndWaitForTasks(commId, IVRExternalNumber);

      const assignedParty = await loadParty(ctx, party.id);
      expect(assignedParty.userId).to.equal(user.id);
    });

    it('should mark the call as transferred from queue comm', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId, IVRExternalNumber } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId, IVRExternalNumber);

      const [{ message }] = await getAllComms(ctx);

      expect(message.wasTransferred).to.be.ok;
      expect(message.transferRequestedFrom).to.be.equal(DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME);
    });

    it('should save the exit time, "callerRequestedAction" and transfer number in the CallQueueStatistics', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId, IVRExternalNumber } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId, IVRExternalNumber);

      const stats = await repo.getCallQueueStatsByCommId(ctx, commId);

      expect(stats).to.be.ok;
      expect(stats.entryTime).to.be.ok;
      expect(stats.exitTime).to.be.ok;
      expect(stats.callerRequestedAction).to.equal(DALTypes.CallerRequestedAction.TRANSFER_TO_NUMBER);
      expect(stats.metadata.transferToNumber).to.be.ok;
    });

    it('should transfer call to external number', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { commId, callId, IVRExternalNumber } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId, IVRExternalNumber);

      const conf = await getTelephonyConfigs(ctx);
      const url = addParamsToUrl(conf.answerUrl, {
        transferTargetType: TransferTargetType.EXTERNAL_PHONE,
        transferTarget: IVRExternalNumber,
        transferredCallDirection: DALTypes.CommunicationDirection.IN,
        commId,
      });

      expect(transferCall).to.have.been.calledOnce;
      expect(transferCall).to.have.been.calledWith(conf.auth, { callId, alegUrl: url });
    });

    it('should hangup all calls fired to connect an agent', async () => {
      const hangupCall = sinon.spy();
      setTelephonyOps({ hangupCall });

      const { commId, firedCallsToAgent, IVRExternalNumber } = await setupQueuedCall();

      await requestTransferAndWaitForTasks(commId, IVRExternalNumber);

      const { auth } = await getTelephonyConfigs(ctx);
      firedCallsToAgent.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
    });
  });

  describe('given a request to hangup a queued call', () => {
    const hangupAndWaitForTasks = async commId => {
      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);

      await queuing.handleHangup(ctx, commId);
      await callQueueMessage;
    };

    it('should remove the call from the CallQueue table', async () => {
      const { team, commId } = await setupQueuedCall();

      await hangupAndWaitForTasks(commId);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
      expect(queuedCalls.map(c => c.commId)).to.not.include(commId);
    });

    it('should mark the call as missed and as an unread comm', async () => {
      const { commId } = await setupQueuedCall();

      await hangupAndWaitForTasks(commId);

      const [{ message, unread }] = await getAllComms(ctx);
      expect(message.missedCallReason).to.equal(DALTypes.MissedCallReason.NORMAL_QUEUE);

      expect(message.isMissed).to.be.ok;
      expect(unread).to.be.ok;
    });

    it('should assign the party of the caller', async () => {
      const { commId, party, user } = await setupQueuedCall();

      expect(party.userId).to.not.be.ok;

      await hangupAndWaitForTasks(commId);

      const assignedParty = await loadParty(ctx, party.id);
      expect(assignedParty.userId).to.equal(user.id);
    });

    describe('when the party of the caller is already assigned', () => {
      it('should NOT reassign the party of the caller', async () => {
        const { commId, party, user } = await setupQueuedCall();

        expect(party.userId).to.not.be.ok;
        const initialOwner = await createAUser();
        await updateOwner(ctx, party, initialOwner.id);

        await hangupAndWaitForTasks(commId);

        const assignedParty = await loadParty(ctx, party.id);
        expect(assignedParty.userId).to.not.equal(user.id);
        expect(assignedParty.userId).to.equal(initialOwner.id);
      });
    });

    it('should save the exit time and set "hangUp" in the CallQueueStatistics', async () => {
      const { commId } = await setupQueuedCall();

      await hangupAndWaitForTasks(commId);

      const stats = await repo.getCallQueueStatsByCommId(ctx, commId);

      expect(stats).to.be.ok;
      expect(stats.entryTime).to.be.ok;
      expect(stats.exitTime).to.be.ok;
      expect(stats.hangUp).to.be.true;
    });

    it('should hangup all calls fired to connect an agent', async () => {
      const hangupCall = sinon.spy();
      setTelephonyOps({ hangupCall });

      const { commId, firedCallsToAgent } = await setupQueuedCall();

      await hangupAndWaitForTasks(commId);

      const { auth } = await getTelephonyConfigs(ctx);
      firedCallsToAgent.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
    });
  });

  describe('given that time limit in the queue for a call is reached', () => {
    before(() => setTelephonyOps({ transferCall: () => {} }));
    afterEach(resetDequeueCallAfterTimeoutFunc);

    describe('when the call is unlocked for dequeue', () => {
      it('should remove the call from the CallQueue table', async () => {
        const { team, commId, user } = await createTestEntities({ timeToVoiceMail: 0.1 });

        await repo.addCallToQueue(ctx, { commId, teamId: team.id, lockedForDequeue: true });
        // wait twice: once for call-ready-for-dequeue message and once for queue-time-expired messsage
        const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId, msg => msg.commId === commId], CALL_TOPICS);

        await waitFor(110);
        await queuing.markCallAsReadyForDequeue(ctx, commId, user.id);

        await callQueueMessage;

        const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
        expect(queuedCalls.map(c => c.commId)).to.not.include(commId);

        const comm = await loadMessageById(ctx, commId);
        expect(comm.message.missedCallReason).to.equal(DALTypes.MissedCallReason.QUEUE_TIME_EXPIRED);
      });
    });

    describe('when the call is locked for dequeue', () => {
      it('should not remove the call from the CallQueue table', async () => {
        const { team, commId } = await createTestEntities({ timeToVoiceMail: 0.1 });

        await repo.addCallToQueue(ctx, { commId, teamId: team.id, lockedForDequeue: true });

        const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId], CALL_TOPICS);
        await dequeueCallAfterTimeout({ ctx, commId, teamId: team.id });

        await callQueueMessage;

        const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
        expect(queuedCalls.map(c => c.commId)).to.include(commId);
      });
    });

    const sendToQueueAndWaitForTasks = async (commId, team, programId) => {
      setDequeueCallAfterTimeoutFunc(async () => {
        await repo.unlockCallForDequeue(ctx, commId);
        await dequeueCallAfterTimeout({ ctx, commId, teamId: team.id });
      });

      // 2 messages need to be processed: call enqueued and call ready for dequeue
      const { task: enqueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId, msg => msg.commId === commId], CALL_TOPICS);
      await queuing.sendCallToQueue(ctx, { commId, team, programId });
      await enqueueMessage;
    };

    it('should remove the call from the CallQueue table', async () => {
      const { team, commId, programId } = await createTestEntities({ timeToVoiceMail: 0.1 });

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
      expect(queuedCalls.map(c => c.commId)).to.not.include(commId);
    });

    it('should assign the party of the caller', async () => {
      const { team, commId, party, user, programId } = await createTestEntities({ timeToVoiceMail: 0.1 });

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const assignedParty = await loadParty(ctx, party.id);
      expect(assignedParty.userId).to.equal(user.id);
    });

    it('should mark the call as missed and as an unread comm', async () => {
      const { team, commId, programId } = await createTestEntities({ timeToVoiceMail: 0.1 });

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const [{ message, unread }] = await getAllComms(ctx);

      expect(message.isMissed).to.be.ok;
      expect(unread).to.be.ok;
    });

    it('should transfer call to voicemail', async () => {
      const { team, commId, callId, programId } = await createTestEntities({ timeToVoiceMail: 0.1 });
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const { auth, transferToVoicemailUrl } = await getTelephonyConfigs(ctx);
      const url = addParamsToUrl(transferToVoicemailUrl, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });

      expect(transferCall).to.have.been.calledOnce;
      expect(transferCall).to.have.been.calledWith(auth, { callId, alegUrl: url });
    });

    it('should save the exit time and set "transferredToVoiceMail" in the CallQueueStatistics', async () => {
      const { team, commId, programId } = await createTestEntities({ timeToVoiceMail: 0.1 });
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      await sendToQueueAndWaitForTasks(commId, team, programId);

      const stats = await repo.getCallQueueStatsByCommId(ctx, commId);

      expect(stats).to.be.ok;
      expect(stats.entryTime).to.be.ok;
      expect(stats.exitTime).to.be.ok;
      expect(stats.transferredToVoiceMail).to.be.true;
    });
  });

  const makeUserAvailableAndWaitForQueue = async userId => {
    const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.userId === userId], CALL_TOPICS);

    await updateUserStatus(ctx, userId, DALTypes.UserStatus.AVAILABLE);

    await callQueueMessage;
    await waitFor(2 * config.telephony.callQueueUserAvailabilityDelay);
  };

  describe('given that a user has become available', () => {
    const setupCallQueueForAvailableUser = async ({ userRole, alreadyDeclined = false } = {}) => {
      const { commId: firstCommId, callId, party, user, team } = await createTestEntities({ userRole });

      const { id: secondCommId } = await createALiveCall({ teams: [team.id], parties: [party.id] });

      const { id: lockedCommId } = await createALiveCall({ teams: [team.id], parties: [party.id] });

      const declinedByUserIds = alreadyDeclined ? [user.id] : [];

      await repo.addCallToQueue(ctx, { commId: lockedCommId, teamId: team.id, lockedForDequeue: true });
      await waitFor(100);
      await repo.addCallToQueue(ctx, { commId: firstCommId, teamId: team.id, declinedByUserIds });
      await waitFor(100);
      await repo.addCallToQueue(ctx, { commId: secondCommId, teamId: team.id, declinedByUserIds });

      return { firstCommId, secondCommId, lockedCommId, callId, user, team };
    };

    it('should lock for dequeuing the call from party owned by him with priority', async () => {
      setTelephonyOps({ makeCall: () => ({ requestUuid: [newId()] }) });

      const team = await createTeamForCallQueuing();
      const user = await createAUser({ status: DALTypes.UserStatus.BUSY });
      makeUsersSipEndpointsOnline([user]);
      await createATeamMember({ teamId: team.id, userId: user.id });

      const ownedParty = await createAParty({ userId: user.id });
      const { id: commForOwnedParty } = await createALiveCall({ teams: [team.id], parties: [ownedParty.id] });

      const anotherParty = await createAParty();

      const { id: commForOtherParty } = await createALiveCall({ teams: [team.id], parties: [anotherParty.id] });

      await repo.addCallToQueue(ctx, {
        commId: commForOtherParty,
        teamId: team.id,
      });
      await waitFor(100);
      await repo.addCallToQueue(ctx, {
        commId: commForOwnedParty,
        teamId: team.id,
      });

      await makeUserAvailableAndWaitForQueue(user.id);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
      expect(queuedCalls.find(c => c.commId === commForOwnedParty).lockedForDequeue).to.be.ok;
      expect(queuedCalls.find(c => c.commId === commForOtherParty).lockedForDequeue).to.not.be.ok;
    });

    it('should lock for dequeue the oldest call from the queue that is not already locked', async () => {
      setTelephonyOps({ makeCall: () => ({ requestUuid: [newId()] }) });

      const { firstCommId, secondCommId, lockedCommId, user, team } = await setupCallQueueForAvailableUser();

      await makeUserAvailableAndWaitForQueue(user.id);

      const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);
      expect(queuedCalls.find(c => c.commId === lockedCommId).lockedForDequeue).to.be.ok;
      expect(queuedCalls.find(c => c.commId === firstCommId).lockedForDequeue).to.be.ok;
      expect(queuedCalls.find(c => c.commId === secondCommId).lockedForDequeue).to.not.be.ok;
    });

    it('should make a call to the user', async () => {
      const makeCall = sinon.spy(() => ({ requestUuid: [newId()] }));
      setTelephonyOps({ makeCall });

      const { user } = await setupCallQueueForAvailableUser();

      await makeUserAvailableAndWaitForQueue(user.id);

      // further details about the call are verified in server/api/__integration__/webhooks-transferFromQueue-test.js
      expect(makeCall).to.have.been.called;
    });

    describe('when the user is agent in two teams with call queuing and there are calls enqueued for each team', () => {
      it('should lock for dequeuing the oldest call for either team', async () => {
        setTelephonyOps({ makeCall: () => ({ requestUuid: [newId()] }) });

        const user = await createAUser({ status: DALTypes.UserStatus.BUSY });
        makeUsersSipEndpointsOnline([user]);

        const team1 = await createTeamForCallQueuing({
          name: 'team1',
          phone: '12025550196',
        });
        await createATeamMember({ teamId: team1.id, userId: user.id });

        const party1 = await createAParty();
        const { id: firstTeamCommId } = await createALiveCall({ teams: [team1.id], parties: [party1.id] });

        const team2 = await createTeamForCallQueuing({
          name: 'team2',
          phone: '12025550197',
        });
        await createATeamMember({ teamId: team2.id, userId: user.id });

        const party2 = await createAParty();
        const { id: secondTeamCommId } = await createALiveCall({ teams: [team2.id], parties: [party2.id] });

        await repo.addCallToQueue(ctx, {
          commId: secondTeamCommId,
          teamId: team2.id,
        });
        await waitFor(100);
        await repo.addCallToQueue(ctx, {
          commId: firstTeamCommId,
          teamId: team1.id,
        });

        await makeUserAvailableAndWaitForQueue(user.id);

        const [team1QueuedCall] = await repo.getQueuedCallsByTeamId(ctx, team1.id);
        expect(team1QueuedCall.lockedForDequeue).to.not.be.ok;

        const [team2QueuedCall] = await repo.getQueuedCallsByTeamId(ctx, team2.id);
        expect(team2QueuedCall.lockedForDequeue).to.be.ok;
      });
    });

    describe('when the user already declined the queuedCalls', () => {
      it('should not lock any calls for dequeing', async () => {
        const { firstCommId, secondCommId, user, team } = await setupCallQueueForAvailableUser({ alreadyDeclined: true });

        await makeUserAvailableAndWaitForQueue(user.id);

        const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);

        expect(queuedCalls.find(c => c.commId === firstCommId).lockedForDequeue).to.not.be.ok;
        expect(queuedCalls.find(c => c.commId === secondCommId).lockedForDequeue).to.not.be.ok;
      });

      it('should not connect the user for any queued calls', async () => {
        const makeCall = sinon.spy();
        setTelephonyOps({ makeCall });

        const { user } = await setupCallQueueForAvailableUser({ alreadyDeclined: true });

        await makeUserAvailableAndWaitForQueue(user.id);

        expect(makeCall).to.have.not.been.called;
      });
    });

    describe('when the user is not an agent in the team', () => {
      it('should not lock any calls for dequeing', async () => {
        setTelephonyOps({ makeCall: () => ({ requestUuid: [newId()] }) });

        const { firstCommId, secondCommId, user, team } = await setupCallQueueForAvailableUser({
          userRole: MainRoleDefinition.LM.name,
        });

        await makeUserAvailableAndWaitForQueue(user.id);

        const queuedCalls = await repo.getQueuedCallsByTeamId(ctx, team.id);

        expect(queuedCalls.find(c => c.commId === firstCommId).lockedForDequeue).to.not.be.ok;
        expect(queuedCalls.find(c => c.commId === secondCommId).lockedForDequeue).to.not.be.ok;
      });

      it('should not connect the user for any queued calls', async () => {
        const makeCall = sinon.spy(() => ({ requestUuid: [newId()] }));
        setTelephonyOps({ makeCall });

        const { user } = await setupCallQueueForAvailableUser({
          userRole: MainRoleDefinition.LM.name,
        });

        await makeUserAvailableAndWaitForQueue(user.id);

        expect(makeCall).to.have.not.been.called;
      });
    });
  });

  describe('given that two users become available one right after another', () => {
    let makeCall;
    beforeEach(() => {
      makeCall = sinon.spy(() => ({ requestUuid: [newId()] }));
      setTelephonyOps({ makeCall });
    });

    const makeAgentsAvailableAndWaitForHandling = async (userId1, userId2) => {
      const { task } = await setupQueueToWaitFor([msg => msg.userId === userId1, msg => msg.userId === userId2], CALL_TOPICS);
      await updateUserStatus(ctx, userId1, DALTypes.UserStatus.AVAILABLE);
      await waitFor(10);
      await updateUserStatus(ctx, userId2, DALTypes.UserStatus.AVAILABLE);

      await task;
      await waitFor(2 * config.telephony.callQueueUserAvailabilityDelay);
    };

    describe('when they are in the same team with routing strategy EVERYBODY', () => {
      describe('when there are two queued calls for that team', () => {
        it('should call both agents for oldest queued call', async () => {
          const user1 = await createAUser({ status: DALTypes.UserStatus.BUSY });
          const user2 = await createAUser({ status: DALTypes.UserStatus.BUSY });

          makeUsersSipEndpointsOnline([user1, user2]);

          const team = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY });
          await createATeamMember({ teamId: team.id, userId: user1.id });
          await createATeamMember({ teamId: team.id, userId: user2.id });

          const party = await createAParty();
          const { id: commId1 } = await createALiveCall({ teams: [team.id], parties: [party.id] });
          await repo.addCallToQueue(ctx, { commId: commId1, teamId: team.id });
          const { id: commId2 } = await createALiveCall({ teams: [team.id], parties: [party.id] });
          await repo.addCallToQueue(ctx, { commId: commId2, teamId: team.id });

          await makeAgentsAvailableAndWaitForHandling(user1.id, user2.id);

          expect(makeCall).to.have.been.calledTwice;

          const { auth } = await getTelephonyConfigs(ctx);
          expect(makeCall).to.have.been.calledWith(
            auth,
            sinon.match({ to: toQualifiedSipEndpoint(user1.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commId1) }),
          );
          expect(makeCall).to.have.been.calledWith(
            auth,
            sinon.match({ to: toQualifiedSipEndpoint(user2.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commId1) }),
          );

          const usersLockStatus = (await loadUsersByIds(ctx, [user1.id, user2.id])).map(u => parseBoolean(u.lockedForCallQueueRouting));
          expect(usersLockStatus, 'users where not unlocked after call queue routing').to.deep.equal([false, false]);
        });
      });
    });

    describe('when they are both in teamA and one in teamB also, both teams with routing strategy EVERYBODY', () => {
      describe('when there is one queued call for each team', () => {
        describe('and the call for teamA is the oldest', () => {
          it('should call both agents for the call for team A', async () => {
            const user1 = await createAUser({ status: DALTypes.UserStatus.BUSY });
            const user2 = await createAUser({ status: DALTypes.UserStatus.BUSY });

            makeUsersSipEndpointsOnline([user1, user2]);

            const teamA = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY });
            const teamB = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY });
            await createATeamMember({ teamId: teamA.id, userId: user1.id });
            await createATeamMember({ teamId: teamA.id, userId: user2.id });
            await createATeamMember({ teamId: teamB.id, userId: user2.id });

            const partyA = await createAParty();
            const { id: commIdA } = await createALiveCall({ teams: [teamA.id], parties: [partyA.id] });
            await repo.addCallToQueue(ctx, { commId: commIdA, teamId: teamA.id });
            const partyB = await createAParty();
            const { id: commIdB } = await createALiveCall({ teams: [teamB.id], parties: [partyB.id] });
            await repo.addCallToQueue(ctx, { commId: commIdB, teamId: teamB.id });

            await makeAgentsAvailableAndWaitForHandling(user1.id, user2.id);

            expect(makeCall).to.have.been.calledTwice;

            const { auth } = await getTelephonyConfigs(ctx);
            expect(makeCall).to.have.been.calledWith(
              auth,
              sinon.match({ to: toQualifiedSipEndpoint(user1.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commIdA) }),
            );
            expect(makeCall).to.have.been.calledWith(
              auth,
              sinon.match({ to: toQualifiedSipEndpoint(user2.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commIdA) }),
            );

            const usersLockStatus = (await loadUsersByIds(ctx, [user1.id, user2.id])).map(u => parseBoolean(u.lockedForCallQueueRouting));
            expect(usersLockStatus, 'users where not unlocked after call queue routing').to.deep.equal([false, false]);
          });
        });

        describe('and the call for team B is the oldest', () => {
          it('should call agent from teamB for teamB call and agent from teamA for teamA call', async () => {
            const user1 = await createAUser({ status: DALTypes.UserStatus.BUSY });
            const user2 = await createAUser({ status: DALTypes.UserStatus.BUSY });

            makeUsersSipEndpointsOnline([user1, user2]);

            const teamA = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY });
            const teamB = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY });
            await createATeamMember({ teamId: teamA.id, userId: user1.id });
            await createATeamMember({ teamId: teamA.id, userId: user2.id });
            await createATeamMember({ teamId: teamB.id, userId: user2.id });

            const partyB = await createAParty();
            const { id: commIdB } = await createALiveCall({ teams: [teamB.id], parties: [partyB.id] });
            await repo.addCallToQueue(ctx, { commId: commIdB, teamId: teamB.id });

            const partyA = await createAParty();
            const { id: commIdA } = await createALiveCall({ teams: [teamA.id], parties: [partyA.id] });
            await repo.addCallToQueue(ctx, { commId: commIdA, teamId: teamA.id });

            await makeAgentsAvailableAndWaitForHandling(user1.id, user2.id);

            expect(makeCall).to.have.been.calledTwice;

            const { auth } = await getTelephonyConfigs(ctx);
            expect(makeCall).to.have.been.calledWith(
              auth,
              sinon.match({ to: toQualifiedSipEndpoint(user2.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commIdB) }),
            );
            expect(makeCall).to.have.been.calledWith(
              auth,
              sinon.match({ to: toQualifiedSipEndpoint(user1.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commIdA) }),
            );

            const usersLockStatus = (await loadUsersByIds(ctx, [user1.id, user2.id])).map(u => parseBoolean(u.lockedForCallQueueRouting));
            expect(usersLockStatus, 'users where not unlocked after call queue routing').to.deep.equal([false, false]);
          });
        });
      });
    });

    describe('when they are in the same team with routing strategy ROUND ROBIN', () => {
      describe('when there are two queued calls for that team', () => {
        it('should call each agent for a queued call', async () => {
          const user1 = await createAUser({ status: DALTypes.UserStatus.BUSY });
          const user2 = await createAUser({ status: DALTypes.UserStatus.BUSY });

          makeUsersSipEndpointsOnline([user1, user2]);

          const team = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.ROUND_ROBIN });
          await createATeamMember({ teamId: team.id, userId: user1.id });
          await createATeamMember({ teamId: team.id, userId: user2.id });

          const party = await createAParty();
          const { id: commId1 } = await createALiveCall({ teams: [team.id], parties: [party.id] });
          await repo.addCallToQueue(ctx, { commId: commId1, teamId: team.id });

          const { id: commId2 } = await createALiveCall({ teams: [team.id], parties: [party.id] });
          await repo.addCallToQueue(ctx, { commId: commId2, teamId: team.id });

          await makeAgentsAvailableAndWaitForHandling(user1.id, user2.id);

          expect(makeCall).to.have.been.calledTwice;

          const { auth } = await getTelephonyConfigs(ctx);
          expect(makeCall).to.have.been.calledWith(auth, sinon.match({ sipHeaders: toCommIdSipHeader(commId1) }));
          expect(makeCall).to.have.been.calledWith(auth, sinon.match({ sipHeaders: toCommIdSipHeader(commId2) }));
          expect(makeCall).to.have.been.calledWith(auth, sinon.match({ to: toQualifiedSipEndpoint(user1.sipEndpoints[0]) }));
          expect(makeCall).to.have.been.calledWith(auth, sinon.match({ to: toQualifiedSipEndpoint(user2.sipEndpoints[0]) }));

          const usersLockStatus = (await loadUsersByIds(ctx, [user1.id, user2.id])).map(u => parseBoolean(u.lockedForCallQueueRouting));
          expect(usersLockStatus, 'users where not unlocked after call queue routing').to.deep.equal([false, false]);
        });
      });
    });

    describe('when they are in different teams with routing strategy ROUND ROBIN', () => {
      describe('when there are two queued calls for each team', () => {
        it("should call each agent for his team's queued call", async () => {
          const user1 = await createAUser({ status: DALTypes.UserStatus.BUSY });
          const user2 = await createAUser({ status: DALTypes.UserStatus.BUSY });

          makeUsersSipEndpointsOnline([user1, user2]);

          const team1 = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.ROUND_ROBIN });
          await createATeamMember({ teamId: team1.id, userId: user1.id });

          const team2 = await createTeamForCallQueuing({ callRoutingStrategy: DALTypes.CallRoutingStrategy.ROUND_ROBIN });
          await createATeamMember({ teamId: team2.id, userId: user2.id });

          const party = await createAParty();
          const { id: commId1 } = await createALiveCall({ teams: [team1.id], parties: [party.id] });
          await repo.addCallToQueue(ctx, { commId: commId1, teamId: team1.id });

          const { id: commId2 } = await createALiveCall({ teams: [team2.id], parties: [party.id] });
          await repo.addCallToQueue(ctx, { commId: commId2, teamId: team2.id });

          await makeAgentsAvailableAndWaitForHandling(user1.id, user2.id);

          expect(makeCall).to.have.been.calledTwice;

          const { auth } = await getTelephonyConfigs(ctx);
          expect(makeCall).to.have.been.calledWith(
            auth,
            sinon.match({ to: toQualifiedSipEndpoint(user1.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commId1) }),
          );
          expect(makeCall).to.have.been.calledWith(
            auth,
            sinon.match({ to: toQualifiedSipEndpoint(user2.sipEndpoints[0]), sipHeaders: toCommIdSipHeader(commId2) }),
          );

          const usersLockStatus = (await loadUsersByIds(ctx, [user1.id, user2.id])).map(u => parseBoolean(u.lockedForCallQueueRouting));
          expect(usersLockStatus, 'users where not unlocked after call queue routing').to.deep.equal([false, false]);
        });
      });
    });
  });

  describe('given the team reached end of office hours', () => {
    beforeEach(() => setTelephonyOps({ transferCall: () => {} }));

    const reachEndOfDay = async (teamId, jobId) => {
      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamIds && msg.teamIds[0] === teamId], CALL_TOPICS);

      await updateTeam(ctx, teamId, { officeHours: officeHoursAlwaysOff });
      await queuing.clearCallQueueIfEndOfDay(ctx, { jobId });

      await callQueueMessage;
    };

    it('should play a message and transfer to voicemail', async () => {
      const { callId, commId, team } = await setupQueuedCall();

      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      await reachEndOfDay(team.id);

      const { auth, transferToVoicemailUrl } = await getTelephonyConfigs(ctx);
      const url = addParamsToUrl(transferToVoicemailUrl, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_CLOSING });

      expect(transferCall).to.have.been.calledOnce;
      expect(transferCall).to.have.been.calledWith(auth, { callId, alegUrl: url });
    });

    it('should remove all the calls for that team from the queue and save exit time for them', async () => {
      const { team, commId } = await setupQueuedCall();

      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      await reachEndOfDay(team.id);

      const queuedCalls = await repo.getQueuedCalls(ctx);
      expect(queuedCalls.map(c => c.commId)).to.not.include(commId);

      const stats = await repo.getCallQueueStatsByCommId(ctx, commId);
      expect(stats).to.be.ok;
      expect(stats.exitTime).to.be.ok;
    });

    it('should assign the party of the caller', async () => {
      const { team, party, user } = await setupQueuedCall();

      expect(party.userId).to.not.be.ok;

      await reachEndOfDay(team.id);

      const assignedParty = await loadParty(ctx, party.id);
      expect(assignedParty.userId).to.equal(user.id);
    });

    it('should mark the call as missed and as an unread comm', async () => {
      const { team, callId } = await setupQueuedCall();

      await reachEndOfDay(team.id);

      const [{ message, unread }] = await getCommunicationsByMessageId(ctx, callId);
      expect(message.missedCallReason).to.equal(DALTypes.MissedCallReason.QUEUE_END_OF_DAY);

      expect(message.isMissed).to.be.ok;
      expect(unread).to.be.ok;
    });

    it('should hangup all calls fired to connect an agent', async () => {
      const hangupCall = sinon.spy();
      setTelephonyOps({ hangupCall });

      const { team, firedCallsToAgent } = await setupQueuedCall();

      await reachEndOfDay(team.id);

      const { auth } = await getTelephonyConfigs(ctx);
      firedCallsToAgent.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
    });

    it('should set the end of day recurring job status to "Idle"', async () => {
      const { id: jobId } = await getRecurringJobByName(ctx, DALTypes.Jobs.CallQueueEndOfDay);
      await updateRecurringJobStatus(ctx, jobId, DALTypes.JobStatus.IN_PROGRESS);
      const { team } = await setupQueuedCall();

      await reachEndOfDay(team.id, jobId);

      const { status } = await getRecurringJobByName(ctx, DALTypes.Jobs.CallQueueEndOfDay);
      expect(status).to.equal(DALTypes.JobStatus.IDLE);
    });
  });

  describe('given that all users in a team go offline', () => {
    beforeEach(() => setTelephonyOps({ transferCall: () => {} }));

    const setupCallQueueForOffline = async () => {
      const { commId: usersTeamCommId, callId, party, user, team } = await createTestEntities();

      const team2 = await createTeamForCallQueuing({
        name: 'team2',
        phone: '12025550197',
      });
      const { id: anotherTeamCommId } = await createALiveCall({ teams: [team2.id], parties: [party.id] });

      const firedCallsToAgent = [newId(), newId()];
      await repo.addCallToQueue(ctx, {
        commId: usersTeamCommId,
        teamId: team.id,
        firedCallsToAgents: { [user.id]: firedCallsToAgent },
      });

      await repo.addCallToQueue(ctx, {
        commId: anotherTeamCommId,
        teamId: team2.id,
      });

      return { usersTeamCommId, anotherTeamCommId, callId, user, team, party, firedCallsToAgent };
    };

    const makeUserUnavailableAndWaitForQueue = async (userId, teamId) => {
      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamIds && msg.teamIds[0] === teamId], CALL_TOPICS);

      await updateUserStatus(ctx, userId, DALTypes.UserStatus.NOT_AVAILABLE);

      await callQueueMessage;
    };

    it('should remove all the calls for that team from the queue', async () => {
      const { usersTeamCommId, anotherTeamCommId, user, team } = await setupCallQueueForOffline();

      await makeUserUnavailableAndWaitForQueue(user.id, team.id);

      const queuedCalls = await repo.getQueuedCalls(ctx);
      expect(queuedCalls.map(c => c.commId)).to.not.include(usersTeamCommId);
      expect(queuedCalls.map(c => c.commId)).to.include(anotherTeamCommId);
    });

    it('should transfer the calls for that team to voicemail', async () => {
      const transferCall = sinon.spy();
      setTelephonyOps({ transferCall });

      const { callId, usersTeamCommId: commId, user, team } = await setupCallQueueForOffline();

      await makeUserUnavailableAndWaitForQueue(user.id, team.id);

      const { auth, transferToVoicemailUrl } = await getTelephonyConfigs(ctx);
      const url = addParamsToUrl(transferToVoicemailUrl, { commId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_UNAVAILABLE });

      expect(transferCall).to.have.been.calledOnce;
      expect(transferCall).to.have.been.calledWith(auth, { callId, alegUrl: url });

      const comm = await loadMessageById(ctx, commId);
      expect(comm.message.missedCallReason).to.equal(DALTypes.MissedCallReason.QUEUE_AGENTS_OFFLINE);
    });

    it('should assign the party of the caller', async () => {
      const { team, party, user } = await setupCallQueueForOffline();

      expect(party.userId).to.not.be.ok;

      await makeUserUnavailableAndWaitForQueue(user.id, team.id);

      const assignedParty = await loadParty(ctx, party.id);
      expect(assignedParty.userId).to.equal(user.id);
    });

    it('should mark the call as missed and as an unread comm', async () => {
      const { team, callId, user } = await setupCallQueueForOffline();

      await makeUserUnavailableAndWaitForQueue(user.id, team.id);

      const [{ message, unread }] = await getCommunicationsByMessageId(ctx, callId);

      expect(message.isMissed).to.be.ok;
      expect(unread).to.be.ok;
      expect(message.missedCallReason).to.equal(DALTypes.MissedCallReason.QUEUE_AGENTS_OFFLINE);
    });

    it('should hangup all calls fired to connect an agent', async () => {
      const hangupCall = sinon.spy();
      setTelephonyOps({ hangupCall });

      const { team, user, firedCallsToAgent } = await setupCallQueueForOffline();

      await makeUserUnavailableAndWaitForQueue(user.id, team.id);

      const { auth } = await getTelephonyConfigs(ctx);
      firedCallsToAgent.forEach(callId => expect(hangupCall).to.have.been.calledWith(auth, { callId }));
    });
  });
});
