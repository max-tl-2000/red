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
  createVoiceMessages,
  createACommunicationEntry,
  createAUser,
  createATeamMember,
  createAParty,
  createAPartyMember,
  createATask,
  createATeamPropertyProgram,
  createAProperty,
  createATeamProperty,
} from '../../../testUtils/repoHelper';
import { post, postDirect, postCallReadyForDequeue, makeUsersSipEndpointsOnline } from '../../../testUtils/telephonyHelper';
import config from '../../../config';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { getAllComms } from '../../../dal/communicationRepo';
import { addCallToQueue, getCallQueueStatsByCommId, addCallQueueStats, getQueuedCalls } from '../../../dal/callQueueRepo';
import { loadProgramForIncomingCommByPhone } from '../../../dal/programsRepo';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { loadUsersByIds } from '../../../services/users';
import { TransferTargetType, CallStatus, ConferenceEvents, ConferenceActions } from '../../../services/telephony/enums';
import { getVoiceMessage, getHoldingMusic } from '../../../services/telephony/voiceMessages';
import { getCallDetailsByCommId } from '../../../dal/callDetailsRepo';
import { waitFor } from '../../../common/utils';
import { now } from '../../../../common/helpers/moment-utils';

chai.use(sinonChai);
const expect = chai.expect;

describe('/webhooks/directDial', () => {
  const programPhoneIdentifier = '12025550190';

  const createTeamAndProgramForCallQueuing = async () => {
    const { name: voiceMessage } = await createVoiceMessages(ctx, {
      withIvrMessages: true,
      messages: { callQueueWelcome: 'team specific call queue message' },
    });

    const team = await createATeam({
      metadata: {
        callQueue: { enabled: true },
      },
      voiceMessage,
    });

    const { id: propertyId } = await createAProperty();
    await createATeamProperty(team.id, propertyId);

    const teamPropertyProgram = await createATeamPropertyProgram({
      teamId: team.id,
      propertyId,
      directPhoneIdentifier: programPhoneIdentifier,
      commDirection: DALTypes.CommunicationDirection.IN,
    });

    return { team, teamPropertyProgram };
  };

  const expectInitialCallQueueInstructions = async ({ response, team, ...targetId }) => {
    const { id: teamId } = team;
    const [comm] = await getAllComms(ctx);

    const { digitsPressedUrl, callReadyForDequeueUrl } = await getTelephonyConfigs(ctx);

    const digitsUrl = addParamsToUrl(digitsPressedUrl, {
      commId: comm.id,
      teamId,
      ...targetId,
      voiceMessageType: DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME,
    });
    const redirectUrl = addParamsToUrl(callReadyForDequeueUrl, { commId: comm.id, teamId });

    expect(response).to.contain('<Redirect');
    expect(response.replace(/amp;/g, '')).to.contain(redirectUrl);

    expect(response).to.contain('<GetDigits');
    expect(response.replace(/amp;/g, '')).to.contain(`action="${digitsUrl}"`);
    expect(response).to.contain('numDigits="1"');

    expect(response).to.contain('<Speak');
    const { message: welcomeMessage } = await getVoiceMessage(ctx, { ...targetId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME });
    expect(response).to.contain(welcomeMessage);
  };

  const expectCallQueueInstructions = async (response, teamId, teamPropertyProgram) => {
    const [comm] = await getAllComms(ctx);

    expect(response).to.contain('<GetDigits');

    const { digitsPressedUrl } = await getTelephonyConfigs(ctx);
    const { programId } = teamPropertyProgram;

    const url = addParamsToUrl(digitsPressedUrl, { commId: comm.id, teamId, programId, voiceMessageType: DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME });

    expect(response.replace(/amp;/g, '')).to.contain(`action="${url}"`);
    expect(response).to.contain('numDigits="1"');

    expect(response).to.contain('<Speak');
    const speakOccurences = response.match(/<Speak/g) || [];
    expect(speakOccurences).to.have.lengthOf(10);

    const { message: welcomeMessage } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME });

    expect(response).to.contain(welcomeMessage);

    expect(response).to.contain('<Play');

    const playOccurences = response.match(/<Play/g) || [];
    expect(playOccurences).to.have.lengthOf(11);

    const loopOccurences = response.match(/loop="0"/g) || [];
    expect(loopOccurences).to.have.lengthOf(1);

    const holdingMusic = await getHoldingMusic(ctx, { programId });
    expect(response).to.contain(holdingMusic);
  };

  describe('given a request for an incoming call', () => {
    describe('when caller is known, call is not a transfer, and team has call queue enabled', () => {
      const setupForKnownCaller = async status => {
        const { team, teamPropertyProgram } = await createTeamAndProgramForCallQueuing();
        const user = await createAUser({ status });
        await createATeamMember({
          teamId: team.id,
          userId: user.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
          },
        });

        const callerNo = '12025550197';
        const contactInfo = enhance([{ type: 'phone', value: callerNo, id: newId() }]);

        const { id: partyId } = await createAParty({
          userId: user.id,
          teams: [team.id],
          ownerTeam: team.id,
        });
        await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

        makeUsersSipEndpointsOnline([user]);

        return { team, user, callerNo, teamPropertyProgram };
      };

      describe('when party owner agents are online but busy', () => {
        it('should respond with call queue specific instructions', async () => {
          const { team, callerNo, teamPropertyProgram } = await setupForKnownCaller(DALTypes.UserStatus.BUSY);

          const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamId === team.id && !!msg.commId], ['calls']);

          const res = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: callerNo })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);
          await callQueueMessage;

          await expectInitialCallQueueInstructions({ response: res.text, team, programId: teamPropertyProgram.programId });
        });
      });

      describe('when party owner agents are online and available', () => {
        it('should respond with call queue specific instructions', async () => {
          const { team, callerNo, teamPropertyProgram } = await setupForKnownCaller(DALTypes.UserStatus.AVAILABLE);

          const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamId === team.id && !!msg.commId], ['calls']);

          const res = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: callerNo })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);
          await callQueueMessage;

          await expectInitialCallQueueInstructions({ response: res.text, team, programId: teamPropertyProgram.programId });
        });
      });

      describe('when call comes in for hub team but party belongs to another team', () => {
        it('should not queue the call but redirect to ownerTeam', async () => {
          const { team: hubTeam } = await createTeamAndProgramForCallQueuing();
          const hubAgent = await createAUser({
            name: 'hubAgent',
            status: DALTypes.UserStatus.BUSY,
          });
          await createATeamMember({
            teamId: hubTeam.id,
            userId: hubAgent.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
            },
          });

          const aTeam = await createATeam({
            name: 'A-Team',
            metadta: {
              callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY,
            },
          });

          const aTeamAgent = await createAUser({
            name: 'aTeamAgent',
            status: DALTypes.UserStatus.AVAILABLE,
          });
          await createATeamMember({
            teamId: aTeam.id,
            userId: aTeamAgent.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
            },
          });

          const callerNo = '12025550197';
          const contactInfo = enhance([{ type: 'phone', value: callerNo, id: newId() }]);
          const program = await loadProgramForIncomingCommByPhone(ctx, programPhoneIdentifier);

          const { id: partyId } = await createAParty({
            userId: aTeamAgent.id,
            teams: [hubTeam.id, aTeam.id],
            ownerTeam: aTeam.id,
            assignedPropertyId: program.propertyId,
          });
          await createAPartyMember(partyId, {
            fullName: 'Batman',
            contactInfo,
          });

          makeUsersSipEndpointsOnline([aTeamAgent]);

          const res = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: callerNo })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);
          expect(res.text).to.contain('<Dial');

          aTeamAgent.sipEndpoints.forEach(e => expect(res.text).to.contain(`<User>sip:${e.username}@phone.plivo.com</User>`));
        });
      });
    });

    describe('when call is a transfer to a specific agent', () => {
      it('should not queue the call but redirect to transfer target agent', async () => {
        const { team } = await createTeamAndProgramForCallQueuing();
        const transferTargetAgent = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
        await createATeamMember({ teamId: team.id, userId: transferTargetAgent.id });
        makeUsersSipEndpointsOnline([transferTargetAgent]);

        const { status, text } = await postDirect()
          .send({ transferTarget: transferTargetAgent.id })
          .send({ transferTargetType: TransferTargetType.USER })
          .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
          .send({ From: '12025550197' })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ CallUUID: newId() });

        expect(status).to.equal(200);
        expect(text).to.contain('<Dial');
        expect(text).to.contain(`<User>sip:${transferTargetAgent.sipEndpoints[0].username}@phone.plivo.com</User>`);
      });
    });

    describe('when call is a transfer to a team with callQueue enabled and caller is owned by another team', () => {
      it('should respond with call queue specific instructions for target team and exclude the transfer initiator from the target agents', async () => {
        const { team, teamPropertyProgram } = await createTeamAndProgramForCallQueuing();
        const transferInitiator = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
        await createATeamMember({ teamId: team.id, userId: transferInitiator.id });
        makeUsersSipEndpointsOnline([transferInitiator]);

        const callerNo = '12025550197';
        const contactInfo = enhance([{ type: 'phone', value: callerNo, id: newId() }]);

        const { propertyId: assignedPropertyId } = teamPropertyProgram;
        const { id: partyId } = await createAParty({ ownerTeam: team.id, assignedPropertyId });
        await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

        const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamId === team.id && !!msg.commId], ['calls']);

        const { status, text } = await postDirect()
          .send({ transferTarget: team.id })
          .send({ transferTargetType: TransferTargetType.TEAM })
          .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
          .send({ transferredFrom: transferInitiator.id })
          .send({ From: callerNo })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ CallUUID: newId() });

        expect(status).to.equal(200);

        await callQueueMessage;

        await expectInitialCallQueueInstructions({ response: text, team, teamId: team.id });

        const queuedCalls = await getQueuedCalls(ctx);

        expect(queuedCalls.length).to.equal(1);
        expect(queuedCalls[0].declinedByUserIds).to.include(transferInitiator.id);
      });
    });

    describe('when caller is unknown, call is not a transfer, and team has call queue enabled', () => {
      describe('when some agents are online but busy', () => {
        it('should respond with call queue specific instructions', async () => {
          const { team, teamPropertyProgram } = await createTeamAndProgramForCallQueuing();
          const user = await createAUser({ status: DALTypes.UserStatus.BUSY });
          await createATeamMember({
            teamId: team.id,
            userId: user.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
            },
          });

          makeUsersSipEndpointsOnline([user]);

          const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamId === team.id && !!msg.commId], ['calls']);

          const res = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: '12025550197' })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);
          await callQueueMessage;

          await expectInitialCallQueueInstructions({ response: res.text, team, programId: teamPropertyProgram.programId });
        });
      });

      describe('when all agents are not available', () => {
        it('should redirect to voicemail', async () => {
          const { team, teamPropertyProgram } = await createTeamAndProgramForCallQueuing();
          const user = await createAUser({
            status: DALTypes.UserStatus.NOT_AVAILABLE,
          });
          await createATeamMember({
            teamId: team.id,
            userId: user.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
            },
          });

          const res = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: '12025550197' })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);
          expect(res.text).to.contain('<Speak');
          const { programId } = teamPropertyProgram;
          const { message: unavailableMessage } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
          expect(res.text).to.contain(unavailableMessage);
        });
      });

      describe('when some agents are available', () => {
        it('should respond with call queue specific instructions', async () => {
          const { team, teamPropertyProgram } = await createTeamAndProgramForCallQueuing();
          const user = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          await createATeamMember({
            teamId: team.id,
            userId: user.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
            },
          });

          makeUsersSipEndpointsOnline([user]);

          const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamId === team.id && !!msg.commId], ['calls']);

          const res = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: '12025550197' })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);
          await callQueueMessage;

          await expectInitialCallQueueInstructions({ response: res.text, team, programId: teamPropertyProgram.programId });
        });

        it('should save the entry time', async () => {
          const { team } = await createTeamAndProgramForCallQueuing();
          const user = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          await createATeamMember({
            teamId: team.id,
            userId: user.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
            },
          });

          makeUsersSipEndpointsOnline([user]);

          const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.teamId === team.id && !!msg.commId], ['calls']);

          const res = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: '12025550197' })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);
          await callQueueMessage;

          const [{ id }] = await getAllComms(ctx);
          const stats = await getCallQueueStatsByCommId(ctx, id);

          expect(stats).to.be.ok;
          expect(stats.entryTime).to.be.ok;
        });
      });
    });
  });

  describe('given a request for callReadyForDequeue', () => {
    it('should respond with 200 and GetDigits, Speak and Play instructions', async () => {
      const user = await createAUser();
      const { team, teamPropertyProgram } = await createTeamAndProgramForCallQueuing();
      await createATeamMember({
        teamId: team.id,
        userId: user.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
        },
      });
      makeUsersSipEndpointsOnline([user]);
      const party = await createAParty();
      const { id: commId } = await createACommunicationEntry({ teams: [team.id], parties: [party.id] });
      await addCallToQueue(ctx, { commId, teamId: team.id });
      await addCallQueueStats(ctx, { communicationId: commId, entryTime: now() });

      const { task: callQueueMessage } = await setupQueueToWaitFor([msg => msg.commId === commId], ['calls']);
      const { programId } = teamPropertyProgram;
      const { status, text: response } = await postCallReadyForDequeue(commId, team.id, programId);

      expect(status).to.equal(200);
      await callQueueMessage;

      await expectCallQueueInstructions(response, team.id, teamPropertyProgram);
    });
  });

  describe('given an outgoing call', () => {
    it.skip('should update call back communication details in CallQueueStatistics', async () => {
      const userPhoneNo = '1202555199';
      const teamPropertyPhoneNo = '1202555198';
      const username = 'John';

      const { id: userId, sipEndpoints } = await createAUser({
        ctx,
        name: username,
        status: DALTypes.UserStatus.AVAILABLE,
        directPhoneIdentifier: userPhoneNo,
        sipEndpoints: [{ username, isUsedInApp: true }],
      });

      const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

      const { id: teamId } = await createATeam();
      await createATeamMember({ teamId, userId });
      const { id: propertyId } = await createAProperty();
      await createATeamPropertyProgram({
        teamId,
        propertyId,
        displayPhoneNumber: teamPropertyPhoneNo,
        commDirection: DALTypes.CommunicationDirection.OUT,
      });

      const { id: partyId } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId });
      const memberPhoneNo = '12025550198';
      const contactInfo = enhance([{ type: 'phone', value: memberPhoneNo, id: newId() }]);
      const { personId } = await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

      await createATask({ name: DALTypes.TaskNames.CALL_BACK, partyId, state: DALTypes.TaskStates.Active });

      const { id: commId } = await createACommunicationEntry({
        teams: [teamId],
        parties: [partyId],
        persons: [personId],
      });

      await addCallQueueStats(ctx, {
        entryTime: new Date(),
        communicationId: commId,
        callerRequestedAction: DALTypes.CallerRequestedAction.CALL_BACK,
      });

      const { id: anotherPartyId } = await createAParty({ userId, teams: [teamId] });
      const { id: anotherCommId } = await createACommunicationEntry({
        teams: [teamId],
        parties: [anotherPartyId],
      });

      await addCallQueueStats(ctx, {
        entryTime: new Date(),
        communicationId: anotherCommId,
        callerRequestedAction: DALTypes.CallerRequestedAction.CALL_BACK,
      });

      const { id: outgoingCommId } = await createACommunicationEntry({
        teams: [teamId],
        parties: [partyId],
        persons: [personId],
      });

      const { status } = await postDirect()
        .send({ From: sipUsername })
        .send({ To: memberPhoneNo })
        .send({ CallerName: username })
        .send({ commId: outgoingCommId })
        .send({ CallUUID: newId() });

      expect(status).to.equal(200);

      const updatedStats = await getCallQueueStatsByCommId(ctx, commId);
      expect(updatedStats.callBackCommunicationId).to.equal(outgoingCommId);
      expect(updatedStats.callBackTime).to.be.ok;

      const unaffectedStats = await getCallQueueStatsByCommId(ctx, anotherCommId);
      expect(unaffectedStats.callBackCommunicationId).to.not.be.ok;
      expect(unaffectedStats.callBackTime).to.not.be.ok;
    });
  });

  describe('given a request for recording conference callback', () => {
    describe('when conference action is "record" and event is "ConferenceRecordStop"', () => {
      it('shoud save recording details', async () => {
        const { id: commId } = await createACommunicationEntry();

        const { status } = await post('conferenceCallback')
          .send({ ConferenceAction: ConferenceActions.RECORD })
          .send({ Event: ConferenceEvents.RECORD_STOP })
          .send({ RecordUrl: 'url' })
          .send({ RecordingID: 'id' })
          .send({ RecordingDuration: '5' })
          .send({ commId });

        expect(status).to.equal(200);
        const [commEntry] = await getAllComms(ctx);
        const { recordingUrl, recordingId, recordingDuration } = commEntry.message;

        expect(recordingUrl).to.equal('url');
        expect(recordingId).to.equal('id');
        expect(recordingDuration).to.equal('5');
      });
    });

    describe('when conference action is "record" and event is "ConferenceRecordStart"', () => {
      it('shoud ignore the request', async () => {
        const { id: commId } = await createACommunicationEntry();

        const { status } = await post('conferenceCallback')
          .send({ ConferenceAction: ConferenceActions.RECORD })
          .send({ Event: 'ConferenceRecordStart' })
          .send({ RecordUrl: 'url' })
          .send({ RecordingID: 'id' })
          .send({ RecordingDuration: '5' })
          .send({ commId });

        expect(status).to.equal(200);
        const [commEntry] = await getAllComms(ctx);
        const { recordingUrl, recordingId, recordingDuration } = commEntry.message;

        expect(recordingUrl).to.not.be.ok;
        expect(recordingId).to.not.be.ok;
        expect(recordingDuration).to.not.be.ok;
      });
    });

    describe('when conference action is "exit"', () => {
      it('mark as available users involved in call and save call details', async () => {
        const { id: userId } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });

        const team = await createATeam();
        await createATeamMember({ teamId: team.id, userId });

        const { id: commId, messageId: callId } = await createACommunicationEntry({
          userId,
          teams: [team.id],
        });

        setTelephonyOps({ getLiveCalls: () => [{ id: callId }] });

        const { status } = await post('conferenceCallback').send({ ConferenceAction: 'exit' }).send({ commId });

        expect(status).to.equal(200);

        const [user] = await loadUsersByIds(ctx, [userId]);
        expect(user.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);

        const callDetails = await getCallDetailsByCommId(ctx, commId);

        expect(callDetails).to.be.ok;
        expect(callDetails.details).to.be.ok;
        expect(callDetails.details.endTime).to.be.ok;
      });
    });

    describe('when a member (agent or caller) enters a conference', () => {
      describe('and no one else joins in configured time', () => {
        it('should hangup the only member', async () => {
          const { id: userId } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });

          const team = await createATeam();
          await createATeamMember({ teamId: team.id, userId });

          const { id: commId } = await createACommunicationEntry({ userId, teams: [team.id] });

          const memberId = newId();

          const getLiveConference = () => ({ conferenceMemberCount: '1', members: [{ memberId }] });
          const hangupConferenceMember = sinon.spy();
          setTelephonyOps({ getLiveConference, hangupConferenceMember });

          const { status } = await post('conferenceCallback')
            .send({ ConferenceAction: ConferenceActions.ENTER })
            .send({ Event: ConferenceEvents.ENTER })
            .send({ ConferenceMemberID: memberId })
            .send({ commId });

          expect(status).to.equal(200);

          await waitFor(2 * config.telephony.timeoutBeforeOneMemberConferenceEnds);

          const { auth } = await getTelephonyConfigs(ctx);
          expect(hangupConferenceMember).to.have.been.called.once;
          expect(hangupConferenceMember).to.have.been.calledWith(auth, { conferenceId: `room_${commId}`, memberId });
        });
      });

      describe('and someone else joins before configured time', () => {
        it('should NOT hangup the conference member', async () => {
          const { id: userId } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });

          const team = await createATeam();
          await createATeamMember({ teamId: team.id, userId });

          const { id: commId } = await createACommunicationEntry({ userId, teams: [team.id] });

          const memberId = newId();

          const getLiveConference = () => ({ conferenceMemberCount: '2', members: [{ memberId }, { memberId: newId() }] });
          const hangupConferenceMember = sinon.spy();
          setTelephonyOps({ getLiveConference, hangupConferenceMember });

          const { status } = await post('conferenceCallback')
            .send({ ConferenceAction: 'enter' })
            .send({ Event: ConferenceEvents.ENTER })
            .send({ ConferenceMemberID: memberId })
            .send({ commId });

          expect(status).to.equal(200);

          await waitFor(2 * config.telephony.timeoutBeforeOneMemberConferenceEnds);

          expect(hangupConferenceMember).to.not.have.been.called;
        });
      });
    });
  });
});
