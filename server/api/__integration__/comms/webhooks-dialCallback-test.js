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
import { setNotificationFunction, resetNotificationFunction } from '../../../../common/server/notificationClient';
import {
  testCtx as ctx,
  createAUser,
  createACommunicationEntry,
  createATeam,
  createATeamMember,
  createAParty,
  createAProperty,
  createATeamPropertyProgram,
} from '../../../testUtils/repoHelper';
import eventTypes from '../../../../common/enums/eventTypes';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { postCallbackBasic, postDirect } from '../../../testUtils/telephonyHelper';
import { loadUsersByIds, loadUserById } from '../../../services/users';
import { getAllComms, loadMessageById } from '../../../dal/communicationRepo';
import { getActivityLogs } from '../../../dal/activityLogRepo';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { loadParty } from '../../../dal/partyRepo';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { setDelayFunc } from '../../../services/telephony/hangup';
import { CallStatus, DialActions } from '../../../services/telephony/enums';

chai.use(sinonChai);
const expect = chai.expect;

describe('given a request to dial callback', () => {
  beforeEach(async () => {
    setDelayFunc(async func => await func());
  });

  afterEach(() => resetNotificationFunction());

  it('should save rawMessage data', async () => {
    const { id: userId } = await createAUser({ ctx });
    const { messageId: CallUUID, id: commId } = await createACommunicationEntry({
      direction: DALTypes.CommunicationDirection.OUT,
      userId,
    });

    const res = await postCallbackBasic()
      .send({ From: '12025550195' })
      .send({ To: '12025550196' })
      .send({ DialAction: DialActions.ANSWER })
      .send({ AnswerTime: '18:00' })
      .send({ CallUUID })
      .send({ env: 'test' })
      .send({ token: 'test' })
      .send({ tenant: 'integration_test_tenant' })
      .send({ commId });

    expect(res.status).to.equal(200);
    const [{ message }] = await getAllComms(ctx);

    expect(message).to.be.ok;
    expect(message.rawMessage).to.be.ok;

    expect(message.rawMessage).to.have.all.keys('From', 'To', 'DialAction', 'CallUUID', 'AnswerTime');
    expect(message.rawMessage).to.not.have.any.keys('env', 'token', 'tenant');
  });

  describe('when event is a "answer" and call is a transfer to an external number', () => {
    it('should mark call as answered and client should be notified', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const { id: userId } = await createAUser();
      const { id: teamId } = await createATeam();
      await createATeamMember({ teamId, userId });

      const { id: partyId } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId });
      const { id: commId } = await createACommunicationEntry({
        parties: [partyId],
        direction: DALTypes.CommunicationDirection.OUT,
        message: { transferredToNumber: '12025550195' },
      });

      const res = await postCallbackBasic().send({ DialAction: DialActions.ANSWER, commId });

      expect(res.status).to.equal(200);
      const [{ message }] = await getAllComms(ctx);

      expect(message).to.be.ok;
      expect(message.answered).to.be.ok;

      expect(notify).to.have.been.calledWith(
        sinon.match({
          event: eventTypes.COMMUNICATION_UPDATE,
          data: { partyIds: [partyId], ids: [commId] },
          routing: { teams: [teamId] },
        }),
      );
    });
  });

  describe('when event is a hangup and call is a transfer to an external number', () => {
    it('should save call duration and the client should be notified', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const { id: userId } = await createAUser();
      const { id: teamId } = await createATeam();
      await createATeamMember({ teamId, userId });

      const { id: partyId } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId });
      const { id: commId } = await createACommunicationEntry({
        parties: [partyId],
        direction: DALTypes.CommunicationDirection.OUT,
        message: { transferredToNumber: '12025550195' },
      });

      const res = await postCallbackBasic().send({ DialAction: 'hangup' }).send({ DialBLegDuration: 42 }).send({ commId });

      expect(res.status).to.equal(200);
      const [{ message }] = await getAllComms(ctx);

      expect(message).to.be.ok;
      expect(message.duration).to.equal('00:42');

      expect(notify).to.have.been.calledWith(
        sinon.match({
          event: eventTypes.COMMUNICATION_UPDATE,
          data: { partyIds: [partyId], ids: [commId] },
          routing: { teams: [teamId] },
        }),
      );
    });
  });

  describe('when event is a hangup and call is a transfer to a user', () => {
    it('and the user does not answer, the user will be set as AVAILABLE after the call', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const {
        id: hangupUser,
        sipEndpoints: [hangupEndpoint],
      } = await createAUser({
        ctx,
        name: 'Agnetha',
        status: DALTypes.UserStatus.BUSY,
      });
      const { id: dialedUser } = await createAUser({
        ctx,
        name: 'Bjorn',
        status: DALTypes.UserStatus.BUSY,
      });
      const { id: anotherDialedUser } = await createAUser({
        ctx,
        name: 'Benny',
        status: DALTypes.UserStatus.BUSY,
      });

      const { id: userId } = await createAUser();
      const { id: teamId } = await createATeam();
      await createATeamMember({ teamId, userId });

      const receiversEndpointsByUserId = { [hangupUser]: [hangupEndpoint], [dialedUser]: [], [anotherDialedUser]: [] };

      const CallUUID = newId();
      const { id: commId } = await createACommunicationEntry({
        messageId: CallUUID,
        userId: hangupUser,
        message: {
          receiversEndpointsByUserId,
        },
      });

      setTelephonyOps({ getLiveCalls: () => [{ id: CallUUID }] });
      const res = await postCallbackBasic()
        .send({ DialAction: 'hangup' })
        .send({ AnswerTime: '' })
        .send({
          DialBLegTo: `sip:${hangupEndpoint.username}@phone.plivo.com`,
        })
        .send({ CallUUID })
        .send({ commId });

      expect(res.status).to.equal(200);

      const { message } = await loadMessageById(ctx, commId);

      const users = await loadUsersByIds(ctx, Object.keys(receiversEndpointsByUserId));
      const getUserStatusById = id => users.find(u => u.id === id).metadata.status;

      expect(getUserStatusById(hangupUser)).to.equal(DALTypes.UserStatus.AVAILABLE);
      expect(getUserStatusById(dialedUser)).to.equal(DALTypes.UserStatus.BUSY);
      expect(getUserStatusById(anotherDialedUser)).to.equal(DALTypes.UserStatus.BUSY);

      const hangupMarkedEndpoint = message.receiversEndpointsByUserId[hangupUser][0];
      expect(hangupMarkedEndpoint.hasHangup).to.be.true;
    });
  });

  describe('when the call is phone-to-phone', () => {
    it('should notify about answering', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const { id: userId } = await createAUser({ ctx });
      const { id: commId } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.OUT,
        userId,
      });

      const res = await postCallbackBasic().send({ DialAction: DialActions.ANSWER }).send({ commId }).send({ isPhoneToPhone: true });

      expect(res.status).to.equal(200);
      expect(notify).to.have.been.calledWith(
        sinon.match({
          event: eventTypes.CALL_ANSWERED,
          data: { commId, isPhoneToPhone: true },
          routing: { users: [userId] },
        }),
      );
    });
  });

  describe('when the incoming call is answered from phone', () => {
    it('should notify about answering', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const userRingPhone = '12025550198';
      const { id: userId } = await createAUser({
        ctx,
        ringPhones: [`+${userRingPhone}`],
      });
      const { id: commId } = await createACommunicationEntry({
        message: { receiversEndpointsByUserId: { [userId]: [] } },
      });

      const res = await postCallbackBasic().send({ DialAction: DialActions.ANSWER }).send({ commId }).send({ DialBLegTo: userRingPhone });

      expect(res.status).to.equal(200);
      expect(notify).to.have.been.calledWith(
        sinon.match({
          event: eventTypes.CALL_ANSWERED,
          data: { commId, isPhoneToPhone: true },
          routing: { users: [userId] },
        }),
      );
    });
  });

  describe('when the incoming call is answered by a user', () => {
    it('should add an activity log entry and add the user as party collaborator', async () => {
      const user = await createAUser();
      const { id: teamId } = await createATeam();
      await createATeamMember({ teamId, userId: user.id });

      const programPhoneIdentifier = '12025550120';

      const { id: programPropertyId } = await createAProperty();
      await createATeamPropertyProgram({
        teamId,
        propertyId: programPropertyId,
        directPhoneIdentifier: programPhoneIdentifier,
        commDirection: DALTypes.CommunicationDirection.IN,
      });

      const party = await createAParty({ assignedPropertyId: programPropertyId }, ctx, { createAssignedProperty: false });

      const callId = newId();
      const directDialRes = await postDirect()
        .send({ To: programPhoneIdentifier })
        .send({ CallerName: 'Batman' })
        .send({ From: '12025550196' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ CallUUID: callId });

      expect(directDialRes.status).to.equal(200);

      const { id: commId } = await createACommunicationEntry({
        parties: [party.id],
        message: { receiversEndpointsByUserId: { [user.id]: [user.sipEndpoints[0].username] } },
        type: DALTypes.CommunicationMessageType.CALL,
      });

      const res = await postCallbackBasic()
        .send({ DialAction: DialActions.ANSWER })
        .send({ commId })
        .send({ DialBLegTo: `sip:${user.sipEndpoints[0].username}@phone.plivo.com` });

      expect(res.status).to.equal(200);

      const comm = await loadMessageById(ctx, commId);

      await postDirect().send({ CallUUID: comm.messageId }).send({ HangupCause: 'NORMAL_CLEARING' });

      const logs = await getActivityLogs(ctx);
      const callLogs = logs.filter(l => l.component === COMPONENT_TYPES.CALL);

      expect(callLogs.length).to.equal(2);
      expect(callLogs[0].component).to.equal(COMPONENT_TYPES.CALL);
      expect(callLogs[0].type).to.equal(ACTIVITY_TYPES.TERMINATED);
      expect(callLogs[1].component).to.equal(COMPONENT_TYPES.CALL);
      expect(callLogs[1].type).to.equal(ACTIVITY_TYPES.NEW);
      expect(callLogs[0].details.status).to.equal('normal cleared');
      expect(callLogs[0].context.users).to.deep.equal([user.id]);

      const { collaborators } = await loadParty(ctx, party.id);
      expect(collaborators).to.deep.include(user.id);
    });
  });

  describe('when an incoming call to many users is declined by one user', () => {
    it('the user is marked as AVAILABLE', async () => {
      const {
        id: hangupUser,
        sipEndpoints: [hangupEndpoint],
      } = await createAUser({
        ctx,
        name: 'Agnetha',
        status: DALTypes.UserStatus.BUSY,
      });
      const { id: dialedUser } = await createAUser({
        ctx,
        name: 'Bjorn',
        status: DALTypes.UserStatus.BUSY,
      });
      const { id: anotherDialedUser } = await createAUser({
        ctx,
        name: 'Benny',
        status: DALTypes.UserStatus.BUSY,
      });

      const receiversEndpointsByUserId = { [hangupUser]: [hangupEndpoint], [dialedUser]: [], [anotherDialedUser]: [] };

      const { id: commId } = await createACommunicationEntry({
        message: {
          receiversEndpointsByUserId,
        },
      });

      const res = await postCallbackBasic()
        .send({ DialAction: 'hangup' })
        .send({ AnswerTime: '' })
        .send({
          DialBLegTo: `sip:${hangupEndpoint.username}@phone.plivo.com`,
        })
        .send({ commId });

      expect(res.status).to.equal(200);

      const users = await loadUsersByIds(ctx, Object.keys(receiversEndpointsByUserId));
      const getUserStatusById = userId => users.find(u => u.id === userId).metadata.status;

      expect(getUserStatusById(hangupUser)).to.equal(DALTypes.UserStatus.AVAILABLE);
      expect(getUserStatusById(dialedUser)).to.equal(DALTypes.UserStatus.BUSY);
      expect(getUserStatusById(anotherDialedUser)).to.equal(DALTypes.UserStatus.BUSY);

      const { message } = await loadMessageById(ctx, commId);
      const hangupMarkedEndpoint = message.receiversEndpointsByUserId[hangupUser][0];
      expect(hangupMarkedEndpoint.hasHangup).to.be.true;
    });
  });

  describe('when an incoming call is received and the agent marks himself as not available before declining the call', () => {
    it("should keep the user's status as NOT_AVAILABLE", async () => {
      const {
        id: userId,
        sipEndpoints: [userEndpoint],
      } = await createAUser({
        ctx,
        name: 'Agnetha',
        status: DALTypes.UserStatus.NOT_AVAILABLE,
        notAvailableSetAt: '2021-05-06T19:39:19.788Z',
      });

      const receiversEndpointsByUserId = { [userId]: [userEndpoint] };

      const { id: commId } = await createACommunicationEntry({
        message: {
          receiversEndpointsByUserId,
        },
      });

      const res = await postCallbackBasic()
        .send({ DialAction: 'hangup' })
        .send({ AnswerTime: '' })
        .send({
          DialBLegTo: `sip:${userEndpoint.username}@phone.plivo.com`,
        })
        .send({ commId });
      expect(res.status).to.equal(200);

      const user = await loadUserById(ctx, userId);
      expect(user.metadata.status).to.equal(DALTypes.UserStatus.NOT_AVAILABLE);
    });
  });

  describe('when an incoming call to many users is answered by one user', () => {
    it('answering user is assigned to the comm and the rest of them are marked as AVAILABLE, and the call marked as answered', async () => {
      const {
        id: answeringUser,
        sipEndpoints: [answeringEndpoint],
      } = await createAUser({
        ctx,
        name: 'Agnetha',
        status: DALTypes.UserStatus.BUSY,
      });

      const { id: dialedUser } = await createAUser({
        ctx,
        name: 'Bjorn',
        status: DALTypes.UserStatus.BUSY,
      });
      const { id: anotherDialedUser } = await createAUser({
        ctx,
        name: 'Benny',
        status: DALTypes.UserStatus.BUSY,
      });

      const receiversEndpointsByUserId = { [answeringUser]: [], [dialedUser]: [], [anotherDialedUser]: [] };

      const { id: commId } = await createACommunicationEntry({
        message: {
          receiversEndpointsByUserId,
        },
      });

      const res = await postCallbackBasic()
        .send({ DialAction: DialActions.ANSWER })
        .send({ DialBLegTo: `sip:${answeringEndpoint.username}@phone.plivo.com` })
        .send({ commId });

      expect(res.status).to.equal(200);

      const users = await loadUsersByIds(ctx, Object.keys(receiversEndpointsByUserId));

      expect(users.find(u => u.id === answeringUser).metadata.status).to.equal(DALTypes.UserStatus.BUSY);
      expect(users.find(u => u.id === dialedUser).metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);
      expect(users.find(u => u.id === anotherDialedUser).metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);

      const [comm] = await getAllComms(ctx, { id: commId });
      expect(comm.userId).to.equal(answeringUser);
      expect(comm.message.answered).to.be.true;
    });
  });
});
