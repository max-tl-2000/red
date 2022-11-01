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
import { setNotificationFunction, resetNotificationFunction } from '../../../../common/server/notificationClient';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import {
  createAUser,
  createATeam,
  createATeamMember,
  createAParty,
  createAPartyMember,
  createAPersonContactInfo,
  createATeamPropertyProgram,
  createAProperty,
} from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getCommsByUserId } from '../../../dal/communicationRepo';
import eventTypes from '../../../../common/enums/eventTypes';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/communications/phone/makeCallFromPhone', () => {
  let ctx;
  let auth;
  let answerUrl;
  let ops;
  const messageId = newId();

  beforeEach(async () => {
    ctx = { tenantId: tenant.id };
    const conf = await getTelephonyConfigs(ctx);
    auth = conf.auth;
    answerUrl = conf.answerUrl;
    ops = { makeCall: sinon.spy(() => ({ requestUuid: messageId })) };
    setTelephonyOps(ops);
  });

  afterEach(() => resetNotificationFunction());

  const createTestEntities = async (phone = '12025550196') => {
    const user = await createAUser({
      ctx,
      name: 'Danny',
      directEmailIdentifier: 'danny',
      email: 'd@n.ny',
      status: DALTypes.UserStatus.AVAILABLE,
    });

    const team = await createATeam();
    await createATeamMember({ teamId: team.id, userId: user.id });
    const authHeader = getAuthHeader(ctx.tenantId, user.id, [team]);

    const { id: propertyId } = await createAProperty();
    const teamPropertyDisplayPhone = tenant.metadata.phoneNumbers[2].phoneNumber;
    await createATeamPropertyProgram({
      teamId: team.id,
      propertyId,
      displayPhoneNumber: teamPropertyDisplayPhone,
      commDirection: DALTypes.CommunicationDirection.OUT,
    });

    const party = await createAParty({ userId: user.id, teams: [team.id], ownerTeam: team.id, assignedPropertyId: propertyId });
    const partyMember = await createAPartyMember(party.id);
    await createAPersonContactInfo(partyMember.personId, {
      type: 'phone',
      value: phone,
    });

    const secondParty = await createAParty({
      userId: user.id,
      teams: [team.id],
    });
    const secondPartyMember = await createAPartyMember(secondParty.id);
    await createAPersonContactInfo(partyMember.personId, {
      type: 'phone',
      value: phone,
    });

    return {
      user,
      authHeader,
      party,
      partyMember,
      team,
      secondParty,
      secondPartyMember,
      teamPropertyDisplayPhone,
    };
  };

  describe("given a request to make a call from user's ring phone or ip phone", () => {
    const makeRequest = params => request(app).post('/communications/phone/makeCallFromPhone').send(params).set(getAuthHeader());

    it('should validate request params', async () => {
      const { party, partyMember } = await createTestEntities();
      const partyId = party.id;
      const personId = partyMember.personId;

      const phone = '12025550196';

      let res = await makeRequest({});
      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('MISSING_CALL_RECIPIENT');

      res = await makeRequest({ to: {} });
      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('MISSING_PHONE_NUMBER_TO_CALL');

      res = await makeRequest({ to: { phone } });
      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('MISSING_PERSON_ID');

      res = await makeRequest({ to: { phone, personId } });
      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('MISSING_PARTY_ID');

      res = await makeRequest({ to: { phone, personId, partyId } });
      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('MISSING_CALL_SOURCE');

      res = await makeRequest({ to: { phone, personId, partyId }, from: {} });
      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('MISSING_PHONE_NUMBER_TO_CALL_FROM');
    });

    ['12025550197', 'sip:JohnDoe42@phone.plivo.com'].forEach(source =>
      it('should call the makeCall provider function', async () => {
        const phone = '12025550196';
        const { user, authHeader, party, partyMember, teamPropertyDisplayPhone } = await createTestEntities(phone);

        const params = {
          to: { phone, personId: partyMember.personId, partyId: party.id },
          from: { phone: source },
        };

        const { status } = await request(app).post('/communications/phone/makeCallFromPhone').send(params).set(authHeader);

        expect(status).to.equal(200);

        expect(ops.makeCall).to.have.been.calledOnce;

        const [comm] = await getCommsByUserId(ctx, user.id);

        expect(comm).to.be.ok;
        expect(comm.messageId).to.equal(messageId);

        const answerParams = {
          guestNo: params.to.phone,
          isPhoneToPhone: true,
          initiatingUserId: user.id,
          commId: comm.id,
        };

        const url = addParamsToUrl(answerUrl, answerParams);

        expect(ops.makeCall).to.have.been.calledWith(auth, {
          from: teamPropertyDisplayPhone,
          to: params.from.phone,
          answerUrl: url,
          machineDetection: 'hangup',
        });
      }),
    );

    it('should create a communication entry and should notify about it', async () => {
      const notify = sinon.spy();
      setNotificationFunction(notify);

      const toPhone = '12025550196';
      const fromPhone = '12025550197';
      const { authHeader, party, partyMember, team } = await createTestEntities(toPhone);

      const params = {
        to: {
          phone: toPhone,
          personId: partyMember.personId,
          partyId: party.id,
        },
        from: { phone: fromPhone },
      };

      const { status, body: comm } = await request(app).post('/communications/phone/makeCallFromPhone').send(params).set(authHeader);

      expect(status).to.equal(200);

      expect(comm).to.be.ok;
      expect(comm.parties).to.deep.equal([party.id]);
      expect(comm.persons).to.deep.equal([partyMember.personId]);
      expect(comm.teams).to.deep.equal([team.id]);

      expect(notify).to.have.been.calledWith(
        sinon.match({
          event: eventTypes.COMMUNICATION_UPDATE,
          data: { partyIds: comm.parties, ids: [comm.id] },
        }),
      );
    });

    describe('when there are more persons with the same phone number', () => {
      it('should create a communication entry for given person and party', async () => {
        const toPhone = '12025550196';
        const fromPhone = '12025550197';
        const { user, authHeader, party, partyMember, secondParty, secondPartyMember } = await createTestEntities(toPhone);

        const params = {
          to: {
            phone: toPhone,
            personId: partyMember.personId,
            partyId: party.id,
          },
          from: { phone: fromPhone },
        };

        const { status } = await request(app).post('/communications/phone/makeCallFromPhone').send(params).set(authHeader);

        expect(status).to.equal(200);

        const [comm] = await getCommsByUserId(ctx, user.id);

        expect(comm).to.be.ok;
        expect(comm.parties).to.include(party.id);
        expect(comm.parties).to.not.include(secondParty.id);

        expect(comm.persons).to.include(partyMember.personId);
        expect(comm.persons).to.not.include(secondPartyMember.personId);
      });
    });
  });
});
