/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { commKeys, partyKeys } from '../../../testUtils/expectedKeys';
import app from '../../api';
import { createAParty, createAPartyMember, createACommunicationEntry, createAUser } from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';

describe('API GET communications/phone/:commId/activeCallData', () => {
  describe('with comm id that is not a UUID', () => {
    it('should respond with status code 400 and token INCORRECT_CALL_ID', async () => {
      const { status, body } = await request(app).get('/communications/phone/not-valid-uuid/activeCallData').set(getAuthHeader(tenant.id));

      expect(status).to.equal(400);
      expect(body.token).to.equal('INCORRECT_CALL_ID');
    });
  });

  describe('with valid comm id', () => {
    it('should contain the expected fields and values in the response body', async () => {
      const expectedBodyKeys = ['communication', 'parties', 'contact'];

      const expectedPartyKeys = [...partyKeys, 'partyMembers', 'timezone'];
      const expectedContactKeys = ['fullName', 'preferredName', 'contactInfo', 'score'];

      const user = await createAUser({ name: 'johnny' });
      const party = await createAParty({ userId: user.id });
      const party2 = await createAParty({ userId: user.id });
      const partyMember = await createAPartyMember(party.id);

      const comm = await createACommunicationEntry({
        userId: user.id,
        persons: [partyMember.personId],
        parties: [party.id, party2.id],
      });

      const { status, body } = await request(app).get(`/communications/phone/${comm.id}/activeCallData`).set(getAuthHeader(tenant.id));

      expect(status).to.equal(200);
      expect(body).to.have.all.keys(expectedBodyKeys);

      const commBody = body.communication;
      expect(commBody).to.have.all.keys(commKeys);
      expect(commBody.userId).to.equal(user.id);
      expect(commBody.persons).to.deep.equal([partyMember.personId]);
      expect(commBody.parties.sort()).to.deep.equal([party.id, party2.id].sort());

      const contactBody = body.contact;
      expect(contactBody).to.have.all.keys(expectedContactKeys);

      const partiesBody = body.parties;
      expect(partiesBody[0]).to.have.all.keys(expectedPartyKeys);
    });
  });
});
