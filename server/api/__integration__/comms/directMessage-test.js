/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import Promise from 'bluebird';
import newId from 'uuid/v4';
import config from '../../../config';
import app from '../../api';
import {
  testCtx as ctx,
  createAUser,
  createATeam,
  createATeamMember,
  createAPerson,
  createAProperty,
  createAParty,
  createAPartyMember,
  createACommunicationEntry,
  createATeamPropertyProgram,
  createATeamProperty,
} from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { saveContactInfo } from '../../../dal/contactInfoRepo';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { setupConsumers } from '../../../workers/consumer';
import { waitFor, getAuthHeader } from '../../../testUtils/apiHelper';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../../workers/communication/inboundEmailHandler';
import { loadParties } from '../../../dal/partyRepo';
import { getAllComms } from '../../../dal/communicationRepo';
import { postSms } from '../../../testUtils/telephonyHelper';
import { getActivityLogsByParty } from '../../../dal/activityLogRepo';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../../common/enums/activityLogTypes';

describe('/directMessages', () => {
  describe('POST', () => {
    const messageId = newId().toString();
    const mailData = { Bucket: 'test', Key: messageId };
    const fromEmail = 'rhaenys@test.com';
    const fromPhone = '12094458888';
    const programEmailIdentifier = 'program-email-identifier';
    const programDirectPhoneIdentifier = '12025550130';

    let user;
    let team;
    let programPropertyId;
    let person;
    let existingParty;
    let directMessageId;
    let contactInfosFull;
    let directMessageComm;

    const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;

    const setupMessageQueueForEmail = async (msgId, condition = (m, handlerSucceeded) => m.Key === msgId && handlerSucceeded) => {
      const { resolvers, promises } = waitFor([condition]);
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['mail']);

      return { task: Promise.all(promises) };
    };
    let matcher;

    const setupMsgQueueAndWaitFor = async (conditions, workerKeysToBeStarted) => {
      matcher = createResolverMatcher();

      const { resolvers, promises } = waitFor(conditions);
      matcher.addWaiters(resolvers);
      await setupConsumers(chan(), matcher, workerKeysToBeStarted);
      return { task: Promise.all(promises) };
    };

    beforeEach(async () => {
      setDeleteS3MailFunction(() => true);
      user = await createAUser({
        ctx,
        name: 'Aegon',
        email: 'user1+test@test.com',
        status: DALTypes.UserStatus.AVAILABLE,
      });
      team = await createATeam({ name: 'testTeam', module: 'leasing' });
      programPropertyId = (await createAProperty()).id;
      await createATeamProperty(team.id, programPropertyId);

      await createATeamMember({
        teamId: team.id,
        userId: user.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name],
        },
        directEmailIdentifier: 'teamMember1',
        outsideDedicatedEmails: [`outside+email@${tenant.name}.com`],
        directPhoneIdentifier: '12025550190',
      });

      await createATeamPropertyProgram({
        teamId: team.id,
        propertyId: programPropertyId,
        directEmailIdentifier: programEmailIdentifier,
        directPhoneIdentifier: programDirectPhoneIdentifier,
        commDirection: DALTypes.CommunicationDirection.IN,
      });

      person = await createAPerson();
      const contactInfos = [
        {
          type: 'email',
          value: fromEmail,
        },
        {
          type: 'phone',
          value: fromPhone,
        },
      ];
      contactInfosFull = await saveContactInfo(ctx, contactInfos, person.id);

      existingParty = await createAParty({
        teams: [team.id],
        state: DALTypes.PartyStateType.RESIDENT,
        assignedPropertyId: programPropertyId,
        userId: user.id,
        ownerTeam: team.id,
      });
      await createAPartyMember(existingParty.id, { personId: person.id });
      directMessageId = newId();
      directMessageComm = await createACommunicationEntry({
        parties: [existingParty.id],
        persons: [person.id],
        direction: DALTypes.CommunicationDirection.IN,
        type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
        threadId: newId(),
        category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
        message: {
          text: 'Random direct message for testing purposes',
          from: person.fullName,
          to: null,
        },
        userId: null,
        teams: [existingParty.ownerTeam],
        messageId: directMessageId,
        unread: true,
      });
    });

    describe('when receiving a new incomming email from the same party member', () => {
      it('a new raw lead is NOT created and the comm is associated with the existing party and a new comm thread is created', async () => {
        const testData = {
          To: programDirectPhoneIdentifier,
          From: fromPhone,
          TotalRate: '0',
          Units: '1',
          Text: 'Test incoming SMS message to a phone alias!',
          TotalAmount: '0',
          Type: 'sms',
          MessageUUID: messageId,
        };

        const condition = msg => msg.MessageUUID === messageId;
        const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        // new lead is NOT created
        const parties = await loadParties(ctx);
        expect(parties.length).to.be.equal(1);

        const [party] = parties;
        expect(party.id).to.equal(existingParty.id);

        const comms = await getAllComms(ctx);
        expect(comms.length).to.be.equal(2);

        const commForDirectMessage = comms.find(c => c.messageId === directMessageId);
        const commForSMS = comms.find(c => c.messageId !== directMessageId);

        expect(commForDirectMessage.threadId).to.not.equal(commForSMS.threadId);
        expect(commForSMS.parties.sort()).to.deep.equal([existingParty.id]);
        expect(commForDirectMessage.parties.sort()).to.deep.equal([existingParty.id]);
      });
    });

    describe('when receiving a new incomming sms from the same party member', () => {
      it('a new raw lead is NOT created and the comm is associated with the existing party and a new comm thread is created', async () => {
        const emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${programEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: fromEmail,
            from_name: person.fullName,
            text: 'test email',
            subject: 'test subject',
            messageId,
          },
        };
        setGetEmailDetailsFunction(() => emailDetails);

        const condition = m => m.Key === messageId;

        const { task } = await setupMessageQueueForEmail(messageId, condition);

        await request(app).post(postEmailUrl).send(mailData).expect(200);
        await task;

        // new lead is NOT created
        const parties = await loadParties(ctx);
        expect(parties.length).to.be.equal(1);

        const [party] = parties;
        expect(party.id).to.equal(existingParty.id);

        const comms = await getAllComms(ctx);
        expect(comms.length).to.be.equal(2);
        const commForDirectMessage = comms.find(c => c.messageId === directMessageId);

        const commForEmail = comms.find(c => c.messageId === messageId);

        expect(commForDirectMessage.threadId).to.not.equal(commForEmail.threadId);
        expect(commForEmail.parties.sort()).to.deep.equal([existingParty.id]);
        expect(commForDirectMessage.parties.sort()).to.deep.equal([existingParty.id]);
      });
    });

    describe('when saving a direct message draft for a party', () => {
      it('it is persisted correctly for the user and party', async () => {
        const content = 'Draft content for direct message';
        const draft = {
          id: '',
          recipients: { contactInfos: [contactInfosFull[0].id] },
          message: { content },
          type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
          partyId: existingParty.id,
          userId: user.id,
        };
        await request(app).post('/communications/draft').set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

        const result = await request(app).get(`/communications/drafts/${user.id}/${existingParty.id}`).set(getAuthHeader(tenant.id)).expect(200);

        expect(result.body).to.not.be.null;
        expect(result.body.length).to.equal(1);
        expect(result.body[0].data).is.not.null;

        expect(result.body[0].data.content).to.equal(content);
        expect(result.body[0].type).to.equal(DALTypes.CommunicationMessageType.DIRECT_MESSAGE);
      });
    });

    describe('when saving a direct message communication draft for a party', () => {
      it('it is not retrieved for a different user for the same party', async () => {
        const content = 'Draft content for direct message';
        const draft = {
          id: '',
          recipients: { contactInfos: [contactInfosFull[0].id] },
          message: { content },
          type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
          partyId: existingParty.id,
          userId: user.id,
        };
        await request(app).post('/communications/draft').set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

        const differentUser = await createAUser();
        const result = await request(app).get(`/communications/drafts/${differentUser.id}/${existingParty.id}`).set(getAuthHeader(tenant.id)).expect(200);

        expect(result.body).to.not.be.null;
        expect(result.body.length).to.equal(0);
      });
    });

    describe('after deleting a direct message communication draft for a party', () => {
      it('it is no longer retrieved', async () => {
        const content = 'Draft content for direct message';
        const draft = {
          id: '',
          recipients: { contactInfos: [contactInfosFull[0].id] },
          message: { content },
          type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
          partyId: existingParty.id,
          userId: user.id,
        };
        await request(app).post('/communications/draft').set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

        let result = await request(app).get(`/communications/drafts/${user.id}/${existingParty.id}`).set(getAuthHeader(tenant.id)).expect(200);

        expect(result.body).to.not.be.null;
        expect(result.body.length).to.equal(1);
        const savedDraft = result.body[0];

        await request(app).delete(`/communications/drafts/${savedDraft.id}`).set(getAuthHeader(tenant.id)).send({ draft }).expect(200);

        result = await request(app).get(`/communications/drafts/${user.id}/${existingParty.id}`).set(getAuthHeader(tenant.id)).expect(200);

        expect(result.body).to.not.be.null;
        expect(result.body.length).to.equal(0);
      });
    });

    describe('when an agent replies to a direct communication on the party', () => {
      it('the communication reply is set correctly and activity log should be added', async () => {
        const content = 'reply for direct message';
        await request(app)
          .post('/communications')
          .set(getAuthHeader(tenant.id))
          .send({
            recipients: { contactInfos: [contactInfosFull[0].value] },
            message: { content },
            type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
            partyId: existingParty.id,
            userId: user.id,
            threadId: directMessageComm.threadId,
          })
          .expect(200);
        const parties = await loadParties(ctx);
        expect(parties.length).to.be.equal(1);

        const [party] = parties;
        expect(party.id).to.equal(existingParty.id);

        const comms = await getAllComms(ctx);
        expect(comms.length).to.be.equal(2);

        const commForDirectMessage = comms.find(c => c.messageId === directMessageId);
        const commForReply = comms.find(c => c.messageId !== directMessageId);

        expect(commForDirectMessage.threadId).to.equal(commForReply.threadId);
        expect(commForReply.parties.sort()).to.deep.equal([existingParty.id]);
        expect(commForDirectMessage.parties.sort()).to.deep.equal([existingParty.id]);

        expect(commForReply.messageId).to.not.be.null;
        expect(commForReply.direction).to.equal(DALTypes.CommunicationDirection.OUT);
        expect(commForReply.type).to.equal(DALTypes.CommunicationMessageType.DIRECT_MESSAGE);
        expect(commForReply.category).to.equal(DALTypes.CommunicationCategory.USER_COMMUNICATION);

        const activityLogs = await getActivityLogsByParty(ctx, existingParty.id);

        expect(activityLogs.length).to.equal(1);
        const log = activityLogs[0];

        expect(log.type).to.equal(ACTIVITY_TYPES.NEW);
        expect(log.component).to.equal(COMPONENT_TYPES.DIRECT_MESSAGE);
        expect(log.details.id).to.equal(commForReply.id);
        expect(log.details.partyId).to.equal(existingParty.id);
        expect(log.details.to[0]).to.equal(person.fullName);
      });
    });
  });
});
