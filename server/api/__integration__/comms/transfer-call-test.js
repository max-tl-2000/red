/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import request from 'supertest';
import newId from 'uuid/v4';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { TransferTargetType, CallStatus, DialStatus } from '../../../services/telephony/enums';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import {
  createAUser,
  createATeam,
  createATeamMember,
  createAParty,
  createAPartyMember,
  createACommunicationEntry,
  createAProperty,
  createATeamPropertyProgram,
} from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { loadUserById } from '../../../services/users';
import { loadPartyById, loadParties } from '../../../dal/partyRepo';
import { getCallDetailsByCommId } from '../../../dal/callDetailsRepo';
import { getAllComms } from '../../../dal/communicationRepo';
import { postDirect, makeUsersSipEndpointsOnline } from '../../../testUtils/telephonyHelper';
import { waitFor } from '../../../common/utils';
import config from '../../../config';

const { telephony } = config;

chai.use(sinonChai);
const expect = chai.expect;

describe('API/communications/phone/:commId/transfer', () => {
  let ctx;
  let auth;
  let answerUrl;
  let ops;

  beforeEach(async () => {
    ctx = { tenantId: tenant.id };
    const conf = await getTelephonyConfigs(ctx);
    auth = conf.auth;
    answerUrl = conf.answerUrl;
    ops = { transferCall: sinon.spy() };
    setTelephonyOps(ops);
  });

  const createTestEntities = async (commDirection = DALTypes.CommunicationDirection.IN, initiatorStatus = DALTypes.UserStatus.AVAILABLE) => {
    const initiatorUser = await createAUser({
      ctx,
      name: 'Jamie',
      email: 'jamie@a.bc',
      status: initiatorStatus,
    });
    const authHeader = getAuthHeader(ctx.tenantId, initiatorUser.id);
    const user = await createAUser({
      ctx,
      name: 'Danny',
      email: 'd@n.ny',
      status: DALTypes.UserStatus.AVAILABLE,
    });

    const team = await createATeam({
      name: 'team1',
      module: 'leasing',
    });

    const party = await createAParty({ userId: initiatorUser.id, teams: [team.id], ownerTeam: team.id });
    const partyMember = await createAPartyMember(party.id);
    const comm = await createACommunicationEntry({
      parties: [party.id],
      persons: [partyMember.personId],
      direction: commDirection,
      type: DALTypes.CommunicationMessageType.CALL,
      teams: [team.id],
      userId: initiatorUser.id,
    });

    return {
      commId: comm.id,
      teamId: team.id,
      userId: user.id,
      callId: comm.messageId,
      initiatorId: initiatorUser.id,
      authHeader,
      partyId: party.id,
    };
  };

  describe('given a request to transfer a call', () => {
    describe('when the call id is not a uuid', () => {
      it('responds with status code 400 and INVALID_CALL_ID token', async () => {
        const res = await request(app).post('/communications/phone/123/transfer').send({}).set(getAuthHeader());

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INCORRECT_CALL_ID');
      });
    });

    describe("when the call doesn't exist", () => {
      it('responds with status code 404 and CALL_NOT_FOUND token', async () => {
        const res = await request(app).post(`/communications/phone/${newId()}/transfer`).send({}).set(getAuthHeader());

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('CALL_NOT_FOUND');
      });
    });

    describe('when the target id is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_TARGET_ID token', async () => {
        const { commId } = await createTestEntities();
        const res = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: '123' }).set(getAuthHeader());

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INCORRECT_TARGET_ID');
      });
    });

    describe("when the target user doesn't exist", () => {
      it('responds with status code 404 and USER_NOT_FOUND token', async () => {
        const { commId } = await createTestEntities();
        const res = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: newId() }).set(getAuthHeader());

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('USER_NOT_FOUND');
      });
    });

    describe("when the target team doesn't exist", () => {
      it('responds with status code 404 and TEAM_NOT_FOUND token', async () => {
        const { commId } = await createTestEntities();
        const res = await request(app).post(`/communications/phone/${commId}/transfer`).send({ isTeam: true, id: newId() }).set(getAuthHeader());

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('TEAM_NOT_FOUND');
      });
    });

    describe('when the call is incoming and the target is a user', () => {
      it('should call the transferCall provider function', async () => {
        const { commId, userId, callId, initiatorId, authHeader } = await createTestEntities();

        const { status } = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: userId }).set(authHeader);

        expect(status).to.equal(200);

        const transferParams = {
          transferTargetType: TransferTargetType.USER,
          transferTarget: userId,
          transferredCallDirection: DALTypes.CommunicationDirection.IN,
          transferredFrom: initiatorId,
          transferredFromCommId: commId,
        };

        const alegUrl = addParamsToUrl(answerUrl, transferParams);

        expect(ops.transferCall).to.have.been.calledOnce;
        expect(ops.transferCall).to.have.been.calledWith(auth, { callId, legs: 'aleg', alegUrl });
      });

      it('should mark the initiator as available, add the target user as party collaborator, and save call details', async () => {
        const { commId, userId, initiatorId, partyId, authHeader } = await createTestEntities(DALTypes.CommunicationDirection.IN, DALTypes.UserStatus.BUSY);

        const { status } = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: userId }).set(authHeader);

        expect(status).to.equal(200);
        const initiator = await loadUserById(ctx, initiatorId);
        expect(initiator.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);

        const party = await loadPartyById(ctx, partyId);
        expect(party.collaborators).to.include(userId);

        const callDetails = await getCallDetailsByCommId(ctx, commId);

        expect(callDetails).to.be.ok;
        expect(callDetails.details).to.be.ok;
        expect(callDetails.details.endTime).to.be.ok;
      });

      it('should not overwrite call end time at final hangup', async () => {
        const { commId, callId, userId, authHeader } = await createTestEntities(DALTypes.CommunicationDirection.IN, DALTypes.UserStatus.BUSY);

        const { status } = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: userId }).set(authHeader);

        expect(status).to.equal(200);

        const callDetailsSavedAtTransfer = await getCallDetailsByCommId(ctx, commId);
        expect(callDetailsSavedAtTransfer.details.endTime).to.be.ok;

        const details = { callUuid: callId, endTime: '2015-07-26 15:45:14+05:30' };
        setTelephonyOps({ getCallDetails: () => details });

        const res = await postDirect().send({ DialStatus: DialStatus.COMPLETED }).send({ CallUUID: callId }).send({ HangupCause: 'NORMAL_CLEARING' });

        expect(res.status).to.equal(200);
        await waitFor(2 * telephony.timeoutBeforeHandlingAfterCallOperations);

        const callDetailsAfterHangup = await getCallDetailsByCommId(ctx, commId);
        expect(callDetailsAfterHangup.details).to.be.ok;

        expect(callDetailsAfterHangup.details).to.not.equal({ endTime: details.endTime });
      });
    });

    describe('when the call is incoming and the target is a team', () => {
      it('should call the transferCall provider function', async () => {
        const { commId, teamId, callId, authHeader, initiatorId } = await createTestEntities();

        const { status } = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: teamId, isTeam: true }).set(authHeader);

        expect(status).to.equal(200);

        const transferParams = {
          transferTargetType: TransferTargetType.TEAM,
          transferTarget: teamId,
          transferredCallDirection: DALTypes.CommunicationDirection.IN,
          transferredFrom: initiatorId,
          transferredFromCommId: commId,
        };

        const alegUrl = addParamsToUrl(answerUrl, transferParams);

        expect(ops.transferCall).to.have.been.calledOnce;
        expect(ops.transferCall).to.have.been.calledWith(auth, { callId, legs: 'aleg', alegUrl });
      });
    });

    describe('when the call is outgoing and the target is a user', () => {
      it('should call the transferCall provider function', async () => {
        const { commId, userId, callId, initiatorId, authHeader } = await createTestEntities(DALTypes.CommunicationDirection.OUT);

        const { status } = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: userId }).set(authHeader);

        expect(status).to.equal(200);

        expect(ops.transferCall).to.have.been.calledOnce;

        const transferParams = {
          transferTargetType: TransferTargetType.USER,
          transferTarget: userId,
          transferredCallDirection: DALTypes.CommunicationDirection.OUT,
          transferredFrom: initiatorId,
          transferredFromCommId: commId,
        };
        const blegUrl = addParamsToUrl(answerUrl, transferParams);

        expect(ops.transferCall).to.have.been.calledWith(auth, { callId, legs: 'bleg', blegUrl });
      });
    });

    describe('when the call is outgoing and the target is a team', () => {
      it('should call the transferCall provider function', async () => {
        const { commId, teamId, callId, initiatorId, authHeader } = await createTestEntities(DALTypes.CommunicationDirection.OUT);

        const { status } = await request(app).post(`/communications/phone/${commId}/transfer`).send({ id: teamId, isTeam: true }).set(authHeader);

        expect(status).to.equal(200);

        expect(ops.transferCall).to.have.been.calledOnce;

        const transferParams = {
          transferTargetType: TransferTargetType.TEAM,
          transferTarget: teamId,
          transferredCallDirection: DALTypes.CommunicationDirection.OUT,
          transferredFrom: initiatorId,
          transferredFromCommId: commId,
        };
        const blegUrl = addParamsToUrl(answerUrl, transferParams);

        expect(ops.transferCall).to.have.been.calledWith(auth, { callId, legs: 'bleg', blegUrl });
      });
    });

    describe('when the call the target is an external phone', () => {
      it('should call the transferCall provider function', async () => {
        const { commId, callId, initiatorId, authHeader } = await createTestEntities(DALTypes.CommunicationDirection.IN);

        const number = '12025550999';

        const { status } = await request(app)
          .post(`/communications/phone/${commId}/transfer`)
          .send({ id: newId(), isExternalPhone: true, number })
          .set(authHeader);

        expect(status).to.equal(200);

        expect(ops.transferCall).to.have.been.calledOnce;

        const transferParams = {
          transferTargetType: TransferTargetType.EXTERNAL_PHONE,
          transferTarget: number,
          transferredCallDirection: DALTypes.CommunicationDirection.IN,
          transferredFrom: initiatorId,
          transferredFromCommId: commId,
        };
        const alegUrl = addParamsToUrl(answerUrl, transferParams);

        expect(ops.transferCall).to.have.been.calledWith(auth, { callId, legs: 'aleg', alegUrl });
      });

      it('should create a communication entry for the transferred leg of the call', async () => {
        const { commId, authHeader } = await createTestEntities(DALTypes.CommunicationDirection.IN);

        const number = '12025550999';
        const fullName = 'Resident Services';

        const { status } = await request(app)
          .post(`/communications/phone/${commId}/transfer`)
          .send({ id: newId(), isExternalPhone: true, number, fullName })
          .set(authHeader);

        expect(status).to.equal(200);

        const comm = (await getAllComms(ctx)).find(c => c.message.transferredToNumber);
        expect(comm).to.be.ok;

        const { wasTransferred, transferredToNumber, transferredToDisplayName } = comm.message;
        expect({ wasTransferred, transferredToNumber, transferredToDisplayName }).to.deep.equal({
          wasTransferred: true,
          transferredToNumber: number,
          transferredToDisplayName: fullName,
        });

        expect(comm.transferredFromCommId).to.equal(commId);
      });
    });

    describe('when the call is made from a RESTRICTED number', () => {
      it('should create a new communication for the same person, party and teamPropertyProgramId', async () => {
        const programPhoneNo = '12025550150';
        const fromNumber = 'Restricted';
        const callId = newId();

        const makeAnonymousRequest = async toPhoneNo =>
          await postDirect()
            .send({ To: toPhoneNo })
            .send({ CallerName: 'Anonymous' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: fromNumber })
            .send({ CallUUID: callId });

        const createProgram = async (teamId, directPhoneIdentifier, propertyId) => {
          const programPropertyId = propertyId || (await createAProperty()).id;
          return await createATeamPropertyProgram({
            teamId,
            propertyId: programPropertyId,
            directPhoneIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
          });
        };

        const team = await createATeam({ name: 'team', module: 'leasing' });
        const teamPropertyProgram = await createProgram(team.id, programPhoneNo);

        const firstUser = await createAUser({
          ctx,
          name: 'user1',
          email: 'user1@domain.com',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: team.id, userId: firstUser.id });
        makeUsersSipEndpointsOnline([firstUser]);

        await makeAnonymousRequest(programPhoneNo);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        const commsBeforeTransfer = await getAllComms(ctx);
        expect(commsBeforeTransfer.length).to.equal(1);
        const firstComm = commsBeforeTransfer[0];
        expect(firstComm.teamPropertyProgramId).to.equal(teamPropertyProgram.id);

        const secondUser = await createAUser({
          ctx,
          name: 'user2',
          email: 'user2@domain.com',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: team.id, userId: secondUser.id });
        makeUsersSipEndpointsOnline([secondUser]);

        const { status } = await postDirect()
          .send({ transferTarget: secondUser.id })
          .send({ transferTargetType: TransferTargetType.USER })
          .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
          .send({ From: fromNumber })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ transferredFromCommId: firstComm.id })
          .send({ CallUUID: callId });

        expect(status).to.equal(200);

        const partiesAfterTransfer = await loadParties(ctx);
        expect(partiesAfterTransfer.length).to.equal(1);
        const commsAfterTransfer = await getAllComms(ctx);
        expect(commsAfterTransfer.length).to.equal(2);

        const secondComm = commsAfterTransfer.find(item => item.id !== firstComm.id);
        expect(firstComm.persons).to.deep.equal(secondComm.persons);
        expect(firstComm.parties).to.deep.equal(secondComm.parties);
        expect(secondComm.teamPropertyProgramId).to.equal(teamPropertyProgram.id);
      });
    });
  });
});
