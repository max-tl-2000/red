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
import {
  createAPartyMember,
  createAUser,
  createATeam,
  createATeamMember,
  createAPerson,
  testCtx as ctx,
  createAProperty,
  createATeamPropertyProgram,
  createAProgramReferrer,
  createAParty,
  enableHoneypotTrap,
  createAInventoryGroup,
  createAnInventory,
  refreshUnitSearch,
  createALeaseTerm,
  createALeaseName,
  createAFee,
  setAssociatedFees,
  createACommTemplate,
  saveUnitsRevaPricing,
  createAProgram,
} from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { loadParties } from '../../../dal/partyRepo';
import { updateProperty } from '../../../dal/propertyRepo';
import { getPublishedQuotesByPartyId } from '../../../dal/quoteRepo';
import { getAllSpamCommunications } from '../../../dal/blacklistRepo';
import { getInventoriesQualifiedNamesByIds } from '../../../dal/inventoryRepo';
import { getAllComms, getCommsByType } from '../../../dal/communicationRepo';
import { generateTokenForDomain } from '../../../services/tenantService';
import { waitFor, setupQueueToWaitFor, getAuthHeader } from '../../../testUtils/apiHelper';
import { chan, createResolverMatcher, tenant } from '../../../testUtils/setupTestGlobalContext';
import { setupConsumers } from '../../../workers/consumer';
import { getPersonById, updatePerson, getRawLeadsPersons } from '../../../dal/personRepo';
import { loadAppointmentsForParties } from '../../../dal/appointmentRepo';
import { updateTeam } from '../../../dal/teamsRepo';
import { loadProgramForIncomingCommByEmail, saveTeamPropertyProgram } from '../../../dal/programsRepo';
import { formatPhoneNumberForDb } from '../../../helpers/phoneUtils';
import { getOnlyDigitsFromPhoneNumber } from '../../../../common/helpers/phone-utils';
import { toMoment, now } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { EXPECTED_HONEYPOT_NAME } from '../../helpers/honeypot';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { TemplateNames } from '../../../../common/enums/templateTypes';
import { partyCloseReasonsToExcludeForNewLead } from '../../../helpers/party';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { init as initCloudinary } from '../../../../common/helpers/cloudinary';
import { getKeyByValue } from '../../../../common/enums/enumHelper';
import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';
import { saveContactInfo, getContactInfosByPersonId } from '../../../dal/contactInfoRepo';

describe('API/contactUs', () => {
  initCloudinary({ cloudName: 'test' });

  describe('POST', () => {
    let matcher;

    const setupMsgQueueAndWaitFor = async conditions => {
      const { resolvers, promises } = waitFor(conditions);
      matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['webInquiry']);
      return { task: Promise.all(promises) };
    };

    const programEmailIdentifier = 'program-email-identifier';

    const createProgram = async (teamId, onSiteLeasingTeamId, metadata, directEmailIdentifier = programEmailIdentifier) => {
      const { id: programPropertyId } = await createAProperty();
      return await createATeamPropertyProgram({
        teamId,
        propertyId: programPropertyId,
        onSiteLeasingTeamId,
        directEmailIdentifier,
        commDirection: DALTypes.CommunicationDirection.IN,
        metadata,
      });
    };

    let hubTeamId;
    let hubTeamEmail;
    let header;
    const teamName = 'The HUB';
    const questions = DALTypes.QualificationQuestions;
    const qualificationQuestions = {
      cashAvailable: Object.keys(questions.SufficientIncome)[0],
      groupProfile: Object.keys(questions.GroupProfile)[0],
      moveInTime: Object.keys(questions.MoveInTime)[0],
    };

    beforeEach(async () => {
      const user = await createAUser();
      const { id, directEmailIdentifier } = await createATeam({
        name: teamName,
        module: 'leasing',
        email: 'thehubteam@test.com',
        phone: '16504375757',
      });
      hubTeamId = id;
      hubTeamEmail = directEmailIdentifier;

      await createATeamMember({ teamId: hubTeamId, userId: user.id });
      const token = await generateTokenForDomain({
        tenantId: tenant.id,
        domain: 'testing.reva.tech',
        expiresIn: '1m',
        allowedEndpoints: ['contactUs', 'leads', 'marketing/', 'guestCard'],
      });
      header = {
        Authorization: `Bearer ${token}`,
        referer: 'http://testing.reva.tech',
      };
    });

    it('should be a protected route', async () => {
      const res = await request(app).post('/contactUs').send({ phone: '+1-202-555-0130', hubTeamEmail });

      expect(res.status).to.equal(401);
    });

    describe('when payload does not cotain phone or email', () => {
      it('responds with status code 400 and PHONE_OR_EMAIL_REQUIRED token', async () => {
        await createProgram(hubTeamId);

        const res = await request(app).post('/contactUs').set(header).send({ programEmail: programEmailIdentifier });

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('PHONE_OR_EMAIL_REQUIRED');
      });
    });

    describe('when phone looks like a phone number and creatOnError is false', () => {
      it('responds with status code 202', async () => {
        await createProgram(hubTeamId);

        const res = await request(app)
          .post('/contactUs')
          .set(header)
          .send({ phone: '11111111111', programEmail: programEmailIdentifier, createOnError: false });

        expect(res.status).to.equal(202);
      });

      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        await createProgram(hubTeamId);

        await request(app)
          .post('/contactUs')
          .set(header)
          .send({ phone: 'dddd', email: 'xxx@xxx.com', programEmail: programEmailIdentifier, createOnError: false })
          .expect(res => expect(res.body.token).to.equal('INVALID_PHONE_NUMBER'));
      });

      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        await createProgram(hubTeamId);

        await request(app)
          .post('/contactUs')
          .set(header)
          .send({ phone: '', email: 'xxx@xxx.com', programEmail: programEmailIdentifier, createOnError: false })
          .expect(res => expect(res.body.token).to.equal('INVALID_PHONE_NUMBER'));
      });
    });

    describe('when phone comes with special characteres or blank spaces and creatOnError is false', () => {
      it('should strip out the every character except digits and responds with status code 202', async () => {
        await createProgram(hubTeamId);

        const res = await request(app)
          .post('/contactUs')
          .set(header)
          .send({ phone: '+1 11 - 11ç111111', programEmail: programEmailIdentifier, createOnError: false });

        expect(res.status).to.equal(202);
      });
    });

    describe("when phone number is not valid and creatOnError is 'false'", () => {
      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        await createProgram(hubTeamId);

        const res = await request(app)
          .post('/contactUs')
          .set(header)
          .send({ phone: '11111111111', programEmail: programEmailIdentifier, createOnError: 'false' });

        expect(res.status).to.equal(202);
      });
    });

    describe('when email is not valid', () => {
      it('responds with status code 400 and INVALID_EMAIL_ADDRESS token', async () => {
        await createProgram(hubTeamId);

        const res = await request(app).post('/contactUs').set(header).send({ email: 'abc', programEmail: programEmailIdentifier, createOnError: false });

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INVALID_EMAIL_ADDRESS');
      });
    });

    describe('team email and marketingSessionId are missing', () => {
      it('responds with status code 400 and MISSING_PROGRAM_EMAIL_OR_SESSION_ID token', async () => {
        const res = await request(app).post('/contactUs').set(header).send({ email: 'abc@abc.com' });

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('MISSING_PROGRAM_EMAIL_OR_SESSION_ID');
      });
    });

    describe('team with specified email does not exist', () => {
      it('responds with status code 404 and PROGRAM_NOT_FOUND token', async () => {
        const res = await request(app).post('/contactUs').set(header).send({ email: 'abc@abc.abc', programEmail: 'dummyEmailIdentifier' });

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('PROGRAM_NOT_FOUND');
      });
    });

    describe('whe the appointment tour type is invalid', () => {
      it('responds with status code 404 and INCORRECT_TOUR_TYPE token', async () => {
        await createProgram(hubTeamId);

        const payload = {
          name: 'Orson Welles',
          phone: '+1-202-555-0130',
          programEmail: programEmailIdentifier,
          requestAppointment: {
            startDate: now().startOf('day').add(2, 'days'),
            tourType: DALTypes.TourTypes.IN_PERSON_SELF_GUIDED_TOUR,
          },
        };

        const res = await request(app).post('/guestCard').set(header).send(payload);

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('INCORRECT_TOUR_TYPE');
      });
    });

    it('should create a lead', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1202-555-0130',
        programEmail: programEmailIdentifier,
      };

      const { id: teamPropertyProgramId } = await createProgram(hubTeamId);

      const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
      const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

      const res = await request(app).post('/contactUs').set(header).send(formData);

      expect(res.status).to.equal(202);

      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
      expect(parties[0].teamPropertyProgramId).to.equal(teamPropertyProgramId);
      expect(parties[0].partyMembers[0].fullName).to.contain(formData.name);
    });

    describe('when party routing strategy is "Round Robin"', () => {
      describe('when the dispatcher is the next user in line', () => {
        it('should create a lead and skip dispatcher, i.e. assign it to the next agent', async () => {
          const { id: teamId } = await createATeam({ metadata: { partyRoutingStrategy: DALTypes.PartyRoutingStrategy.ROUND_ROBIN } });

          const { id: agentId } = await createAUser();
          await createATeamMember({ teamId, userId: agentId });

          const { id: dispatcherId } = await createAUser();
          await createATeamMember({
            teamId,
            userId: dispatcherId,
            roles: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LD.name] },
          });

          await updateTeam(ctx, teamId, { metadata: { lastAssignedUser: agentId } });

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            teamEmail: programEmailIdentifier,
          };
          await createProgram(teamId);

          const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
          const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

          const res = await request(app).post('/contactUs').set(header).send(formData);

          expect(res.status).to.equal(202);

          await task;

          const [lead] = await loadParties(ctx);
          expect(lead.userId).to.equal(agentId);
        });
      });

      describe('when only dispatcher is available', () => {
        it('should create a lead and assign it to dispatcher', async () => {
          const { id: teamId } = await createATeam({ metadata: { partyRoutingStrategy: DALTypes.PartyRoutingStrategy.ROUND_ROBIN } });

          const { id: agentId } = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
          await createATeamMember({ teamId, userId: agentId });

          const { id: dispatcherId } = await createAUser();
          await createATeamMember({
            teamId,
            userId: dispatcherId,
            roles: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LD.name] },
          });

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            teamEmail: programEmailIdentifier,
          };
          await createProgram(teamId);

          const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
          const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

          const res = await request(app).post('/contactUs').set(header).send(formData);

          expect(res.status).to.equal(202);

          await task;

          const [lead] = await loadParties(ctx);
          expect(lead.userId).to.equal(dispatcherId);
        });
      });
    });

    describe('when party routing strategy is "Dispatcher"', () => {
      it('should create a lead and assign it to dispatcher', async () => {
        const { id: teamId } = await createATeam({ metadata: { partyRoutingStrategy: DALTypes.PartyRoutingStrategy.DISPATCHER } });

        const { id: agentId } = await createAUser();
        await createATeamMember({ teamId, userId: agentId });

        const { id: dispatcherId } = await createAUser();
        await createATeamMember({
          teamId,
          userId: dispatcherId,
          roles: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LD.name] },
        });

        const formData = {
          name: 'Orson Welles',
          phone: '+1-202-555-0130',
          teamEmail: programEmailIdentifier,
        };
        await createProgram(teamId);

        const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

        const res = await request(app).post('/contactUs').set(header).send(formData);

        expect(res.status).to.equal(202);

        await task;

        const [lead] = await loadParties(ctx);
        expect(lead.userId).to.equal(dispatcherId);
      });
    });

    it('should save qualification question data', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1-202-555-0130',
        qualificationQuestions,
        programEmail: programEmailIdentifier,
      };

      await createProgram(hubTeamId);

      const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
      const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

      const res = await request(app).post('/contactUs').set(header).send(formData);

      expect(res.status).to.equal(202);

      await task;

      const parties = await loadParties(ctx);
      expect(parties[0].qualificationQuestions).to.deep.equal(formData.qualificationQuestions);
    });

    describe('when email and phone are invalid and createOnError is not specified', () => {
      it(`should consider createOnError true and save a communicaton
          entry with the validationMessage reflecting the invalid values`, async () => {
        const formData = {
          name: 'Orson Welles',
          phone: 'aa',
          email: 'xyz',
          message: 'Help me, Obi One!',
          qualificationQuestions,
          programEmail: programEmailIdentifier,
        };

        await createProgram(hubTeamId);

        const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

        const res = await request(app).post('/contactUs').set(header).send(formData);

        expect(res.status).to.equal(202);

        await task;

        const messages = await getAllComms(ctx);
        const emailError = `Email address supplied was invalid '${formData.email}'`;
        const expectedValidationMessage = `${emailError}`;

        expect(messages[0].message.validationMessages).to.equal(expectedValidationMessage);
      });
    });

    it('should set teamPropertyProgramId FK on Party and Communication', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1-202-555-0130',
        qualificationQuestions,
        programEmail: programEmailIdentifier,
      };

      await createProgram(hubTeamId);

      const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
      const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

      const res = await request(app).post('/contactUs').set(header).send(formData);

      expect(res.status).to.equal(202);

      await task;

      const parties = await loadParties(ctx);
      const messages = await getCommsByType(ctx, DALTypes.CommunicationMessageType.WEB);
      const program = await loadProgramForIncomingCommByEmail(ctx, programEmailIdentifier);

      expect(parties[0].teamPropertyProgramId).to.equal(program.teamPropertyProgramId);
      expect(parties[0].metadata.creationType).to.equal(DALTypes.PartyCreationTypes.SYSTEM);
      expect(toMoment(parties[0].metadata.qualQuestionsCompleted).isValid()).to.equal(true);
      expect(parties[0].metadata.propertyId).to.equal(program.propertyId);
      expect(messages[0].teamPropertyProgramId).to.equal(program.teamPropertyProgramId);
    });

    describe('when marketingSessionId is present in request data', () => {
      it('should use it to set teamPropertyProgramId FK on Party and Communication', async () => {
        const defaultProgram = await createProgram(hubTeamId);

        const googleProgram = await createATeamPropertyProgram({
          teamId: hubTeamId,
          propertyId: defaultProgram.propertyId,
          directEmailIdentifier: 'google@program.com',
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        await createAProgramReferrer({
          programId: googleProgram.programId,
          order: '1',
          currentUrl: '^(.*\\.)?google.com$',
          referrerUrl: '.*',
        });

        const phone = '+1-202-555-0130';

        const { task } = await setupMsgQueueAndWaitFor([msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(phone)]);

        const { status, body } = await request(app).post('/marketing/session').set(header).send({ currentUrl: 'parkmerced.google.com', referrerUrl: '*' });

        expect(status).to.equal(200);
        const { marketingSessionId } = body;

        const formData = {
          name: 'Orson Welles',
          phone,
          qualificationQuestions,
          programEmail: programEmailIdentifier,
          marketingSessionId,
        };

        const res = await request(app).post('/contactUs').set(header).send(formData);

        expect(res.status).to.equal(202);

        await task;

        const parties = await loadParties(ctx);
        const messages = await getCommsByType(ctx, DALTypes.CommunicationMessageType.WEB);

        expect(parties[0].teamPropertyProgramId).to.equal(googleProgram.id);
        expect(parties[0].metadata.creationType).to.equal(DALTypes.PartyCreationTypes.SYSTEM);
        expect(messages[0].teamPropertyProgramId).to.equal(googleProgram.id);
      });
    });

    it('should create only one lead', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1-202-555-0130',
        programEmail: programEmailIdentifier,
      };

      await createProgram(hubTeamId);

      const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
      const { task: firstMessage } = await setupMsgQueueAndWaitFor([condition]);

      const res1 = await request(app).post('/contactUs').set(header).send(formData);

      expect(res1.status).to.equal(202);
      await firstMessage;

      const {
        resolvers,
        promises: [secondMessage],
      } = waitFor([condition]);
      matcher.addWaiters(resolvers);

      const res2 = await request(app).post('/contactUs').set(header).send(formData);

      expect(res2.status).to.equal(202);
      await secondMessage;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
      expect(parties[0].partyMembers[0].fullName).to.contain(formData.name);
    });

    it('should save a communication entry', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1-202-555-0130',
        text: 'I am looking to rent...',
        source: 'Parkmerced',
        programEmail: programEmailIdentifier,
      };

      await createProgram(hubTeamId);

      const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
      const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

      const res = await request(app).post('/contactUs').set(header).send(formData);

      expect(res.status).to.equal(202);

      await task;

      const messages = await getCommsByType(ctx, DALTypes.CommunicationMessageType.WEB);
      const [lead] = await loadParties(ctx);
      expect(messages).to.have.length(1);
      const [msg] = messages;
      expect(msg.teams).to.deep.equal([hubTeamId]);
      expect(msg.threadId).to.be.ok;
      expect(msg.message).to.be.ok;
      expect(msg.message.source).to.equal('Parkmerced');
      expect(msg.message.text).to.equal(formData.message);
      expect(msg.parties).to.deep.equal([lead.id]);
      expect(msg.persons).to.deep.equal(lead.partyMembers.map(pm => pm.personId));
      expect(msg.direction).to.equal(DALTypes.CommunicationDirection.IN);
    });

    it('should save all communication entries', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1-202-555-0130',
        text: 'I am looking to rent...',
        programEmail: programEmailIdentifier,
      };

      await createProgram(hubTeamId);

      const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
      const { task } = await setupMsgQueueAndWaitFor([condition]);

      const res1 = await request(app).post('/contactUs').set(header).send(formData);
      expect(res1.status).to.equal(202);

      await task;

      const {
        resolvers,
        promises: [secondMsg],
      } = waitFor([condition]);
      matcher.addWaiters(resolvers);

      const res2 = await request(app).post('/contactUs').set(header).send(formData);

      expect(res2.status).to.equal(202);
      await secondMsg;

      const messages = await getCommsByType(ctx, DALTypes.CommunicationMessageType.WEB);

      expect(messages).to.have.length(2);
    });

    describe('when a lead already exists', () => {
      describe('when  email does not match and the phone matches', () => {
        it('should add the email to the person', async () => {
          const formData = {
            name: 'Orson Welles',
            phone: '12025550130',
            programEmail: programEmailIdentifier,
          };

          await createProgram(hubTeamId);

          const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
          const { task: firstMessage } = await setupMsgQueueAndWaitFor([condition]);

          const res = await request(app).post('/contactUs').set(header).send(formData);

          expect(res.status).to.equal(202);
          await firstMessage;

          const {
            resolvers,
            promises: [secondMessage],
          } = waitFor([condition]);
          matcher.addWaiters(resolvers);
          const secondFormCall = {
            name: 'Orson Welles',
            phone: '12025550130',
            email: 'email@reva.tech',
            programEmail: programEmailIdentifier,
          };

          const res2 = await request(app).post('/contactUs').set(header).send(secondFormCall);

          expect(res2.status).to.equal(202);
          await secondMessage;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);

          const persons = await getRawLeadsPersons(ctx);
          const person = persons && persons.length && persons.find(x => x);

          const contactInfos = await getContactInfosByPersonId(ctx, person.id);
          const email = contactInfos.find(ci => ci.type === 'email');
          expect(email.value).to.equal(secondFormCall.email);

          const phone = contactInfos.find(ci => ci.type === 'phone');
          expect(phone.value).to.equal(secondFormCall.phone);
        });
      });
      describe('when email matches', () => {
        let condition;
        let formData;
        beforeEach(async () => {
          formData = {
            name: '',
            phone: '+1-202-555-0130',
            email: 'email@reva.tech',
            programEmail: programEmailIdentifier,
          };

          await createProgram(hubTeamId);

          condition = email => msg => msg.data && msg.data.email === email;
          const { task: firstMessage } = await setupMsgQueueAndWaitFor([condition(formData.email)]);

          const res = await request(app).post('/contactUs').set(header).send(formData);

          expect(res.status).to.equal(202);
          await firstMessage;
        });

        it('should add the phone number to the person if phone number is not already present ', async () => {
          const secondFormData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0131',
            email: 'email@reva.tech',
            programEmail: programEmailIdentifier,
          };

          const {
            resolvers,
            promises: [secondMessage],
          } = waitFor([condition(secondFormData.email)]);
          matcher.addWaiters(resolvers);
          const res2 = await request(app).post('/contactUs').set(header).send(secondFormData);

          expect(res2.status).to.equal(202);
          await secondMessage;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
          expect(parties[0].partyMembers[0].fullName).to.equal(secondFormData.name);

          const person = await getPersonById(ctx, parties[0].partyMembers[0].personId);
          const phones = person.contactInfo.phones.map(p => p.value);
          expect(phones.length).to.equal(2);
          expect(phones.some(p => p === formatPhoneNumberForDb(formData.phone))).to.be.true;
          expect(phones.some(p => p === formatPhoneNumberForDb(secondFormData.phone))).to.be.true;
        });

        it('should not add the phone number to the person if number is already present ', async () => {
          const secondFormData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            email: 'eMaIl@reva.tech', // also check case sensitivity
            programEmail: programEmailIdentifier,
          };

          const {
            resolvers,
            promises: [secondMessage],
          } = waitFor([condition(secondFormData.email)]);
          matcher.addWaiters(resolvers);
          const res2 = await request(app).post('/contactUs').set(header).send(secondFormData);

          expect(res2.status).to.equal(202);
          await secondMessage;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);

          const person = await getPersonById(ctx, parties[0].partyMembers[0].personId);
          const phones = person.contactInfo.phones.map(p => p.value);
          expect(phones.length).to.equal(1);
          expect(phones.some(p => p === formatPhoneNumberForDb(formData.phone))).to.be.true;
          expect(person.fullName).to.equal(secondFormData.name);
        });

        it('should not modify the legalName if a valid name already existsd', async () => {
          const secondFormData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            email: 'email@reva.tech',
            programEmail: programEmailIdentifier,
          };

          const legalName = 'Test';
          let parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          const initialPerson = await getPersonById(ctx, parties[0].partyMembers[0].personId);
          await updatePerson(ctx, initialPerson.id, { fullName: legalName });
          const {
            resolvers,
            promises: [secondMessage],
          } = waitFor([condition(secondFormData.email)]);
          matcher.addWaiters(resolvers);
          const res2 = await request(app).post('/contactUs').set(header).send(secondFormData);

          expect(res2.status).to.equal(202);
          await secondMessage;

          parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          expect(parties[0].partyMembers[0].fullName).to.equal(legalName);
        });
      });
    });

    describe('when the request contains requestAppointment field and the startdate is valid', () => {
      describe('when a close or archived party exists for the same person on program property', () => {
        const partyCloseReasonEntries = Object.entries(DALTypes.ClosePartyReasons);
        const partyCloseReasonThatShouldNotReopen = partyCloseReasonEntries
          .filter(([_key, value]) => partyCloseReasonsToExcludeForNewLead.includes(value))
          .map(([key, _value]) => key);

        let timezone;

        const getPayload = (teamEmail, partyMemberEmail, appHour, partyMemberPhone = null, appMinutes = 0) => ({
          name: 'Orson Welles',
          email: partyMemberEmail,
          phone: partyMemberPhone,
          teamEmail,
          requestAppointment: {
            startDate: now({ timezone }).startOf('day').add(1, 'days').add(appMinutes, 'minute').add(appHour, 'hour'),
          },
        });

        let createCloseParty;
        let createArchivedParty;
        let createActiveLeaseParty;
        let createRenewalParty;
        let createNewLeaseParty;
        let addPartyMember;
        let updatePropertySlotDuration;

        beforeEach(async () => {
          const { id: user1Id } = await createAUser();
          const { id: team1Id } = await createATeam();
          await createATeamMember({ teamId: team1Id, userId: user1Id });

          const { id: dispatcherId } = await createAUser();
          await createATeamMember({
            teamId: team1Id,
            userId: dispatcherId,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          });

          const { id: property1, timezone: propertyTz } = await createAProperty();
          timezone = propertyTz;
          await createATeamPropertyProgram({
            teamId: team1Id,
            propertyId: property1,
            onSiteLeasingTeamId: team1Id,
            directEmailIdentifier: 'property1',
            commDirection: DALTypes.CommunicationDirection.IN,
          });

          createCloseParty = async closeReason => {
            const yesterday = now().startOf('day').subtract(1, 'days');

            const party = await createAParty({
              userId: user1Id,
              assignedPropertyId: property1,
              endDate: yesterday,
              metadata: { closeReasonId: closeReason },
              workflowState: DALTypes.WorkflowState.CLOSED,
              workflowName: DALTypes.WorkflowName.NEW_LEASE,
              ownerTeam: team1Id,
            });

            return party;
          };

          createArchivedParty = async archiveReason => {
            const yesterday = now().startOf('day').subtract(1, 'days');

            const party = await createAParty({
              userId: user1Id,
              assignedPropertyId: property1,
              archiveDate: yesterday,
              metadata: { archiveReasonId: getKeyByValue(DALTypes.ArchivePartyReasons, archiveReason) },
              workflowState: DALTypes.WorkflowState.ARCHIVED,
              workflowName: DALTypes.WorkflowName.NEW_LEASE,
              ownerTeam: team1Id,
            });

            return party;
          };

          createNewLeaseParty = async () => {
            const party = await createAParty({
              userId: user1Id,
              assignedPropertyId: property1,
              workflowName: DALTypes.WorkflowName.NEW_LEASE,
              workflowState: DALTypes.WorkflowState.ACTIVE,
              ownerTeam: team1Id,
            });

            return party;
          };

          createActiveLeaseParty = async () => {
            const party = await createAParty({
              userId: user1Id,
              assignedPropertyId: property1,
              workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
              ownerTeam: team1Id,
            });

            return party;
          };

          createRenewalParty = async () => {
            const party = await createAParty({
              userId: user1Id,
              assignedPropertyId: property1,
              workflowName: DALTypes.WorkflowName.RENEWAL,
              ownerTeam: team1Id,
            });

            return party;
          };

          addPartyMember = async (party, personEmail) => {
            const contactInfos = enhance([{ type: 'email', value: personEmail, id: newId() }]);
            const person = await createAPerson('Orson Welles', 'Citizen K', contactInfos);
            await createAPartyMember(party.id, { personId: person.id });
          };

          updatePropertySlotDuration = async teamSlotDuration =>
            await updateProperty(ctx, { id: property1 }, { settings: { ...property1.settings, calendar: { teamSlotDuration } } });
        });

        describe(`and the close reason is one of: MARKED_AS_SPAM, REVA_TESTING,
          NO_MEMBERS, CLOSED_DURING_IMPORT, or archived regardless of the reason`, () => {
          it('should create a new party and create the appointment on it', async () => {
            const closeParty = await createCloseParty(partyCloseReasonThatShouldNotReopen[0]);
            const personEmail = 'test@mail.com';
            await addPartyMember(closeParty, personEmail);

            const closeParty1 = await createCloseParty(partyCloseReasonThatShouldNotReopen[1]);
            const personEmail1 = 'test1@mail.com';
            await addPartyMember(closeParty1, personEmail1);

            const closeParty2 = await createCloseParty(partyCloseReasonThatShouldNotReopen[2]);
            const personEmail2 = 'test2@mail.com';
            await addPartyMember(closeParty2, personEmail2);

            const archivedParty = await createArchivedParty(DALTypes.ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY);
            const personEmail3 = 'test3@mail.com';
            await addPartyMember(archivedParty, personEmail3);

            const closeParty4 = await createCloseParty(partyCloseReasonThatShouldNotReopen[4]);
            const personEmail4 = 'test4@mail.com';
            await addPartyMember(closeParty4, personEmail4);

            const condition = msg => msg.data && msg.data.email === personEmail;
            const condition1 = msg => msg.data && msg.data.email === personEmail1;
            const condition2 = msg => msg.data && msg.data.email === personEmail2;
            const condition3 = msg => msg.data && msg.data.email === personEmail3;
            const condition4 = msg => msg.data && msg.data.email === personEmail4;
            const {
              tasks: [task, task1, task2, task3, task4],
            } = await setupQueueToWaitFor([condition, condition1, condition2, condition3, condition4], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail, 1)).expect(202);

            await task;

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail1, 2)).expect(202);

            await task1;

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail2, 3)).expect(202);

            await task2;

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail3, 4)).expect(202);

            await task3;

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail4, 5)).expect(202);

            await task4;

            const openParties = await loadParties(ctx);
            const openAndClosedParties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(openParties).to.have.lengthOf(5);
            expect(openAndClosedParties).to.have.lengthOf(10);

            const partyAppointments = await loadAppointmentsForParties(
              ctx,
              openParties.map(p => p.id),
            );
            expect(partyAppointments).to.have.lengthOf(5);
          });
        });

        describe('and the close reason is BLOCKED_CONTACT', () => {
          it('should create a new party with the appointment on it, if the request contains a spam phone number, but a valid email', async () => {
            const personPhone = '+12025550130';

            const { id: userId } = await createAUser();
            const tenantId = tenant.id;
            const party = await createAParty({ userId });

            const contactInfos = enhance([{ type: 'phone', value: personPhone, id: newId() }], { shouldCleanUpPhoneNumbers: true });
            const person = await createAPerson('Orson Welles', 'Citizen K', contactInfos);
            await createAPartyMember(party.id, { personId: person.id });

            await request(app).post(`/parties/${party.id}/markAsSpam`).set(getAuthHeader(tenantId, userId)).expect(200);

            const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(personPhone);
            const {
              tasks: [task],
            } = await setupQueueToWaitFor([condition], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', 'testEmail1@mail.com', 1, personPhone)).expect(202);

            await task;

            const openParties = await loadParties(ctx);
            const openAndClosedParties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(openParties.length).to.equal(1);
            expect(openAndClosedParties.length).to.equal(2);

            const partyAppointments = await loadAppointmentsForParties(
              ctx,
              openParties.map(p => p.id),
            );
            expect(partyAppointments).to.have.lengthOf(1);
          });
          it('should not create a new party, nor open the closed one, if the request contains a spam email', async () => {
            const personEmail = 'testEmail1@mail.com';

            const { id: userId } = await createAUser();
            const tenantId = tenant.id;
            const party = await createAParty({ userId });

            const contactInfos = enhance([{ type: 'email', value: personEmail, id: newId() }]);
            const person = await createAPerson('Orson Welles', 'Citizen K', contactInfos);
            await createAPartyMember(party.id, { personId: person.id });

            await request(app).post(`/parties/${party.id}/markAsSpam`).set(getAuthHeader(tenantId, userId)).expect(200);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', 'testEmail1@mail.com', 1)).expect(200);

            const openParties = await loadParties(ctx);
            const openAndClosedParties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(openParties.length).to.equal(0);
            expect(openAndClosedParties.length).to.equal(1);

            const partyAppointments = await loadAppointmentsForParties(
              ctx,
              openAndClosedParties.map(p => p.id),
            );
            expect(partyAppointments).to.have.lengthOf(0);
            const spamComms = await getAllSpamCommunications(ctx);
            expect(spamComms.length).to.equal(1);
          });
        });

        describe('and the close reason is not in the close reasons that should not reopen the party', () => {
          it('should reopen the closed party and create the appointment on it', async () => {
            const closeParty = await createCloseParty('FOUND_ANOTHER_PLACE');
            const personEmail = 'test@mail.com';
            await addPartyMember(closeParty, personEmail);

            const condition = msg => msg.data && msg.data.email === personEmail;

            const {
              tasks: [task],
            } = await setupQueueToWaitFor([condition], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail, 1)).expect(202);

            await task;

            const openParties = await loadParties(ctx);
            const openAndClosedParties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(openParties).to.have.lengthOf(1);
            expect(openAndClosedParties).to.have.lengthOf(1);

            const partyAppointments = await loadAppointmentsForParties(ctx, [closeParty.id]);
            expect(partyAppointments).to.have.lengthOf(1);
          });
        });

        describe('and the party workflow is activeLease', () => {
          it('should create a new newLease party', async () => {
            const activeLeaseParty = await createActiveLeaseParty();
            const personEmail = 'test@mail.com';
            await addPartyMember(activeLeaseParty, personEmail);

            const condition = msg => msg.data && msg.data.email === personEmail;

            const {
              tasks: [task],
            } = await setupQueueToWaitFor([condition], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail, 1)).expect(202);

            await task;

            const openParties = await loadParties(ctx);
            expect(openParties).to.have.lengthOf(2);

            const newLeaseParty = openParties.filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE);
            expect(newLeaseParty).to.have.lengthOf(1);

            const partyAppointments = await loadAppointmentsForParties(ctx, [activeLeaseParty.id]);
            expect(partyAppointments).to.have.lengthOf(0);
          });
        });

        describe('and the party workflow is renewal', () => {
          it('should create a new newLease party', async () => {
            const renewalParty = await createRenewalParty();
            const personEmail = 'test@mail.com';
            await addPartyMember(renewalParty, personEmail);

            const condition = msg => msg.data && msg.data.email === personEmail;

            const {
              tasks: [task],
            } = await setupQueueToWaitFor([condition], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail, 1)).expect(202);

            await task;

            const openParties = await loadParties(ctx);
            expect(openParties).to.have.lengthOf(2);

            const newLeaseParty = openParties.filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE);
            expect(newLeaseParty).to.have.lengthOf(1);

            const partyAppointments = await loadAppointmentsForParties(ctx, [renewalParty.id]);
            expect(partyAppointments).to.have.lengthOf(0);
          });
        });

        describe('and the newLease party is archived, and we have an active lease and renewal created for it', () => {
          it('should create a new newLease party', async () => {
            const archivedNewLeaseParty = await createArchivedParty(DALTypes.ArchivePartyReasons.RESIDENT_CREATED);
            const activeLeaseParty = await createActiveLeaseParty();
            const renewalParty = await createRenewalParty();

            const personEmail = 'test@mail.com';
            const contactInfos = enhance([{ type: 'email', value: personEmail, id: newId() }]);
            const person = await createAPerson('Orson Welles', 'Citizen K', contactInfos);

            await createAPartyMember(archivedNewLeaseParty.id, { personId: person.id });
            await createAPartyMember(activeLeaseParty.id, { personId: person.id });
            await createAPartyMember(renewalParty.id, { personId: person.id });

            const condition = msg => msg.data && msg.data.email === personEmail;

            const {
              tasks: [task],
            } = await setupQueueToWaitFor([condition], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail, 1)).expect(202);

            await task;

            const openParties = await loadParties(ctx);
            const allParties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(openParties).to.have.lengthOf(3);
            expect(allParties).to.have.lengthOf(4);

            const newLeaseParty = allParties.filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE);
            expect(newLeaseParty).to.have.lengthOf(2);

            const renewalPartyAppointments = await loadAppointmentsForParties(ctx, [renewalParty.id]);
            const activeLeasePartyAppointments = await loadAppointmentsForParties(ctx, [activeLeaseParty.id]);
            const archivedNewLeasePartyAppointments = await loadAppointmentsForParties(ctx, [archivedNewLeaseParty.id]);

            expect(renewalPartyAppointments).to.have.lengthOf(0);
            expect(activeLeasePartyAppointments).to.have.lengthOf(0);
            expect(archivedNewLeasePartyAppointments).to.have.lengthOf(0);
          });
        });

        describe('and the newLease party is active, and we have an active lease and renewal created for it', () => {
          it('should create appointment only for the new newLease party', async () => {
            const newLeaseParty = await createNewLeaseParty();
            const activeLeaseParty = await createActiveLeaseParty();
            const renewalParty = await createRenewalParty();

            const personEmail = 'test@mail.com';
            const contactInfos = enhance([{ type: 'email', value: personEmail, id: newId() }]);
            const person = await createAPerson('Orson Welles', 'Citizen K', contactInfos);

            await createAPartyMember(newLeaseParty.id, { personId: person.id });
            await createAPartyMember(activeLeaseParty.id, { personId: person.id });
            await createAPartyMember(renewalParty.id, { personId: person.id });

            const condition = msg => msg.data && msg.data.email === personEmail;

            const {
              tasks: [task],
            } = await setupQueueToWaitFor([condition], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail, 1)).expect(202);

            await task;

            const openParties = await loadParties(ctx);
            const allParties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(openParties).to.have.lengthOf(3);
            expect(allParties).to.have.lengthOf(3);

            const renewalPartyAppointments = await loadAppointmentsForParties(ctx, [renewalParty.id]);
            const activeLeasePartyAppointments = await loadAppointmentsForParties(ctx, [activeLeaseParty.id]);
            const newLeasePartyAppointments = await loadAppointmentsForParties(ctx, [newLeaseParty.id]);

            expect(renewalPartyAppointments).to.have.lengthOf(0);
            expect(activeLeasePartyAppointments).to.have.lengthOf(0);
            expect(newLeasePartyAppointments).to.have.lengthOf(1);
          });
        });

        describe('even if the team slot duration is 90min', () => {
          it('should create an appointment for the new party', async () => {
            const personEmail = 'claudiu+001@reva.tech';
            const teamSlotDuration = 90;
            await updatePropertySlotDuration(teamSlotDuration);

            const condition = msg => msg.data && msg.data.email === personEmail;

            const {
              tasks: [task],
            } = await setupQueueToWaitFor([condition], ['webInquiry']);

            await request(app).post('/guestCard').set(header).send(getPayload('property1', personEmail)).expect(202);

            await task;

            const openParties = await loadParties(ctx);
            expect(openParties).to.have.lengthOf(1);

            const partyAppointments = await loadAppointmentsForParties(ctx, [openParties[0].id]);
            expect(partyAppointments).to.have.lengthOf(1);
          });
        });
      });
    });

    describe('when the request contains requestQuote field', () => {
      let unitQualifiedName;
      let petRent;

      let program;
      let user;
      let person;
      const personPhone = '1202555-  0130';
      const personEmail = 'person@domain.com';

      let createArchivedNewLeaseParty;
      let createActiveLeaseParty;
      let createRenewalParty;

      beforeEach(async () => {
        const { propertyId, programId } = await createProgram(hubTeamId);
        const unitRent = await createAFee({
          feeName: 'UnitBaseRent',
          displayName: 'Unit Base Rent',
          absolutePrice: 300,
          feeType: DALTypes.FeeType.INVENTORY_GROUP,
          quoteSectionName: DALTypes.QuoteSection.INVENTORY,
          servicePeriod: DALTypes.ServicePeriod.MONTH,
          propertyId,
        });

        petRent = await createAFee({
          feeName: 'PetRent',
          displayName: 'Pet Rent',
          absolutePrice: 30,
          feeType: DALTypes.FeeType.SERVICE,
          quoteSectionName: DALTypes.QuoteSection.PET,
          servicePeriod: DALTypes.ServicePeriod.MONTH,
          propertyId,
        });

        await setAssociatedFees(unitRent.id, petRent.id);

        await saveTeamPropertyProgram(ctx, {
          teamId: hubTeamId,
          propertyId,
          programId,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });

        const { id: leaseNameId } = await createALeaseName(ctx, { propertyId });
        const inventoryGroup = await createAInventoryGroup({ propertyId, leaseNameId, feeId: unitRent.id, basePriceMonthly: 300 });
        const inventory = await createAnInventory({
          propertyId,
          inventoryGroupId: inventoryGroup.id,
        });
        await createALeaseTerm({ termLength: 12, propertyId, leaseNameId });

        await saveUnitsRevaPricing([inventory]);
        await refreshUnitSearch();
        [{ fullQualifiedName: unitQualifiedName }] = await getInventoriesQualifiedNamesByIds(ctx, [inventory.id]);

        program = await loadProgramForIncomingCommByEmail(ctx, programEmailIdentifier);

        const contactInfos = enhance(
          [
            { type: 'phone', value: personPhone, id: newId() },
            { type: 'email', value: personEmail, id: newId() },
          ],
          {
            shouldCleanUpPhoneNumbers: true,
          },
        );
        person = await createAPerson('Orson Welles', 'Citizen K', contactInfos);

        user = await createAUser({ ctx, name: 'user-1' });
        const team = await createATeam();
        await createATeamMember({ teamId: team.id, userId: user.id });

        createArchivedNewLeaseParty = async () => {
          const yesterday = now().startOf('day').subtract(1, 'days');

          const party = await createAParty({
            userId: user.id,
            assignedPropertyId: program.propertyId,
            archiveDate: yesterday,
            workflowName: DALTypes.WorkflowName.NEW_LEASE,
            workflowState: DALTypes.WorkflowState.ARCHIVED,
            ownerTeam: team.id,
          });

          return party;
        };

        createActiveLeaseParty = async () => {
          const party = await createAParty({
            userId: user.id,
            assignedPropertyId: program.propertyId,
            workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
            workflowState: DALTypes.WorkflowState.ACTIVE,
            ownerTeam: team.id,
          });

          return party;
        };

        createRenewalParty = async () => {
          const party = await createAParty({
            userId: user.iId,
            assignedPropertyId: program.propertyId,
            workflowName: DALTypes.WorkflowName.RENEWAL,
            workflowState: DALTypes.WorkflowState.ACTIVE,
            ownerTeam: team.id,
          });

          return party;
        };
      });

      describe('and the unit qualified name is not valid', () => {
        it('should respond with status code 400 and INVALID_UNIT_QUALIFIED_NAME token', async () => {
          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            teamEmail: programEmailIdentifier,
            requestQuote: {
              unitQualifiedName: 'wrong-unit-name',
              moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
              petCount: 0,
            },
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INVALID_UNIT_QUALIFIED_NAME');
        });
      });

      describe('and the moveInDate is not valid format', () => {
        it('should respond with status code 400 and INVALID_MOVE_IN_DATE token', async () => {
          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            teamEmail: programEmailIdentifier,
            requestQuote: {
              unitQualifiedName,
              moveInDate: '20.11.11',
              petCount: 0,
            },
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INVALID_MOVE_IN_DATE');
        });
      });
      describe('and the petCount is not valid', () => {
        it('should respond with status code 400 and INVALID_PET_COUNT token', async () => {
          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            teamEmail: programEmailIdentifier,
            requestQuote: {
              unitQualifiedName,
              moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
              petCount: -1,
            },
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INVALID_PET_COUNT');
        });
      });
      describe('and the termLength is not valid for the selected unit', () => {
        it('should respond with status code 400 and INVALID_TERM_LENGTH_FOR_SELECTED_INVENTORY token', async () => {
          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            teamEmail: programEmailIdentifier,
            requestQuote: {
              unitQualifiedName,
              moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
              petCount: 0,
              termLength: 6,
            },
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INVALID_TERM_LENGTH_FOR_SELECTED_INVENTORY');
        });
      });
      describe('and the unitQualifiedName and moveInDate are valid', () => {
        it('should respond with status code 202 and create a party with published quote and QQ answered', async () => {
          await createACommTemplate(TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE);

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            teamEmail: programEmailIdentifier,
            email: 'orsonWells@test.com',
            qualificationQuestions,
            requestQuote: {
              unitQualifiedName,
              moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
              petCount: 1,
            },
          };

          const condition = msg => msg.data && msg.data.email === formData.email;
          const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(202);

          await task;
          const parties = await loadParties(ctx);
          expect(parties).to.have.lengthOf(1);
          expect(parties[0].qualificationQuestions).to.deep.equal(qualificationQuestions);
          const partyQuotes = await getPublishedQuotesByPartyId(ctx, parties[0].id);
          expect(partyQuotes).to.have.lengthOf(1);
          const { additionalCharges } = partyQuotes[0].publishedQuoteData.additionalAndOneTimeCharges;
          expect(additionalCharges.map(c => c.id)).to.include(petRent.id);
        });
        describe('and a lead exists for the person requesting the quote with QQ not answered', () => {
          it('should not create a new party and set the qualification questions and update the party state for the existing one', async () => {
            const party = await createAParty({
              userId: user.id,
              ownerTeam: program.teamId,
              assignedPropertyId: program.propertyId,
            });
            await createAPartyMember(party.id, { personId: person.id });

            await createACommTemplate(TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE);

            const secondFormData = {
              name: 'Orson Welles',
              phone: personPhone,
              teamEmail: programEmailIdentifier,
              email: personEmail,
              qualificationQuestions,
              requestQuote: {
                unitQualifiedName,
                moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
                petCount: 0,
              },
            };

            const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(secondFormData.phone);
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(secondFormData);
            expect(res.status).to.equal(202);

            await task;
            const parties = await loadParties(ctx);
            expect(parties).to.have.lengthOf(1);
            expect(parties[0].state).to.equal(DALTypes.PartyStateType.PROSPECT);
            expect(parties[0].qualificationQuestions).to.deep.equal(qualificationQuestions);
            const partyQuotes = await getPublishedQuotesByPartyId(ctx, parties[0].id);
            expect(partyQuotes).to.have.lengthOf(1);
          });
        });
        describe('and a lead exists for the person requesting the quote with QQ answered', () => {
          it('should not create a new party nor overwrite QQs, and update the party state for the existing one', async () => {
            const partyQQ = {
              cashAvailable: Object.keys(questions.SufficientIncome)[2],
              groupProfile: Object.keys(questions.GroupProfile)[1],
              moveInTime: Object.keys(questions.MoveInTime)[1],
            };
            const party = await createAParty({
              userId: user.id,
              ownerTeam: program.teamId,
              assignedPropertyId: program.propertyId,
              qualificationQuestions: partyQQ,
            });

            await createAPartyMember(party.id, { personId: person.id });

            await createACommTemplate(TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE);

            const secondFormData = {
              name: 'Orson Welles',
              phone: personPhone,
              teamEmail: programEmailIdentifier,
              email: personEmail,
              qualificationQuestions,
              requestQuote: {
                unitQualifiedName,
                moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
                petCount: 0,
              },
            };

            const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(secondFormData.phone);
            const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

            const res = await request(app).post('/guestCard').set(header).send(secondFormData);
            expect(res.status).to.equal(202);

            await task;
            const parties = await loadParties(ctx);
            expect(parties).to.have.lengthOf(1);
            expect(parties[0].state).to.equal(DALTypes.PartyStateType.PROSPECT);
            expect(parties[0].qualificationQuestions).to.deep.equal(partyQQ);
            const partyQuotes = await getPublishedQuotesByPartyId(ctx, parties[0].id);
            expect(partyQuotes).to.have.lengthOf(1);
          });
        });

        describe('when the request is valid', () => {
          describe('and an archived party exists for the same person on program property', () => {
            it('should respond with status code 202 and create a party with published quote', async () => {
              const party = await createArchivedNewLeaseParty();
              await createAPartyMember(party.id, { personId: person.id });

              await createACommTemplate(TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE);

              const formData = {
                name: 'Orson Welles',
                phone: personPhone,
                teamEmail: programEmailIdentifier,
                email: personEmail,
                qualificationQuestions,
                requestQuote: {
                  unitQualifiedName,
                  moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
                  petCount: 0,
                },
              };

              const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
              const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

              const res = await request(app).post('/guestCard').set(header).send(formData);
              expect(res.status).to.equal(202);

              await task;
              const allParties = await loadParties(ctx, partyWfStatesSubset.all);
              expect(allParties).to.have.lengthOf(2);

              const partyQuotes = await getPublishedQuotesByPartyId(ctx, party.id);
              expect(partyQuotes).to.have.lengthOf(0);
            });
          });

          describe('and an activeLease party exists for the same person on program property', () => {
            it('should respond with status code 202 and create a party with published quote', async () => {
              const party = await createActiveLeaseParty();
              await createAPartyMember(party.id, { personId: person.id });

              await createACommTemplate(TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE);

              const formData = {
                name: 'Orson Welles',
                phone: personPhone,
                teamEmail: programEmailIdentifier,
                email: personEmail,
                qualificationQuestions,
                requestQuote: {
                  unitQualifiedName,
                  moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
                  petCount: 0,
                },
              };

              const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
              const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

              const res = await request(app).post('/guestCard').set(header).send(formData);
              expect(res.status).to.equal(202);

              await task;
              const allParties = await loadParties(ctx, partyWfStatesSubset.all);
              expect(allParties).to.have.lengthOf(2);

              const [newLeaseParty] = allParties.filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE);
              const partyQuotes = await getPublishedQuotesByPartyId(ctx, newLeaseParty.id);
              expect(partyQuotes).to.have.lengthOf(1);
            });
          });

          describe('and a renewal party exists for the same person on program property', () => {
            it('should respond with status code 202 and create a party with published quote', async () => {
              const party = await createRenewalParty();
              await createAPartyMember(party.id, { personId: person.id });

              await createACommTemplate(TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE);

              const formData = {
                name: 'Orson Welles',
                phone: personPhone,
                teamEmail: programEmailIdentifier,
                email: personEmail,
                qualificationQuestions,
                requestQuote: {
                  unitQualifiedName,
                  moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
                  petCount: 0,
                },
              };

              const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
              const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

              const res = await request(app).post('/guestCard').set(header).send(formData);
              expect(res.status).to.equal(202);

              await task;
              const allParties = await loadParties(ctx, partyWfStatesSubset.all);
              expect(allParties).to.have.lengthOf(2);

              const [newLeaseParty] = allParties.filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE);
              const partyQuotes = await getPublishedQuotesByPartyId(ctx, newLeaseParty.id);
              expect(partyQuotes).to.have.lengthOf(1);
            });
          });

          describe('and an archived party, active lease and renewal exists for the same person on program property', () => {
            it('should respond with status code 202 and create a party with published quote', async () => {
              const archivedNewLeaseParty = await createArchivedNewLeaseParty();
              const activeLeaseParty = await createActiveLeaseParty();
              const renewalParty = await createRenewalParty();

              await createAPartyMember(archivedNewLeaseParty.id, { personId: person.id });
              await createAPartyMember(activeLeaseParty.id, { personId: person.id });
              await createAPartyMember(renewalParty.id, { personId: person.id });

              await createACommTemplate(TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE);

              const formData = {
                name: 'Orson Welles',
                phone: personPhone,
                teamEmail: programEmailIdentifier,
                email: personEmail,
                qualificationQuestions,
                requestQuote: {
                  unitQualifiedName,
                  moveInDate: now().format(YEAR_MONTH_DAY_FORMAT),
                  petCount: 0,
                },
              };

              const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
              const { task } = await setupQueueToWaitFor([condition], ['webInquiry']);

              const res = await request(app).post('/guestCard').set(header).send(formData);
              expect(res.status).to.equal(202);

              await task;

              const openParties = await loadParties(ctx);
              const allParties = await loadParties(ctx, partyWfStatesSubset.all);
              expect(openParties).to.have.lengthOf(3);
              expect(allParties).to.have.lengthOf(4);

              const [newLeaseParty] = allParties.filter(
                p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE && p.workflowState === DALTypes.WorkflowState.ACTIVE,
              );
              const partyQuotes = await getPublishedQuotesByPartyId(ctx, newLeaseParty.id);
              expect(partyQuotes).to.have.lengthOf(1);
            });
          });
        });
      });
    });

    describe('when receiving a web inquiry from known originator but the party owner has been deactivated', async () => {
      const fromPhoneGuest = '12029990111';
      const fromEmailGuest = 'guest1@test.com';
      const directPhoneIdentifier = '12025550144';
      const teamMemberPhone = '12025550155';
      const directEmailIdentifier = 'mainprogramemail';

      let partyOwnerUser;
      let dispatcherUser;
      let property;
      let mainTeam;

      const getWebInquiryDetails = () => ({
        name: 'Orson Welles',
        phone: '+1-202-999-0111',
        email: fromEmailGuest,
        programEmail: directEmailIdentifier,
        _userName_: '',
        _name_: EXPECTED_HONEYPOT_NAME,
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
        await createAProgram({ property, team: mainTeam, directPhoneIdentifier, directEmailIdentifier });

        await createATeamMember({
          teamId: mainTeam.id,
          userId: partyOwnerUser.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LWA.name],
          },
          inactive: true,
          directPhoneIdentifier: teamMemberPhone,
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

      it(`when web inquiry is to program a raw lead will NOT be created and the existing
party of the user will be assigned to the dispatcher of the team`, async () => {
        const { id: personId } = await createAPerson();
        const contactInfos = [
          {
            type: 'phone',
            value: fromPhoneGuest,
          },
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
        const formData = getWebInquiryDetails();

        const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);

        const res = await request(app).post('/contactUs').set(header).send(formData);

        expect(res.status).to.equal(202);
        await task;

        const parties = await loadParties(ctx, partyWfStatesSubset.all);
        expect(parties.length).to.equal(1);
        expect(parties[0].userId).to.equal(dispatcherUser.id);
      });
    });

    describe('when the Honeypot trap is enabled', () => {
      describe('and the honeypot fields exist', () => {
        it('should respond with status code 202 if the _userName_ field is empty and the _name_ field has the value "Mary-Jane Smith"', async () => {
          await enableHoneypotTrap();

          const { id: onSiteLeasingTeamId } = await createATeam();

          const { id: userId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId });
          await createProgram(hubTeamId, onSiteLeasingTeamId);

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programEmailIdentifier,
            _userName_: '',
            _name_: EXPECTED_HONEYPOT_NAME,
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(202);
        });

        it('should respond with status code 200 if the _userName_ field has a none blank value', async () => {
          await enableHoneypotTrap();

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programEmailIdentifier,
            _userName_: 'populated',
            _name_: EXPECTED_HONEYPOT_NAME,
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(200);
        });

        it('should respond with status code 200 if the _userName_ field is missing', async () => {
          await enableHoneypotTrap();

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programEmailIdentifier,
            _name_: EXPECTED_HONEYPOT_NAME,
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(200);
        });

        it('should respond with status code 200 if the _name_ field is missing', async () => {
          await enableHoneypotTrap();

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programEmailIdentifier,
            _userName_: '',
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(200);
        });

        it('should respond with status code 200 if the _name_ field has other value than "Mary-Jane Smith"', async () => {
          await enableHoneypotTrap();

          const UNEXPECTED_HONEYPOT_NAME = 'Mary-Jane';

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programEmailIdentifier,
            _userName_: '',
            _name_: UNEXPECTED_HONEYPOT_NAME,
          };

          const res = await request(app).post('/guestCard').set(header).send(formData);

          expect(res.status).to.equal(200);
        });

        it('should respond with status code 202 if the _userName_ field and the _name_ field are missing', async () => {
          await enableHoneypotTrap();

          const { id: onSiteLeasingTeamId } = await createATeam();

          const { id: userId } = await createAUser();
          await createATeamMember({ teamId: onSiteLeasingTeamId, userId });
          await createProgram(hubTeamId, onSiteLeasingTeamId);

          const formDataWithProgramEmail = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programEmailIdentifier,
          };

          const resWithProgramEmail = await request(app).post('/guestCard').set(header).send(formDataWithProgramEmail);

          expect(resWithProgramEmail.status).to.equal(202);

          const formDataWithTeamEmail = {
            name: 'Orson Welles3',
            phone: '+1-202-555-0132',
            teamEmail: programEmailIdentifier,
          };

          const responseWithTeamEmail = await request(app).post('/guestCard').set(header).send(formDataWithTeamEmail);

          expect(responseWithTeamEmail.status).to.equal(202);
        });
      });
    });

    describe('when a propertyId is passed as header param', () => {
      let headerWithPropertyId;
      let task;
      let formData;
      let matchingProgram;

      beforeEach(async () => {
        const metadata = { defaultMatchingPath: null, requireMatchingPathFlag: true, requireMatchingSourceFlag: null, defaultMatchingSource: null };

        const defaultProgramEmail = 'default.program.email';
        const defaultProgram = await createProgram(hubTeamId, null, metadata, defaultProgramEmail);
        const defaultPropertyId = defaultProgram.propertyId;
        await updateProperty(ctx, { id: defaultPropertyId }, { settings: { comms: { defaultPropertyProgram: defaultProgram.programId } } });

        const matchingProgramEmail = 'matching.program.email';
        matchingProgram = await createProgram(hubTeamId, null, metadata, matchingProgramEmail);
        const matchingPropertyId = matchingProgram.propertyId;
        await updateProperty(ctx, { id: matchingPropertyId }, { settings: { comms: { defaultPropertyProgram: matchingProgram.programId } } });

        formData = {
          name: 'Orson Welles',
          phone: '+1-202-555-0130',
          programEmail: defaultProgramEmail,
        };

        const queueCondition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);
        ({ task } = await setupMsgQueueAndWaitFor([queueCondition]));

        headerWithPropertyId = {
          ...header,
          'x-reva-property-id': matchingPropertyId,
        };
      });

      describe('a request on contactUs', () => {
        it('should create a lead in the correct property', async () => {
          const res = await request(app).post('/contactUs').set(headerWithPropertyId).send(formData);

          expect(res.status).to.equal(202);

          await task;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
          expect(parties[0].teamPropertyProgramId).to.equal(matchingProgram.id);
          expect(parties[0].partyMembers[0].fullName).to.contain(formData.name);
        });
      });

      describe('a request on guestCard', () => {
        it('should create a lead in the correct property', async () => {
          const res = await request(app).post('/guestCard').set(headerWithPropertyId).send(formData);

          expect(res.status).to.equal(202);

          await task;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
          expect(parties[0].teamPropertyProgramId).to.equal(matchingProgram.id);
          expect(parties[0].partyMembers[0].fullName).to.contain(formData.name);
        });
      });

      describe('a request on marketing guestCard', () => {
        it('should create a lead in the correct property', async () => {
          const res = await request(app).post('/marketing/guestCard').set(headerWithPropertyId).send(formData);

          expect(res.status).to.equal(202);

          await task;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
          expect(parties[0].teamPropertyProgramId).to.equal(matchingProgram.id);
          expect(parties[0].partyMembers[0].fullName).to.contain(formData.name);
        });
      });
    });

    describe('when a program is inactive', () => {
      describe('and it contains a fallback program active', () => {
        it('should create a new raw lead and a comm entry associated to the fallback program', async () => {
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
          const team = await createATeam({ name: 'testTeam', module: 'leasing' });

          const { id: propertyId } = await createAProperty();
          const { id: teamPropertyProgramId } = await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
            programEndDate: now().add(-1, 'days'),
            programFallbackId: fallbackProgramId,
          });

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programIdentifier,
          };

          const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);

          const {
            tasks: [task],
          } = await setupQueueToWaitFor([condition], ['webInquiry']);

          await request(app).post('/guestCard').set(header).send(formData).expect(202);

          await task;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          const [party] = parties;

          const comms = await getAllComms(ctx);
          expect(comms.length).to.equal(1);
          const [comm] = comms;

          expect(party.assignedPropertyId).to.equal(fallbackPropertyId);
          expect(party.storedUnitsFilters).to.deep.equal({
            numBedrooms: {},
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

      describe('and the program has no fallback program', () => {
        it('should not create a new raw lead or a comm entry', async () => {
          const programIdentifier = 'program-identifier';
          const team = await createATeam({ name: 'testTeam', module: 'leasing' });

          const { id: propertyId } = await createAProperty();
          await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directEmailIdentifier: programIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
            programEndDate: now().add(-1, 'days'),
            programFallbackId: null,
          });

          const formData = {
            name: 'Orson Welles',
            phone: '+1-202-555-0130',
            programEmail: programIdentifier,
          };

          const condition = msg => msg.data && msg.data.phone === getOnlyDigitsFromPhoneNumber(formData.phone);

          const {
            tasks: [task],
          } = await setupQueueToWaitFor([condition], ['webInquiry']);

          await request(app).post('/guestCard').set(header).send(formData).expect(202);

          await task;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(0);

          const comms = await getAllComms(ctx);
          expect(comms.length).to.equal(0);
        });
      });
    });
  });
});
