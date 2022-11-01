/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import getUUID from 'uuid/v4';
import Promise from 'bluebird';
import path from 'path';
import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import app from '../../api';
import { setupConsumers, getEnvQueueName, DEAD_LETTER_QUEUE_SUFFIX, RETRY_QUEUE_SUFFIX } from '../../../workers/consumer';
import { waitFor } from '../../../testUtils/apiHelper';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { testCtx as ctx, createAUser, createATeam, createATeamMember, createAProperty, createATeamPropertyProgram } from '../../../testUtils/repoHelper';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction, constructDataForDeterminingContext } from '../../../workers/communication/inboundEmailHandler';
import { loadParties } from '../../../dal/partyRepo';
import { getAllComms } from '../../../dal/communicationRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import config from '../../../config';
import timedOut from '../../../../common/helpers/sleep';
import { readAndParseEmail } from '../../../testUtils/emailHelper';

import { getEmailParserProvider } from '../../../services/routing/email-parser/email-parser-provider';
import zillow from '../../../services/__tests__/email-parser/zillow.json';
import apartments from '../../../services/__tests__/email-parser/apartments.json';
import apartmentSearch from '../../../services/__tests__/email-parser/apartment-search.json';
import zendesk from '../../../services/__tests__/email-parser/zendesk.json';
import zillowReplyToAsObject from '../../../services/__tests__/email-parser/zillow-reply-to-as-object.json';
import apartmentList from '../../../services/__tests__/email-parser/apartment-list.json';
import zumper from '../../../services/__tests__/email-parser/zumper.json';
import padmapper from '../../../services/__tests__/email-parser/padmapper.json';
import { getTwilioProviderOps } from '../../../common/twillioHelper';

chai.use(sinonChai);
const expect = chai.expect;

describe('/webhooks/email', () => {
  let twilioCall;
  beforeEach(() => {
    twilioCall = sinon.spy(getTwilioProviderOps(), 'getPhoneNumberInfo');
  });
  afterEach(() => {
    twilioCall.restore();
  });

  describe('POST', () => {
    const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;

    const createProgram = async (teamId, directEmailIdentifier) => {
      const { id: programPropertyId } = await createAProperty();
      return await createATeamPropertyProgram({
        teamId,
        propertyId: programPropertyId,
        directEmailIdentifier,
        commDirection: DALTypes.CommunicationDirection.IN,
      });
    };

    const getEmailPath = fileName => path.resolve(path.dirname(__dirname), 'resources', fileName);

    describe('mail processing', () => {
      const messageId = getUUID().toString();
      const mailData = { Bucket: 'test', Key: messageId };
      let user;
      let team;
      let conn;

      beforeEach(async () => {
        setDeleteS3MailFunction(() => true);
        user = await createAUser({
          ctx,
          name: 'Aegon',
          email: 'user1+test@test.com',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        team = await createATeam({
          name: 'testTeam',
          module: 'leasing',
        });
        await createATeamMember({
          teamId: team.id,
          userId: user.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          },
        });
      });

      const setupMessageQueueForEmail = async (msgId, condition = m => m.Key === msgId) => {
        const { resolvers, promises } = waitFor([condition]);
        const matcher = createResolverMatcher(resolvers);
        conn = chan();
        await setupConsumers(conn, matcher, ['mail']);

        return { task: Promise.all(promises) };
      };

      const getMessageData = emailDetails => {
        const { messageData } = constructDataForDeterminingContext(emailDetails.msg);
        return { ...messageData, msg: emailDetails.msg };
      };

      const getParsedInformation = async messageData => {
        const emailParserProvider = getEmailParserProvider({
          ...messageData,
          rawMessage: messageData.msg,
        });
        const parsedInformation = emailParserProvider.parseEmailInformation({
          ...messageData,
          rawMessage: messageData.msg,
        });
        if (parsedInformation.from === DALTypes.CommunicationIgnoreFields.EMAIL) parsedInformation.from = undefined;
        if (parsedInformation.fromName === DALTypes.CommunicationIgnoreFields.FULLNAME) parsedInformation.fromName = null;
        return {
          parsedInformation,
          providerName: emailParserProvider.providerName,
        };
      };

      const setupIlsProvider = async (fileName, programDirectEmailIdentifier) => {
        await createProgram(team.id, programDirectEmailIdentifier);
        const filePath = getEmailPath(fileName);
        const messageDetails = await readAndParseEmail(filePath, messageId, [`${programDirectEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`]);
        setGetEmailDetailsFunction(() => messageDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(messageDetails);
        return await getParsedInformation(messageData);
      };

      const checkExpectedResults = async (name, phone, email) => {
        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
        const partyMember = parties[0].partyMembers[0];
        expect(partyMember.fullName).to.equal(name);
        expect(partyMember.contactInfo.defaultEmail).to.equal(email);
        expect(partyMember.contactInfo.defaultPhone).to.equal(phone);
        expect(parties[0].userId).to.equal(user.id);
        expect(parties[0].teams).to.deep.equal([team.id]);
        const commEntries = await getAllComms(ctx);
        expect(commEntries).to.have.length(1);
        expect(commEntries[0].messageId).to.equal(messageId);
        expect(commEntries[0].type).to.equal(DALTypes.CommunicationMessageType.WEB);
      };

      it(`when receiving an email from Zillow, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'zillow.test');

        const emailDetails = {
          event: 'inbound',
          msg: {
            ...zillow.rawMessage,
            text: zillow.text,
            emails: [`${'zillow.test'}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from Zillow, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'zillow.test');

        const emailDetails = {
          event: 'inbound',
          msg: {
            ...zillowReplyToAsObject.rawMessage,
            text: zillowReplyToAsObject.text,
            emails: [`${'zillow.test'}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from Apartments, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'apts.test');

        const emailDetails = {
          event: 'inbound',
          msg: {
            ...apartments.rawMessage,
            text: apartments.text,
            emails: [`${'apts.test'}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from ApartmentList, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'aptsList.test');

        const emailDetails = {
          event: 'inbound',
          msg: {
            ...apartmentList.rawMessage,
            text: apartmentList.text,
            emails: [`${'aptsList.test'}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from Zumper, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'zumper.test');

        const emailDetails = {
          event: 'inbound',
          msg: {
            ...zumper.rawMessage,
            text: zumper.text,
            emails: [`${'zumper.test'}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from Padmapper, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'padmapper.test');
        const emailDetails = {
          event: 'inbound',
          msg: {
            ...padmapper.rawMessage,
            text: padmapper.text,
            emails: [`${'padmapper.test'}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from ApartmentsSearch, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'apt-search.test');

        const emailDetails = {
          event: 'inbound',
          msg: {
            ...apartmentSearch.rawMessage,
            text: apartmentSearch.text,
            emails: [`${'apt-search.test'}@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from ApartmentsSearch, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('apartment-search-base64.eml', 'apartmentsearch.com');
        const { from, fromName, contactInfo } = parsedInformation;
        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(providerName).to.equal('apartmentsearch.com');
        expect(fromName).to.equal('Jacob Mensah');
        expect(contactInfo.phone).to.equal('16073797374');
        expect(from).to.equal('jhm353@cornell.edu');
      });

      it(`when receiving an email from Zendesk, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        await createProgram(team.id, 'zendesk.test');

        const emailDetails = {
          event: 'inbound',
          msg: {
            ...zendesk.rawMessage,
            text: zendesk.text,
            emails: [`zendesk.test@${tenant.name}.${config.mail.emailDomain}`],
            messageId,
          },
        };

        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const messageData = getMessageData(emailDetails);
        const { parsedInformation } = await getParsedInformation(messageData);
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);
      });

      it(`when receiving an email from contactUs - webinquiry, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('contact-us-email.eml', 'contactUsEmail');
        const {
          from,
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        expect(twilioCall).to.have.been.calledOnce;
        await checkExpectedResults(fromName, contactInfo.phone, from);

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.numBedrooms).to.have.length(1);
        expect(partyQualQuestions.numBedrooms).to.eql(qualificationQuestions.numBedrooms);
        expect(partyQualQuestions.moveInTime).to.equal(qualificationQuestions.moveInTime);
        expect(partyQualQuestions.groupProfile).to.equal(qualificationQuestions.groupProfile);
      });

      describe('when receiving an email from facebook', () => {
        it('should extract info from email body, a raw lead should be created and a comm entry is saved', async () => {
          const { parsedInformation, providerName } = await setupIlsProvider('facebook-clxmedia.eml', 'clxMedia');
          const { from, fromName, contactInfo } = parsedInformation;

          expect(providerName).to.equal('clxmedia.com');
          await checkExpectedResults(fromName, contactInfo.phone, from);
          expect(fromName).to.equal('Peroushini Villiamma');
          expect(contactInfo.phone).to.equal('16128190350');
          expect(from).to.equal('pvilliam@macalester.edu');
        });
      });

      it(`when receiving an email from contactUs - webinquiry with no qualificationQuestions, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('contact-us-email-with-no-qq.eml', 'contactUsEmail');
        const { from, fromName, contactInfo } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;

        expect(twilioCall).to.have.been.calledOnce;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone, from);

        expect(partyQualQuestions).to.eql({});
      });

      it(`when receiving an email from contactUs - webinquiry with one qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('contact-us-email-with-one-qq.eml', 'contactUsEmail');
        const {
          from,
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone, from);

        expect(twilioCall).to.have.been.calledOnce;

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.numBedrooms).to.have.length(1);
        expect(partyQualQuestions.numBedrooms).to.eql(qualificationQuestions.numBedrooms);
      });

      it(`when receiving an email from contactUs - webinquiry with two qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('contact-us-email-with-two-qq.eml', 'contactUsEmail');
        const {
          from,
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone, from);

        expect(twilioCall).to.have.been.calledOnce;

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.moveInTime).to.equal(qualificationQuestions.moveInTime);
        expect(partyQualQuestions.groupProfile).to.equal(qualificationQuestions.groupProfile);
      });

      // betterbot-ai is using same format and code as contact us above
      it(`when receiving an email from betterbot-ai with one qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('betterbot-ai-with-one-qq.eml', 'contactUsEmail');
        const {
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone, undefined);

        expect(twilioCall).to.have.been.calledOnce;

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.numBedrooms).to.eql(qualificationQuestions.numBedrooms);
      });

      // betterbot-ai is also using the betterbot.com domain now
      it(`when receiving an email from betterbot-com with one qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('betterbot-com-with-one-qq.eml', 'contactUsEmail');
        const {
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone, undefined);

        expect(twilioCall).to.have.been.calledOnce;

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.numBedrooms).to.eql(qualificationQuestions.numBedrooms);
      });

      it(`when receiving an email from <no-reply@betterbot.ai> with one qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('betterbot-ai-hyphenated-sender-email-variation.eml', 'contactUsEmail');
        const {
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone, undefined);

        expect(twilioCall).to.have.been.calledOnce;

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.numBedrooms).to.eql(qualificationQuestions.numBedrooms);
      });

      it(`when receiving an email from betterbot-ai with two qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('betterbot-ai-with-two-qq.eml', 'contactUsEmail');
        const {
          from,
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone === '' ? undefined : contactInfo.phone, from);

        expect(twilioCall).to.have.been.callCount(0);

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.moveInTime).to.equal(qualificationQuestions.moveInTime);
        expect(partyQualQuestions.groupProfile).to.equal(qualificationQuestions.groupProfile);
      });

      // AmberStudent is using same format and code as contact us above
      it(`when receiving an email from AmberStudent with one qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('amberstudent-with-one-qq.eml', 'contactUsEmail');
        const {
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone, undefined);

        expect(twilioCall).to.have.been.calledOnce;

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.numBedrooms).to.eql(qualificationQuestions.numBedrooms);
      });

      it(`when receiving an email from AmberStudent with two qualificationQuestion, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('amberstudent-with-two-qq.eml', 'contactUsEmail');
        const {
          from,
          fromName,
          contactInfo,
          additionalFields: { qualificationQuestions },
        } = parsedInformation;

        const parties = await loadParties(ctx);
        const partyQualQuestions = parties[0].qualificationQuestions;
        expect(providerName).to.equal('contactus');
        await checkExpectedResults(fromName, contactInfo.phone === '' ? undefined : contactInfo.phone, from);

        expect(twilioCall).to.have.been.callCount(0);

        expect(partyQualQuestions).to.eql(qualificationQuestions);
        expect(partyQualQuestions.moveInTime).to.equal(qualificationQuestions.moveInTime);
        expect(partyQualQuestions.groupProfile).to.equal(qualificationQuestions.groupProfile);
      });

      it(`when receiving an email from respage chatbot, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('respage-chatbot.eml', 'respageEmail');
        const { from, fromName, contactInfo } = parsedInformation;

        expect(providerName).to.equal('respage');
        await checkExpectedResults(fromName, undefined, from);
        expect(twilioCall).to.have.been.not.called;
        expect(fromName).to.equal('Noel');
        expect(contactInfo.phone).to.be.empty; // restpage does not have phone information in the email body
        expect(from).to.equal('noelh@respage.com');
      });

      it(`when receiving an email from ForRent.com, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('for-rent.eml', 'forRentEmail');
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;

        expect(providerName).to.equal('forrent.com');
        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(fromName).to.equal('Largo Took');
        expect(contactInfo.phone).to.equal('16509918351');
        expect(from).to.equal('largo.took@teleworm.us');
      });

      it(`when receiving an email from digible.com, person info is extracted from email body,
      a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('digible.eml', 'zapiermail');
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;

        expect(providerName).to.equal('zapiermail');
        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(fromName).to.equal('Ash K. Johnson-Hice');
        expect(contactInfo.phone).to.equal('19137311288');
        expect(from).to.equal('ashketchum@icloud.com');
      });

      it(`when receiving an email from ForRent.com (email2), person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('for-rent-2.eml', 'forRent2');
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;

        expect(providerName).to.equal('forrent.com');
        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(fromName).to.equal('Fredegar Gamgee');
        expect(contactInfo.phone).to.equal('16503368157');
        expect(from).to.equal('fredegar.gamgee@me.com');
      });

      it(`when receiving an email from ForRent.com (only text), person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('for-rent-only-text.eml', 'forRent');
        const { from, fromName, contactInfo } = parsedInformation;

        expect(twilioCall).to.have.been.calledOnce;

        expect(providerName).to.equal('forrent.com');
        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(fromName).to.equal('Ruby Underhill');
        expect(contactInfo.phone).to.equal('16503368157');
        expect(from).to.equal('ruby.underhill@me.com');
      });

      [
        {
          fileName: 'zillow.eml',
          data: {
            from: 'lsj9148@gmail.com',
            fromName: 'Linda Johnson',
            phone: '19709240423',
          },
        },
        {
          fileName: 'zillow-2.eml',
          data: {
            from: 'griffinbouchard@gmail.com',
            fromName: 'griffin bouchard',
            phone: '12026771177',
          },
        },
        {
          fileName: 'zillow-special-chars.eml',
          data: {
            from: 'user@example.com',
            fromName: "Contact Names Special-Char's In–em—ai—l",
            phone: '19709245555',
          },
        },
      ].forEach(({ fileName, data }) => {
        it(`when receiving an email from zillow, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
          const { parsedInformation, providerName } = await setupIlsProvider(fileName, 'zillow');
          const { from, fromName, contactInfo } = parsedInformation;

          expect(providerName).to.equal('zillow');
          await checkExpectedResults(fromName, contactInfo.phone, from);
          expect(fromName).to.equal(data.fromName);
          expect(contactInfo.phone).to.equal(data.phone);
          expect(from).to.equal(data.from);
        });
      });

      [
        {
          format: 'red-format',
          fileName: 'yelp.eml',
          data: {
            from: 'reply+f67322335aee40bdbf9528e2ebe825fd@messaging.yelp.com',
            fromName: 'Jessamine Tunnelly',
          },
        },
        {
          format: 'white-format',
          fileName: 'yelp-white.eml',
          data: {
            from: 'reply+c2743541d05d47f1bb1413ec3506dae4@messaging.yelp.com',
            fromName: 'Miranda',
          },
        },
      ].forEach(({ format, fileName, data }) => {
        it(`when receiving an email from yelp (${format}), person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
          const { parsedInformation, providerName } = await setupIlsProvider(fileName, 'yelp');
          const { from, fromName, contactInfo } = parsedInformation;

          expect(providerName).to.equal('yelp');
          await checkExpectedResults(fromName, undefined, from);

          expect(fromName).to.equal(data.fromName);
          expect(twilioCall).to.have.been.not.called;
          expect(contactInfo.phone).to.be.empty;
          expect(from).to.equal(data.from);
        });
      });

      it(`when receiving an email from one ILS provider without email address in the body, person info is extracted from email body,
        a raw lead without email is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('for-rent-without-email.eml', 'forRent');
        const { from, fromName, contactInfo } = parsedInformation;

        expect(providerName).to.equal('forrent.com');
        await checkExpectedResults(fromName, contactInfo.phone, undefined);
        expect(fromName).to.equal('Largo Took');
        expect(twilioCall).to.have.been.calledOnce;
        expect(contactInfo.phone).to.equal('16509918351');
        expect(from).to.be.undefined;
      });

      it(`when receiving an email from zumper, person info is extracted from email body,
      a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('zumper.eml', 'zumper');
        const { from, fromName, contactInfo } = parsedInformation;

        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(providerName).to.equal('zumper.com');
        expect(fromName).to.equal("Rosa Noake's—Smith");
        expect(contactInfo.phone).to.equal('16505555555');
        expect(from).to.equal('fnjkx7d3vdwr8pqx6231zwch8b@zlead.co');
      });

      it(`when receiving an email from zumper, person info is extracted from replyTo,
      a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('zumper-reply-to.eml', 'zumper');
        const { from, fromName, contactInfo } = parsedInformation;

        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(providerName).to.equal('zumper.com');
        expect(fromName).to.equal('Rosa Noakes—Doe');
        expect(contactInfo.phone).to.equal('16505555555');
        expect(from).to.equal('fnjkx7d3vdwr8pqx6231zwch8b@zlead.co');
      });

      it(`when receiving an email from zumper with a normalized phone format, person info is extracted from email body,
      a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('zumper-normalized-phone-format.eml', 'zumper');
        const { from, fromName, contactInfo } = parsedInformation;

        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(providerName).to.equal('zumper.com');
        expect(fromName).to.equal('Heena Multani');
        expect(contactInfo.phone).to.equal('19257261723');
        expect(from).to.equal('luvy_duby2005@yahoo.com');
      });

      [
        {
          format: 'blue-format',
          fileName: 'apartmentlist-blue-oldformat.eml',
          data: {
            from: 'jpompa1998@gmail.com',
            fromName: 'Jazmin Pompa',
            contactInfo: {
              phone: '17134480600',
            },
          },
        },
        {
          format: 'purple-format',
          fileName: 'apartmentlist-purple-newformat.eml',
          data: {
            from: 'smith2669@gmail.com',
            fromName: 'Gen Smith',
            contactInfo: {
              phone: '12064554950',
            },
          },
        },
        {
          format: 'purple-format-new-name',
          fileName: 'apartmentlist-purple-newNameformat.eml',
          data: {
            from: 'kbarton11@gmail.com',
            fromName: 'Karissa Barton',
            contactInfo: {
              phone: '12064554958',
            },
          },
        },
        {
          format: 'purple-format-other-states',
          fileName: 'apartmentlist-purple-newformat-otherstates.eml',
          data: {
            from: 'samantha.pearo@gmail.com',
            fromName: 'Samantha Pearo',
            contactInfo: {
              phone: '16103162974',
            },
          },
        },
        {
          format: 'blue-format',
          fileName: 'aparmentlist-blue-newformat.eml',
          data: {
            from: 'cocoxie9161@gmail.com',
            fromName: 'Kylie Xie',
          },
        },
        {
          format: 'apartmentList-cpm13125',
          fileName: 'apartmentList-cpm13125.eml',
          data: {
            from: 'Ismael.Matos.c5x65@renter.apartmentlist.com',
            fromName: 'Ismael Matos',
            contactInfo: {
              phone: '16282258897',
            },
          },
        },
        {
          format: 'apartmentList-cpm17099',
          fileName: 'apartmentList-cpm17099.eml',
          data: {
            from: 'progressive1827@gmail.com',
            fromName: 'Stacie Sesker',
            contactInfo: {
              phone: '17632213123',
            },
          },
        },
        {
          format: 'apartmentList-cpm17101',
          fileName: 'apartmentList-cpm17101.eml',
          data: {
            from: 'dallaskeel98@gmail.com',
            fromName: 'Dallas Keel',
            contactInfo: {
              phone: null,
            },
          },
        },
      ].forEach(({ format, fileName, data }) => {
        it(`when receiving an email from apartmentlist (${format}), person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
          const { parsedInformation, providerName } = await setupIlsProvider(fileName, 'apartmentlist');
          const { from, fromName, contactInfo } = parsedInformation;
          expect(providerName).to.equal('apartments.com');
          const phone = data.contactInfo && data.contactInfo.phone ? contactInfo.phone : undefined;
          await checkExpectedResults(fromName, phone, from.toLowerCase());
          expect(fromName).to.equal(data.fromName);
          expect(contactInfo.phone).to.equal(phone || '');
          expect(from).to.equal(data.from);
        });
      });

      [
        {
          format: 'real format received',
          fileName: 'foundation-homes-real.eml',
          data: {
            fromName: 'PRIYA CLEMENS',
          },
        },
        {
          format: 'one name in the sender name',
          fileName: 'foundation-homes.eml',
          data: {
            fromName: 'Kate Roberts',
          },
        },
        {
          format: 'more than one name in the sender name',
          fileName: 'foundation-homes-multiple-names.eml',
          data: {
            fromName: 'Kate Roberts',
          },
        },
        {
          format: 'First and Last matching',
          fileName: 'foundation-homes-first-last.eml',
          data: {
            fromName: 'Christine Fordstrom',
          },
        },
      ].forEach(({ format, fileName, data }) => {
        it(`when receiving an email from foundationhomes (${format}), person info is extracted from email body,
          a raw lead is created and a comm entry is saved`, async () => {
          const { parsedInformation, providerName } = await setupIlsProvider(fileName, 'foundationhomes.cove');
          const { from, fromName, contactInfo } = parsedInformation;
          await checkExpectedResults(fromName, undefined, undefined);
          expect(providerName).to.equal('foundationhomes');
          expect(fromName).to.equal(data.fromName);
          expect(contactInfo.phone).to.be.empty; // in foundation homes we only extract the lead name
          expect(from).to.be.undefined;
        });
      });

      [
        {
          format: 'initiated from mobile',
          fileName: 'apartment-guide-mobile.eml',
          data: {
            fromName: 'Peter Malonesio',
            from: 'uspnoy@yahoo.com',
          },
        },
        {
          format: 'initiated from mobile - fallback email',
          fileName: 'apartment-guide-mobile-no-email.eml',
          data: {
            fromName: 'Peter Malonesio',
            from: 'reply-feb71d7873670d78-473_HTML-166824132-7001514-174930@message.my.apartmentguide.com',
          },
        },
        {
          format: 'initiated from desktop',
          fileName: 'apartment-guide-desktop.eml',
          data: {
            fromName: 'Nicholas H Hannon',
            from: 'nickhh.sf@gmail.com',
            contactInfo: {
              phone: '14152860873',
            },
          },
        },
        {
          format: 'apartmentguide customeroldFormat',
          fileName: 'apartment-guide-customerold-format.eml',
          data: {
            fromName: 'Amaranth Burrows',
            from: 'amaranth.burrows@me.com',
            contactInfo: {
              phone: '16503368157',
            },
          },
        },
      ].forEach(({ format, fileName, data }) => {
        it(`when receiving an email from apartmentGuide (${format}), person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
          const { parsedInformation, providerName } = await setupIlsProvider(fileName, 'apartmentguide');
          const { from, fromName, contactInfo } = parsedInformation;
          const phone = data.contactInfo && data.contactInfo.phone ? contactInfo.phone : undefined;
          await checkExpectedResults(fromName, phone, from?.toLowerCase() || undefined);
          expect(providerName).to.equal('apartmentguide.com');
          expect(fromName).to.equal(data.fromName);
          expect(contactInfo.phone).to.equal(phone || '');
          expect(from).to.equal(data.from);
        });
      });

      it(`when receiving an email from rent, person info is extracted from email body,
      a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('rent-desktop.eml', 'rent');
        const { from, fromName, contactInfo } = parsedInformation;

        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(providerName).to.equal('rent.com');
        expect(fromName).to.equal('Uffo Hogpen');
        expect(contactInfo.phone).to.equal('16503368157');
        expect(from).to.equal('uffo.hogpen@me.com');
      });

      [
        {
          format: 'adobo',
          fileName: 'adobo.eml',
          data: {
            fromName: 'Sandra Hefner',
            fromNameParty: 'Sandra Hefner',
            from: 'dustycoe@yahoo.com',
            contactInfo: {
              phone: '14153451592',
            },
          },
        },
        {
          format: 'adobo format 2',
          fileName: 'adobo-format-2.eml',
          data: {
            fromName: null,
            contactInfo: {
              phone: '17049045492',
            },
          },
        },
      ].forEach(({ format, fileName, data }) => {
        it(`when receiving an email from ${format}, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
          const { parsedInformation, providerName } = await setupIlsProvider(fileName, 'abodoapts');
          const { from, fromName, contactInfo } = parsedInformation;
          await checkExpectedResults(fromName, contactInfo.phone, from === null ? undefined : from);
          expect(providerName).to.equal('abodoapts.com');
          expect(fromName).to.equal(data.fromName);
          expect(contactInfo.phone).to.equal(data.contactInfo.phone);
          expect(from).to.equal(data.from);
        });
      });

      it(`when receiving an email from rentBits, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('rentBits.eml', 'rentbits.io');
        const { from, fromName, contactInfo } = parsedInformation;

        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(providerName).to.equal('rentbits.io');
        expect(fromName).to.equal('Miranda');
        expect(contactInfo.phone).to.be.empty; // no phone information in rentbits ils
        expect(from).to.equal('miranda.sandheaver@gmail.com');
      });

      it(`when receiving an email from room8, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('room8.eml', 'room8.io');
        const { from, fromName, contactInfo } = parsedInformation;

        await checkExpectedResults(fromName, undefined, from);
        expect(providerName).to.equal('room8.io');
        expect(fromName).to.equal('Rae Dogg');
        expect(contactInfo.phone).to.be.empty; // The current eml file for build this ils parser does not have a phone on it (it says none)
        expect(from).to.equal('montep92@gmail.com');
      });

      it(`when receiving an email from cozy, person info is extracted from email body,
        a raw lead is created and a comm entry is saved`, async () => {
        const { parsedInformation, providerName } = await setupIlsProvider('cozy.eml', 'cozy');
        const { from, fromName, contactInfo } = parsedInformation;

        await checkExpectedResults(fromName, contactInfo.phone, from);
        expect(providerName).to.equal('cozy');
        expect(fromName).to.equal('John Miller');
        expect(contactInfo.phone).to.equal('14156045334');
        expect(from).to.equal('swickham@parkmerced.com');
      });

      [
        {
          format: 'zapiermail',
          fileName: 'zapiermail.eml',
          data: {
            fromName: 'Jim Aaker',
            from: 'jim_aaker@hotmail.com',
            contactInfo: {
              phone: '17013170831',
            },
          },
        },
        {
          format: 'zapiermail format 2',
          fileName: 'zapiermail-format-2.eml',
          data: {
            fromName: 'Kim Fleckenstein',
            from: 'kdfeck@delegardtool.com',
            contactInfo: {
              phone: '16126699451',
            },
          },
        },
      ].forEach(({ format, fileName, data }) => {
        it(`when receiving an email from ${format}, person info is extracted from email body,
          a raw lead is created and a comm entry is saved`, async () => {
          const { parsedInformation, providerName } = await setupIlsProvider(fileName, 'zapiermail');
          const { from, fromName, contactInfo } = parsedInformation;

          await checkExpectedResults(fromName, contactInfo.phone, from);
          expect(providerName).to.equal('zapiermail');
          expect(fromName).to.equal(data.fromName);
          expect(contactInfo.phone).to.equal(data.contactInfo.phone);
          expect(from).to.equal(data.from);
        });
      });

      describe('Moving inbound emails from ils providers to dead letter queue', () => {
        const queueCondition = (msgId, expectedRetries) => (payload, processed, msg) => {
          const retryCount = msg.properties.headers.retryCount || 0;
          return payload.Key === msgId && (processed || retryCount === expectedRetries);
        };

        const getIlsEmailParserProvider = emailDetails => {
          const messageData = getMessageData(emailDetails);
          return getEmailParserProvider({
            ...messageData,
            rawMessage: messageData.msg,
          });
        };

        const assertDeadLetterQueue = async msg => {
          const deadLetterMsg = await conn.get(`${getEnvQueueName('mail_queue')}${DEAD_LETTER_QUEUE_SUFFIX}`, { noAck: true });
          expect(JSON.parse(deadLetterMsg.content)).to.deep.equal(msg);

          const retryMsg = await conn.get(`${getEnvQueueName('mail_queue')}${RETRY_QUEUE_SUFFIX}`, { noAck: true });
          expect(retryMsg).to.be.false;
        };

        it('when receiving an email from Apartments, and it is not processed by ils parser', async () => {
          const emailDetails = {
            event: 'inbound',
            msg: {
              ...apartments.rawMessage,
              replyTo: 'admin@apartments.com',
              from_email: 'admin@apartments.com',
              text: apartments.text,
              emails: [`${team.directEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
              messageId,
            },
          };

          setGetEmailDetailsFunction(() => emailDetails);

          const { task } = await setupMessageQueueForEmail(messageId, queueCondition(messageId, 0));
          await request(app).post(postEmailUrl).send(mailData).expect(200);

          const results = await task;
          results.forEach(x => expect(x).to.be.true);

          // give time to the message to be routed by dead letter exchange
          await timedOut(300);

          const emailParserProvider = getIlsEmailParserProvider(emailDetails);

          const parties = await loadParties(ctx);

          expect(parties.length).to.equal(0);
          expect(emailParserProvider).to.be.undefined;
          await assertDeadLetterQueue(mailData);
        });
      });
    });
  });
});
