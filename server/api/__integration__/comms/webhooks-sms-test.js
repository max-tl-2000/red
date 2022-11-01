/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import v4 from 'uuid/v4';
import { waitFor } from '../../../testUtils/apiHelper';
import { setupConsumers } from '../../../workers/consumer';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { NoRetryError } from '../../../common/errors';
import { getAllComms, getCommsByType, getUnreadCommunicationsByPartyId } from '../../../dal/communicationRepo';
import { loadParties } from '../../../dal/partyRepo';
import { saveContactInfo } from '../../../dal/contactInfoRepo';
import { getAllSpamCommunications } from '../../../dal/blacklistRepo';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { postSms } from '../../../testUtils/telephonyHelper';
import { updateTenant } from '../../../services/tenantService';
import { setTwilioProviderOps, resetTwilioProviderOps } from '../../../common/twillioHelper';
import { RESTRICTED_PHONE_NUMBER } from '../../../helpers/phoneUtils';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { computeThreadId } from '../../../../common/helpers/utils';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { now } from '../../../../common/helpers/moment-utils';
import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';

import {
  testCtx as ctx,
  createAUser,
  createATeam,
  createATeamMember,
  createAPerson,
  createAProperty,
  createATeamPropertyProgram,
  createAParty,
  createAPartyMember,
  createACommunicationEntry,
  createAProgram,
} from '../../../testUtils/repoHelper';

const testTeam = {
  name: 'testTeam',
  module: 'leasing',
  email: 'leasing@test.com',
  phone: '16504375757',
};

const fallbackProgramPhoneIdentifier = '12025550101';
const programPhoneIdentifier = '12025550120';

const createProgram = async teamId => {
  const { id: programPropertyId } = await createAProperty();
  return await createATeamPropertyProgram({
    teamId,
    propertyId: programPropertyId,
    directPhoneIdentifier: programPhoneIdentifier,
    commDirection: DALTypes.CommunicationDirection.IN,
  });
};

describe('/webhooks/sms', () => {
  let matcher;

  const setupMsgQueueAndWaitFor = async (conditions, workerKeysToBeStarted) => {
    matcher = createResolverMatcher();

    const { resolvers, promises } = waitFor(conditions);
    matcher.addWaiters(resolvers);
    await setupConsumers(chan(), matcher, workerKeysToBeStarted);
    return { task: Promise.all(promises) };
  };

  describe('POST', () => {
    const testRawLeadCreation = async (from, isForward = false) => {
      const msgId = v4();
      const testData = {
        To: programPhoneIdentifier,
        From: from || '16502736663',
        TotalRate: '0',
        Units: '1',
        Text: isForward ? 'FWD+16504680820: Test incoming SMS message!' : 'Test incoming SMS message!',
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };
      const user = await createAUser();
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId: user.id });
      const { id: teamPropertyProgramId } = await createProgram(team.id);

      const condition = msg => msg.MessageUUID === msgId;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      await postSms().send(testData).expect(200);
      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
      expect(parties[0].partyMembers[0].fullName).to.equal('');
      expect(parties[0].teamPropertyProgramId).to.equal(teamPropertyProgramId);
    };

    it('with valid data creates a raw lead with associated communication', async () => {
      await testRawLeadCreation();
    });

    describe('When phone number has special characters', () => {
      it('should strip out special characters and blank spaces from phone number and create a raw lead with associated communication', async () => {
        await testRawLeadCreation('+1650273666-3');
      });
    });

    describe('When phone number seems to be invalid because of its short length', () => {
      it('should strip out special characters and blank spaces from phone number and create a raw lead with associated communication', async () => {
        await testRawLeadCreation('+16512 3');
      });
    });

    describe('with a failed twilio request', () => {
      beforeEach(async () => {
        await updateTenant(tenant.id, {
          metadata: {
            ...tenant.metadata,
            enablePhoneSupport: true,
          },
        });
      });

      afterEach(async () => {
        resetTwilioProviderOps();
        await updateTenant(tenant.id, {
          metadata: {
            ...tenant.metadata,
            enablePhoneSupport: false,
          },
        });
      });

      it('with a failed twilio call creates a raw lead with associated communications', async () => {
        setTwilioProviderOps({
          getPhoneNumberInfo: () => {
            throw new Error('Twilio call failed');
          },
        });
        await testRawLeadCreation();
      });
    });

    it('multiple times from the same originator creates only one raw lead with all the communication associated properly', async () => {
      await testRawLeadCreation();
      const from = '16502736663';

      const conditions = [];
      const data = [1, 2, 3].map(step => {
        const testData = {
          To: programPhoneIdentifier,
          From: from,
          TotalRate: '0',
          Units: '1',
          Text: `Test incoming SMS message! ${step}`,
          TotalAmount: '0',
          Type: 'sms',
          MessageUUID: v4(),
        };
        const condition = msg => msg.MessageUUID === testData.MessageUUID;
        conditions.push(condition);
        return testData;
      });

      const { resolvers, promises } = waitFor(conditions);
      matcher.addWaiters(resolvers);

      await Promise.all(data.map(testData => postSms().send(testData).expect(200)));
      await Promise.all(promises);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
      expect(parties[0].partyMembers[0].fullName).to.equal('');

      const messages = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.SMS);
      expect(messages).to.have.length(4);
    });

    it('when receiving an SMS to a program phone number a comm entry is saved for the team associated with that program', async () => {
      const user = await createAUser();
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId: user.id });
      const { id: teamPropertyProgramId } = await createProgram(team.id);

      const msgId = v4();
      const testData = {
        To: programPhoneIdentifier,
        From: '16502736663',
        TotalRate: '0',
        Units: '1',
        Text: 'Test incoming SMS message to a phone alias!',
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };

      const condition = msg => msg.MessageUUID === msgId;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      await postSms().send(testData).expect(200);
      await task;

      const messages = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.SMS);

      expect(messages).to.have.length(1);
      expect(messages[0].message.to[0]).to.equal(programPhoneIdentifier);
      expect(messages[0].teams).to.deep.equal([team.id]);
      expect(messages[0].teamPropertyProgramId).to.equal(teamPropertyProgramId);
    });

    describe('when receiving an SMS to a program phone number that is inactive and has a fallback program', () => {
      it('a new raw lead is created and a comm entry is saved for the team associated with the fallback program', async () => {
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
          directPhoneIdentifier: fallbackProgramPhoneIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        const user = await createAUser();
        const team = await createATeam(testTeam);
        await createATeamMember({ teamId: team.id, userId: user.id });
        const { id: propertyId } = await createAProperty();
        const { id: teamPropertyProgramId } = await createATeamPropertyProgram({
          teamId: team.id,
          propertyId,
          directPhoneIdentifier: programPhoneIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
          programEndDate: now().add(-1, 'days'),
          programFallbackId: fallbackProgramId,
        });

        const msgId = v4();
        const testData = {
          To: programPhoneIdentifier,
          From: '16502736663',
          TotalRate: '0',
          Units: '1',
          Text: 'Test incoming SMS message to a phone alias!',
          TotalAmount: '0',
          Type: 'sms',
          MessageUUID: msgId,
        };

        const condition = msg => msg.MessageUUID === msgId;
        const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(1);
        const [party] = parties;

        const comms = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.SMS);
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

    describe('when receiving an SMS to a program phone number that is inactive and has no fallback program', () => {
      it('should not create the party and comm', async () => {
        const user = await createAUser();
        const team = await createATeam(testTeam);
        await createATeamMember({ teamId: team.id, userId: user.id });
        const { id: propertyId } = await createAProperty();
        await createATeamPropertyProgram({
          teamId: team.id,
          propertyId,
          directPhoneIdentifier: programPhoneIdentifier,
          commDirection: DALTypes.CommunicationDirection.IN,
          programEndDate: now().add(-1, 'days'),
          programFallbackId: null,
        });

        const msgId = v4();
        const testData = {
          To: programPhoneIdentifier,
          From: '16502736663',
          TotalRate: '0',
          Units: '1',
          Text: 'Test incoming SMS message to a phone alias!',
          TotalAmount: '0',
          Type: 'sms',
          MessageUUID: msgId,
        };

        const condition = msg => msg.MessageUUID === msgId;
        const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(0);

        const comms = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.SMS);
        expect(comms.length).to.equal(0);
      });
    });

    describe('when receiving an SMS to a program phone number that is inactive and has no fallback program', () => {
      describe('and the fallback program is inactive', () => {
        it('a NoRetryError is thrown', async () => {
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
            directPhoneIdentifier: fallbackProgramPhoneIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
            programEndDate: now().add(-1, 'days'),
            programFallbackId: null,
          });

          const user = await createAUser();
          const team = await createATeam(testTeam);
          await createATeamMember({ teamId: team.id, userId: user.id });
          const { id: propertyId } = await createAProperty();
          await createATeamPropertyProgram({
            teamId: team.id,
            propertyId,
            directPhoneIdentifier: programPhoneIdentifier,
            commDirection: DALTypes.CommunicationDirection.IN,
            programEndDate: now().add(-1, 'days'),
            programFallbackId: fallbackProgramId,
          });

          const msgId = v4();
          const testData = {
            To: programPhoneIdentifier,
            From: '16502736663',
            TotalRate: '0',
            Units: '1',
            Text: 'Test incoming SMS message to a phone alias!',
            TotalAmount: '0',
            Type: 'sms',
            MessageUUID: msgId,
          };

          const condition = (payload, handled, amqpMsg, error) => payload.MessageUUID === msgId.toString() && !handled && error instanceof NoRetryError;
          const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

          await postSms().send(testData).expect(200);
          await task;

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(0);
          const comms = await getAllComms(ctx);
          expect(comms.length).to.equal(0);
        });
      });
    });

    it('when receiving an forwarded SMS to a program phone number a comm entry is saved for the team associated with that program', async () => {
      const user = await createAUser();
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId: user.id });
      const { id: teamPropertyProgramId } = await createProgram(team.id);

      const msgId = v4();
      const forwardedFromNo = '16504680820';
      const forwardedText = 'Test incoming SMS message!';
      const testData = {
        To: programPhoneIdentifier,
        From: '16502736663',
        TotalRate: '0',
        Units: '1',
        Text: `FWD+${forwardedFromNo}: ${forwardedText}`,
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };

      const condition = msg => msg.MessageUUID === msgId;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      await postSms().send(testData).expect(200);
      await task;

      const messages = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.SMS);

      expect(messages).to.have.length(1);
      expect(messages[0].message.to[0]).to.equal(programPhoneIdentifier);
      expect(messages[0].message.from).to.equal(forwardedFromNo);
      expect(messages[0].message.text).to.equal(forwardedText);
      expect(messages[0].teams).to.deep.equal([team.id]);
      expect(messages[0].teamPropertyProgramId).to.equal(teamPropertyProgramId);
    });

    it(`when receiving an SMS from a phone number that is marked as spam,
      no raw lead is created and the communication is saved in the spam communication table`, async () => {
      const fromPhone = '1202555019';
      const user = await createAUser();
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId: user.id });

      const programPhone = '12025550130';
      const { id: programPropertyId } = await createAProperty();
      await createATeamPropertyProgram({
        teamId: team.id,
        propertyId: programPropertyId,
        directPhoneIdentifier: programPhone,
        commDirection: DALTypes.CommunicationDirection.IN,
      });

      const { id: personId } = await createAPerson();
      const contactInfos = [
        {
          type: 'phone',
          value: fromPhone,
          isSpam: true,
        },
      ];
      await saveContactInfo(ctx, contactInfos, personId);

      const msgId = v4();
      const testData = {
        To: programPhone,
        From: fromPhone,
        TotalRate: '0',
        Units: '1',
        Text: 'Test incoming SMS message to a phone alias!',
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };

      const condition = msg => msg.MessageUUID === msgId;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      await postSms().send(testData).expect(200);
      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(0);

      const commEntries = await getAllComms(ctx);
      expect(commEntries).to.have.length(0);

      const commSpamEntries = await getAllSpamCommunications(ctx);
      expect(commSpamEntries).to.have.length(1);
    });

    describe('when receiving an SMS to a phone alias that has an associated party', () => {
      it('should set the associated property to the newly created party', async () => {
        const user = await createAUser();
        const team = await createATeam(testTeam);
        await createATeamMember({ teamId: team.id, userId: user.id });

        const programPhone = '12025550130';
        const { id: programPropertyId } = await createAProperty();
        await createATeamPropertyProgram({
          teamId: team.id,
          propertyId: programPropertyId,
          directPhoneIdentifier: programPhone,
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        const msgId = v4();
        const testData = {
          To: programPhone,
          From: '16502736663',
          TotalRate: '0',
          Units: '1',
          Text: 'Test incoming SMS message to a phone alias!',
          TotalAmount: '0',
          Type: 'sms',
          MessageUUID: msgId,
        };

        const condition = msg => msg.MessageUUID === msgId;
        const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

        await postSms().send(testData).expect(200);
        await task;

        const parties = await loadParties(ctx);
        expect(parties[0].assignedPropertyId).to.equal(programPropertyId);
        expect(parties[0].storedUnitsFilters).to.deep.equal({
          propertyIds: [programPropertyId],
        });
      });
    });
  });

  describe('when receiving an SMS from a RESTRICTED phone number', () => {
    it('creates a raw lead with associated communication', async () => {
      const msgId = v4();

      const testData = {
        To: programPhoneIdentifier,
        From: RESTRICTED_PHONE_NUMBER,
        TotalRate: '0',
        Units: '1',
        Text: 'Test incoming SMS message!',
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };
      const user = await createAUser();
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId: user.id });
      await createProgram(team.id);

      const condition = msg => msg.MessageUUID === msgId;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      await postSms().send(testData).expect(200);
      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
      expect(parties[0].partyMembers[0].fullName).to.contain(RESTRICTED_PHONE_NUMBER);
    });
  });

  describe('when receiving an SMS and we have multiple active and inactive members in the same party for the incoming phone number', () => {
    it('adds the communication to the correct active party member ', async () => {
      const user = await createAUser();
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId: user.id });

      const campaignPhone = '12025550130';
      const { id: campaignPropertyId } = await createAProperty();
      await createATeamPropertyProgram({
        teamId: team.id,
        propertyId: campaignPropertyId,
        directPhoneIdentifier: campaignPhone,
        commDirection: DALTypes.CommunicationDirection.IN,
      });
      const fromPhone = '16502736663';
      const { id: person1Id } = await createAPerson();
      const { id: person2Id } = await createAPerson();
      const { id: person3Id } = await createAPerson();
      await saveContactInfo(ctx, [{ type: 'phone', value: fromPhone }], person1Id);
      await saveContactInfo(ctx, [{ type: 'phone', value: fromPhone }], person2Id);
      await saveContactInfo(ctx, [{ type: 'phone', value: fromPhone }], person3Id);

      const { id } = await createAParty({
        userId: user.id,
        teams: [team.id],
        assignedPropertyId: campaignPropertyId,
      });

      // mark this as removed
      await createAPartyMember(id, {
        personId: person1Id,
        endDate: new Date(),
      });

      await createAPartyMember(id, {
        personId: person1Id,
      });

      await createAPartyMember(id, {
        personId: person3Id,
        endDate: new Date(),
      });

      const msgId = v4();
      const testData = {
        To: campaignPhone,
        From: fromPhone,
        TotalRate: '0',
        Units: '1',
        Text: 'Test incoming SMS message to a phone alias!',
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };

      const condition = msg => msg.MessageUUID === msgId;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      await postSms().send(testData).expect(200);
      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);

      const messages = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.SMS);

      expect(messages).to.have.length(1);
      expect(messages[0].message.from).to.equal(fromPhone);
    });
  });

  describe('when receiving an SMS and we have multiple persons for the incoming phone number', () => {
    it('adds the communication to the correct active party member ', async () => {
      const user = await createAUser();
      const team = await createATeam(testTeam);
      await createATeamMember({ teamId: team.id, userId: user.id });

      const campaignPhone = '12025550130';
      const { id: campaignPropertyId } = await createAProperty();
      await createATeamPropertyProgram({
        teamId: team.id,
        propertyId: campaignPropertyId,
        directPhoneIdentifier: campaignPhone,
        commDirection: DALTypes.CommunicationDirection.IN,
      });
      const fromPhone = '16502736663';
      const personName = 'testSmsDeliveryToCorrectPerson';

      const party1 = await createAParty({ userId: user.id, teams: [team.id], ownerTeam: team.id, assignedPropertyId: campaignPropertyId });
      const contactInfo = enhance([{ type: 'phone', value: fromPhone, id: v4() }]);
      const partyMember1 = await createAPartyMember(party1.id, { fullName: personName, contactInfo });

      const { id: personId2 } = await createAPerson();
      const contactInfo2 = [{ type: 'phone', value: fromPhone, id: v4() }];
      await saveContactInfo(ctx, contactInfo2, personId2);

      const expectedThreadId = computeThreadId(DALTypes.CommunicationMessageType.SMS, [partyMember1.personId]);
      await createACommunicationEntry({
        parties: [party1.id],
        persons: [partyMember1.personId],
        threadId: expectedThreadId,
        messageId: v4(),
        teams: [team.id],
        direction: 'out',
        type: 'Sms',
        unread: false,
      });

      const msgId = v4();
      const testData = {
        To: campaignPhone,
        From: fromPhone,
        TotalRate: '0',
        Units: '1',
        Text: 'Test incoming SMS message is delivered to correct person in the system',
        TotalAmount: '0',
        Type: 'Sms',
        MessageUUID: msgId,
        threadId: expectedThreadId,
      };

      const condition = msg => msg.MessageUUID === msgId;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      await postSms().send(testData).expect(200);
      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].partyMembers.length).to.equal(1);

      const messages = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.SMS);
      expect(messages).to.have.length(2);

      const unreadComms = await getUnreadCommunicationsByPartyId(ctx, parties[0].id);
      expect(unreadComms.length).to.equal(1);
    });
  });

  describe('when receiving an sms from known originator but the party owner has been deactivated', async () => {
    const messageId2 = v4().toString();
    const fromPhoneGuest = '12029990111';
    const directPhoneIdentifier = '12025550144';
    const teamMemberPhone = '12025550155';

    let partyOwnerUser;
    let dispatcherUser;
    let property;
    let mainTeam;

    const getSmsDetails = (msgId = messageId2, to = directPhoneIdentifier) => ({
      To: to,
      From: fromPhoneGuest,
      TotalRate: '0',
      Units: '1',
      Text: 'Test incoming SMS for party reassignment',
      TotalAmount: '0',
      Type: 'Sms',
      MessageUUID: msgId,
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
      await createAProgram({ property, team: mainTeam, directPhoneIdentifier });

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

    it(`when sms is to program a raw lead will NOT be created and the existing
    party of the user will be assigned to the dispatcher of the team`, async () => {
      const { id: personId } = await createAPerson();
      const contactInfos = [
        {
          type: 'phone',
          value: fromPhoneGuest,
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

      const condition = msg => msg.MessageUUID === messageId2;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      const smsDetails = getSmsDetails(messageId2);

      await postSms().send(smsDetails).expect(200);
      await task;

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(1);
      expect(parties[0].userId).to.equal(dispatcherUser.id);
    });

    it(`when sms is to team member a raw lead will NOT be created and the existing
    party of the user will be assigned to the dispatcher of the team`, async () => {
      const { id: personId } = await createAPerson();
      const contactInfos = [
        {
          type: 'phone',
          value: fromPhoneGuest,
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

      const condition = msg => msg.MessageUUID === messageId2;
      const { task } = await setupMsgQueueAndWaitFor([condition], ['sms']);

      const smsDetails = getSmsDetails(messageId2, teamMemberPhone);

      await postSms().send(smsDetails).expect(200);
      await task;

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(1);
      expect(parties[0].userId).to.equal(dispatcherUser.id);
    });
  });
});
