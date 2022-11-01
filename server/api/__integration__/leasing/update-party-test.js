/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { createAPartyMember, createAParty, createAQuotePromotion, createAnInventoryItem, createAUser, testCtx as ctx } from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { partyKeys } from '../../../testUtils/expectedKeys';
import '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenantId } from '../../../testUtils/test-tenant';
import { getContactEventsByPartyAndFilter } from '../../../services/communication';

describe('API/party', () => {
  describe('given a request to update a party', () => {
    describe("when the party doesn't exist", () => {
      it('responds with status code 404 and PARTY_NOT_FOUND token', async () => {
        await request(app)
          .patch(`/parties/${newId()}`)
          .set(getAuthHeader())
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'));
      });
    });

    describe('when the id is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_PARTY_ID token', async () => {
        await request(app)
          .patch('/parties/123')
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_PARTY_ID'));
      });
    });

    describe('when the sent partyMember is not a uuid', () => {
      it('responds with status code 400 and INCORRECT_PARTY_MEMBER_ID token', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });
        await request(app)
          .patch(`/parties/${party.id}`)
          .set(getAuthHeader(tenantId, user.id))
          .send({
            id: party.id,
            partyMembers: [
              {
                id: 123,
              },
            ],
          })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_PARTY_MEMBER_ID'));
      });
    });
  });

  describe('when the party exists', () => {
    it('result has entity response', async () => {
      const expectedKeys = [...partyKeys, 'partyMembers', 'favoriteUnitsPropertyIds', 'screeningRequired'];
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      await request(app)
        .patch(`/parties/${party.id}`)
        .set(getAuthHeader(tenantId, user.id))
        .send({
          id: party.id,
        })
        .expect(200)
        .expect(res => expect(res.body).to.have.all.keys(expectedKeys));
    });
  });

  describe('when the party doesnt have a contact event and it was created by the + button', () => {
    it('should add a new contact event', async () => {
      const expectedKeys = [...partyKeys, 'partyMembers', 'favoriteUnitsPropertyIds', 'screeningRequired'];
      const user = await createAUser();
      const party = await createAParty({
        metadata: { creationType: 'user', firstContactChannel: 'Walk-in' },
        userId: user.id,
      });
      const resp = await request(app).patch(`/parties/${party.id}`).set(getAuthHeader(tenantId, user.id)).send({
        id: party.id,
      });

      expect(resp.body).to.have.all.keys(expectedKeys);
      const partyContactEvents = await getContactEventsByPartyAndFilter(ctx, party.id);
      expect(partyContactEvents).to.have.lengthOf(1);
    });
  });

  describe('when the payload contains a unit id that is not a uuid', () => {
    it('responds with status code 400 and INCORRECT_UNIT_ID token', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const res = await request(app)
        .patch(`/parties/${party.id}`)
        .set(getAuthHeader(tenantId, user.id))
        .send({ metadata: { favoriteUnits: ['some-invalid-unit-id'] } });

      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('INCORRECT_UNIT_ID');
    });
  });

  describe('when the payload contains a unit id that does not exists', () => {
    it('responds with status code 404 and UNIT_NOT_FOUND token', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const res = await request(app)
        .patch(`/parties/${party.id}`)
        .set(getAuthHeader(tenantId, user.id))
        .send({ metadata: { favoriteUnits: [newId()] } });

      expect(res.status).to.equal(404);
      expect(res.body.token).to.equal('UNIT_NOT_FOUND');
    });
  });

  describe('when the payload contains favoriteUnits', () => {
    it('the response has the updated favorite units', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const { id: unitId } = await createAnInventoryItem();

      const res = await request(app)
        .patch(`/parties/${party.id}`)
        .set(getAuthHeader(tenantId, user.id))
        .send({ metadata: { favoriteUnits: [unitId] } });

      expect(res.status).to.equal(200);
      expect(res.body.metadata.favoriteUnits).to.deep.equal([unitId]);
    });
  });

  describe('when the party exists and the partyMembers exists', () => {
    it('should update the party and party member entities', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const partyMember1 = await createAPartyMember(party.id, {
        fullName: 'Test',
      });
      const partyMember2 = await createAPartyMember(party.id, {
        fullName: 'ToUpdate',
      });
      const data = {
        id: party.id,
        state: DALTypes.PartyStateType.CONTACT,
        partyMembers: [
          {
            id: partyMember1.id,
            personId: partyMember1.personId,
          },
          {
            id: partyMember2.id,
            personId: partyMember2.personId,
            memberState: DALTypes.PartyStateType.LEAD,
            fullName: 'Updated',
          },
        ],
      };
      const response = await request(app).patch(`/parties/${party.id}`).set(getAuthHeader(tenantId, user.id)).send(data).expect(200);
      const updatedParty = response.body;
      expect(updatedParty.state).to.equal(DALTypes.PartyStateType.CONTACT);
      expect(updatedParty.partyMembers.length).to.equal(2);
      const pm1 = updatedParty.partyMembers.find(p => p.id === partyMember1.id);
      const pm2 = updatedParty.partyMembers.find(p => p.id === partyMember2.id);
      expect(pm1.fullName).to.equal('Test');
      expect(pm2.fullName).to.equal('Updated');
      expect(pm2.memberState).to.equal(DALTypes.PartyStateType.LEAD);
    });
  });

  describe('when updating a party with qualification questions data', () => {
    it('has the qualification questions data in response', async () => {
      const user = await createAUser();
      const { id } = await createAParty({ userId: user.id });
      const qualificationQuestions = {
        moveInTime: 'Within the next for weeks',
        groupType: 'A couple of family',
        cashAvailable: 'Yes',
      };

      const res = await request(app).patch(`/parties/${id}`).set(getAuthHeader(tenantId, user.id)).send({ qualificationQuestions });

      expect(res.status).to.equal(200);
      expect(res.body.qualificationQuestions).to.deep.equal(qualificationQuestions);
    });
  });

  describe('when user is not authorized to update the party', () => {
    it('responds with status code 403 and FORBIDDEN token', async () => {
      const { id } = await createAParty();

      await request(app)
        .patch(`/parties/${id}`)
        .set(getAuthHeader())
        .send({})
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });
  });

  describe('given a request to update a party', () => {
    let user;
    let party;
    const newQualificationquestions = {
      numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.ONE_BED],
      groupProfile: DALTypes.QualificationQuestions.GroupProfile.CORPORATE,
      moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
      numberOfUnits: '7',
    };
    beforeEach(async () => {
      user = await createAUser();
      party = await createAParty({
        userId: user.id,
        leaseType: DALTypes.PartyTypes.TRADITIONAL,
        qualificationQuestions: {
          numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.ONE_BED],
          groupProfile: DALTypes.QualificationQuestions.GroupProfile.STUDENTS,
          moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
          cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
        },
      });
    });
    describe('when update party type is not allowed after a quote promotion', () => {
      it('responds with status code 412 and CANNOT_CHANGE_PARTY_TYPE token and the ACTIVE_QUOTE_PROMOTION reason', async () => {
        await createAPartyMember(party.id, {
          fullName: 'Resident 01',
          memberType: DALTypes.MemberType.RESIDENT,
        });

        await createAQuotePromotion(party.id, DALTypes.PromotionStatus.APPROVED);

        await request(app)
          .patch(`/parties/${party.id}`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ qualificationQuestions: newQualificationquestions })
          .expect(412)
          .expect(res => {
            expect(res.body.token).to.equal('CANNOT_CHANGE_PARTY_TYPE');
            expect(res.body.data.reason).to.equal('ACTIVE_QUOTE_PROMOTION');
          });
      });
    });

    describe('when update party type is not allowed, because it has more than one resident', () => {
      it('responds with status code 412 and CANNOT_CHANGE_PARTY_TYPE token and the MULTIPLE_MEMBERS reason', async () => {
        await createAPartyMember(party.id, {
          fullName: 'Resident 01',
          memberType: DALTypes.MemberType.RESIDENT,
        });

        await createAPartyMember(party.id, {
          fullName: 'Resident 02',
          memberType: DALTypes.MemberType.RESIDENT,
        });

        await request(app)
          .patch(`/parties/${party.id}`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ qualificationQuestions: newQualificationquestions })
          .expect(412)
          .expect(res => {
            expect(res.body.token).to.equal('CANNOT_CHANGE_PARTY_TYPE');
            expect(res.body.data.reason).to.equal('MULTIPLE_MEMBERS');
          });
      });
    });
  });
});
