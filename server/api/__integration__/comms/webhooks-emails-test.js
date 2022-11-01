/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import newId from 'uuid/v4';
import config from '../../../config';
import { NoRetryError } from '../../../common/errors';
import app from '../../api';
import { setupConsumers } from '../../../workers/consumer';
import { waitFor } from '../../../testUtils/apiHelper';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { updateTeam } from '../../../dal/teamsRepo';
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
  createAPersonContactInfo,
  createATeamPropertyProgram,
  createATeamProperty,
  createASource,
  createAProgram,
} from '../../../testUtils/repoHelper';
import { update } from '../../../database/factory';
import { saveContactInfo } from '../../../dal/contactInfoRepo';
import { getAllSpamCommunications } from '../../../dal/blacklistRepo';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../../workers/communication/inboundEmailHandler';
import { loadParties } from '../../../dal/partyRepo';
import { getAllComms } from '../../../dal/communicationRepo';
import { loadProgramForIncomingCommByEmail } from '../../../dal/programsRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getEmailAddressWithoutDomain } from '../../../../common/helpers/utils';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { parseEmail } from '../../../workers/communication/aws/awsUtils.js';
const readFile = Promise.promisify(fs.readFile);
import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'webhooks-emails-test' });
import { saveMarketingContactData } from '../../../dal/marketingContactRepo';
import { getEmailIdentifierFromUuid } from '../../../../common/helpers/strings';
import { now } from '../../../../common/helpers/moment-utils';
import { removePartyMember } from '../../../services/party.js';
import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';
import { EMAIL_UNIQUE_CONSTRAINT_ERROR, DUPLICATE_EMAIL_TIME_INTERVAL_MIN } from '../../../helpers/mails';

describe('/webhooks/email', () => {
  describe('POST', () => {
    const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;
    const postEmailStatus = `/webhooks/email/status?api-token=${config.tokens.api}`;
    let matcher;

    const setupMessageQueueForEmail = async (msgId, condition = (m, handlerSucceeded) => m.Key === msgId && handlerSucceeded) => {
      const { resolvers, promises } = waitFor(msgId ? [condition] : []);
      matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['mail']);

      return { task: Promise.all(promises) };
    };

    describe('Given a valid request', () => {
      it('will return 200', async () => {
        const testData = {
          Bucket: 'test',
          Key: newId().toString(),
        };
        await request(app).post(postEmailUrl).send(testData).expect(200);
      });
    });

    describe('Given an invalid request', () => {
      it('will return 400', async () => {
        const testData = {
          Key: newId().toString(),
        };
        await request(app).post(postEmailUrl).send(testData).expect(400);
      });
    });

    describe('Given an invalid api token', () => {
      it('will return 401', async () => {
        await request(app).post('/webhoooks/email?api-token=123').expect(401);
      });
    });

    describe('/status', () => {
      describe('given a valid request', () => {
        it('will return 200', async () => {
          const testData = {
            email: 'test@test.com',
            messageId: newId().toString(),
            type: 'Delivered',
          };
          await request(app).post(postEmailStatus).send(testData).expect(200);
        });
      });

      describe('given an invalid request', () => {
        it('will return 400', async () => {
          const testData = {
            email: 'test@test.com',
          };
          await request(app).post(postEmailStatus).send(testData).expect(400);
        });
      });

      describe('Given an invalid api token', () => {
        it('will return 401', async () => {
          await request(app).post('/webhoooks/email/status?api-token=123').expect(401);
        });
      });
    });

    describe('mail processing', () => {
      const messageId = newId().toString();
      const mailData = { Bucket: 'test', Key: messageId };
      const fromEmail = 'rhaenys@test.com';
      const programEmailIdentifier = 'program-email-identifier';
      let programId;
      let emailDetails;
      let user;
      let team;
      let teamMember;
      let programPropertyId;
      let propertyTimezone;

      const getEmailDetails = (msgId = messageId) => ({
        event: 'inbound',
        msg: {
          emails: [`${teamMember.directEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
          from_email: fromEmail,
          from_name: 'rhaenys',
          text: 'quertyiop',
          subject: 'querty',
          messageId: msgId,
        },
      });

      beforeEach(async () => {
        setDeleteS3MailFunction(() => true);
        user = await createAUser({
          ctx,
          name: 'Aegon',
          email: 'user1+test@test.com',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        team = await createATeam({ name: 'testTeam', module: 'leasing' });
        const property = await createAProperty();
        programPropertyId = property.id;
        propertyTimezone = property.timezone;
        await createATeamProperty(team.id, programPropertyId);

        teamMember = await createATeamMember({
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

        const teamPropertyProgram = await createATeamPropertyProgram({
          teamId: team.id,
          propertyId: programPropertyId,
          directEmailIdentifier: programEmailIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        programId = teamPropertyProgram.programId;

        emailDetails = getEmailDetails(messageId);
      });

      it(`when receiving an email from an unknown originator to a team member address
        a raw lead is created and a comm entry is saved`, async () => {
        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(parties[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);
        expect(parties[0].userId).to.equal(user.id);
        expect(parties[0].teams).to.deep.equal([team.id]);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
      });

      it(`when receiving an email from an unknown originator to a team member address
        and Reply-To is set, a raw lead is created and a comm entry is saved as originating from Reply-To`, async () => {
        const fileEmailDetails = async () => {
          const filePath = path.resolve(path.dirname(__dirname), 'resources', 'single-reply-to.eml');
          const email = await readFile(filePath, 'utf8');
          const parsed = await parseEmail(ctx, Buffer.from(email));
          // the single-reply-to.eml is a message from lead@apartments.com and that emails should be processed with the ILS email parser
          // and to avoid extracting the email and contact name information from the email body we need to update the sender
          // because the idea of this test is take the imformation from the Reply-To
          parsed.msg = {
            ...parsed.msg,
            from_email: parsed.msg.from_email.replace('.com', '.net'),
            emails: [`${teamMember.directEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          };
          return parsed;
        };

        setGetEmailDetailsFunction(fileEmailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        logger.trace({ ctx }, `Email created party: ${JSON.stringify(parties, null, 2)}`);
        expect(parties.length).to.equal(1);
        expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(parties[0].partyMembers[0].fullName).to.equal('Jean Luc Picard');
        expect(parties[0].partyMembers[0].contactInfo.defaultEmail).to.equal('jean.luc.picard@reva.tech'); // ENGAGE
        expect(parties[0].userId).to.equal(user.id);
        expect(parties[0].teams).to.deep.equal([team.id]);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
      });

      it(`when receiving an email from an email that is marked as spam to a team member address
        no raw lead is created and the email is added to the spam communication table`, async () => {
        const { id: personId } = await createAPerson();
        const contactInfos = [
          {
            type: 'email',
            value: fromEmail,
            isSpam: true,
          },
        ];
        await saveContactInfo(ctx, contactInfos, personId);

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(0);

        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(0);

        const commSpamEntries = await getAllSpamCommunications(ctx);
        expect(commSpamEntries).to.have.length(1);
      });

      it(`when receiving an email from an email with uppercase letters that is marked as spam to a team member address
        no raw lead is created and the email is added to the spam communication table`, async () => {
        const { id: personId } = await createAPerson();
        const contactInfos = [
          {
            type: 'email',
            value: 'rHaenYs@TeSt.com',
            isSpam: true,
          },
        ];
        await saveContactInfo(ctx, contactInfos, personId);

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(0);

        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(0);

        const commSpamEntries = await getAllSpamCommunications(ctx);
        expect(commSpamEntries).to.have.length(1);
      });

      it(`when receiving an email from an unknown originator to a team member address and user belongs to two teams,
        a raw lead is created and assigned target team`, async () => {
        const secondTeam = await createATeam({ name: 'testTeam2', module: 'leasing' });
        await createATeamMember({ teamId: secondTeam.id, userId: user.id });

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);
        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(parties[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);
        expect(parties[0].userId).to.equal(user.id);
        expect(parties[0].teams).to.deep.equal([team.id]);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
      });

      it(`when receiving an email from a known originator,
        a raw lead will NOT be created if there already is a lead created for that team (even on a different property)`, async () => {
        const { id: personId } = await createAPerson();
        const contactInfos = [
          {
            type: 'email',
            value: fromEmail,
          },
        ];
        await saveContactInfo(ctx, contactInfos, personId);

        const property = await createAProperty();

        const programIdentifier = 'program-identifier';
        await createATeamPropertyProgram({
          teamId: team.id,
          propertyId: property.id,
          directEmailIdentifier: programIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        const { id } = await createAParty({
          userId: user.id,
          teams: [team.id],
          assignedPropertyId: property.id,
        });
        await createAPartyMember(id, {
          personId,
        });

        const { task } = await setupMessageQueueForEmail(messageId);

        emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: fromEmail,
            from_name: 'rhaenys',
            text: 'quertyiop',
            subject: 'querty',
            messageId,
          },
        };
        setGetEmailDetailsFunction(() => emailDetails);

        await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: messageId }).expect(200);

        await task;
        const parties = await loadParties(ctx, partyWfStatesSubset.all);
        expect(parties.length).to.equal(1);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
      });

      it(`when receiving an email from an unknown originator to a teamMember address which is part of a team with an associatedTeam relationship,
        raw lead is created and assigned to the teamMember team + the associated Team`, async () => {
        const hubTeam = await createATeam({ name: 'hubTeam', module: 'leasing' });

        team = await updateTeam(ctx, team.id, {
          metadata: {
            associatedTeamNames: 'hubTeam',
          },
        });

        const secondTeam = await createATeam({ name: 'testTeam2', module: 'leasing', metadata: { associatedTeamNames: 'hubTeam' } });
        await createATeamMember({ teamId: secondTeam.id, userId: user.id });

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);
        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(parties[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);
        expect(parties[0].userId).to.equal(user.id);
        expect(parties[0].teams.sort()).to.deep.equal([team.id, hubTeam.id].sort());
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
      });

      it(`when receiving an email from an unknown originator to a program address
        a raw lead is created and a comm entry is saved`, async () => {
        emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${programEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: 'rhaenys@test.com',
            from_name: 'rhaenys',
            text: 'quertyiop',
            subject: 'querty',
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);
        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(parties[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);
        expect(parties[0].teams).to.deep.equal([team.id]);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
      });

      it(`when receiving an email from an unknown originator to a marketing contact address
        a raw lead is created and the marketing session id is saved`, async () => {
        const marketingSessionId = newId();
        const emailIdentifier = `${programEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}`;
        const contact = { emailIdentifier };

        await saveMarketingContactData(ctx, { marketingSessionId, contact, programId });

        emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${emailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: 'rhaenys@test.com',
            from_name: 'rhaenys',
            text: 'quertyiop',
            subject: 'querty',
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);
        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const [party] = await loadParties(ctx);
        expect(party).to.be.ok;
        expect(party.state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(party.partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);
        expect(party.teams).to.deep.equal([team.id]);
        expect(party.metadata).to.be.ok;
        expect(party.metadata.marketingSessionId).to.equal(marketingSessionId);
        expect(party.teamPropertyProgramId).to.be.ok;
      });

      it(`when receiving an email from an unknown originator to a program address which corespond to a team that has an associated team,
        raw lead is created and assigned to the team and to the associatedTeam`, async () => {
        const hubTeam = await createATeam({ name: 'hubTeam', module: 'leasing' });
        const team2 = await createATeam({ name: 'testTeam2', module: 'leasing', metadata: { associatedTeamNames: 'hubTeam' } });

        const programIdentifier = 'program-identifier';
        const { id: propertyId } = await createAProperty();
        await createATeamPropertyProgram({
          teamId: team2.id,
          propertyId,
          directEmailIdentifier: programIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: 'rhaenys@test.com',
            from_name: 'rhaenys',
            text: 'quertyiop',
            subject: 'querty',
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        await createATeamMember({
          teamId: team2.id,
          userId: user.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          },
        });

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);
        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(parties[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);
        expect(parties[0].userId).to.equal(user.id);
        expect(parties[0].teams.sort()).to.deep.equal([team2.id, hubTeam.id].sort());
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
      });

      it(`when receiving an email to a program address and there is already a party created for the sender, but the associatedPropertyId is not set for the existing party,
        a new party should be created and associated with the program's property`, async () => {
        const firstMsgId = newId();
        const secondMsgId = newId();

        const hubTeam = await createATeam({ name: 'hubTeam', module: 'leasing' });
        const { id: firstPropertyId } = await createAProperty();
        const { id: secondPropertyId } = await createAProperty();
        // we need to have two properties associated with this team;
        // this is to make sure that the associatedPropertyId will not be set for the first party (party created from incoming comm on team member address (Business Card scenario))
        await createATeamProperty(team.id, firstPropertyId);
        await createATeamProperty(team.id, secondPropertyId);

        const hubMember = await createATeamMember({
          teamId: hubTeam.id,
          userId: user.id,
          directEmailIdentifier: 'hubMemberEmailIdentifier',
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          },
        });

        // first email - sent on team member's email address
        emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${hubMember.directEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: 'rhaenys@test.com',
            from_name: 'rhaenys',
            text: 'quertyiop',
            subject: 'querty',
            messageId: firstMsgId,
          },
        };
        setGetEmailDetailsFunction(() => emailDetails);

        const firstCondition = m => m.Key === firstMsgId;
        const secondCondition = m => m.Key === secondMsgId;

        const { resolvers, promises } = waitFor([firstCondition, secondCondition]);
        const resolverMatcher = createResolverMatcher(resolvers);
        await setupConsumers(chan(), resolverMatcher, ['mail']);

        await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: firstMsgId }).expect(200);

        await promises[0];

        let parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        const firstParty = parties[0];
        expect(firstParty.assignedPropertyId).to.equal(null);

        // second email - sent on a program email address
        const programIdentifier = 'program-identifier';
        const { id: propertyId } = await createAProperty();
        await createATeamPropertyProgram({
          teamId: hubTeam.id,
          propertyId,
          directEmailIdentifier: programIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: 'rhaenys@test.com',
            from_name: 'rhaenys',
            text: 'quertyiop',
            subject: 'querty',
            messageId: secondMsgId,
          },
        };
        setGetEmailDetailsFunction(() => emailDetails);

        await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: secondMsgId }).expect(200);

        await promises[1];

        parties = await loadParties(ctx);
        const firstEmailParty = parties.find(p => p.id === firstParty.id);
        const secondEmailParty = parties.find(p => p.id !== firstParty.id);

        expect(firstEmailParty.assignedPropertyId).to.equal(null);
        expect(secondEmailParty.assignedPropertyId).to.equal(propertyId);
      });

      it(`when receiving multiple emails from the same originator
        only one raw lead is created and all comm entries are saved`, async () => {
        // email 1
        const firstMsgId = newId();
        const secondMsgId = newId();
        emailDetails = getEmailDetails(firstMsgId);
        setGetEmailDetailsFunction(() => ({
          ...emailDetails,
          msg: {
            ...emailDetails.msg,
            messageId: firstMsgId,
          },
        }));
        const firstCondition = m => m.Key === firstMsgId;
        const secondCondition = m => m.Key === secondMsgId;

        const { resolvers, promises } = waitFor([firstCondition, secondCondition]);
        const resolverMatcher = createResolverMatcher(resolvers);
        await setupConsumers(chan(), resolverMatcher, ['mail']);

        await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: firstMsgId }).expect(200);

        await promises[0];

        // mail 2
        emailDetails = getEmailDetails(secondMsgId);
        setGetEmailDetailsFunction(() => ({
          ...emailDetails,
          msg: {
            ...emailDetails.msg,
            messageId: secondMsgId,
          },
        }));

        await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: secondMsgId }).expect(200);
        await promises[1];

        // assertions
        const parties2 = await loadParties(ctx);
        expect(parties2.length).to.equal(1);
        expect(parties2[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        expect(parties2[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);

        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(2);
      });

      it(`when receiving an email to a program
        a comm entry is saved for the team associated with that program`, async () => {
        const programIdentifier = 'program-identifier';
        const { id: propertyId } = await createAProperty();
        await createATeamPropertyProgram({
          teamId: team.id,
          propertyId,
          directEmailIdentifier: programIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        emailDetails = {
          event: 'inbound',
          msg: {
            emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
            from_email: 'rhaenys@test.com',
            from_name: 'rhaenys',
            text: 'quertyiop',
            subject: 'querty',
            messageId,
          },
        };
        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);
        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(getEmailAddressWithoutDomain(commEntries[0].message.to[0])).to.equal(programIdentifier);
        expect(commEntries[0].teams).to.deep.equal([team.id]);
      });

      describe('when receiving an email to a program', () => {
        it('should set the associated property to the newly created party and set the associated program to comm', async () => {
          const programIdentifier = 'program-identifier';
          const { id: propertyId } = await createAProperty();
          await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
          });

          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: 'rhaenys@test.com',
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject: 'querty',
              messageId,
            },
          };
          setGetEmailDetailsFunction(() => emailDetails);

          const { task } = await setupMessageQueueForEmail(messageId);
          await request(app).post(postEmailUrl).send(mailData).expect(200);
          const results = await task;
          results.forEach(x => expect(x).to.be.true);

          const parties = await loadParties(ctx);
          const commEntries = await getAllComms(ctx);
          const program = await loadProgramForIncomingCommByEmail(ctx, programIdentifier);

          expect(parties[0].assignedPropertyId).to.equal(propertyId);
          expect(parties[0].storedUnitsFilters).to.deep.equal({
            propertyIds: [propertyId],
          });
          expect(commEntries[0].teamPropertyProgramId).to.equal(program.teamPropertyProgramId);
        });
      });

      describe('when receiving an email to an inactive program that has a fallback program', () => {
        it('should set the associated property from the fallback program to the newly created party and set the associated program to comm', async () => {
          const programFallbackIdentifier = 'program-fallback-identifier';
          const fallbackUser = await createAUser({
            ctx,
            name: 'User2',
            email: 'user2+test@test.com',
            status: DALTypes.UserStatus.AVAILABLE,
          });
          const fallbackTeam = await createATeam({ name: 'testTeam2', module: 'leasing' });
          await createATeamMember({ teamId: fallbackTeam.id, userId: fallbackUser.id });

          const { id: fallbackPropertyId } = await createAProperty();
          const { programId: fallbackProgramId, id: fallbackTeamPropertyProgramId } = await createATeamPropertyProgram({
            teamId: fallbackTeam.id,
            propertyId: fallbackPropertyId,
            directEmailIdentifier: programFallbackIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
          });

          const programIdentifier = 'program-identifier';
          const { id: propertyId } = await createAProperty();
          const { id: teamPropertyProgramId } = await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
            programEndDate: now().add(-1, 'days'),
            programFallbackId: fallbackProgramId,
          });

          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: 'rhaenys@test.com',
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject: 'querty',
              messageId,
            },
          };
          setGetEmailDetailsFunction(() => emailDetails);

          const { task } = await setupMessageQueueForEmail(messageId);
          await request(app).post(postEmailUrl).send(mailData).expect(200);
          const results = await task;
          results.forEach(x => expect(x).to.be.true);

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          const [party] = parties;

          const comms = await getAllComms(ctx);
          expect(comms.length).to.equal(1);
          const [comm] = comms;

          expect(party.assignedPropertyId).to.equal(fallbackPropertyId);
          expect(party.storedUnitsFilters).to.deep.equal({
            propertyIds: [fallbackPropertyId],
          });
          expect(party.ownerTeam).to.equal(fallbackTeam.id);
          expect(party.userId).to.equal(fallbackUser.id);
          expect(party.teamPropertyProgramId).to.equal(teamPropertyProgramId);
          expect(party.fallbackTeamPropertyProgramId).to.equal(fallbackTeamPropertyProgramId);

          expect(comm.teamPropertyProgramId).to.equal(teamPropertyProgramId);
          expect(comm.fallbackTeamPropertyProgramId).to.equal(fallbackTeamPropertyProgramId);
        });
      });

      describe('when receiving an email to a program inactive that has not a fallback program', () => {
        it('should not create the party and comm', async () => {
          const programIdentifier = 'program-identifier';
          const { id: propertyId } = await createAProperty();
          await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
            programEndDate: now().add(-1, 'days'),
            programFallbackId: null,
          });

          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: 'rhaenys@test.com',
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject: 'querty',
              messageId,
            },
          };
          setGetEmailDetailsFunction(() => emailDetails);

          const { task } = await setupMessageQueueForEmail(messageId);
          await request(app).post(postEmailUrl).send(mailData).expect(200);
          const results = await task;
          results.forEach(x => expect(x).to.be.true);

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(0);

          const comms = await getAllComms(ctx);
          expect(comms.length).to.equal(0);
        });
      });

      describe('when receiving an email to a program inactive that has a fallback program', () => {
        describe('and the fallback program is inactive', () => {
          it('a NoRetryError is thrown', async () => {
            const programFallbackIdentifier = 'program-fallback-identifier';
            const condition = (payload, handled, amqpMsg, error) => payload.Key === messageId && !handled && error instanceof NoRetryError;

            const fallbackUser = await createAUser({
              ctx,
              name: 'User2',
              email: 'user2+test@test.com',
              status: DALTypes.UserStatus.AVAILABLE,
            });
            const fallbackTeam = await createATeam({ name: 'testTeam2', module: 'leasing' });
            await createATeamMember({ teamId: fallbackTeam.id, userId: fallbackUser.id });

            const { id: fallbackPropertyId } = await createAProperty();
            const { programId: fallbackProgramId } = await createATeamPropertyProgram({
              teamId: fallbackTeam.id,
              propertyId: fallbackPropertyId,
              directEmailIdentifier: programFallbackIdentifier,
              commDirection: DALTypes.CommunicationDirection.IN,
              programEndDate: now().add(-1, 'days'),
              programFallbackId: null,
            });

            const programIdentifier = 'program-identifier';
            const { id: propertyId } = await createAProperty();
            await createATeamPropertyProgram({
              teamId: team.id,
              propertyId,
              directEmailIdentifier: programIdentifier,
              commDirection: DALTypes.CommunicationDirection.IN,
              programEndDate: now().add(-1, 'days'),
              programFallbackId: fallbackProgramId,
            });

            emailDetails = {
              event: 'inbound',
              msg: {
                emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
                from_email: 'rhaenys@test.com',
                from_name: 'rhaenys',
                text: 'quertyiop',
                subject: 'querty',
                messageId,
              },
            };
            setGetEmailDetailsFunction(() => emailDetails);

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            await request(app).post(postEmailUrl).send(mailData).expect(200);
            const results = await task;
            results.forEach(x => expect(x).to.be.true);

            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(0);
            const comms = await getAllComms(ctx);
            expect(comms.length).to.equal(0);
          });
        });
      });

      describe('outside email address scenarios', () => {
        describe('for program', () => {
          it(`when the email was manually forwarded
            a comm entry is saved for the team associated with the program and a raw lead is created `, async () => {
            const programIdentifier = 'program-identifier';
            const { id: propertyId } = await createAProperty();
            await createATeamPropertyProgram({
              teamId: team.id,
              propertyId,
              directEmailIdentifier: programIdentifier,
              outsideDedicatedEmails: ['outside@gmail.com'],
              commDirection: DALTypes.CommunicationDirection.IN,
            });

            const forwardedOriginalSource = 'originalSource@gmail.com';
            const forwardedOriginalName = 'Darius Baba';
            const forwardedMessageText = `
    ---------- Forwarded message ----------\nFrom: ${forwardedOriginalName} <${forwardedOriginalSource}>\nDate: Fri, Sep 2, 2016 at 3:24 PM\nSubject: test\nTo: Darius Baba <darius@craftingsoftware.com>\n\n\ntest\n
    `;
            emailDetails = {
              event: 'inbound',
              msg: {
                emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
                from_email: 'outside@gmail.com',
                from_name: 'rhaenys',
                subject: 'querty',
                text: forwardedMessageText,
                messageId,
              },
            };
            setGetEmailDetailsFunction(() => emailDetails);

            const { task } = await setupMessageQueueForEmail(messageId);
            await request(app).post(postEmailUrl).send(mailData).expect(200);
            const results = await task;
            results.forEach(x => expect(x).to.be.true);

            // assertions
            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);
            expect(parties[0].teams).to.deep.equal([team.id]);
            expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
            expect(parties[0].partyMembers[0].fullName).to.equal(forwardedOriginalName);

            const commEntries = await getAllComms(ctx);
            expect(commEntries).to.have.length(1);
            expect(getEmailAddressWithoutDomain(commEntries[0].message.to[0])).to.equal(programIdentifier);
            expect(commEntries[0].teams).to.deep.equal([team.id]);
            expect(commEntries[0].message.from).to.equal(forwardedOriginalSource);
          });

          it(`when the email was automatically forwarded
            a comm entry is saved for the team with the email alias and a raw lead is created`, async () => {
            const outsideEmail = 'outside@gmail.com';
            const programIdentifier = 'program-identifier';
            const { id: propertyId } = await createAProperty();
            await createATeamPropertyProgram({
              teamId: team.id,
              propertyId,
              directEmailIdentifier: programIdentifier,
              outsideDedicatedEmails: [outsideEmail],
              commDirection: DALTypes.CommunicationDirection.IN,
            });

            const forwardedOriginalSource = 'originalSource@gmail.com';
            emailDetails = {
              event: 'inbound',
              msg: {
                emails: [outsideEmail],
                from_email: forwardedOriginalSource,
                from_name: 'rhaenys',
                subject: 'querty',
                text: '',
                headers: {
                  'x-forwarded-to': `${programIdentifier}@${tenant.name}.com`,
                },
                messageId,
              },
            };
            setGetEmailDetailsFunction(() => emailDetails);

            const { task } = await setupMessageQueueForEmail(messageId);
            await request(app).post(postEmailUrl).send(mailData).expect(200);
            const results = await task;
            results.forEach(x => expect(x).to.be.true);

            // assertions
            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);
            expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
            expect(parties[0].teams).to.deep.equal([team.id]);
            expect(parties[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);

            const commEntries = await getAllComms(ctx);
            expect(commEntries).to.have.length(1);
            expect(getEmailAddressWithoutDomain(commEntries[0].message.to[0])).to.equal(programIdentifier);
            expect(commEntries[0].teams).to.deep.equal([team.id]);
            expect(commEntries[0].message.from).to.equal(forwardedOriginalSource);
          });

          it('creates a raw lead correctly when email contains receivedFor header instead of x-forwarded', async () => {
            const programIdentifier = 'program-identifier';
            const { id: propertyId } = await createAProperty();
            await createATeamPropertyProgram({
              teamId: team.id,
              propertyId,
              directEmailIdentifier: programIdentifier,
              commDirection: DALTypes.CommunicationDirection.IN,
            });

            const forwardedOriginalSource = 'originalSource@gmail.com';
            emailDetails = {
              event: 'inbound',
              msg: {
                emails: ['blabavalva@asdasda.com'],
                from_email: forwardedOriginalSource,
                from_name: 'rhaenys',
                subject: 'querty',
                text: '',
                messageId,
                receivedFor: `${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`,
              },
            };
            setGetEmailDetailsFunction(() => emailDetails);

            const { task } = await setupMessageQueueForEmail(messageId);
            await request(app).post(postEmailUrl).send(mailData).expect(200);
            const results = await task;
            results.forEach(x => expect(x).to.be.true);

            // assertions
            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);
            expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
            expect(parties[0].teams).to.deep.equal([team.id]);
            expect(parties[0].partyMembers[0].fullName).to.equal(emailDetails.msg.from_name);

            const commEntries = await getAllComms(ctx);
            expect(commEntries).to.have.length(1);
            expect(getEmailAddressWithoutDomain(commEntries[0].message.to[0])).to.equal(programIdentifier);
            expect(commEntries[0].message.from).to.equal(forwardedOriginalSource);
          });
        });

        describe('for team member', () => {
          it(`when the email was manually forwarded to a teamMember
            a raw lead will be created and associated to the teamMember and his team`, async () => {
            const forwardedOriginalSource = 'originalSource@gmail.com';
            const forwardedOriginalName = 'Darius Baba';
            const forwardedMessageText = `
    ---------- Forwarded message ----------\nFrom: ${forwardedOriginalName} <${forwardedOriginalSource}>\nDate: Fri, Sep 2, 2016 at 3:24 PM\nSubject: test\nTo: Darius Baba <darius@craftingsoftware.com>\n\n\ntest\n
    `;
            emailDetails = {
              event: 'inbound',
              msg: {
                emails: [`${teamMember.directEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
                from_email: teamMember.outsideDedicatedEmails[0],
                from_name: 'rhaenys',
                subject: 'querty',
                text: forwardedMessageText,
                messageId,
              },
            };
            setGetEmailDetailsFunction(() => emailDetails);

            const { task } = await setupMessageQueueForEmail(messageId);
            await request(app).post(postEmailUrl).send(mailData).expect(200);
            const results = await task;
            results.forEach(x => expect(x).to.be.true);

            // assertions
            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);
            expect(parties[0].userId).to.equal(user.id);
            expect(parties[0].teams).to.deep.equal([team.id]);
            expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
            expect(parties[0].partyMembers[0].fullName).to.equal(forwardedOriginalName);

            const commEntries = await getAllComms(ctx);
            expect(commEntries).to.have.length(1);
            expect(getEmailAddressWithoutDomain(commEntries[0].message.to[0])).to.equal(teamMember.directEmailIdentifier);
            expect(commEntries[0].message.from).to.equal(forwardedOriginalSource);
          });
        });
      });

      describe('when receiving an email from within REVA domain', () => {
        it('a NoRetryError is thrown', async () => {
          const condition = (payload, handled, amqpMsg, error) =>
            payload.Key === messageId && !handled && error instanceof NoRetryError && error.message.match('within REVA domain');

          const programIdentifier = 'program-identifier';
          const { id: propertyId } = await createAProperty();
          await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
          });

          const { task } = await setupMessageQueueForEmail(messageId, condition);
          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: `rhaenys@testTeanant.${config.mail.emailDomain}`,
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject: 'querty',
              messageId,
            },
          };

          setGetEmailDetailsFunction(() => emailDetails);

          await request(app).post(postEmailUrl).send(mailData).expect(200);
          await task;
        });
      });

      describe('when receiving an email with a messageId that already exists in db', async () => {
        it(`should be ignored if the time interval between initial message and the new one is < ${DUPLICATE_EMAIL_TIME_INTERVAL_MIN} min`, async () => {
          const conditionSuccess = (payload, handled) => payload.Key === messageId && handled;
          const conditionFail = (payload, handled, amqpMsg, error) =>
            payload.Key === messageId && !handled && error.toString().match(EMAIL_UNIQUE_CONSTRAINT_ERROR);

          await setupMessageQueueForEmail();
          const {
            resolvers,
            promises: [waitForFirstEmail, waitForSecondEmail],
          } = waitFor([conditionSuccess, conditionFail]);
          matcher.addWaiters(resolvers);

          const { id: propertyId } = await createAProperty();

          const party = await createAParty({
            teams: [team.id],
            endDate: now(),
            assignedPropertyId: propertyId,
            workflowState: DALTypes.WorkflowState.ACTIVE,
            ownerTeam: team.id,
            userId: user.id,
          });

          const fromEmailAddress = 'abc@domain.com';
          const person = await createAPerson();
          const contactInfo = [
            {
              type: 'email',
              value: fromEmailAddress,
            },
          ];
          await createAPersonContactInfo(person.id, ...contactInfo);
          await createAPartyMember(party.id, {
            personId: person.id,
          });

          const communication = await createACommunicationEntry({
            parties: [party.id],
            messageId,
            teams: [team.id],
            persons: [person.id],
          });

          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${party.emailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: fromEmailAddress,
              from_name: 'name',
              text: 'email-message',
              subject: 'email-subject',
              messageId,
            },
          };

          setGetEmailDetailsFunction(() => emailDetails);

          await request(app).post(postEmailUrl).send(mailData).expect(200);
          await waitForFirstEmail;

          await update(ctx, 'Communication', { id: communication.id }, { created_at: now().add(-DUPLICATE_EMAIL_TIME_INTERVAL_MIN, 'minutes') });
          await request(app).post(postEmailUrl).send(mailData).expect(200);
          await waitForSecondEmail;
        });
      });

      describe('when we already have closed parties', () => {
        let condition;
        let personId;
        let subject;
        beforeEach(async () => {
          condition = (payload, handled) => payload.Key === messageId && handled;
          const person = await createAPerson();
          personId = person.id;
          const contactInfos = [
            {
              type: 'email',
              value: fromEmail,
            },
          ];
          await saveContactInfo(ctx, contactInfos, personId);
          subject = 'testSubj';
          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: fromEmail,
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject,
              messageId,
            },
          };
        });
        describe('when receiving a inReplyTo email for the closed party', () => {
          it('the new comm is assigned to the parties where the thread originated', async () => {
            const user1 = await createAUser();
            const user2 = await createAUser();
            const party1 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
              userId: user1.id,
            });
            const party2 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
              userId: user1.id,
            });
            const party3 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
              userId: user2.id,
            });

            await createATeamMember({ teamId: team.id, userId: user1.id });
            await createATeamMember({ teamId: team.id, userId: user2.id });
            await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party2.id, { personId });
            await createAPartyMember(party3.id, { personId });

            const replyToId = newId();
            const threadId = newId();
            // 2 parties have the message thread
            await createACommunicationEntry({
              parties: [party1.id, party2.id],
              messageId: replyToId,
              teams: [team.id],
              threadId,
              persons: [personId],
            });
            await createACommunicationEntry({
              parties: [party3.id],
              teams: [team.id],
              persons: [personId],
            });

            const { task } = await setupMessageQueueForEmail(messageId, condition);

            emailDetails.msg.inReplyTo = replyToId;
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            // no new lead is created
            expect(parties.length).to.be.equal(3);
            const commEntries = await getAllComms(ctx);
            // one new comm is added for the parties where whe have the replyTo
            expect(commEntries.length).to.be.equal(3);
            const latest = commEntries.find(m => m.message.subject === subject);

            expect(latest).to.not.be.null;
            expect(latest.parties.sort()).to.deep.equal([party1.id, party2.id].sort());
            expect(latest.threadId).to.equal(threadId);
          });
        });

        describe('when receiving party reply email for the closed party but the sender has another active party on the same property', () => {
          it('the new comm is assigned to the active party of the sender', async () => {
            const party1 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
            });
            const party2 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
            });
            const party3 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
            });
            const party4 = await createAParty({ teams: [team.id], assignedPropertyId: programPropertyId });
            await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party2.id, { personId });
            await createAPartyMember(party3.id, { personId });
            await createAPartyMember(party4.id, { personId });

            const replyToId = newId();
            const threadId = newId();
            // 2 parties have the message thread
            await createACommunicationEntry({
              parties: [party1.id, party2.id],
              messageId: replyToId,
              teams: [team.id],
              threadId,
              persons: [personId],
            });
            await createACommunicationEntry({
              parties: [party3.id],
              teams: [team.id],
              persons: [personId],
            });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            emailDetails.msg.inReplyTo = replyToId;
            emailDetails.msg.emails = [`${party1.emailIdentifier}@${tenant.name}.${config.mail.emailDomain}`];
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            // no new lead is created
            expect(parties.length).to.be.equal(4);
            const commEntries = await getAllComms(ctx);

            // one new comm is added to the active party
            expect(commEntries.length).to.be.equal(3);
            const latest = commEntries.find(m => m.message.subject === subject);
            expect(latest).to.not.be.null;
            expect(latest.parties.sort()).to.deep.equal([party4.id].sort());
          });
        });

        describe('when receiving party reply email for the closed party but the sender is no longer in the party and has no active ones', () => {
          it('the new comm is assigned to a new party for the sender', async () => {
            const person2 = await createAPerson();
            const personId2 = person2.id;
            const contactInfos = [
              {
                type: 'email',
                value: 'dummy@test.com',
              },
            ];
            await saveContactInfo(ctx, contactInfos, personId2);

            const party1 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
            });
            const pm1 = await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party1.id, { personId2 });

            const replyToId = newId();
            const threadId = newId();
            // 2 parties have the message thread
            await createACommunicationEntry({
              parties: [party1.id],
              messageId: replyToId,
              teams: [team.id],
              threadId,
              persons: [personId, personId2],
            });
            const source = await createASource('transfer-agent', 'transfer-agent', '', 'Agent');
            await removePartyMember({ ...ctx, params: { partyId: party1.id, memberId: pm1.id }, body: { notes: 'removing a user' } });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            emailDetails.msg.inReplyTo = replyToId;
            emailDetails.msg.emails = [`${party1.emailIdentifier}@${tenant.name}.${config.mail.emailDomain}`];
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            // a new lead is created
            expect(parties.length).to.be.equal(2);
            const commEntries = await getAllComms(ctx);

            expect(commEntries.length).to.be.equal(2);
            const latest = commEntries.find(m => m.message.subject === subject);

            expect(latest).to.not.be.null;
            expect(latest.parties).to.not.include(party1.id);

            const newParty = parties.find(p => p.id !== party1.id);
            expect(newParty.metadata.transferAgentSource).to.not.be.undefined;
            expect(newParty.metadata.transferAgentSource.id).to.equal(source.id);
          });
        });

        describe('when receiving party reply email for an archived party', () => {
          it('the new comm is assigned to the active party of the sender', async () => {
            const user1 = await createAUser();
            const user2 = await createAUser();
            const party1 = await createAParty({
              teams: [team.id],
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.ARCHIVED,
              archiveDate: now(),
              ownerTeam: team.id,
              userId: user1.id,
            });
            const party2 = await createAParty({
              teams: [team.id],
              endDate: now(),
              partyGroupId: party1.partyGroupId,
              seedPartyId: party1.id,
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.ACTIVE,
              ownerTeam: team.id,
              userId: user2.id,
            });

            await createATeamMember({ teamId: team.id, userId: user1.id });
            await createATeamMember({ teamId: team.id, userId: user2.id });
            await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party2.id, { personId });

            const replyToId = newId();
            const threadId = newId();
            // 2 parties have the message thread
            await createACommunicationEntry({
              parties: [party1.id],
              messageId: replyToId,
              teams: [team.id],
              threadId,
              persons: [personId],
            });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            emailDetails.msg.inReplyTo = replyToId;
            emailDetails.msg.emails = [`${party1.emailIdentifier}@${tenant.name}.${config.mail.emailDomain}`];
            emailDetails.msg.subject = 'REPLY';
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            // no new lead is created
            expect(parties.length).to.be.equal(2);
            const commEntries = await getAllComms(ctx);

            // one new comm is added to the active party
            expect(commEntries.length).to.be.equal(2);
            const latest = commEntries.find(m => m.message.subject === 'REPLY');
            expect(latest).to.not.be.null;
            expect(latest.parties.sort()).to.deep.equal([party2.id].sort());
          });
        });

        describe('when the party group contains only archived parties and a reply is received', () => {
          it('should assign the new email to the last archived Active Lease', async () => {
            const user1 = await createAUser();
            const user2 = await createAUser();
            const party1 = await createAParty({
              teams: [team.id],
              assignedPropertyId: programPropertyId,
              workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
              workflowState: DALTypes.WorkflowState.ARCHIVED,
              archiveDate: now({ timezone: propertyTimezone }).add(-10, 'days'),
              ownerTeam: team.id,
              userId: user1.id,
            });
            const party2 = await createAParty({
              teams: [team.id],
              partyGroupId: party1.partyGroupId,
              seedPartyId: party1.id,
              assignedPropertyId: programPropertyId,
              workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
              workflowState: DALTypes.WorkflowState.ARCHIVED,
              archiveDate: now({ timezone: propertyTimezone }).add(-5, 'days'),
              ownerTeam: team.id,
              userId: user2.id,
            });

            await createATeamMember({ teamId: team.id, userId: user1.id });
            await createATeamMember({ teamId: team.id, userId: user2.id });
            await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party2.id, { personId });

            const replyToId = newId();
            const threadId = newId();

            await createACommunicationEntry({
              parties: [party1.id],
              messageId: replyToId,
              teams: [team.id],
              threadId,
              persons: [personId],
            });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            emailDetails.msg.inReplyTo = replyToId;
            emailDetails.msg.emails = [`${party1.emailIdentifier}@${tenant.name}.${config.mail.emailDomain}`];
            emailDetails.msg.subject = 'REPLY';
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;

            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            expect(parties.length).to.be.equal(2);

            const commEntries = await getAllComms(ctx);
            expect(commEntries.length).to.be.equal(2);

            const latest = commEntries.find(m => m.message.subject === 'REPLY');
            expect(latest).to.not.be.null;
            expect(latest.parties.length).to.be.equal(1);
            expect(latest.parties).to.deep.equal([party2.id]);
          });
        });

        describe('when receiving a new email', () => {
          it('the new comm is assigned to active parties if available', async () => {
            const party1 = await createAParty({
              teams: [team.id],
              assignedPropertyId: programPropertyId,
              endDate: now(),
              workflowState: DALTypes.WorkflowState.CLOSED,
            });
            const party2 = await createAParty({ teams: [team.id], assignedPropertyId: programPropertyId });
            const party3 = await createAParty({ teams: [team.id], assignedPropertyId: programPropertyId });
            await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party2.id, { personId });
            await createAPartyMember(party3.id, { personId });

            const replyToId = newId();
            const threadId = newId();
            // 2 parties have the message thread
            await createACommunicationEntry({
              parties: [party1.id, party2.id],
              messageId: replyToId,
              teams: [team.id],
              threadId,
              persons: [personId],
            });
            await createACommunicationEntry({
              parties: [party3.id],
              teams: [team.id],
              persons: [personId],
            });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            // no new lead is created
            expect(parties.length).to.be.equal(3);
            const commEntries = await getAllComms(ctx);
            // one new comm is added for the active parties
            expect(commEntries.length).to.be.equal(3);
            const latest = commEntries.find(m => m.message.subject === subject);
            expect(latest).to.not.be.null;
            expect(latest.parties.sort()).to.deep.equal([party2.id, party3.id].sort());
            expect(latest.threadId).to.not.equal(threadId); // we should have a new thread
          });
        });

        describe('when receiving a new email', () => {
          it('the new comm will not be assigned to an archived party', async () => {
            const party1 = await createAParty({
              teams: [team.id],
              assignedPropertyId: programPropertyId,
              archiveDate: now(),
              workflowState: DALTypes.WorkflowState.ARCHIVED,
            });
            const party2 = await createAParty({ teams: [team.id], assignedPropertyId: programPropertyId });
            await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party2.id, { personId });

            const replyToId = newId();
            const threadId = newId();

            await createACommunicationEntry({
              parties: [party1.id, party2.id],
              messageId: replyToId,
              teams: [team.id],
              threadId,
              persons: [personId],
            });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            expect(parties.length).to.be.equal(2);
            const commEntries = await getAllComms(ctx);
            expect(commEntries.length).to.be.equal(2);
            const latest = commEntries.find(m => m.message.subject === subject);
            expect(latest).to.not.be.null;
            expect(latest.parties.sort()).to.deep.equal([party2.id].sort());
            expect(latest.threadId).to.not.equal(threadId);
          });
        });

        describe('when receiving a new email and no active parties are available', () => {
          it('the new comm is assigned to the last closed party', async () => {
            const party1 = await createAParty({
              teams: [team.id],
              endDate: now(),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
              userId: user.id,
            });
            const party2 = await createAParty({
              teams: [team.id],
              endDate: now().add(-1, 'days'),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
              userId: user.id,
            });
            const party3 = await createAParty({
              teams: [team.id],
              endDate: now().add(-2, 'days'),
              assignedPropertyId: programPropertyId,
              workflowState: DALTypes.WorkflowState.CLOSED,
              ownerTeam: team.id,
              userId: user.id,
            });
            await createAPartyMember(party1.id, { personId });
            await createAPartyMember(party2.id, { personId });
            await createAPartyMember(party3.id, { personId });

            const threadId = newId();
            // 2 parties have the message thread
            await createACommunicationEntry({
              parties: [party1.id, party2.id],
              teams: [team.id],
              threadId,
              persons: [personId],
            });
            await createACommunicationEntry({
              parties: [party3.id],
              teams: [team.id],
              persons: [personId],
            });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);
            // no new lead is created
            expect(parties.length).to.be.equal(3);
            const commEntries = await getAllComms(ctx);
            // one new comm is added for the active parties
            expect(commEntries.length).to.be.equal(3);
            const latest = commEntries.find(m => m.message.subject === subject);
            expect(latest).to.not.be.null;
            expect(latest.parties.sort()).to.deep.equal([party1.id]);
            expect(latest.threadId).to.not.equal(threadId);
          });
        });
      });

      describe('party exclusion rules on new incoming comm', () => {
        let condition;
        let personId;
        let subject;
        beforeEach(async () => {
          condition = (payload, handled) => payload.Key === messageId && handled;
          const person = await createAPerson();
          personId = person.id;
          const contactInfos = [
            {
              type: 'email',
              value: fromEmail,
            },
          ];
          await saveContactInfo(ctx, contactInfos, personId);
          subject = 'testSubj';
          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: fromEmail,
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject,
              messageId,
            },
          };
        });

        describe('when receiving a new email from a known originator which is no longer in Leasing', () => {
          it('a new raw lead is NOT created and the comm is associated with the existing party', async () => {
            const existingParty = await createAParty({
              teams: [team.id],
              state: DALTypes.PartyStateType.RESIDENT,
              assignedPropertyId: programPropertyId,
            });
            await createAPartyMember(existingParty.id, { personId });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;

            // new lead is NOT created
            const parties = await loadParties(ctx);
            expect(parties.length).to.be.equal(1);

            const [party] = parties;
            expect(party.id).to.equal(existingParty.id);

            const comms = await getAllComms(ctx);
            expect(comms.length).to.be.equal(1);
            const [comm] = comms;
            expect(comm.parties.sort()).to.deep.equal([existingParty.id]);
          });
        });

        describe('when receiving a new email from a known originator in an archived party', () => {
          it('a new raw lead is created', async () => {
            const party1 = await createAParty({
              userId: user.id,
              teams: [team.id],
              archiveDate: now(),
              workflowState: DALTypes.WorkflowState.ARCHIVED,
            });
            await createAPartyMember(party1.id, { personId });

            const { task } = await setupMessageQueueForEmail(messageId, condition);
            setGetEmailDetailsFunction(() => emailDetails);

            await request(app).post(postEmailUrl).send(mailData).expect(200);
            await task;
            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            // new lead is created
            expect(parties.length).to.be.equal(2);
            const newRawLead = parties.find(p => p.id !== party1.id);
            const commEntries = await getAllComms(ctx);
            // one new comm is added for the active parties
            expect(commEntries.length).to.be.equal(1);
            const latest = commEntries.find(m => m.message.subject === subject);
            expect(latest).to.not.be.null;
            expect(latest.parties.sort()).to.deep.equal([newRawLead.id]);
          });
        });
      });

      describe('when receiving an email to a known alias', () => {
        let firstMsgId;
        let hubTeam;
        const firstCondition = m => m.Key === firstMsgId;
        let property1;
        let party;
        beforeEach(async () => {
          firstMsgId = newId();
          hubTeam = await createATeam({ name: 'hubTeam', module: 'leasing' });
          await createATeamMember({
            teamId: hubTeam.id,
            userId: user.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          });
          property1 = await createAProperty();
          party = await createAParty({
            userId: user.id,
            teams: [hubTeam.id],
            assignedPropertyId: property1.id,
          });
        });

        it('a new raw lead will be created if a party for that propertyId does not exists', async () => {
          const { task } = await setupMessageQueueForEmail(messageId, firstCondition);
          const programIdentifier = 'program-identifier';
          const { id: propertyId } = await createAProperty();
          await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
          });
          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: 'rhaenys@test.com',
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject: 'querty',
              messageId: firstMsgId,
            },
          };
          setGetEmailDetailsFunction(() => emailDetails);

          await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: firstMsgId }).expect(200);

          await task;
          const parties = await loadParties(ctx, partyWfStatesSubset.all);

          expect(parties.length).to.equal(2);
          const [p2] = parties.filter(p => p.id !== party.id);
          expect(p2.assignedPropertyId).to.equal(propertyId);
        });

        it('the comm will be associated only with the parties for that property', async () => {
          const { task } = await setupMessageQueueForEmail(messageId, firstCondition);
          const contactInfo = [
            {
              type: 'email',
              value: fromEmail,
            },
          ];
          const person = await createAPerson();
          await createAPersonContactInfo(person.id, ...contactInfo);
          await createAPartyMember(party.id, {
            personId: person.id,
          });
          const secondPartyOnSameProperty = await createAParty({
            userId: user.id,
            teams: [hubTeam.id],
            assignedPropertyId: property1.id,
          });
          await createAPartyMember(secondPartyOnSameProperty.id, {
            personId: person.id,
          });
          // 2 parties on different properties, for the same person
          await Promise.all(
            [1, 2].map(async () => {
              const property = await createAProperty();
              const newParty = await createAParty({
                userId: user.id,
                teams: [hubTeam.id],
                assignedPropertyId: property.id,
              });
              return await createAPartyMember(newParty.id, {
                personId: person.id,
              });
            }),
          );

          const programIdentifier = 'program-identifier';
          await createATeamPropertyProgram({
            teamId: team.id,
            propertyId: property1.id,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
          });
          emailDetails = {
            event: 'inbound',
            msg: {
              emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              from_email: fromEmail,
              from_name: 'rhaenys',
              text: 'quertyiop',
              subject: 'querty',
              messageId: firstMsgId,
            },
          };
          setGetEmailDetailsFunction(() => emailDetails);

          await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: firstMsgId }).expect(200);

          await task;
          const parties = await loadParties(ctx, partyWfStatesSubset.all);
          const messages = await getAllComms(ctx);
          expect(parties.length).to.equal(4);
          expect(messages.length).to.equal(1);
          expect(messages[0].parties.sort()).to.deep.equal([party.id, secondPartyOnSameProperty.id].sort()); // party in property 1
        });
      });
      describe('when receiving a inReplyTo email and the sender already matches some parties but not the inReplyTo one', () => {
        it('a new party member will be added to the party that matches the inReplyTo', async () => {
          const condition = (payload, handled) => payload.Key === messageId && handled;
          const { id: personId } = await createAPerson('TestSender');
          const contactInfos = [
            {
              type: 'email',
              value: fromEmail,
            },
          ];
          await saveContactInfo(ctx, contactInfos, personId);

          const party1 = await createAParty({
            teams: [team.id],
            assignedPropertyId: programPropertyId,
          });
          const party2 = await createAParty({
            teams: [team.id],
            assignedPropertyId: programPropertyId,
          });
          const { id: personId2 } = await createAPerson();
          await createAPartyMember(party1.id, { personId });
          await createAPartyMember(party2.id, { personId2 });

          const replyToId = newId();
          const threadId = newId();
          // mail will match  the person
          await createACommunicationEntry({
            parties: [party1.id],
            teams: [team.id],
            threadId,
            persons: [personId],
          });

          // this will match by  reply to
          await createACommunicationEntry({
            parties: [party2.id],
            messageId: replyToId,
            teams: [team.id],
            persons: [personId2],
          });

          const { task } = await setupMessageQueueForEmail(messageId, condition);
          emailDetails.msg.inReplyTo = replyToId;
          setGetEmailDetailsFunction(() => emailDetails);

          await request(app).post(postEmailUrl).send(mailData).expect(200);
          await task;
          const parties = await loadParties(ctx, partyWfStatesSubset.all);
          // no new lead is created
          expect(parties.length).to.be.equal(2);
          const commEntries = await getAllComms(ctx);
          // one new comm is added for the parties where whe have the replyTo
          expect(commEntries.length).to.be.equal(3);
          // a new party member should have been added to the party that matches reply-to
          const matchedParty = parties.find(p => p.id === party2.id);
          expect(matchedParty.partyMembers.length).to.be.equal(2);
          expect(matchedParty.partyMembers.find(pm => pm.fullName === 'TestSender'));
        });
      });
    });

    describe('when receiving an email from known originator but the party owner has been deactivated', async () => {
      const messageId2 = newId().toString();
      const mailData2 = { Bucket: 'test', Key: messageId2 };
      const fromEmailGuest = 'guest1@test.com';
      const directEmailIdentifier = 'program-email-identifier';

      let partyOwnerUser;
      let dispatcherUser;
      let property;
      let mainTeam;

      const getEmailDetails2 = (msgId = messageId2, firstPartEmail = directEmailIdentifier) => ({
        event: 'inbound',
        msg: {
          emails: [`${firstPartEmail}@${tenant.name}.${config.mail.emailDomain}`],
          from_email: fromEmailGuest,
          from_name: 'Guest 1',
          text: 'test text',
          subject: 'subject mail',
          messageId: msgId,
        },
      });
      beforeEach(async () => {
        partyOwnerUser = await createAUser({
          ctx,
          name: 'owner1',
          status: DALTypes.UserStatus.AVAILABLE,
        });

        dispatcherUser = await createAUser({
          ctx,
          name: 'dispatcher1',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        mainTeam = await createATeam({ name: 'mainTeam', module: 'leasing' });
        property = await createAProperty();
        await createAProgram({ property, team: mainTeam, directEmailIdentifier });

        await createATeamMember({
          teamId: mainTeam.id,
          userId: partyOwnerUser.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LWA.name],
          },
          inactive: true,
        });
        await createATeamMember({
          teamId: mainTeam.id,
          userId: dispatcherUser.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          },
        });
      });

      it(`when email is to program a raw lead will NOT be created and the existing
      party of the user will be assigned to the dispatcher of the team`, async () => {
        const { id: personId } = await createAPerson();
        const contactInfos = [
          {
            type: 'email',
            value: fromEmailGuest,
          },
        ];
        await saveContactInfo(ctx, contactInfos, personId);
        const sixtyDaysAgo = now().add(-60, 'days');

        const { id } = await createAParty({
          userId: partyOwnerUser.id,
          teams: [mainTeam.id],
          assignedPropertyId: property.id,
          endDate: sixtyDaysAgo,
          ownerTeam: mainTeam.id,
        });

        await createAPartyMember(id, {
          personId,
        });

        const { task } = await setupMessageQueueForEmail(messageId2);

        const emailDetails = getEmailDetails2(messageId2, directEmailIdentifier);

        setGetEmailDetailsFunction(() => emailDetails);

        await request(app).post(postEmailUrl).send(mailData2).expect(200);

        await task;
        const parties = await loadParties(ctx, partyWfStatesSubset.all);
        expect(parties.length).to.equal(1);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId2);
        expect(parties[0].userId).to.equal(dispatcherUser.id);
      });

      it(`when email is to party email identifier a raw lead will NOT be created and the existing
      party of the user will be assigned to the dispatcher of the team`, async () => {
        const { id: personId } = await createAPerson();
        const contactInfos = [
          {
            type: 'email',
            value: fromEmailGuest,
          },
        ];
        await saveContactInfo(ctx, contactInfos, personId);
        const sixtyDaysAgo = now().add(-60, 'days');

        const { id, emailIdentifier } = await createAParty({
          userId: partyOwnerUser.id,
          teams: [mainTeam.id],
          assignedPropertyId: property.id,
          endDate: sixtyDaysAgo,
          ownerTeam: mainTeam.id,
        });

        await createAPartyMember(id, {
          personId,
        });

        const { task } = await setupMessageQueueForEmail(messageId2);

        const emailDetails = getEmailDetails2(messageId2, emailIdentifier);

        setGetEmailDetailsFunction(() => emailDetails);

        await request(app).post(postEmailUrl).send(mailData2).expect(200);

        await task;
        const parties = await loadParties(ctx, partyWfStatesSubset.all);
        expect(parties.length).to.equal(1);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId2);
        expect(parties[0].userId).to.equal(dispatcherUser.id);
      });
    });
  });
});
