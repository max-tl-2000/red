/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import pick from 'lodash/pick';
import newId from 'uuid/v4';

import app from '../../api';
import { testCtx as ctx, createAPerson, createATeam, createACommonUser } from '../../../testUtils/repoHelper';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import '../../../testUtils/setupTestGlobalContext';

import { enhance } from '../../../../common/helpers/contactInfoUtils';

import { createRawLead } from '../../../dal/partyRepo';
import { personKeys } from '../../../testUtils/expectedKeys';
import { createAPersonApplication } from '../../../../rentapp/server/test-utils/repo-helper';

describe('API/persons', () => {
  describe('given some created persons, when loading all persons', () => {
    it('has the created persons', async () => {
      await createAPerson('Tyrion Lannister', 'The Imp');
      await createAPerson('Ramsay Bolton', 'Ramsay');

      await request(app)
        .get('/persons')
        .set(getAuthHeader())
        .expect(200)
        .expect(r => expect(r.body.length).to.equal(2));
    });
  });

  describe('given a request to update a person', () => {
    describe("when the person doesn't exist", () => {
      it('responds with status code 404 and PERSON_NOT_FOUND token', async () => {
        await request(app)
          .patch(`/persons/${newId()}`)
          .set(getAuthHeader())
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PERSON_NOT_FOUND'));
      });
    });

    describe('when the id is not a uuid', () => {
      it('responds with status code 400 and INVALID_PERSON_ID token', async () => {
        await request(app)
          .patch('/persons/123')
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_PERSON_ID'));
      });
    });

    describe('when the person has a common user', () => {
      const primaryEmail = 'luke@jedi.org';
      const newEmail = 'yoda@jedi.org';
      const createPersonAndCommonUser = async email => {
        const person = await createAPerson('Tyrion Lannister', 'The Imp', enhance([{ id: newId(), type: 'email', value: email }]));

        const commonUser = await createACommonUser({
          tenantId: ctx.tenantId,
          personId: person.id,
          fullName: 'Luke',
          preferredName: 'Luke',
          email,
        });
        return { person, commonUser };
      };

      describe('when a new email is added', () => {
        it('responds with status code 200', async () => {
          const { person } = await createPersonAndCommonUser(primaryEmail);
          const contactInfo = enhance([
            { type: 'email', value: person.contactInfo.defaultEmail, id: person.contactInfo.defaultEmailId, isPrimary: true },
            { type: 'email', value: newEmail, id: newId() },
          ]);

          const { body } = await request(app).patch(`/persons/${person.id}`).set(getAuthHeader()).send({ contactInfo }).expect(200);

          const { defaultEmailId, emails } = body.contactInfo;
          expect(defaultEmailId).to.equal(person.contactInfo.defaultEmailId);
          expect(emails.some(email => email.value === newEmail)).to.equal(true);
        });
      });
    });

    describe('when providing an invalid phone number', () => {
      it('responds with status code 200', async () => {
        const { id } = await createAPerson('Tyrion Lannister', 'The Imp');

        const contactInfo = enhance([{ type: 'phone', value: '11111111111', id: newId() }]);

        await request(app).patch(`/persons/${id}`).set(getAuthHeader()).send({ contactInfo }).expect(200);
      });

      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        const { id } = await createAPerson('Tyrion Lannister', 'The Imp');

        const contactInfo = enhance([{ type: 'phone', value: 'ddddddd', id: newId() }]);

        await request(app)
          .patch(`/persons/${id}`)
          .set(getAuthHeader())
          .send({ contactInfo })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_PHONE_NUMBER'));
      });

      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        const { id } = await createAPerson('Tyrion Lannister', 'The Imp');

        const contactInfo = enhance([{ type: 'phone', value: '', id: newId() }]);

        await request(app)
          .patch(`/persons/${id}`)
          .set(getAuthHeader())
          .send({ contactInfo })
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_PHONE_NUMBER'));
      });
    });

    describe('when it has a valid phone number', () => {
      it('responds with status code 200 and updated entity has correctly formatted phone number', async () => {
        const { id } = await createAPerson('Tyrion Lannister', 'The Imp');

        const contactInfo = enhance([{ type: 'phone', value: '+1 619-738-4381', id: newId() }]);

        const { body } = await request(app).patch(`/persons/${id}`).set(getAuthHeader()).send({ contactInfo }).expect(200);

        const number = body.contactInfo.defaultPhone;
        expect(number).to.equal('16197384381');
      });
    });

    describe('when the update alters contact info', () => {
      it("should remove the existing contactInfos which don't exist in the new ContactInfo list and the new items should be saved", async () => {
        const phoneNo1 = '16504466620';
        const phoneNo2 = '16504466621';
        const phoneNo3 = '16504466622';

        const { id, contactInfo: initialContactInfo } = await createAPerson(
          'Tyrion Lannister',
          'The Imp',
          enhance([
            { id: newId(), type: 'phone', value: phoneNo1 },
            { id: newId(), type: 'phone', value: phoneNo2 },
          ]),
        );

        const initialContactInfoItem = initialContactInfo.all.find(ci => ci.value === phoneNo1);
        const newContactInfo = enhance([
          { id: initialContactInfoItem.id, type: 'phone', value: phoneNo1 },
          { id: newId(), type: 'phone', value: phoneNo3 },
        ]);

        const res = await request(app).patch(`/persons/${id}`).set(getAuthHeader()).send({ contactInfo: newContactInfo }).expect(200);

        const { contactInfo: updatedContactInfo } = res.body;
        expect(updatedContactInfo.all).to.have.length(2);
        const updatedContactInfoData = updatedContactInfo.all.map(c => pick(c, ['type', 'value']));
        const expectedMembers = [
          { type: 'phone', value: phoneNo3 },
          { type: 'phone', value: phoneNo1 },
        ];
        expect(updatedContactInfoData).to.deep.include.members(expectedMembers);
      });
    });
    describe('when the update request has an email with the isAnonymous field', () => {
      it('should update the temporary email', async () => {
        const { id, contactInfo: initialContactInfo } = await createAPerson(
          'Tyrion Lannister',
          'The Imp',
          enhance([{ type: 'email', value: 'reply-tyrion@email.rent.com', id: newId() }]),
        );

        const updatedEmail = 'lou.gerstner@gmail.com';
        const [temporaryEmail] = initialContactInfo.emails;
        const newContactInfo = enhance([{ ...temporaryEmail, value: updatedEmail }]);

        expect(temporaryEmail.isAnonymous).to.eq(true);

        await request(app)
          .patch(`/persons/${id}`)
          .set(getAuthHeader())
          .send({ contactInfo: newContactInfo })
          .expect(200)
          .expect(res => {
            expect(res.body.contactInfo.defaultEmailId).to.eq(temporaryEmail.id);
            expect(res.body.contactInfo.defaultEmail).to.eq(updatedEmail);
            expect(res.body.contactInfo.emails[0].isAnonymous).to.eq(false);
          });
      });
    });
    describe('when the update request has an email that already exists in the database', () => {
      it('should throw a 412 error with the EMAIL_ADDRESS_ALREADY_EXISTS token', async () => {
        await createAPerson('Tyrion Lannister', 'The Imp', enhance([{ type: 'email', value: 'reply-tyrion@email.rent.com', id: newId() }]));

        const { id, contactInfo: initialContactInfo } = await createAPerson(
          'Tyrion Lannister',
          'The Imp',
          enhance([{ type: 'email', value: 'reply-tyrion2@email.rent.com', id: newId() }]),
        );

        const updatedEmail = 'reply-tyrion@email.rent.com';
        const [temporaryEmail] = initialContactInfo.emails;
        const newContactInfo = enhance([{ ...temporaryEmail, value: updatedEmail }]);

        await request(app)
          .patch(`/persons/${id}`)
          .set(getAuthHeader())
          .send({ contactInfo: newContactInfo })
          .expect(412)
          .expect(res => {
            expect(res.body.token).to.eq('EMAIL_ADDRESS_ALREADY_EXISTS');
          });
      });
    });
    describe('when the update succeeds', () => {
      it('has all the person keys in response', async () => {
        const person = await createAPerson('Tyrion Lannister', 'The Imp');
        const res = await request(app).patch(`/persons/${person.id}`).set(getAuthHeader()).send(person).expect(200);
        expect(res.body).to.have.all.keys([...personKeys, 'displayName']);
      });

      it('has the updated name', async () => {
        const person = await createAPerson('Tyrion Lannister', 'The Imp');
        const newName = 'Jamie Lannister';

        await request(app)
          .patch(`/persons/${person.id}`)
          .set(getAuthHeader())
          .send({ fullName: newName })
          .expect(200)
          .expect(res => expect(res.body.fullName).to.deep.equal(newName));
      });
    });
  });

  describe('GET/leads', () => {
    it('has all the persons not assigned to a party member', async () => {
      const team = await createATeam({
        name: 'TestTeam',
        module: 'leasing',
        email: 'leasing@test.com',
        phone: '12345678923',
      });
      const person = {
        fullName: 'Luke Skywalker',
        contactInfo: enhance([
          { type: 'email', value: 'tatooine@middleofnowhere.io', id: newId() },
          { type: 'phone', value: '16502736663', id: newId() },
        ]),
      };
      await createRawLead({
        ctx,
        personData: person,
        collaboratorTeams: [team.id],
        teamsForParty: [team.id],
      });

      const res = await request(app).get('/leads').set(getAuthHeader());
      expect(res.status).to.equal(200);
      expect(res.body).to.have.length(1);
      expect(res.body[0].fullName).to.equal('Luke Skywalker');
    });
  });

  describe('GET/:id', () => {
    it('has the requested person in response', async () => {
      const person = await createAPerson();
      const personMemberKeys = [
        'id',
        'memberState',
        'memberType',
        'fullName',
        'personId',
        'person',
        'isSpam',
        'contactInfoId',
        'email',
        'created_at',
        'updated_at',
      ];

      request(app)
        .get(`/persons/${person.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(r => expect(r.body).to.have.all.keys(personMemberKeys))
        .expect(res => expect(res.body.id).to.equal(person.id))
        .expect(res => expect(res.body.fullName).to.equal(person.fullName));
    });
  });

  describe('given a request to merge two persons', () => {
    describe('when one of the persons does not exist', () => {
      it('responds with status code 404 and PERSON_NOT_FOUND token', async () => {
        await request(app)
          .post('/persons/merge')
          .set(getAuthHeader())
          .send({ firstPersonId: newId(), secondPersonId: newId() })
          .expect(404)
          .expect(result => expect(result.body.token).to.equal('PERSON_NOT_FOUND'));
      });
    });

    describe('when the merge cannot be performed due to both persons having paid applications', () => {
      it('responds with status code 412 and ERROR_BOTH_PERSONS_APPLIED token', async () => {
        const person1 = await createAPerson('John Papa SR', 'John P');
        const person2 = await createAPerson('John Papa', 'John');

        await createAPersonApplication({ firstName: 'John P' }, person1.id, newId(), newId(), true);
        await createAPersonApplication({ firstName: 'John' }, person2.id, newId(), newId(), true);

        await request(app)
          .post('/persons/merge')
          .set(getAuthHeader())
          .send({ firstPersonId: person1.id, secondPersonId: person2.id })
          .expect(412)
          .expect(result => expect(result.body.token).to.equal('ERROR_BOTH_PERSONS_APPLIED'));
      });
    });
  });
});
