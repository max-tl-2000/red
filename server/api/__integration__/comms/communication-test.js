/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { commKeys } from '../../../testUtils/expectedKeys';
import app from '../../api';
import {
  testCtx as ctx,
  createAParty,
  createAPartyMember,
  createACommunicationEntry,
  createAUser,
  createATeam,
  createATeamMember,
  createAProperty,
  createATeamPropertyProgram,
  createAPerson,
} from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { storeMessage, getAllComms, loadMessageById } from '../../../dal/communicationRepo';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { now } from '../../../../common/helpers/moment-utils';
import { computeThreadId } from '../../../../common/helpers/utils';
import { updateParty } from '../../../dal/partyRepo';

describe('API/communications/draft', () => {
  let user;
  let party;
  let email;
  let draft;
  const content = 'Draft content';

  beforeEach(async () => {
    user = await createAUser();
    party = await createAParty({ userId: user.id });
    email = enhance([{ type: 'email', value: 'john.doe@test.com', id: newId() }]);
    await createAPartyMember(party.id, {
      fullName: 'John Doe',
      contactInfo: email,
    });

    draft = {
      id: '',
      recipients: { contactInfos: [email.id] },
      message: { content },
      type: DALTypes.CommunicationMessageType.EMAIL,
      partyId: party.id,
      userId: user.id,
    };
  });

  describe('when saving a communication draft for a party', () => {
    it('it is persisted correctly for the user and party', async () => {
      await request(app).post('/communications/draft').set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

      const result = await request(app).get(`/communications/drafts/${user.id}/${party.id}`).set(getAuthHeader(tenant.id)).expect(200);

      expect(result.body).to.not.be.null;
      expect(result.body.length).to.equal(1);
      expect(result.body[0].data).is.not.null;
      expect(result.body[0].data.content).to.equal(content);
    });
  });

  describe('when saving a communication draft for a party', () => {
    it('it is not retrieved for a different user for the same party', async () => {
      await request(app).post('/communications/draft').set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

      const differentUser = await createAUser();
      const result = await request(app).get(`/communications/drafts/${differentUser.id}/${party.id}`).set(getAuthHeader(tenant.id)).expect(200);

      expect(result.body).to.not.be.null;
      expect(result.body.length).to.equal(0);
    });
  });

  describe('after deleting a communication draft for a party', () => {
    it('it is no longer retrieved', async () => {
      await request(app).post('/communications/draft').set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

      let result = await request(app).get(`/communications/drafts/${user.id}/${party.id}`).set(getAuthHeader(tenant.id)).expect(200);

      expect(result.body).to.not.be.null;
      expect(result.body.length).to.equal(1);
      const savedDraft = result.body[0];

      await request(app).delete(`/communications/drafts/${savedDraft.id}`).set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

      result = await request(app).get(`/communications/drafts/${user.id}/${party.id}`).set(getAuthHeader(tenant.id)).expect(200);

      expect(result.body).to.not.be.null;
      expect(result.body.length).to.equal(0);
    });
  });
});

describe('API/parties/communication', () => {
  let user;
  let team1;
  beforeEach(async () => {
    user = await createAUser();
    team1 = await createATeam({
      name: 'team1',
      module: 'leasing',
      email: 'test1@test.a',
      phone: '16503381450',
    });
    const team2 = await createATeam({
      name: 'team2',
      module: 'residentServices',
      email: 'test2@test.a',
      phone: '16197384381',
    });
    user.teams = [team1, team2];
  });

  const send = message => request(app).post('/communications').set(getAuthHeader(tenant.id, user.id, user.teams)).send(message);

  describe('when saving an email communication', () => {
    let party;
    let existingPartyMember;
    let existingPartyMember2;
    let emailMessage;

    beforeEach(async () => {
      const { id: propertyId } = await createAProperty();
      await createATeamPropertyProgram({ teamId: team1.id, propertyId, commDirection: DALTypes.CommunicationDirection.OUT });
      party = await createAParty({
        userId: user.id,
        teams: [team1.id],
        ownerTeam: team1.id,
        assignedPropertyId: propertyId,
      });

      const contactInfo = enhance([{ type: 'email', value: 'john.doe@test.com', id: newId() }]);
      existingPartyMember = await createAPartyMember(party.id, {
        fullName: 'John Doe',
        contactInfo,
      });

      const contactInfo2 = enhance([{ type: 'email', value: 'jane.doe@test.com', id: newId() }]);
      existingPartyMember2 = await createAPartyMember(party.id, {
        fullName: 'Jane Doe',
        contactInfo: contactInfo2,
      });

      const contactInfoIds = [existingPartyMember.contactInfo.all[0].id, existingPartyMember2.contactInfo.all[0].id];

      emailMessage = {
        partyId: party.id,
        recipients: { contactInfos: contactInfoIds },
        message: {
          subject: 'test subject',
          content: 'test content',
        },
        type: 'Email',
      };
    });

    it('has partial communication entity in response', async () => {
      const res = await send(emailMessage);
      expect(res.status).to.equal(200);
      const comm = res.body[0];
      expect(comm.type).to.equal('Email');
      expect(comm).to.have.all.keys(commKeys);
    });

    it('has persons correctly assigned on the communication', async () => {
      const res = await send(emailMessage);
      const comm = res.body[0];
      expect(comm.persons.length).to.be.equal(2);
      expect(comm.persons.sort()).to.deep.equal([existingPartyMember.personId, existingPartyMember2.personId].sort());
    });

    it('has correct thread id on reply email', async () => {
      const messageId = newId();
      const threadId = newId();
      const initialCommEntity = {
        message: emailMessage.message,
        type: DALTypes.CommunicationMessageType.EMAIL,
        parties: [party.id],
        userId: user.id,
        direction: DALTypes.CommunicationDirection.IN,
        persons: [existingPartyMember.id],
        threadId,
        messageId,
        category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
      };

      const initialComm = await storeMessage({ tenantId: tenant.id }, initialCommEntity);
      const replyEmail = { ...emailMessage, inReplyTo: messageId };

      const res = await send(replyEmail);
      expect(res.status).to.equal(200);
      const comm = res.body[0];
      expect(comm.threadId).to.equal(initialComm.threadId);
    });

    describe('and none of the recipients has an email addresss', () => {
      it('It should return a service error', async () => {
        emailMessage = {
          partyId: party.id,
          recipients: {
            contactInfos: [newId(), newId()],
          },
          message: {
            subject: 'test subject',
          },
          type: 'Email',
        };
        const res = await send(emailMessage, party.id);
        expect(res.body.token).to.be.equal('NO_EMAILS_FOR_RECIPIENTS');
      });
    });

    describe('multiple recipients with templateData for quote', () => {
      beforeEach(() => {
        const contactInfoIds = [existingPartyMember.contactInfo.all[0].id, existingPartyMember2.contactInfo.all[0].id];
        emailMessage = {
          partyId: party.id,
          recipients: { contactInfos: contactInfoIds },
          message: {
            subject: 'test email',
          },
          type: 'Email',
          templateData: {
            templateName: DALTypes.TemplateNames.QUOTE,
          },
        };
      });

      it('will save a comm entry for each recipient with the original content as message', async () => {
        const quote = {
          id: 'sdc324-234aac',
          inventoryId: 'fc801145-e150-416d-be46-1890bc3a5a59',
          partyId: party.id,
          publishDate: '2016-08-12T18:04:40.758Z',
          expirationDate: now().add(2, 'days'),
          leaseStartDate: '2016-08-22T00:00:00.000Z',
          created_at: '2016-08-12T18:04:28.980Z',
          updated_at: '2016-08-12T18:04:28.980Z',
          propertyTimezone: LA_TIMEZONE,
        };

        emailMessage.templateData = {
          contentForComms: {
            anchorText: 'textContent',
          },
          partyMembers: [existingPartyMember, existingPartyMember2],
          ...quote,
          flattenedInventory: {
            timezone: LA_TIMEZONE,
          },
          emails: [existingPartyMember.contactInfo.all[0].value, existingPartyMember2.contactInfo.all[0].value],
          templateName: DALTypes.TemplateNames.QUOTE,
        };

        const res = await send(emailMessage);
        expect(res.status).to.deep.equal(200);
        const comms = await getAllComms(ctx);
        expect(comms.length).to.equal(2);
        expect(comms.find(p => p.persons.length === 1 && p.persons[0] === existingPartyMember.personId)).to.not.be.undefined;
        expect(comms.find(p => p.persons.length === 1 && p.persons[0] === existingPartyMember2.personId)).to.not.be.undefined;
      });
    });
  });

  describe('when saving a SMS communication', () => {
    let party;
    let existingPartyMember;
    let existingPartyMember2;
    let smsMessage;

    beforeEach(async () => {
      const { id: propertyId } = await createAProperty();
      await createATeamPropertyProgram({ teamId: team1.id, propertyId, commDirection: DALTypes.CommunicationDirection.OUT });
      party = await createAParty({ ownerTeam: team1.id, assignedPropertyId: propertyId });

      const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
      existingPartyMember = await createAPartyMember(party.id, {
        fullName: 'John Doe',
        contactInfo,
      });

      const contactInfo2 = enhance([{ type: 'phone', value: '0016502736664', id: newId() }]);
      existingPartyMember2 = await createAPartyMember(party.id, {
        fullName: 'Jane Doe',
        contactInfo: contactInfo2,
      });

      const contactInfoIds = [existingPartyMember.contactInfo.all[0].id, existingPartyMember2.contactInfo.all[0].id];

      smsMessage = {
        partyId: party.id,
        recipients: { contactInfos: contactInfoIds },
        message: {
          subject: 'test sms',
          content: 'test sms content',
        },
        type: 'Sms',
      };
    });

    it('has partial communication entity in response', async () => {
      const res = await send(smsMessage);
      expect(res.status).to.deep.equal(200);
      const [comm] = res.body;
      expect(comm.type).to.deep.equal('Sms');
      expect(comm).to.have.all.keys(commKeys);
    });

    it('preserves the threadId if passed into body', async () => {
      const threadId = newId();
      const res = await send({ ...smsMessage, threadId });

      expect(res.status).to.equal(200);
      const [comm] = res.body;
      expect(comm.threadId).to.equal(threadId);
    });

    it('has persons correctly assigned on the communication', async () => {
      const res = await send(smsMessage, party.id);
      const [comm] = res.body;
      expect(comm.persons.length).to.be.equal(2);
      expect(comm.persons.sort()).to.deep.equal([existingPartyMember.personId, existingPartyMember2.personId].sort());
    });

    describe('and none of the recipients has a phone number', () => {
      it('It should return a service error', async () => {
        smsMessage = {
          partyId: party.id,
          recipients: {
            contactInfos: [newId(), newId()],
          },
          message: {
            subject: 'test sms subject',
            content: 'test sms content',
          },
          type: 'Sms',
        };
        const res = await send(smsMessage, party.id);
        expect(res.body.token).to.be.equal('NO_PHONE_NUMBERS_FOR_RECIPIENTS');
      });
    });

    describe('when there are multiple recipients', () => {
      it('Only one communication entry will be saved', async () => {
        const res = await send(smsMessage);
        expect(res.status).to.deep.equal(200);
        const [comm] = res.body;
        expect(comm.type).to.deep.equal('Sms');
        const comms = await getAllComms(ctx);
        expect(comms.length).to.equal(1);
        expect(comms[0].persons.sort()).to.deep.equal([existingPartyMember.personId, existingPartyMember2.personId].sort());
      });
    });

    describe('when there there is a sms thread started on a specific team-property phone number and we reply to the sms thread', () => {
      it('the communication will be sent from the correct team-property phone number ', async () => {
        const firstTeam = await createATeam({
          name: 'firstTeam',
          module: 'leasing',
          email: 'test112@test.a',
          phone: '15417544229',
        });

        const secondTeam = await createATeam({
          name: 'secondTeamTeam',
          module: 'leasing',
          email: 'test1113@test.a',
          phone: '15417544230',
        });

        const threadId = newId();

        await createATeamMember({ teamId: firstTeam.id, userId: user.id });
        await createATeamMember({ teamId: secondTeam.id, userId: user.id });

        const { id: propertyId } = await createAProperty();
        const firstTeamPropertyDisplayPhone = '122222222222';
        const secondTeamPropertyDisplayPhone = '133333333333';
        await createATeamPropertyProgram({
          teamId: firstTeam.id,
          propertyId,
          displayPhoneNumber: firstTeamPropertyDisplayPhone,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });
        await createATeamPropertyProgram({
          teamId: secondTeam.id,
          propertyId,
          displayPhoneNumber: secondTeamPropertyDisplayPhone,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });

        const { id: partyId } = await createAParty({
          userId: user.id,
          teams: [team1.id],
          assignedPropertyId: propertyId,
          ownerTeam: firstTeam.id,
        });
        const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
        existingPartyMember = await createAPartyMember(party.id, {
          fullName: 'John Doe',
          contactInfo,
        });

        const contactInfoIds = [existingPartyMember.contactInfo.all[0].id];

        await createACommunicationEntry({
          parties: [partyId],
          threadId,
          type: DALTypes.CommunicationMessageType.SMS,
          message: {
            to: [`${secondTeamPropertyDisplayPhone}`],
          },
        });

        smsMessage = {
          partyId,
          recipients: { contactInfos: contactInfoIds },
          message: {
            subject: 'reply SMS',
            content: 'reply content',
          },
          type: 'Sms',
          threadId,
        };

        const res = await send(smsMessage);
        expect(res.status).to.deep.equal(200);
        const [comm] = res.body;
        expect(comm.type).to.deep.equal('Sms');
        const comms = await getAllComms(ctx);
        expect(comms.length).to.equal(2);
        const sentSms = comms.find(p => p.direction === DALTypes.CommunicationDirection.OUT);
        expect(sentSms.message.text).to.equal(smsMessage.message.content);
        expect(sentSms.message.from).to.equal(firstTeamPropertyDisplayPhone);
      });
    });

    describe('multiple recipients with templateData', () => {
      beforeEach(() => {
        const contactInfoIds = [existingPartyMember.contactInfo.all[0].id, existingPartyMember2.contactInfo.all[0].id];
        smsMessage = {
          partyId: party.id,
          recipients: { contactInfos: contactInfoIds },
          message: {
            subject: 'test sms',
            content: '{firstTag} test {secondTag} {unmachedTag}',
          },
          type: 'Sms',
          templateData: {
            template: '{url}',
          },
        };
      });

      describe("when there are multiple recipients and templateData is provided, but data can't be matched", () => {
        beforeEach(() => {
          const contactInfoIds = [existingPartyMember.contactInfo.all[0].id, existingPartyMember2.contactInfo.all[0].id];
          smsMessage = {
            partyId: party.id,
            recipients: { contactInfos: contactInfoIds },
            message: {
              subject: 'test sms',
              content: '{firstTag} test {secondTag} {mismatchedTag}',
            },
            type: 'Sms',
            templateData: {
              template: '{personId}',
            },
          };
        });

        it('will save a comm entry for each recipient with the original content as message', async () => {
          smsMessage.templateData.personalizedData = [
            {
              secondTag: existingPartyMember.personId,
            },
            {
              firstTag: existingPartyMember2.personId,
              secondTag: existingPartyMember2.personId,
            },
          ];

          smsMessage.templateData.commonData = {
            quoteId: 'sdc324-234aac',
          };

          smsMessage.templateData.recipients = [{ personId: 'scr334-af2431', preferredName: 'Maria' }];

          const res = await send(smsMessage);
          expect(res.status).to.deep.equal(200);
          const comms = await getAllComms(ctx);
          expect(comms.length).to.equal(2);
          [existingPartyMember, existingPartyMember2]
            .map(p => p.personId)
            .forEach(p =>
              expect(comms.find(c => c.persons.length === 1 && c.persons[0] === p).message.text).to.equal('{firstTag} test {secondTag} {mismatchedTag}'),
            );
        });
      });

      it('will save the resident(s) quote url link in the db', async () => {
        smsMessage.templateData.commonData = {
          quoteId: 'sdc324-234aac',
        };
        smsMessage.templateData.recipients = [existingPartyMember, existingPartyMember2];

        smsMessage.message.content = 'test message for [ Quote link ]';

        const res = await send(smsMessage);

        expect(res.status).to.deep.equal(200);
        const comms = await getAllComms(ctx);

        expect(comms.length).to.equal(2);

        [existingPartyMember, existingPartyMember2]
          .map(p => p.personId)
          .forEach(p => expect(comms.find(c => c.persons.length === 1 && c.persons[0] === p).message.text).to.contain('https://'));
      });
    });
  });

  describe('when loading communications for several parties', () => {
    describe('with party ids that are not uuids', () => {
      it('should respond with status code 400 and INCORRECT_PARTY_ID token', async () => {
        const { status, body } = await request(app)
          .post('/parties/communications')
          .set(getAuthHeader(tenant.id))
          .send({ partyIds: ['not-uuid'] });

        expect(status).to.equal(400);
        expect(body.token).to.equal('INCORRECT_PARTY_ID');
      });
    });

    describe('with missing party ids', () => {
      it('should respond with status code 400 and MISSING_PARTY_IDS token', async () => {
        const { status, body } = await request(app).post('/parties/communications').set(getAuthHeader(tenant.id)).send({ partyIds: [] });

        expect(status).to.equal(400);
        expect(body.token).to.equal('MISSING_PARTY_IDS');
      });
    });

    describe('with a user that is not authorized to modify any of the parties', () => {
      it('should respond with status code 403 and FORBIDDEN token', async () => {
        const team = await createATeam({
          name: 'team1',
          module: 'leasing',
          email: 'test1@test.a',
          phone: '15417544217',
        });
        await createATeamMember({ teamId: team.id, userId: user.id });
        const { id } = await createAParty({ userId: user.id, teams: [team.id] });
        const unauthorizedUser = createAUser();

        const { status, body } = await request(app)
          .post('/parties/communications')
          .set(getAuthHeader(tenant.id, unauthorizedUser.id))
          .send({ partyIds: [id] });

        expect(status).to.equal(403);
        expect(body.token).to.equal('FORBIDDEN');
      });
    });

    describe('when user is authorized to modify a party', () => {
      it('should respond with comms for accesible party', async () => {
        const firstTeam = await createATeam({
          name: 'firstTeam',
          module: 'leasing',
          email: 'test4@test.a',
          phone: '15417544217',
        });
        const user1 = await createAUser();
        await createATeamMember({ teamId: firstTeam.id, userId: user1.id });
        const { id: party1Id } = await createAParty({ userId: user1.id });

        const secondTeam = await createATeam({
          name: 'secondTeam',
          module: 'leasing',
          email: 'test8@test.a',
          phone: '15417544219',
        });

        const user2 = await createAUser();
        await createATeamMember({ teamId: secondTeam.id, userId: user2.id });
        const { id: party2Id } = await createAParty({ userId: user2.id });

        const accesibleComm = await createACommunicationEntry({
          parties: [party1Id, party2Id],
        });
        await createACommunicationEntry({ parties: [party2Id] }); // the unaccesible comm

        const { status, body } = await request(app)
          .post('/parties/communications')
          .set(getAuthHeader(tenant.id, user1.id))
          .send({ partyIds: [party1Id, party2Id] });

        expect(status).to.equal(200);
        expect(body.length).to.equal(1);
        expect(body[0].id).to.equal(accesibleComm.id);
      });
    });

    describe('when communications ids are sent as filters', () => {
      it('should respond with comms filtered by ids', async () => {
        const { id: partyId } = await createAParty({ userId: user.id });

        const comm = await createACommunicationEntry({ parties: [partyId] });
        await createACommunicationEntry({ parties: [partyId] }); // the unaccesible comm

        const { status, body } = await request(app)
          .post('/parties/communications')
          .set(getAuthHeader(tenant.id, user.id))
          .send({ partyIds: [partyId], ids: [comm.id] });

        expect(status).to.equal(200);
        expect(body.length).to.equal(1);
        expect(body[0].id).to.equal(comm.id);
      });
    });
  });

  describe('when loading the communications for a party', () => {
    describe('with a partyId that is not uuid', () => {
      it('should respond with status code 400 and INCORRECT_PARTY_ID token', done => {
        request(app)
          .get('/parties/some-invalid-uuid/communication')
          .set(getAuthHeader(tenant.id))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_PARTY_ID'))
          .end(done);
      });
    });

    describe('with party with unknown uuid', () => {
      const someUnknownUuid = 'f615f99e-dee4-4d92-b1cb-f2e673825a90';

      it('should respond with status code 404 and PARTY_NOT_FOUND token', done => {
        request(app)
          .get(`/parties/${someUnknownUuid}/communication`)
          .set(getAuthHeader(tenant.id))
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'))
          .end(done);
      });
    });

    describe('with a valid partyId ', () => {
      let party;
      let existingPartyMember;
      let existingPartyMember2;
      let recipients;
      const email = 'john.doe@test.com';
      const email2 = 'john.doe+1@test.com1';
      const phone = '12025550101';

      beforeEach(async () => {
        party = await createAParty({ userId: user.id });
        const contactInfo = enhance([
          { type: 'email', value: email, id: newId() },
          { type: 'phone', value: phone, id: newId() },
        ]);
        existingPartyMember = await createAPartyMember(party.id, {
          fullName: 'John Doe',
          contactInfo,
        });

        const contactInfo2 = enhance([{ type: 'email', value: email2, id: newId() }]);
        existingPartyMember2 = await createAPartyMember(party.id, {
          fullName: 'Jane Doe',
          contactInfo: contactInfo2,
        });

        recipients = [existingPartyMember.personId, existingPartyMember2.personId];
      });

      it('should return 200 and return the communication in the body', async () => {
        const comm = await createACommunicationEntry({
          parties: [party.id],
          persons: recipients,
          direction: DALTypes.CommunicationDirection.OUT,
        });

        const res = await request(app).get(`/parties/${party.id}/communication`).set(getAuthHeader(tenant.id, user.id));

        expect(res.status).to.deep.equal(200);
        expect(res.body[0].id).to.equal(comm.id);
      });

      it('should contain the array of persons', async () => {
        await createACommunicationEntry({
          parties: [party.id],
          persons: recipients,
          direction: DALTypes.CommunicationDirection.OUT,
        });

        const res = await request(app).get(`/parties/${party.id}/communication`).set(getAuthHeader(tenant.id, user.id));

        expect(res.body[0].persons).to.deep.equal(recipients);
      });

      it('should include nurture communications in the body and return 200', async () => {
        const comm = await createACommunicationEntry({
          parties: [party.id],
          persons: recipients,
          category: 'Nurture xxx',
          direction: DALTypes.CommunicationDirection.OUT,
        });

        const res = await request(app).get(`/parties/${party.id}/communication`).set(getAuthHeader(tenant.id, user.id));
        expect(res.status).to.deep.equal(200);
        expect(res.body[0].id).to.equal(comm.id);
      });

      it('should include undelivered communications in the body and return 200', async () => {
        const comm = await createACommunicationEntry({
          parties: [party.id],
          persons: recipients,
          direction: DALTypes.CommunicationDirection.OUT,
          status: { status: [{ status: DALTypes.CommunicationStatus.UNDELIVERED, address: email2 }] },
        });

        const res = await request(app).get(`/parties/${party.id}/communication`).set(getAuthHeader(tenant.id, user.id));
        expect(res.status).to.deep.equal(200);
        expect(res.body[0].id).to.equal(comm.id);
        expect(res.body[0].status.status[0].status).to.equal(DALTypes.CommunicationStatus.UNDELIVERED);
        expect(res.body[0].status.status[0].address).to.equal(email2);
      });

      it('should include bounced communications in the body and return 200', async () => {
        const comm = await createACommunicationEntry({
          parties: [party.id],
          persons: recipients,
          direction: DALTypes.CommunicationDirection.OUT,
          type: DALTypes.CommunicationMessageType.SMS,
          status: { status: [{ status: DALTypes.CommunicationStatus.BOUNCED, address: phone }] },
        });

        const res = await request(app).get(`/parties/${party.id}/communication`).set(getAuthHeader(tenant.id, user.id));
        expect(res.status).to.deep.equal(200);
        expect(res.body[0].id).to.equal(comm.id);
        expect(res.body[0].status.status[0].status).to.equal(DALTypes.CommunicationStatus.BOUNCED);
        expect(res.body[0].status.status[0].address).to.equal(phone);
      });

      it('should include failed communications in the body and return 200', async () => {
        const comm = await createACommunicationEntry({
          parties: [party.id],
          persons: recipients,
          direction: DALTypes.CommunicationDirection.OUT,
          type: DALTypes.CommunicationMessageType.SMS,
          status: { status: [{ status: DALTypes.CommunicationStatus.FAILED, address: phone }] },
        });

        const res = await request(app).get(`/parties/${party.id}/communication`).set(getAuthHeader(tenant.id, user.id));
        expect(res.status).to.deep.equal(200);
        expect(res.body[0].id).to.equal(comm.id);
        expect(res.body[0].status.status[0].status).to.equal(DALTypes.CommunicationStatus.FAILED);
        expect(res.body[0].status.status[0].address).to.equal(phone);
      });

      it('should include failed communications only for requested party in the body and return 200', async () => {
        const comm = await createACommunicationEntry({
          parties: [party.id],
          persons: recipients,
          direction: DALTypes.CommunicationDirection.OUT,
          type: DALTypes.CommunicationMessageType.SMS,
          status: { status: [{ status: DALTypes.CommunicationStatus.FAILED, address: phone }] },
        });

        const party2 = await createAParty({ userId: user.id });
        await createACommunicationEntry({
          parties: [party2.id],
          persons: recipients,
          direction: DALTypes.CommunicationDirection.OUT,
          type: DALTypes.CommunicationMessageType.SMS,
          status: { status: [{ status: DALTypes.CommunicationStatus.FAILED, address: phone }] },
        });
        const res = await request(app).get(`/parties/${party.id}/communication`).set(getAuthHeader(tenant.id, user.id));

        expect(res.status).to.deep.equal(200);
        expect(res.body.length).to.equal(1);
        expect(res.body[0].id).to.equal(comm.id);
        expect(res.body[0].status.status[0].status).to.equal(DALTypes.CommunicationStatus.FAILED);
        expect(res.body[0].status.status[0].address).to.equal(phone);
      });
    });
  });
});

describe('API/communications', () => {
  let commEntry1;
  let commEntry2;
  let storedComm;
  let partyOwner;
  let partyId;

  beforeEach(async () => {
    partyOwner = await createAUser();
    const party = await createAParty({ userId: partyOwner.id });
    partyId = party.id;

    const contactInfo = enhance([
      {
        type: 'email',
        value: 'j.r.r.tolkien@middleearth.com',
        id: newId(),
      },
    ]);
    const { personId: p1 } = await createAPartyMember(partyId, {
      fullName: 'J.R.R. Tolkien',
      contactInfo,
    });

    const contactInfo2 = enhance([
      {
        type: 'email',
        value: 'christopher.tolkien@middleearth.com',
        id: newId(),
      },
    ]);
    const { personId: p2 } = await createAPartyMember(partyId, {
      fullName: 'Christopher Tolkien',
      contactInfo: contactInfo2,
    });

    commEntry1 = {
      id: newId(),
      message: {
        subject: 'The Hobbit',
        text: 'In a hole in the ground there lived a hobbit...',
      },
      unread: true,
      parties: [partyId],
      persons: [p1, p2],
      threadId: newId(),
      type: DALTypes.CommunicationMessageType.EMAIL,
      direction: DALTypes.CommunicationDirection.IN,
      category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
    };

    await storeMessage({ tenantId: tenant.id }, commEntry1);

    commEntry2 = {
      id: newId(),
      message: {
        subject: 'Re: The Hobbit',
        text: 'Not a nasty, dirty, wet hole, filled with the ends of worms...',
      },
      unread: true,
      parties: [partyId],
      persons: [p1, p2],
      type: DALTypes.CommunicationMessageType.EMAIL,
      direction: DALTypes.CommunicationDirection.OUT,
      category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
    };

    storedComm = await storeMessage({ tenantId: tenant.id }, commEntry2);

    const contactInfo3 = enhance([{ type: 'email', value: 'george.martin@westeros.com', id: newId() }]);
    const { personId: p3 } = await createAPartyMember(partyId, {
      fullName: 'George R.R. Martin',
      contactInfo: contactInfo3,
    });

    const commEntry3 = {
      id: newId(),
      message: {
        subject: 'Winds of Winter',
        text: 'Comming soon...',
      },
      unread: true,
      parties: [partyId],
      persons: [p3],
      type: DALTypes.CommunicationMessageType.EMAIL,
      direction: DALTypes.CommunicationDirection.OUT,
      category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
    };

    await storeMessage({ tenantId: tenant.id }, commEntry3);
  });

  describe('when updating communications', () => {
    const delta = {
      unread: false,
      type: DALTypes.CommunicationMessageType.SMS,
    };

    describe('by communication ids', () => {
      describe('when a communication id is not valid', () => {
        it('should respond with status code 400 and the INCORRECT_COMM_ID', async () => {
          const { status, body } = await request(app)
            .patch('/communications')
            .set(getAuthHeader(tenant.id))
            .send({ delta, communicationIds: ['not-a-uuid'] });

          expect(status).to.equal(400);
          expect(body.token).to.equal('INCORRECT_COMM_ID');
        });
      });

      it('should respond with status code 200 and the updated communication entities', async () => {
        const { status, body } = await request(app)
          .patch('/communications')
          .set(getAuthHeader(tenant.id))
          .send({ delta, communicationIds: [storedComm.id] });

        expect(status).to.equal(200);
        expect(body.length).to.equal(1);

        expect(body[0].type).to.equal(DALTypes.CommunicationMessageType.SMS);

        expect(body[0].unread).to.be.false;
      });
    });

    describe('by communication id', () => {
      it('should respond with status code 200 and the updated communication entities', async () => {
        const { status, body } = await request(app).patch(`/communications/?id=${storedComm.id}`).set(getAuthHeader(tenant.id)).send({ delta });

        expect(status).to.equal(200);
        expect(body.length).to.equal(1);

        expect(body[0].type).to.equal(DALTypes.CommunicationMessageType.SMS);
        expect(body[0].unread).to.be.false;
      });
    });

    describe('when loading a communication with a commId that is not uuid', () => {
      it('should respond with status code 400 and INVALID_COMM_ID token', () => {
        request(app)
          .get('/communications/some-invalid-uuid')
          .set(getAuthHeader())
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_COMM_ID'));
      });
    });

    describe('when loading a communication with a known uuid', () => {
      it('should respond with status code 200 and the communication keys in reponse body', async () => {
        await request(app)
          .get(`/communications/${storedComm.id}`)
          .set(getAuthHeader())
          .expect(200)
          .expect(res => expect(res.body).to.have.all.keys(commKeys));
      });
    });
  });

  describe('when the communication is read by the party owner', () => {
    it('should mark the communication as read', async () => {
      const { status, body } = await request(app)
        .patch(`/communications/thread/${commEntry1.threadId}/markAsRead`)
        .set(getAuthHeader(tenant.id, partyOwner.id))
        .send();

      expect(status).to.equal(200);
      expect(body.length).to.equal(1);

      expect(body[0].unread).to.be.false;
      expect(body[0].readBy).to.equal(partyOwner.id);
      expect(body[0].readAt).to.not.be.null;
    });
  });

  describe('when the communication is read by an agent that is not the party owner', () => {
    it('should NOT mark the communication as read', async () => {
      const notPartyOwner = await createAUser();

      const { status, body } = await request(app)
        .patch(`/communications/thread/${commEntry1.threadId}/markAsRead`)
        .set(getAuthHeader(tenant.id, notPartyOwner.id))
        .send();

      expect(status).to.equal(200);
      expect(body.length).to.equal(0);

      const comm = await loadMessageById(ctx, commEntry1.id);
      expect(comm.unread).to.be.true;
      expect(comm.readBy).to.be.null;
      expect(comm.readAt).to.be.null;
    });
  });

  describe('when the communication is read by an agent that is not the party owner', () => {
    it('should mark the communication as read if the owner team is an RS team and the party is an active lease', async () => {
      const notPartyOwner = await createAUser();
      const rsTeam = await createATeam({ name: 'rsTeam', module: DALTypes.ModuleType.RESIDENT_SERVICES, email: 'test+rs@test.com' });
      await updateParty(ctx, { id: partyId, workflowName: DALTypes.WorkflowName.ACTIVE_LEASE, ownerTeam: rsTeam.id });

      const { status, body } = await request(app)
        .patch(`/communications/thread/${commEntry1.threadId}/markAsRead`)
        .set(getAuthHeader(tenant.id, notPartyOwner.id))
        .send();

      expect(status).to.equal(200);
      expect(body.length).to.equal(1);

      expect(body[0].unread).to.be.false;
      expect(body[0].readBy).to.equal(notPartyOwner.id);
      expect(body[0].readAt).to.not.be.null;
    });
  });

  describe('when the communication is read by an agent that is not the party owner', () => {
    it('should not mark the communication as read if the owner team is an RS team and the party is not an active lease', async () => {
      const notPartyOwner = await createAUser();
      const rsTeam = await createATeam({ name: 'rsTeam', module: DALTypes.ModuleType.RESIDENT_SERVICES, email: 'test+rs@test.com' });
      await updateParty(ctx, { id: partyId, workflowName: DALTypes.WorkflowName.NEW_LEASE, ownerTeam: rsTeam.id });

      const { status, body } = await request(app)
        .patch(`/communications/thread/${commEntry1.threadId}/markAsRead`)
        .set(getAuthHeader(tenant.id, notPartyOwner.id))
        .send();

      expect(status).to.equal(200);
      expect(body.length).to.equal(0);

      const comm = await loadMessageById(ctx, commEntry1.id);
      expect(comm.unread).to.be.true;
      expect(comm.readBy).to.be.null;
      expect(comm.readAt).to.be.null;
    });
  });
});

describe('API/communications/sms/computeThreadId', () => {
  describe('when persons with specified IDs do not exists', () => {
    it('should respond with status code 404 and PERSON_NOT_FOUND token', async () => {
      const res = await request(app)
        .post('/communications/sms/computeThreadId')
        .set(getAuthHeader())
        .send({ personIds: [newId(), newId()] });

      expect(res.status).to.equal(404);
      expect(res.body.token).to.equal('PERSON_NOT_FOUND');
    });
  });

  describe('when specified persons do not share a phone number with other persons', () => {
    it('should respond with computed threadId based on specified persons', async () => {
      const contactInfo = enhance([{ type: 'phone', value: '12025550101', id: newId() }]);
      const { id: personId } = await createAPerson('Paul Atreides', "Muad'Dib", contactInfo);

      const res = await request(app)
        .post('/communications/sms/computeThreadId')
        .set(getAuthHeader())
        .send({ personIds: [personId] });

      const expectedThreadId = computeThreadId(DALTypes.CommunicationMessageType.SMS, [personId]);
      expect(res.body).to.equal(expectedThreadId);
    });
  });

  describe('when specified persons share a phone number with other persons', () => {
    it('should respond with computed threadId based on all persons sharing phone number', async () => {
      const contactInfo1 = enhance([{ type: 'phone', value: '12025550101', id: newId() }]);
      const { id: personId1 } = await createAPerson('Paul Atreides', "Muad'Dib", contactInfo1);

      const contactInfo2 = enhance([{ type: 'phone', value: '12025550101', id: newId() }]);
      const { id: personId2 } = await createAPerson('Alia Atreides', 'Alia', contactInfo2);

      const res = await request(app)
        .post('/communications/sms/computeThreadId')
        .set(getAuthHeader())
        .send({ personIds: [personId1] });

      const expectedThreadId = computeThreadId(DALTypes.CommunicationMessageType.SMS, [personId1, personId2]);
      expect(res.body).to.equal(expectedThreadId);
    });
  });
});
