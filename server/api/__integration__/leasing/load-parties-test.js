/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';

import app from '../../api';
import { createParty } from '../../../dal/partyRepo';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { testCtx as ctx, createAParty, createAPartyMember } from '../../../testUtils/repoHelper';
import { partyMemberKeys } from '../../../testUtils/expectedKeys';
import '../../../testUtils/setupTestGlobalContext';

describe('API/parties', () => {
  describe('given some created parties, when loading all parties', () => {
    it('has the created parties', async () => {
      const p1 = await createParty(ctx, { id: newId() });
      const p2 = await createParty(ctx, { id: newId() });

      const parties = [p1, p2];

      const res = await request(app).get('/parties').set(getAuthHeader());
      expect(res.status).to.deep.equal(200);
      expect(res.body.map(p => p.id).sort()).to.deep.equal(parties.map(p => p.id).sort());
    });
  });

  describe('given a party without members, when loading all parties', () => {
    it('the loaded party has defined partyMembers key', async () => {
      await createParty(ctx, { id: newId() });

      await request(app)
        .get('/parties')
        .set(getAuthHeader())
        .expect(200)
        .expect(res => expect(res.body[0].partyMembers).to.be.ok);
    });
  });

  describe('given a party with a member, when loading the party', () => {
    it('has the member', async () => {
      const party = await createAParty();
      await createAPartyMember(party.id);

      await request(app)
        .get('/parties')
        .set('Accept', 'application/json')
        .set(getAuthHeader())
        .expect(200)
        .expect(r => expect(r.body[0].partyMembers[0]).to.have.all.keys(partyMemberKeys));
    });
  });
});
