/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { personKeys, commKeys, partyKeys } from '../../../testUtils/expectedKeys';
import app from '../../api';
import { createAParty, createAPartyMember, createACommunicationEntry, createAUser } from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';

describe('API GET communications/phone/:threadId/inactiveCallData', () => {
  let user;
  let party;
  let party2;
  let party3;
  let party4;
  let personId;
  let comm;
  let comm2;
  let comm3;
  let comm4;
  let comm5;

  beforeEach(async () => {
    user = await createAUser({ name: 'johnny' });
    party = await createAParty({ userId: user.id });
    party2 = await createAParty({ userId: user.id });
    party3 = await createAParty({ userId: user.id });
    party4 = await createAParty({ userId: user.id });
    const partyMember = await createAPartyMember(party.id);
    personId = partyMember.personId;

    comm = await createACommunicationEntry({
      userId: user.id,
      persons: [partyMember.personId],
      parties: [party.id, party3.id],
    });

    comm2 = await createACommunicationEntry({
      userId: user.id,
      persons: [partyMember.personId],
      parties: [party2.id],
    });

    comm3 = await createACommunicationEntry({
      persons: [partyMember.personId],
      parties: [party4.id],
    });

    comm4 = await createACommunicationEntry({
      persons: [partyMember.personId],
      parties: [party4.id],
    });

    comm5 = await createACommunicationEntry({
      userId: user.id,
      persons: [partyMember.personId],
      parties: [party4.id],
      transferredFromCommId: comm3.id,
    });
  });

  describe('with a party id that is not a UUID', () => {
    it('should respond with status code 400 and token INVALID_PARTY_ID', async () => {
      const { status, body } = await request(app)
        .get(`/communications/phone/${comm.threadId}/inactiveCallData?partyId=not-valid-uuid`)
        .set(getAuthHeader(tenant.id));

      expect(status).to.equal(400);
      expect(body.token).to.equal('INVALID_PARTY_ID');
    });
  });

  describe('with a person id that is not a UUID', () => {
    it('should respond with status code 400 and token INVALID_PERSON_ID', async () => {
      const { status, body } = await request(app)
        .get(`/communications/phone/${comm.threadId}/inactiveCallData?personId=not-valid-uuid`)
        .set(getAuthHeader(tenant.id));

      expect(status).to.equal(400);
      expect(body.token).to.equal('INVALID_PERSON_ID');
    });
  });

  describe('with valid thread id', () => {
    it('should contain the expected fields and values in the response body', async () => {
      const expectedBodyKeys = ['communications', 'parties', 'person'];

      const expectedPartyKeys = [...partyKeys, 'partyMembers', 'timezone'];
      const { status, body } = await request(app).get(`/communications/phone/${comm.threadId}/inactiveCallData`).set(getAuthHeader(tenant.id, user.id));

      expect(status).to.equal(200);
      expect(body).to.have.all.keys(expectedBodyKeys);
      const commsBody = body.communications;
      expect(commsBody.length).to.equal(5);
      const firstComm = commsBody.find(c => c.id === comm.id);

      expect(firstComm).to.have.all.keys(commKeys);

      expect(firstComm.userId).to.equal(user.id);
      expect(firstComm.persons).to.deep.equal([personId]);
      expect(firstComm.parties.sort()).to.deep.equal([party.id, party3.id].sort());

      const partiesBody = body.parties;
      expect(partiesBody[0]).to.have.all.keys(expectedPartyKeys);

      const personBody = body.person;
      expect(personBody[0]).to.have.all.keys(personKeys);
    });

    it('should filter data correctly based on the partyId', async () => {
      const { status, body } = await request(app)
        .get(`/communications/phone/${comm.threadId}/inactiveCallData?partyId=${party2.id}`)
        .set(getAuthHeader(tenant.id, user.id));

      expect(status).to.equal(200);

      const commsBody = body.communications;
      expect(commsBody.length).to.equal(1);
      expect(commsBody[0].id).to.equal(comm2.id);
      expect(commsBody[0].parties).to.deep.equal([party2.id]);
    });

    it('should sort the calls by date but keep transfers together', async () => {
      const { status, body } = await request(app)
        .get(`/communications/phone/${comm.threadId}/inactiveCallData?partyId=${party4.id}`)
        .set(getAuthHeader(tenant.id, user.id));

      expect(status).to.equal(200);

      const commsBody = body.communications;
      expect(commsBody.length).to.equal(3);
      expect(commsBody.map(c => c.id)).to.deep.equal([comm3.id, comm5.id, comm4.id]);
    });
  });
});
