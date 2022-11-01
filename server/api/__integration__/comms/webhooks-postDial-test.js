/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import getUUID from 'uuid/v4';
import { setNotificationFunction, resetNotificationFunction } from '../../../../common/server/notificationClient';
import { getAllComms } from '../../../dal/communicationRepo';
import {
  testCtx as ctx,
  createAParty,
  createAPartyMember,
  createAUser,
  createATeam,
  createATeamMember,
  createACommunicationEntry,
  createAProperty,
  createATeamPropertyProgram,
} from '../../../testUtils/repoHelper';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import eventTypes from '../../../../common/enums/eventTypes';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { makeUsersSipEndpointsOnline, postPostDialBasic, postDirect } from '../../../testUtils/telephonyHelper';
import { loadUsersByIds, loadUserById } from '../../../services/users';
import { updateParty, loadParty } from '../../../dal/partyRepo';
import { getCallQueueStatsByCommId, addCallQueueStats } from '../../../dal/callQueueRepo';
import { getActivityLogs, getActLogDisplayNo } from '../../../dal/activityLogRepo';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import { CommTargetType } from '../../../services/routing/targetUtils';
import { getVoiceMessage } from '../../../services/telephony/voiceMessages';
import { DialStatus, CallStatus } from '../../../services/telephony/enums';
import { setDelayFunc } from '../../../services/telephony/hangup';

chai.use(sinonChai);
const expect = chai.expect;
const testTeam = {
  name: 'team',
  module: 'leasing',
  email: 'a@a.a',
  phone: '12025550197',
};

const programPhoneIdentifier = '12025550120';

const createProgram = async teamId => {
  const { id: programPropertyId } = await createAProperty();
  return await createATeamPropertyProgram({
    teamId,
    propertyId: programPropertyId,
    directPhoneIdentifier: programPhoneIdentifier,
    commDirection: DALTypes.CommunicationDirection.IN,
  });
};

describe('given a request to postDial', () => {
  beforeEach(async () => {
    setTelephonyOps({ getLiveCalls: () => [] });
    setDelayFunc(async func => await func());
  });

  afterEach(() => resetNotificationFunction());

  describe('when call was incoming and no user answered, and status is "complete" because speak recording notice answered the call from provider\'s point of view', () => {
    it('the call must be marked as missed', async () => {
      const { id: userId } = await createAUser({ ctx });
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId });
      const { id: commId } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.IN,
        userId,
        teams: [team.id],
        message: { answered: false },
      });

      const res = await postPostDialBasic().send({ DialStatus: 'complete', commId });

      expect(res.status).to.equal(200);
      const [{ message }] = await getAllComms(ctx);
      expect(message.missedCallReason).to.equal(DALTypes.MissedCallReason.NORMAL_NO_QUEUE);
      expect(message.isMissed).to.be.true;
    });
  });

  it('should save rawMessage data', async () => {
    const { id: userId } = await createAUser({ ctx });
    const team = await createATeam(testTeam);
    await createATeamMember({ teamId: team.id, userId });

    const { messageId: CallUUID, id: commId } = await createACommunicationEntry({
      direction: DALTypes.CommunicationDirection.OUT,
      userId,
      teams: [team.id],
    });

    const res = await postPostDialBasic().send({
      From: '12025550195',
      To: '12025550196',
      DialStatus: DialStatus.NO_ANSWER,
      DialHangupCause: 'NORMAL_CLEARING',
      CallUUID,
      commId,
    });

    expect(res.status).to.equal(200);
    const [{ message }] = await getAllComms(ctx);

    expect(message).to.be.ok;
    expect(message.rawMessage).to.be.ok;

    expect(message.rawMessage).to.have.all.keys('From', 'To', 'DialStatus', 'CallUUID', 'DialHangupCause');
    expect(message.rawMessage).to.not.have.any.keys('env', 'token', 'tenant');
  });

  [DialStatus.NO_ANSWER, DialStatus.BUSY].forEach(status =>
    describe('when call was incoming and there was no answer', () => {
      it("response should contain 'Speak' message with unavailable text", async () => {
        const { id: userId } = await createAUser({ ctx });
        const team = await createATeam(testTeam);
        const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId });
        const { id: commId } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          userId,
          teams: [team.id],
        });

        const res = await postPostDialBasic().send({
          DialStatus: status,
          commId,
          commTargetType: CommTargetType.TEAM_MEMBER,
          targetContextId: teamMemberId,
        });

        expect(res.status).to.equal(200);
        expect(res.text).to.contain('Speak');
        const { message } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
        expect(res.text).to.contain(message);
      });

      it('response should contain "Record" tag and action url', async () => {
        const { id: userId } = await createAUser({ ctx });
        const team = await createATeam(testTeam);
        const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId });
        const { id: commId } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          userId,
          teams: [team.id],
        });

        const res = await postPostDialBasic().send({
          DialStatus: status,
          commId,
          commTargetType: CommTargetType.TEAM_MEMBER,
          targetContextId: teamMemberId,
        });

        expect(res.status).to.equal(200);
        expect(res.text).to.contain('Record');

        const { callRecordingUrl } = await getTelephonyConfigs(ctx);
        const url = addParamsToUrl(callRecordingUrl, { isVoiceMail: true, commId });
        expect(res.text.replace(/amp;/g, '')).to.contain(`action="${url}`);
      });

      describe('involved users are not engaged in other calls', () => {
        it('they should marked as AVAILABLE', async () => {
          const { id: userId } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });
          const { id: dialedUser } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });
          const { id: anotherDialedUser } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });

          const receiversEndpointsByUserId = { [userId]: [], [dialedUser]: [], [anotherDialedUser]: [] };

          const team = await createATeam(testTeam);
          await createATeamMember({ teamId: team.id, userId });

          const { id: commId, messageId: callId } = await createACommunicationEntry({
            direction: DALTypes.CommunicationDirection.IN,
            userId,
            teams: [team.id],
            message: { receiversEndpointsByUserId },
          });

          setTelephonyOps({ getLiveCalls: () => [{ id: callId }] });

          const { programId } = await createProgram(team.id);

          const res = await postPostDialBasic().send({
            DialStatus: status,
            commId,
            commTargetType: CommTargetType.PROGRAM,
            targetContextId: programId,
          });

          expect(res.status).to.equal(200);

          const users = await loadUsersByIds(ctx, Object.keys(receiversEndpointsByUserId));

          expect(users.every(u => u.metadata.status === DALTypes.UserStatus.AVAILABLE)).to.ok;
        });
      });

      describe('involved users are engaged in other calls', () => {
        it('they should NOT marked as AVAILABLE', async () => {
          const { id: userId } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });
          const { id: dialedUser } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });
          const { id: anotherDialedUser } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY });

          const receiversEndpointsByUserId = { [userId]: [], [dialedUser]: [], [anotherDialedUser]: [] };

          const team = await createATeam(testTeam);
          await createATeamMember({ teamId: team.id, userId });

          const { id: commId } = await createACommunicationEntry({
            direction: DALTypes.CommunicationDirection.IN,
            userId,
            teams: [team.id],
            message: { receiversEndpointsByUserId },
          });

          const { messageId: anotherCallId } = await createACommunicationEntry({
            userId: anotherDialedUser,
          });

          setTelephonyOps({ getLiveCalls: () => [{ id: anotherCallId }] });

          const { programId } = await createProgram(team.id);

          const res = await postPostDialBasic().send({
            DialStatus: status,
            commId,
            commTargetType: CommTargetType.PROGRAM,
            targetContextId: programId,
          });

          expect(res.status).to.equal(200);

          const users = await loadUsersByIds(ctx, Object.keys(receiversEndpointsByUserId));

          expect(users.find(u => u.id === userId).metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
          expect(users.find(u => u.id === dialedUser).metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
          expect(users.find(u => u.id === anotherDialedUser).metadata.status).to.equal(DALTypes.UserStatus.BUSY);
        });
      });

      it('call should be marked as "missed" and save call details', async () => {
        const user = await createAUser({ ctx });
        makeUsersSipEndpointsOnline([user]);
        const userId = user.id;

        const team = await createATeam(testTeam);
        await createATeamMember({ teamId: team.id, userId });
        const { programId } = await createProgram(team.id);

        const { id: partyId } = await createAParty({ userId, teams: [team.id], ownerTeam: team.id });
        const contactInfo = enhance([{ type: 'phone', value: '12025550196', id: getUUID() }]);
        await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

        const callId = getUUID();
        const directDialRes = await postDirect()
          .send({ To: programPhoneIdentifier })
          .send({ CallerName: 'Batman' })
          .send({ From: '12025550196' })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ CallUUID: callId });

        expect(directDialRes.status).to.equal(200);

        const [{ id: commId }] = await getAllComms(ctx);

        const postDialRes = await postPostDialBasic().send({
          userId,
          commId,
          DialStatus: status,
          commTargetType: CommTargetType.PROGRAM,
          targetContextId: programId,
        });

        expect(postDialRes.status).to.equal(200);

        const [commEntry] = await getAllComms(ctx);
        const { isMissed, dialStatus } = commEntry.message;
        expect(commEntry.message.missedCallReason).to.equal(DALTypes.MissedCallReason.NORMAL_NO_QUEUE);

        expect(commEntry.messageId).to.equal(callId);
        expect(isMissed).to.be.true;
        expect(dialStatus).to.equal(status);
      });

      it('the party owner should be updated if it is not already set', async () => {
        const { id: userId } = await createAUser({ ctx });
        const team = await createATeam(testTeam);
        await createATeamMember({ teamId: team.id, userId });
        const { id: partyId } = await createAParty({
          userId,
          teams: [team.id],
        });
        // simulate a party without owner
        const updatedParty = await updateParty(ctx, {
          id: partyId,
          userId: null,
        });
        expect(updatedParty.userId).to.be.null;

        const { id: commId } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          userId,
          parties: [updatedParty.id],
          teams: [team.id],
        });

        const { programId } = await createProgram(team.id);

        const res = await postPostDialBasic().send({
          commId,
          partyId: updatedParty.id,
          DialStatus: status,
          commTargetType: CommTargetType.PROGRAM,
          targetContextId: programId,
        });

        expect(res.status).to.equal(200);
        const party = await loadParty(ctx, updatedParty.id);
        expect(party.userId).to.not.be.null;
      });
    }),
  );

  describe('when the incoming call was answered and completed', () => {
    it('response should not contain "Speak" message', async () => {
      const { id: userId } = await createAUser({ ctx });
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId });
      const { id: commId } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.IN,
        userId,
        teams: [team.id],
      });

      const res = await postPostDialBasic().send({ commId, DialStatus: DialStatus.COMPLETED });

      expect(res.status).to.equal(200);
      expect(res.text).to.not.contain('Speak');
    });
  });

  describe('when the call was terminated', () => {
    it('should notify about termination', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const { id: userId } = await createAUser({ ctx });
      const team = await createATeam(testTeam);
      const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId });
      const { id: commId } = await createACommunicationEntry({
        teams: [team.id],
        userId,
      });

      const res = await postPostDialBasic().send({
        DialStatus: DialStatus.CANCEL,
        commId,
        commTargetType: CommTargetType.TEAM_MEMBER,
        targetContextId: teamMemberId,
      });

      expect(res.status).to.equal(200);
      expect(notify).to.have.been.calledWith(
        sinon.match({
          event: eventTypes.CALL_TERMINATED,
          data: { commId },
          routing: { users: [userId] },
        }),
      );
    });

    it('should set the status back to NOT_AVAILABLE if the agent marked himself as not available before initiating the outgoing call', async () => {
      const { id: userId } = await createAUser({ ctx, status: DALTypes.UserStatus.BUSY, notAvailableSetAt: '2021-05-06T19:39:19.788Z' });
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId });
      const { id: commId } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.IN,
        userId,
        teams: [team.id],
      });

      const res = await postPostDialBasic().send({ commId, DialStatus: DialStatus.COMPLETED });
      expect(res.status).to.equal(200);

      const user = await loadUserById(ctx, userId);
      expect(user.metadata.status).to.deep.equal(DALTypes.UserStatus.NOT_AVAILABLE);
    });
  });

  describe('when the incoming call was canceled by originator before answering', () => {
    it('call should be marked as "missed" and call details saved', async () => {
      const user = await createAUser({ ctx });
      makeUsersSipEndpointsOnline([user]);
      const userId = user.id;

      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId });
      const { programId, propertyId } = await createProgram(team.id);

      const { id: partyId } = await createAParty({ userId, teams: [team.id], ownerTeam: team.id, assignedPropertyId: propertyId });
      const contactInfo = enhance([{ type: 'phone', value: '12025550196', id: getUUID() }]);
      await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

      const callId = getUUID();
      const directDialRes = await postDirect()
        .send({ To: programPhoneIdentifier })
        .send({ CallerName: 'Batman' })
        .send({ From: '12025550196' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ CallUUID: callId });

      expect(directDialRes.status).to.equal(200);
      const directDialLogSeqDisplayNo = await getActLogDisplayNo(ctx);

      const [{ id: commId }] = await getAllComms(ctx);

      const postDialRes = await postPostDialBasic().send({
        commId,
        DialHangupCause: 'ORIGINATOR_CANCEL',
        DialStatus: DialStatus.CANCEL,
        commTargetType: CommTargetType.PROGRAM,
        targetContextId: programId,
      });

      expect(postDialRes.status).to.equal(200);
      const postDialLogSeqDisplayNo = await getActLogDisplayNo(ctx);

      await postDirect().send({ CallUUID: callId }).send({ HangupCause: 'ORIGINATOR_CANCEL' });

      const [commEntry] = await getAllComms(ctx);
      const { isMissed, dialStatus } = commEntry.message;
      expect(commEntry.message.missedCallReason).to.equal(DALTypes.MissedCallReason.NORMAL_NO_QUEUE);

      const logs = await getActivityLogs({ tenantId: tenant.id });

      expect(logs.length).to.equal(2);
      expect(logs[0].component).to.equal(COMPONENT_TYPES.CALL);
      expect(logs[0].type).to.equal(ACTIVITY_TYPES.TERMINATED);
      expect(logs[1].component).to.equal(COMPONENT_TYPES.CALL);
      expect(logs[1].type).to.equal(ACTIVITY_TYPES.NEW);

      const { details } = logs[0];
      expect(details).to.deep.equal({
        id: commEntry.id,
        seqDisplayNo: directDialLogSeqDisplayNo,
        createdByType: DALTypes.CreatedByType.USER,
        partyId: commEntry.parties[0],
        status: DALTypes.CallTerminationStatus.MISSED,
      });

      const { details: details2 } = logs[1];

      expect(details2).to.deep.equal({
        id: commEntry.id,
        from: ['Batman'],
        fromNumber: '12025550196',
        seqDisplayNo: postDialLogSeqDisplayNo,
        createdByType: DALTypes.CreatedByType.USER,
        partyId: commEntry.parties[0],
        to: programPhoneIdentifier,
        commDirection: 'in',
      });
      expect(commEntry.messageId).to.equal(callId);
      expect(isMissed).to.be.true;
      expect(dialStatus).to.equal(DialStatus.CANCEL);
    });

    it('response should not contain "Speak" message', async () => {
      const { id: userId } = await createAUser({ ctx });
      const team = await createATeam(testTeam);
      const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId });
      const { id: commId } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.IN,
        userId,
        teams: [team.id],
      });

      const res = await postPostDialBasic().send({
        commId,
        DialHangupCause: 'ORIGINATOR_CANCEL',
        DialStatus: DialStatus.CANCEL,
        commTargetType: CommTargetType.TEAM_MEMBER,
        targetContextId: teamMemberId,
      });

      expect(res.status).to.equal(200);
      expect(res.text).to.not.contain('Speak');
    });
  });

  describe('concerning call queue statistics', () => {
    describe('when the call is not involved in call queuing', () => {
      it('should not save any info to call queue statistics', async () => {
        const { id: userId } = await createAUser({ ctx });
        const team = await createATeam(testTeam);
        await createATeamMember({ teamId: team.id, userId });
        const { id: commId } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          userId,
          teams: [team.id],
        });

        const res = await postPostDialBasic().send({ commId, DialStatus: DialStatus.COMPLETED });

        expect(res.status).to.equal(200);

        const stats = await getCallQueueStatsByCommId(ctx, commId);
        expect(stats).to.not.be.ok;
      });
    });

    describe('when the call is involved in call queuing', () => {
      describe('when the userId is already saved in queuing statistics', () => {
        it('should not overwrite it', async () => {
          const { id: userId } = await createAUser({ ctx });
          const team = await createATeam(testTeam);
          await createATeamMember({ teamId: team.id, userId });
          const { id: commId } = await createACommunicationEntry({
            direction: DALTypes.CommunicationDirection.IN,
            userId,
            teams: [team.id],
          });

          const { id: connectedAgentId } = await createAUser({ ctx });
          await addCallQueueStats(ctx, {
            communicationId: commId,
            entryTime: new Date(),
            userId: connectedAgentId,
          });

          const res = await postPostDialBasic().send({ commId, DialStatus: DialStatus.COMPLETED });

          expect(res.status).to.equal(200);

          const stats = await getCallQueueStatsByCommId(ctx, commId);
          expect(stats).to.be.ok;
          expect(stats.userId).to.equal(connectedAgentId);
        });
      });

      describe('when the userId is not already saved in queuing statistics', () => {
        describe('when the call was answered by a user', () => {
          it('should update the userId in the statistics with the userId of the comm', async () => {
            const { id: userId } = await createAUser({ ctx });
            const team = await createATeam(testTeam);
            await createATeamMember({ teamId: team.id, userId });
            const { id: commId } = await createACommunicationEntry({
              direction: DALTypes.CommunicationDirection.IN,
              userId,
              teams: [team.id],
            });

            await addCallQueueStats(ctx, {
              communicationId: commId,
              entryTime: new Date(),
            });

            const res = await postPostDialBasic().send({ commId, DialStatus: DialStatus.COMPLETED });

            expect(res.status).to.equal(200);

            const stats = await getCallQueueStatsByCommId(ctx, commId);
            expect(stats).to.be.ok;
            expect(stats.userId).to.equal(userId);
          });
        });

        describe('when the call was not answered', () => {
          describe('when there was a single receiver for the call', () => {
            it('should update the userId in the statistics for the call with the receiver id', async () => {
              const { id: receiverId } = await createAUser({ ctx });
              const team = await createATeam(testTeam);
              const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId: receiverId });
              const { id: commId } = await createACommunicationEntry({
                direction: DALTypes.CommunicationDirection.IN,
                teams: [team.id],
                message: { receiversEndpointsByUserId: { [receiverId]: [] } },
              });

              await addCallQueueStats(ctx, {
                communicationId: commId,
                entryTime: new Date(),
              });

              const res = await postPostDialBasic().send({
                commId,
                DialStatus: DialStatus.NO_ANSWER,
                commTargetType: CommTargetType.TEAM_MEMBER,
                targetContextId: teamMemberId,
              });

              expect(res.status).to.equal(200);

              const stats = await getCallQueueStatsByCommId(ctx, commId);
              expect(stats).to.be.ok;
              expect(stats.userId).to.equal(receiverId);
            });
          });

          describe('when the receivers of the call were many', () => {
            it('should not update the userId in the statistics for the call', async () => {
              const { id: receiver1Id } = await createAUser({ ctx });
              const { id: receiver2Id } = await createAUser({ ctx });
              const team = await createATeam(testTeam);
              const { id: commId } = await createACommunicationEntry({
                direction: DALTypes.CommunicationDirection.IN,
                teams: [team.id],
                message: { receiversEndpointsByUserId: { [receiver1Id]: [], [receiver2Id]: [] } },
              });

              const { programId } = await createProgram(team.id);
              await addCallQueueStats(ctx, {
                communicationId: commId,
                entryTime: new Date(),
              });

              const res = await postPostDialBasic().send({
                commId,
                DialStatus: DialStatus.NO_ANSWER,
                commTargetType: CommTargetType.PROGRAM,
                targetContextId: programId,
              });

              expect(res.status).to.equal(200);

              const stats = await getCallQueueStatsByCommId(ctx, commId);
              expect(stats).to.be.ok;
              expect(stats.userId).to.not.be.ok;
            });
          });
        });
      });
    });
  });
});
