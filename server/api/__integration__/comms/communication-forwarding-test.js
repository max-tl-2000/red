/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import getUUID from 'uuid/v4';
import app from '../../api';
import { setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import {
  testCtx as ctx,
  createAUser,
  createATeam,
  createATeamMember,
  createAProperty,
  addATeamPropertyProgram,
  createAProgram,
} from '../../../testUtils/repoHelper';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../../workers/communication/inboundEmailHandler';
import { getForwardedCommunications } from '../../../dal/forwardedCommunicationsRepo';
import { loadParties } from '../../../dal/partyRepo';
import { getPersons } from '../../../dal/personRepo';

import { DALTypes } from '../../../../common/enums/DALTypes';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import config from '../../../config';

import { getAllComms } from '../../../dal/communicationRepo';
import { postSms, postDirect } from '../../../testUtils/telephonyHelper';
import contactUs from '../../../services/__tests__/email-parser/contact-us.json';
import { now } from '../../../../common/helpers/moment-utils';
import { CallStatus } from '../../../services/telephony/enums';

describe('Communication forwarding', () => {
  const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;
  const postEmailStatus = `/webhooks/email/status?api-token=${config.tokens.api}`;
  const programPhoneIdentifier = '12025550120';

  const getCommsWithForwarding = forwardSmsToEmail => ({
    forwardingEnabled: true,
    forwardEmailToExternalTarget: 'test-mail@reva.tech',
    forwardCallToExternalTarget: '16502737777',
    forwardSMSToExternalTarget: forwardSmsToEmail ? 'test-mail@reva.tech' : '16502737777',
  });

  const commsNoForwarding = {
    forwardingEnabled: false,
    forwardEmailToExternalTarget: null,
    forwardCallToExternalTarget: null,
    forwardSMSToExternalTarget: null,
  };

  const baseMetadata = {
    defaultMatchingPath: null,
    requireMatchingPath: false,
    requireMatchingSource: false,
    defaultMatchingSourceId: null,
  };

  const createProgram = async (team, name, directPhoneIdentifier) => {
    const property = await createAProperty();

    const metadata = {
      ...baseMetadata,
      commsForwardingData: commsNoForwarding,
    };
    const program = await createAProgram({
      ctx,
      directPhoneIdentifier: directPhoneIdentifier || programPhoneIdentifier,
      directEmailIdentifier: name,
      name,
      team,
      property,
      metadata,
    });

    await addATeamPropertyProgram(ctx, {
      teamId: team.id,
      propertyId: property.id,
      programId: program.id,
      commDirection: DALTypes.CommunicationDirection.IN,
    });

    return program;
  };

  const createProgramWithForwarding = async (team, name, forwardSmsToEmail, directPhoneIdentifier, endDate) => {
    const property = await createAProperty();

    const metadata = {
      ...baseMetadata,
      commsForwardingData: getCommsWithForwarding(forwardSmsToEmail),
    };
    const program = await createAProgram({
      ctx,
      directPhoneIdentifier: directPhoneIdentifier || programPhoneIdentifier,
      directEmailIdentifier: name,
      name,
      team,
      property,
      metadata,
      endDate,
    });

    await addATeamPropertyProgram(ctx, {
      teamId: team.id,
      propertyId: property.id,
      programId: program.id,
      commDirection: DALTypes.CommunicationDirection.IN,
    });

    return program;
  };

  const getEmailDetails = (program, messageId) => ({
    event: 'inbound',
    msg: {
      ...contactUs.rawMessage,
      text: contactUs.text,
      emails: [`${program.directEmailIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
      messageId,
    },
  });

  const getSMSDetails = (program, messageId) => ({
    To: program.directPhoneIdentifier,
    From: '16502736663',
    TotalRate: '0',
    Units: '1',
    Text: 'Test incoming SMS message!',
    TotalAmount: '0',
    Type: 'sms',
    MessageUUID: messageId,
  });

  const getForwardedSmsDetails = (program, messageId) => ({
    ...getSMSDetails(program, messageId),
    Text: 'FWD+16504680820: Test incoming SMS message!',
  });

  const messageId = getUUID().toString();
  const mailData = { Bucket: 'test', Key: messageId };
  let user;
  let team;

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
    const user2 = await createAUser({
      ctx,
      name: 'User2',
      email: 'user2+test@test.com',
      status: DALTypes.UserStatus.AVAILABLE,
    });
    await createATeamMember({
      teamId: team.id,
      userId: user2.id,
    });
  });

  describe('when a new user sends a new mail for a program', () => {
    it('but the program has forwarding enabled it should not create a party', async () => {
      const program = await createProgramWithForwarding(team, 'program1');

      const emailDetails = getEmailDetails(program, messageId);

      setGetEmailDetailsFunction(() => emailDetails);
      const condition1 = msg => msg && msg.Key === messageId;

      const { task } = await setupQueueToWaitFor([condition1], ['mail']);

      await request(app).post(postEmailUrl).send(mailData).expect(200);

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const forwardedCommunications = await getForwardedCommunications(ctx);
      expect(forwardedCommunications.length).to.equal(1);
      const communication = forwardedCommunications[0];

      expect(communication.programId).to.equal(program.id);
      expect(communication.programContactData).to.equal(program.directEmailIdentifier);
      expect(communication.type).to.equal(DALTypes.CommunicationMessageType.EMAIL);
      expect(communication.forwardedTo).to.equal(program.metadata.commsForwardingData.forwardEmailToExternalTarget);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(0);

      const persons = await getPersons(ctx);
      expect(persons.length).to.equal(0);

      const comms = await getAllComms(ctx);
      expect(comms.length).to.equal(0);
    });
  });

  describe('when a new user sends a new mail for a program that has not reached the end date', () => {
    it('but the program has forwarding enabled it should not create a party, but add a comm forwarding entry', async () => {
      const endDate = now().add(10, 'days').format('MM/DD/YYYY');
      const program = await createProgramWithForwarding(team, 'program1', null, null, endDate);

      const emailDetails = getEmailDetails(program, messageId);

      setGetEmailDetailsFunction(() => emailDetails);
      const condition1 = msg => msg && msg.Key === messageId;

      const { task } = await setupQueueToWaitFor([condition1], ['mail']);

      await request(app).post(postEmailUrl).send(mailData).expect(200);

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const forwardedCommunications = await getForwardedCommunications(ctx);
      expect(forwardedCommunications.length).to.equal(1);
      const communication = forwardedCommunications[0];

      expect(communication.programId).to.equal(program.id);
      expect(communication.programContactData).to.equal(program.directEmailIdentifier);
      expect(communication.type).to.equal(DALTypes.CommunicationMessageType.EMAIL);
      expect(communication.forwardedTo).to.equal(program.metadata.commsForwardingData.forwardEmailToExternalTarget);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(0);

      const persons = await getPersons(ctx);
      expect(persons.length).to.equal(0);

      const comms = await getAllComms(ctx);
      expect(comms.length).to.equal(0);
    });
  });

  describe('when a new user sends a new mail for a program that has reached the end date', () => {
    it('but the program has forwarding enabled it should not create a party and neither a comm forwarding entry', async () => {
      const endDate = now().add(-2, 'days').format('MM/DD/YYYY');
      const program = await createProgramWithForwarding(team, 'program1', null, null, endDate);

      const emailDetails = getEmailDetails(program, messageId);

      setGetEmailDetailsFunction(() => emailDetails);
      const condition1 = msg => msg && msg.Key === messageId;

      const { task } = await setupQueueToWaitFor([condition1], ['mail'], false);

      await request(app).post(postEmailUrl).send(mailData).expect(200);

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const forwardedCommunications = await getForwardedCommunications(ctx);
      expect(forwardedCommunications.length).to.equal(0);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(0);

      const persons = await getPersons(ctx);
      expect(persons.length).to.equal(0);

      const comms = await getAllComms(ctx);
      expect(comms.length).to.equal(0);
    });
  });

  describe('when a old user sends a new mail for a program', () => {
    it('but the program has forwarding enabled it should not create a party', async () => {
      const program = await createProgram(team, 'program1');
      const program2 = await createProgramWithForwarding(team, 'program2');

      const emailDetails = getEmailDetails(program, messageId);

      const messageId2 = getUUID().toString();

      const mailData2 = { Bucket: 'test', Key: messageId2 };

      const emailDetails2 = getEmailDetails(program2, messageId2);

      setGetEmailDetailsFunction(() => emailDetails);
      const condition1 = msg => msg && msg.Key === messageId;
      const condition2 = msg => msg && msg.Key === messageId2;

      const {
        tasks: [task, task1],
      } = await setupQueueToWaitFor([condition1, condition2], ['mail']);

      await request(app).post(postEmailUrl).send(mailData).expect(200);

      await task;

      let forwardedCommunications = await getForwardedCommunications(ctx);
      expect(forwardedCommunications.length).to.equal(0);

      let parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);

      let persons = await getPersons(ctx);
      expect(persons.length).to.equal(1);

      let comms = await getAllComms(ctx);
      expect(comms.length).to.equal(1);

      setGetEmailDetailsFunction(() => emailDetails2);
      await request(app).post(postEmailUrl).send(mailData2).expect(200);

      await task1;

      forwardedCommunications = await getForwardedCommunications(ctx);

      expect(forwardedCommunications.length).to.equal(1);
      const communication = forwardedCommunications[0];

      expect(communication.programId).to.equal(program2.id);
      expect(communication.programContactData).to.equal(program2.directEmailIdentifier);
      expect(communication.type).to.equal(DALTypes.CommunicationMessageType.EMAIL);
      expect(communication.forwardedTo).to.equal(program2.metadata.commsForwardingData.forwardEmailToExternalTarget);

      parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);

      persons = await getPersons(ctx);
      expect(persons.length).to.equal(1);

      comms = await getAllComms(ctx);
      expect(comms.length).to.equal(1);
    });
  });

  describe('/status', () => {
    describe('given a valid request', () => {
      it('will return 200', async () => {
        const program = await createProgramWithForwarding(team, 'program1');

        const emailDetails = getEmailDetails(program, messageId);

        setGetEmailDetailsFunction(() => emailDetails);
        const condition1 = msg => msg && msg.Key === messageId;

        const { task } = await setupQueueToWaitFor([condition1], ['mail']);

        await request(app).post(postEmailUrl).send(mailData).expect(200);

        const results = await task;
        results.forEach(x => expect(x).to.be.true);

        const forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        const testData = {
          email: communication.receivedFrom,
          recipients: [communication.forwardedTo],
          messageId: communication.messageId,
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

  describe('/sms', () => {
    describe('when a new user sends a new sms for a program', () => {
      it('but the program has forwarding enabled to phone number it should not create a party', async () => {
        const program = await createProgramWithForwarding(team, 'program1');

        const msgId = getUUID();
        const testData = getSMSDetails(program, msgId);

        const condition = msg => msg.MessageUUID === msgId;
        const { task } = await setupQueueToWaitFor([condition], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        const forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        expect(communication.programId).to.equal(program.id);
        expect(communication.programContactData).to.equal(program.directPhoneIdentifier);
        expect(communication.type).to.equal(DALTypes.CommunicationMessageType.SMS);
        expect(communication.forwardedTo).to.equal(program.metadata.commsForwardingData.forwardSMSToExternalTarget);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(0);

        const persons = await getPersons(ctx);
        expect(persons.length).to.equal(0);

        const comms = await getAllComms(ctx);
        expect(comms.length).to.equal(0);
      });
    });

    describe('when a old user sends a new sms for a program', () => {
      it('but the program has forwarding enabled to phone number it should not create a party', async () => {
        const program = await createProgram(team, 'program1');
        const program2 = await createProgramWithForwarding(team, 'program2', false, '12025550123');

        const msgId = getUUID();
        const testData = getSMSDetails(program, msgId);

        const messageId2 = getUUID();
        const testData2 = getSMSDetails(program2, messageId2);

        const condition1 = msg => msg.MessageUUID === msgId;
        const condition2 = msg => msg.MessageUUID === messageId2;

        const {
          tasks: [task, task1],
        } = await setupQueueToWaitFor([condition1, condition2], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        let forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(0);

        let parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);

        let persons = await getPersons(ctx);
        expect(persons.length).to.equal(1);

        let comms = await getAllComms(ctx);
        expect(comms.length).to.equal(1);

        await postSms().send(testData2).expect(200);
        await task1;
        forwardedCommunications = await getForwardedCommunications(ctx);

        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        expect(communication.programId).to.equal(program2.id);
        expect(communication.programContactData).to.equal(program2.directPhoneIdentifier);
        expect(communication.type).to.equal(DALTypes.CommunicationMessageType.SMS);
        expect(communication.forwardedTo).to.equal(program2.metadata.commsForwardingData.forwardSMSToExternalTarget);

        parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);

        persons = await getPersons(ctx);
        expect(persons.length).to.equal(1);

        comms = await getAllComms(ctx);
        expect(comms.length).to.equal(1);
      });
    });

    describe('when a new user sends a new forwarded sms for a program', () => {
      it('but the program has forwarding enabled to phone number it should not create a party', async () => {
        const program = await createProgramWithForwarding(team, 'program1', true);

        const msgId = getUUID();
        const testData = getForwardedSmsDetails(program, msgId);

        const condition = msg => msg.MessageUUID === msgId;
        const { task } = await setupQueueToWaitFor([condition], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        const forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        expect(communication.programId).to.equal(program.id);
        expect(communication.programContactData).to.equal(program.directPhoneIdentifier);
        expect(communication.type).to.equal(DALTypes.CommunicationMessageType.SMS);
        expect(communication.forwardedTo).to.equal(program.metadata.commsForwardingData.forwardSMSToExternalTarget);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(0);

        const persons = await getPersons(ctx);
        expect(persons.length).to.equal(0);

        const comms = await getAllComms(ctx);
        expect(comms.length).to.equal(0);
      });
    });

    describe('when a old user sends a new forwarded sms for a program', () => {
      it('but the program has forwarding enabled to phone number it should not create a party', async () => {
        const program = await createProgram(team, 'program1');
        const program2 = await createProgramWithForwarding(team, 'program2', false, '12025550123');

        const msgId = getUUID();
        const testData = getForwardedSmsDetails(program, msgId);

        const messageId2 = getUUID();
        const testData2 = getForwardedSmsDetails(program2, messageId2);

        const condition1 = msg => msg.MessageUUID === msgId;
        const condition2 = msg => msg.MessageUUID === messageId2;

        const {
          tasks: [task, task1],
        } = await setupQueueToWaitFor([condition1, condition2], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        let forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(0);

        let parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);

        let persons = await getPersons(ctx);
        expect(persons.length).to.equal(1);

        let comms = await getAllComms(ctx);
        expect(comms.length).to.equal(1);

        await postSms().send(testData2).expect(200);
        await task1;
        forwardedCommunications = await getForwardedCommunications(ctx);

        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        expect(communication.programId).to.equal(program2.id);
        expect(communication.programContactData).to.equal(program2.directPhoneIdentifier);
        expect(communication.type).to.equal(DALTypes.CommunicationMessageType.SMS);
        expect(communication.forwardedTo).to.equal(program2.metadata.commsForwardingData.forwardSMSToExternalTarget);

        parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);

        persons = await getPersons(ctx);
        expect(persons.length).to.equal(1);

        comms = await getAllComms(ctx);
        expect(comms.length).to.equal(1);
      });
    });

    describe('when a new user sends a new sms for a program', () => {
      it('but the program has forwarding enabled to email it should not create a party', async () => {
        const program = await createProgramWithForwarding(team, 'program1', true);

        const msgId = getUUID();
        const testData = getForwardedSmsDetails(program, msgId);

        const condition = msg => msg.MessageUUID === msgId;
        const { task } = await setupQueueToWaitFor([condition], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        const forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        expect(communication.programId).to.equal(program.id);
        expect(communication.programContactData).to.equal(program.directPhoneIdentifier);
        expect(communication.type).to.equal(DALTypes.CommunicationMessageType.SMS);
        expect(communication.forwardedTo).to.equal(program.metadata.commsForwardingData.forwardSMSToExternalTarget);

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(0);

        const persons = await getPersons(ctx);
        expect(persons.length).to.equal(0);

        const comms = await getAllComms(ctx);
        expect(comms.length).to.equal(0);
      });
    });
  });

  describe('/calls', () => {
    const makeRequest = async (fromPhoneNo, toPhoneNo) => {
      const callId = getUUID();
      const response = await postDirect()
        .send({ To: toPhoneNo })
        .send({ CallerName: 'The caller' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ From: fromPhoneNo })
        .send({ CallUUID: callId });
      return { ...response, callId };
    };

    describe('when a new user calls a program', () => {
      it('but the program has forwarding enabled it should not create a party', async () => {
        const program = await createProgramWithForwarding(team, 'program1');

        const { status, text } = await makeRequest('16502736663', program.directPhoneIdentifier);
        expect(status).to.equal(200);
        const parties = await loadParties(ctx);

        expect(parties.length).to.equal(0);
        expect(text).to.contain('<Dial callerId="16502736663"');
        expect(text).to.contain(`<Number>${program.metadata.commsForwardingData.forwardCallToExternalTarget}</Number>`);

        const forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        expect(communication.programId).to.equal(program.id);
        expect(communication.programContactData).to.equal(program.directPhoneIdentifier);
        expect(communication.type).to.equal(DALTypes.CommunicationMessageType.CALL);
        expect(communication.forwardedTo).to.equal(program.metadata.commsForwardingData.forwardCallToExternalTarget);

        const persons = await getPersons(ctx);
        expect(persons.length).to.equal(0);

        const comms = await getAllComms(ctx);
        expect(comms.length).to.equal(0);
      });
    });

    describe('when a old user calls a program', () => {
      it('but the program has forwarding enabled to phone number it should not create a party', async () => {
        const program = await createProgram(team, 'program1');
        const program2 = await createProgramWithForwarding(team, 'program2', false, '12025550123');

        const { status, text } = await makeRequest('16502736663', program.directPhoneIdentifier);
        expect(status).to.equal(200);

        expect(text).to.contain('<Response><Speak');

        let forwardedCommunications = await getForwardedCommunications(ctx);
        expect(forwardedCommunications.length).to.equal(0);

        let parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);

        let persons = await getPersons(ctx);
        expect(persons.length).to.equal(1);

        let comms = await getAllComms(ctx);
        expect(comms.length).to.equal(1);

        const { status: status2, text: text2 } = await makeRequest('16502736663', program2.directPhoneIdentifier);
        expect(status2).to.equal(200);

        expect(text2).to.contain('<Dial callerId="16502736663"');
        expect(text2).to.contain(`<Number>${program2.metadata.commsForwardingData.forwardCallToExternalTarget}</Number>`);

        forwardedCommunications = await getForwardedCommunications(ctx);

        expect(forwardedCommunications.length).to.equal(1);
        const communication = forwardedCommunications[0];

        expect(communication.programId).to.equal(program2.id);
        expect(communication.programContactData).to.equal(program2.directPhoneIdentifier);
        expect(communication.type).to.equal(DALTypes.CommunicationMessageType.CALL);
        expect(communication.forwardedTo).to.equal(program2.metadata.commsForwardingData.forwardCallToExternalTarget);

        parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);

        persons = await getPersons(ctx);
        expect(persons.length).to.equal(1);

        comms = await getAllComms(ctx);
        expect(comms.length).to.equal(1);
      });
    });
  });
});
