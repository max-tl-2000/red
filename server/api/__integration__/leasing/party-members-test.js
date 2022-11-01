/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import newId from 'uuid/v4';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { createLease, createLeaseTestData } from '../../../testUtils/leaseTestHelper';
import { updateLease } from '../../../dal/leaseRepo';
import { testCtx as ctx, createAParty, createAPartyMember, createAUser } from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { knex } from '../../../database/factory';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { partyMemberKeys } from '../../../testUtils/expectedKeys';

describe('API/parties', () => {
  describe('given a request to add a member to a party', () => {
    describe("when the party doesn't exist", () => {
      it('responds with status code 404 and PARTY_NOT_FOUND token', async () => {
        await request(app)
          .post(`/parties/${newId()}/members`)
          .set(getAuthHeader())
          .expect(404)
          .expect(r => expect(r.body.token).to.equal('PARTY_NOT_FOUND'));
      });
    });

    describe('when the party id is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_PARTY_ID token', async () => {
        await request(app)
          .post('/parties/some-invalid-id/members')
          .set(getAuthHeader())
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INCORRECT_PARTY_ID'));
      });
    });

    it('has party member keys in response', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const member = {
        memberType: DALTypes.MemberType.RESIDENT,
        fullName: 'Luke Skywalker',
      };

      await request(app)
        .post(`/parties/${party.id}/members`)
        .set(getAuthHeader(tenant.id, user.id))
        .send(member)
        .expect(200)
        .expect(r => expect(r.body).to.have.all.keys(partyMemberKeys));
    });

    describe('when the member is valid', () => {
      let user;
      let party;
      let member;
      beforeEach(async () => {
        user = await createAUser();
        party = await createAParty({ userId: user.id });
        member = {
          fullName: 'test',
          memberType: DALTypes.MemberType.GUARANTOR,
        };
      });

      const makeAddMemberRequest = async () =>
        await request(app).post(`/parties/${party.id}/members`).set(getAuthHeader(tenant.id, user.id)).send(member).expect(200);

      it('should add a activity log entry', async () => {
        await createAUser({ email: 'admin@reva.tech' });
        const { body: newMember } = await makeAddMemberRequest();
        const { body: res } = await request(app).get(`/activityLogs?partyId=${party.id}`).set(getAuthHeader()).expect(200);

        const newGuestLogs = res.filter(p => p.type === ACTIVITY_TYPES.NEW && p.component === COMPONENT_TYPES.GUEST);

        expect(newGuestLogs.length).to.equal(1);
        expect(newGuestLogs[0].details.personId).to.equal(newMember.personId);
      });
    });

    describe('when it has an invalid phone number', () => {
      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          contactInfo: enhance([{ type: 'phone', value: '1145bb68qerew', id: newId() }]),
        };

        await request(app)
          .post(`/parties/${party.id}/members`)
          .set(getAuthHeader(tenant.id, user.id))
          .send(member)
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INVALID_PHONE_NUMBER'));
      });
    });

    describe('when it has a valid phone number', () => {
      it('responds with status code 200 and saved entity has correctly formatted phone number', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          contactInfo: enhance([{ type: 'phone', value: '+1 800-800-1234', id: newId() }]),
        };

        const { body: savedMember } = await request(app).post(`/parties/${party.id}/members`).set(getAuthHeader(tenant.id, user.id)).send(member).expect(200);

        const number = savedMember.contactInfo.defaultPhone;
        expect(number).to.equal('18008001234');
      });
    });

    describe("when the person id doesn't exist", () => {
      it('responds with status code 404 and PERSON_NOT_FOUND token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          personId: newId(),
        };

        await request(app)
          .post(`/parties/${party.id}/members`)
          .set(getAuthHeader(tenant.id, user.id))
          .send(member)
          .expect(404)
          .expect(r => expect(r.body.token).to.equal('PERSON_NOT_FOUND'));
      });
    });

    describe('when the person id is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_PERSON_ID token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          personId: 'some-invalid-id',
        };

        await request(app)
          .post(`/parties/${party.id}/members`)
          .set(getAuthHeader(tenant.id, user.id))
          .send(member)
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INCORRECT_PERSON_ID'));
      });
    });

    describe('when the same person is already added to the party', () => {
      it('responds with status code 400 and no new party member is created', async () => {
        const contactInfo = enhance([{ type: 'email', value: 'luke@jedi.org', id: newId() }]);

        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const { personId } = await createAPartyMember(party.id, { fullName: 'Luke Skywalker', contactInfo });
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          personId,
        };

        await request(app)
          .post(`/parties/${party.id}/members`)
          .set(getAuthHeader(tenant.id, user.id))
          .send(member)
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('ADD_PARTY_MEMBER_DUPLICATE_PERSON'));
      });
    });

    describe('when a known person is added as guest', () => {
      it('responds with status code 200 and no new person is created', async () => {
        const existingParty = await createAParty();
        const contactInfo = enhance([{ type: 'email', value: 'luke@jedi.org', id: newId() }]);
        const { personId } = await createAPartyMember(existingParty.id, { fullName: 'Luke Skywalker', contactInfo });

        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          personId,
        };

        await request(app)
          .post(`/parties/${party.id}/members`)
          .set(getAuthHeader(tenant.id, user.id))
          .send(member)
          .expect(200)
          .expect(r => expect(r.body.personId).to.equal(personId));
      });
    });

    describe('when it has phone and email', () => {
      it('saves both contact info items and marks them as default', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });

        const contactInfo = enhance([
          { type: 'phone', value: '16197384381', id: newId() },
          { type: 'email', value: 'jedi@rebellion.ga', id: newId() },
        ]);

        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          contactInfo,
        };

        await request(app).post(`/parties/${party.id}/members`).set(getAuthHeader(tenant.id, user.id)).send(member).expect(200);

        const actual = await knex.withSchema(ctx.tenantId).select('type', 'value', 'isPrimary').from('ContactInfo');

        const expected = [
          { type: 'phone', value: '16197384381', isPrimary: true },
          { type: 'email', value: 'jedi@rebellion.ga', isPrimary: true },
        ];

        expect(actual).to.deep.equal(expected);
      });
    });

    describe('when it is valid, but made by an unauthorized user', () => {
      it('responds with status code 403 and FORBIDDEN token', async () => {
        const party = await createAParty();
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
          contactInfo: enhance([{ type: 'phone', value: '1145bb68qerew', id: newId() }]),
        };

        await request(app)
          .post(`/parties/${party.id}/members`)
          .set(getAuthHeader())
          .send(member)
          .expect(403)
          .expect(r => expect(r.body.token).to.equal('FORBIDDEN'));
      });
    });

    describe('when is a corporate party and already has a primary tenant', () => {
      it('responds with status code 412 and ADD_PARTY_MEMBER_NOT_ALLOWED token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id, leaseType: DALTypes.PartyTypes.CORPORATE });
        await createAPartyMember(party.id, {
          fullName: 'Luke Skywalker',
          memberType: DALTypes.MemberType.RESIDENT,
        });

        await request(app)
          .post(`/parties/${party.id}/members`)
          .set(getAuthHeader(tenant.id, user.id))
          .send({
            memberType: DALTypes.MemberType.RESIDENT,
            fullName: 'John Doe',
          })
          .expect(412)
          .expect(r => expect(r.body.token).to.equal('ADD_PARTY_MEMBER_NOT_ALLOWED'));
      });
    });
  });

  describe('given a request to update a party member', () => {
    describe('when the party id is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_PARTY_ID token', async () => {
        await request(app)
          .patch(`/parties/some-invalid-party-id/members/${newId()}`)
          .set(getAuthHeader())
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INCORRECT_PARTY_ID'));
      });
    });

    describe('when the party id does not exist', () => {
      it('responds with status code 404 and PARTY_NOT_FOUND token', async () => {
        await request(app)
          .patch(`/parties/${newId()}/members/${newId()}`)
          .set(getAuthHeader())
          .expect(404)
          .expect(r => expect(r.body.token).to.equal('PARTY_NOT_FOUND'));
      });
    });

    describe('when the party id is a valid uuid and the party member id is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_PARTY_MEMBER_ID token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .patch(`/parties/${party.id}/members/some-invalid-party-member-id`)
          .set(getAuthHeader(tenant.id, user.id))
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INCORRECT_PARTY_MEMBER_ID'));
      });
    });

    describe('when the party has a published lease', () => {
      it('responds with status code 412 and SUBMITTED_OR_EXECUTED_LEASE_EXISTS token', async () => {
        const { partyId, userId, promotedQuote } = await createLeaseTestData();

        const lease = await createLease(partyId, userId, promotedQuote.id);
        await updateLease(ctx, { id: lease.id, status: DALTypes.LeaseStatus.SUBMITTED });
        const member = {
          memberType: DALTypes.MemberType.RESIDENT,
          fullName: 'Luke Skywalker',
        };

        await request(app)
          .post(`/parties/${partyId}/members`)
          .set(getAuthHeader(tenant.id, userId))
          .send(member)
          .expect(412)
          .expect(r => expect(r.body.token).to.equal('SUBMITTED_OR_EXECUTED_LEASE_EXISTS'));
      });
    });

    describe('when the party id is a valid uuid and the party member id does not exist', () => {
      it('responds with status code 404 and PARTY_MEMBER_NOT_FOUND token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .patch(`/parties/${party.id}/members/${newId()}`)
          .set(getAuthHeader(tenant.id, user.id))
          .expect(404)
          .expect(r => expect(r.body.token).to.equal('PARTY_MEMBER_NOT_FOUND'));
      });
    });

    it('has party member keys in responses', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const partyMember = await createAPartyMember(party.id);

      const member = {
        ...partyMember,
        fullName: 'John Doe',
      };

      await request(app)
        .patch(`/parties/${party.id}/members/${partyMember.id}`)
        .set(getAuthHeader(tenant.id, user.id))
        .send(member)
        .expect(200)
        .expect(r => expect(r.body).to.have.all.keys(partyMemberKeys))
        .expect(r => expect(r.body.fullName).to.equal(member.fullName));
    });

    it("updates the member's contact info also", async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });

      const oldContactInfo = enhance([
        { type: 'phone', value: '16197384382', id: newId() },
        { type: 'email', value: 'aaa@bbb.ccc', id: newId() },
      ]);

      const member = await createAPartyMember(party.id, { fullName: 'Jon', contactInfo: oldContactInfo });

      const newContactInfo = enhance([
        { type: 'phone', value: '16572565197', id: newId() },
        { type: 'email', value: 'zzz@xxx.yyy', id: newId() },
      ]);

      const updatedMember = {
        ...member,
        contactInfo: newContactInfo,
      };

      await request(app)
        .patch(`/parties/${party.id}/members/${member.id}`)
        .set(getAuthHeader(tenant.id, user.id))
        .send(updatedMember)
        .expect(200)
        .expect(r => {
          expect(r.body.contactInfo.type).to.equal(newContactInfo.type);
          expect(r.body.contactInfo.value).to.equal(newContactInfo.value);
        });
    });

    describe('when it has an invalid phone number', () => {
      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const partyMember = await createAPartyMember(party.id);

        const member = {
          ...partyMember,
          contactInfo: enhance([{ type: 'phone', value: '1145bb68qerew', id: newId() }]),
        };

        await request(app)
          .patch(`/parties/${party.id}/members/${partyMember.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .send(member)
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INVALID_PHONE_NUMBER'));
      });
    });

    describe('when it has a valid phone number', () => {
      it('responds with status code 200 and saved entity has correctly formatted phone number', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        const partyMember = await createAPartyMember(party.id);

        const member = {
          ...partyMember,
          contactInfo: enhance([{ type: 'phone', value: '+1 800-800-1234', id: newId() }]),
        };

        const { body: updatedMember } = await request(app)
          .patch(`/parties/${party.id}/members/${partyMember.id}`)
          .set(getAuthHeader(tenant.id, user.id))
          .send(member)
          .expect(200);

        const [{ type, value }] = updatedMember.contactInfo.all;
        expect(type).to.equal('phone');
        expect(value).to.equal('18008001234');
      });
    });

    describe('when it is valid, but made by an unauthorized user', () => {
      it('responds with status code 403 and FORBIDDEN token', async () => {
        const party = await createAParty();
        const partyMember = await createAPartyMember(party.id);

        const member = {
          ...partyMember,
          contactInfo: enhance([{ type: 'phone', value: '+1 123-123-1234', id: newId() }]),
        };

        await request(app)
          .patch(`/parties/${party.id}/members/${partyMember.id}`)
          .set(getAuthHeader())
          .send(member)
          .expect(403)
          .expect(r => expect(r.body.token).to.equal('FORBIDDEN'));
      });
    });
  });

  describe('when loading party members for certain party', () => {
    it('has members of that party', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const partyMember = await createAPartyMember(party.id);

      await request(app)
        .get(`/parties/${party.id}/members`)
        .set(getAuthHeader(tenant.id, user.id))
        .expect(200)
        .expect(res => expect(res.body).to.have.length(1))
        .expect(res => expect(res.body[0].id).to.equal(partyMember.id))
        .expect(res => expect(res.body[0].partyId).to.equal(partyMember.partyId))
        .expect(res => expect(res.body[0].fullName).to.equal(partyMember.fullName));
    });

    it('it loads all contact information for member', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });

      const contactInfo = enhance([
        { type: 'phone', value: '01234567890', id: newId() },
        { type: 'phone', value: '09876543210', id: newId() },
        { type: 'email', value: 'foo@bar.com', id: newId() },
      ]);

      await createAPartyMember(party.id, { fullName: 'Stanis', contactInfo });
      const res = await request(app).get(`/parties/${party.id}/members`).set(getAuthHeader(tenant.id, user.id)).expect(200);

      expect(res.body[0].contactInfo.type).to.equal(contactInfo.type);
      expect(res.body[0].contactInfo.value).to.equal(contactInfo.value);
    });
  });
});
