/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import newId from 'uuid/v4';
import sinonChai from 'sinon-chai';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import {
  testCtx as ctx,
  createAParty,
  createAPartyMember,
  createAUser,
  createATeam,
  createATeamMember,
  createAPerson,
  createAProperty,
  officeHoursAlwaysOff,
  officeHoursAlwaysOn,
  createACommunicationEntry,
  createATeamPropertyProgram,
  createATeamProperty,
  createVoiceMessages,
  createAProgram,
} from '../../../testUtils/repoHelper';
import { getAllComms, getCommunicationByMessageId, getCommsByType, getCommsByTransferredFrom, loadLastMessage } from '../../../dal/communicationRepo';
import { getCallDetailsByCommId } from '../../../dal/callDetailsRepo';
import { getAllSpamCommunications } from '../../../dal/blacklistRepo';
import { loadPartyById, loadParties } from '../../../dal/partyRepo';
import { saveContactInfo } from '../../../dal/contactInfoRepo';
import { getEventsByParty } from '../../../dal/partyEventsRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import config from '../../../config';
import { makeUsersSipEndpointsOnline, postDirect } from '../../../testUtils/telephonyHelper';
import { loadUsersByIds, loadUserById, updateUserStatus } from '../../../services/users';
import { waitFor } from '../../../common/utils';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { TransferTargetType, CallStatus, DialStatus } from '../../../services/telephony/enums';
import { setDelayFunc } from '../../../services/telephony/hangup';
import { markPersonAsMerged, getPersons } from '../../../dal/personRepo';
import * as resources from '../../../services/telephony/resources';
import { getVoiceMessage } from '../../../services/telephony/voiceMessages';
import { setNotificationFunction, resetNotificationFunction } from '../../../../common/server/notificationClient';
import eventTypes from '../../../../common/enums/eventTypes';
import { now, isValidMoment, toMoment } from '../../../../common/helpers/moment-utils';
import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';

const { telephony } = config;
chai.use(sinonChai);
const expect = chai.expect;

describe('/webhooks/directDial', () => {
  afterEach(() => resetNotificationFunction());

  const tenantPhoneNumber = tenant.metadata.phoneNumbers[0].phoneNumber;
  const programPhoneIdentifier = tenantPhoneNumber;

  const createProgram = async (teamId, withIvrMessages, areMessagesMp3) => {
    const { id: programPropertyId } = await createAProperty();

    const { id: voiceMessageId } = await createVoiceMessages(ctx, { withIvrMessages, areMessagesMp3 });

    return await createATeamPropertyProgram({
      teamId,
      propertyId: programPropertyId,
      directPhoneIdentifier: programPhoneIdentifier,
      commDirection: DALTypes.CommunicationDirection.IN,
      voiceMessageId,
    });
  };

  const callId = '31892d50-5d40-4ac2-8539-e3b9338e3ab0';
  const phoneNo = '12025550196';

  const setupForIncomingCall = async () => {
    const user = await createAUser({ ctx, name: 'alfred' });
    const contactInfo = enhance([{ type: 'phone', value: phoneNo, id: newId() }]);
    const team = await createATeam({
      name: 'team',
      module: 'leasing',
    });
    await createATeamMember({ teamId: team.id, userId: user.id });
    await createProgram(team.id);
    const party = await createAParty({ userId: user.id, teams: [team.id], ownerTeam: team.id });
    await createAPartyMember(party.id, { fullName: 'Batman', contactInfo });
    makeUsersSipEndpointsOnline([user]);
    return { user, party };
  };

  const expectToPlayRingingTone = text => expect(text).to.contain('<Play');

  describe('when receiving a request with HangupCause', () => {
    beforeEach(() => {
      setTelephonyOps({ getCallDetails: () => ({}) });
      setDelayFunc(async func => await func());
    });

    describe('when when call is part of a transfer', () => {
      it('should save call details for last leg', async () => {
        const { id: userId } = await createAUser();
        const { messageId: callUuid, id: firstCommId } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          type: DALTypes.CommunicationMessageType.CALL,
          userId,
        });

        const { id: lastCommId } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          type: DALTypes.CommunicationMessageType.CALL,
          userId,
          messageId: callUuid,
          transferredFromCommId: firstCommId,
        });

        const details = {
          answerTime: '2015-07-26 15:45:02+05:30',
          apiId: '06ae0f8f-dc72-11e5-b56c-22000ae90795',
          billDuration: 924,
          billedDuration: 960,
          callDirection: 'outbound',
          callDuration: 924,
          callUuid,
          endTime: '2015-07-26 15:45:14+05:30',
          fromNumber: '+14158572518',
          initiationTime: '2015-07-26 15:44:49+05:30',
          parentCallUuid: null,
          resourceUri: '/v1/Account/MAXXXXXXXXXXXXXXXXXX/Call/eba53b9e-8fbd-45c1-9444-696d2172fbc8/',
          toNumber: '14153268174',
          totalAmount: '0.13600',
          totalRate: '0.00850',
        };

        const getCallDetails = sinon.spy(() => details);

        setTelephonyOps({ getCallDetails });

        const res = await postDirect()
          .send({ From: '12025550195' })
          .send({ To: '12025550196' })
          .send({ DialStatus: DialStatus.COMPLETED })
          .send({ CallUUID: callUuid })
          .send({ HangupCause: 'busy' });

        expect(res.status).to.equal(200);

        const { auth } = await getTelephonyConfigs(ctx);
        expect(getCallDetails).to.have.been.calledOnce;
        expect(getCallDetails).to.have.been.calledWith(auth, { callId: callUuid });

        const callDetails = await getCallDetailsByCommId(ctx, lastCommId);

        expect(callDetails).to.be.ok;
        expect(callDetails.details).to.be.ok;

        expect(callDetails.details).to.deep.equal({ endTime: '2015-07-26T10:15:14.000Z' });
      });
    });

    it('should save rawMessage data', async () => {
      const { id: userId } = await createAUser();
      const { messageId: CallUUID } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.IN,
        userId,
      });

      const res = await postDirect()
        .send({ From: '12025550195' })
        .send({ To: '12025550196' })
        .send({ DialStatus: DialStatus.COMPLETED })
        .send({ CallUUID })
        .send({ env: 'test' })
        .send({ token: 'test' })
        .send({ tenant: 'integration_test_tenant' })
        .send({ HangupCause: 'busy' });

      expect(res.status).to.equal(200);
      const [{ message }] = await getAllComms(ctx);

      expect(message).to.be.ok;
      expect(message.rawMessage).to.be.ok;

      expect(message.rawMessage).to.have.all.keys('From', 'To', 'DialStatus', 'CallUUID', 'HangupCause');
      expect(message.rawMessage).to.not.have.any.keys('env', 'token', 'tenant');
    });

    it('should save a valid endTime in callDetails table even if the one from Plivo is not valid', async () => {
      const { id: userId } = await createAUser();

      // when endTime from Plivo is valid
      const { id: commId, messageId: CallUUID } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.IN,
        userId,
      });

      const validPlivoEndTime = '2020-10-10 21:12:22+00:00';
      setTelephonyOps({ getCallDetails: () => ({ endTime: validPlivoEndTime }) });

      const res = await postDirect().send({ CallUUID }).send({ HangupCause: 'NORMAL_CLEARING' });
      expect(res.status).to.equal(200);

      const { details } = await getCallDetailsByCommId(ctx, commId);
      expect(toMoment(new Date(validPlivoEndTime), { timezone: 'UTC' }).isSame(toMoment(details.endTime, { timezone: 'UTC' })));

      // when endTime from Plivo is not valid
      const { id: secondCommId, messageId: secondCallUUID } = await createACommunicationEntry({
        direction: DALTypes.CommunicationDirection.IN,
        userId,
      });

      const invalidPlivoEndTime = '2020-50-50 21:12:22+00:00';
      setTelephonyOps({ getCallDetails: () => ({ endTime: invalidPlivoEndTime }) });

      const secondRes = await postDirect().send({ CallUUID: secondCallUUID }).send({ HangupCause: 'NORMAL_CLEARING' });
      expect(secondRes.status).to.equal(200);

      const { details: detailsSecondCall } = await getCallDetailsByCommId(ctx, secondCommId);
      const endTimeMoment = toMoment(new Date(detailsSecondCall.endTime), { timezone: 'UTC' });
      expect(isValidMoment(endTimeMoment)).to.be.true;
    });

    describe('when postDial was not handled', () => {
      it('should set owner to the party', async () => {
        const { id: teamId } = await createATeam();
        const { id: userId } = await createAUser();
        await createATeamMember({ teamId, userId });
        const { id: partyId, userId: ownerId } = await createAParty({ teams: [teamId] });
        const { messageId: CallUUID } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          userId,
          parties: [partyId],
          message: { postDialHandled: false },
        });

        expect(ownerId).to.be.null;
        await postDirect().send({ CallUUID }).send({ HangupCause: 'cancelled' });

        const party = await loadPartyById(ctx, partyId);
        expect(party.userId).to.equal(userId);

        const partyEvents = await getEventsByParty(ctx, party.id);
        expect(partyEvents.filter(x => x.event === DALTypes.PartyEventType.COMMUNICATION_COMPLETED).length).to.equal(1);
      });

      it('should make receivers available', async () => {
        const { id: userId1 } = await createAUser({ metadata: { status: DALTypes.UserStatus.BUSY } });
        const { id: userId2 } = await createAUser({ metadata: { status: DALTypes.UserStatus.BUSY } });
        const { messageId: CallUUID } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          message: { receiversEndpointsByUserId: { [userId1]: [], [userId2]: [] }, postDialHandled: false },
        });

        await postDirect().send({ CallUUID }).send({ HangupCause: 'cancelled' });

        const users = await loadUsersByIds(ctx, [userId1, userId2]);
        expect(users.map(u => u.metadata.status)).to.deep.equal([DALTypes.UserStatus.AVAILABLE, DALTypes.UserStatus.AVAILABLE]);
      });

      it('should make call user available when call is outgoing', async () => {
        const { id: userId } = await createAUser({ metadata: { status: DALTypes.UserStatus.BUSY } });
        const { messageId: CallUUID } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.OUT,
          message: { postDialHandled: false },
          userId,
        });

        await postDirect().send({ CallUUID }).send({ HangupCause: 'cancelled' });

        const user = await loadUserById(ctx, userId);
        expect(user.metadata.status).to.deep.equal(DALTypes.UserStatus.AVAILABLE);
      });

      it('should mark the call as missed when call was not marked as answered', async () => {
        const { messageId: CallUUID } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          message: { receiversEndpointsByUserId: {}, postDialHandled: false },
        });

        await postDirect().send({ CallUUID }).send({ HangupCause: 'NORMAL_CLEARING' });

        const [{ message, unread }] = await getAllComms(ctx);
        expect(message.isMissed).to.be.true;
        expect(unread).to.be.true;
      });

      describe('when call is an external transfer that was not answered', () => {
        it('should mark the call as missed and notify about communication update', async () => {
          const notify = sinon.spy();
          setNotificationFunction(notify);

          const { id: teamId } = await createATeam();
          const { id: userId } = await createAUser();
          await createATeamMember({ teamId, userId });
          const { id: partyId } = await createAParty({ teams: [teamId], userId });
          const { messageId: CallUUID, id: commId } = await createACommunicationEntry({
            parties: [partyId],
            direction: DALTypes.CommunicationDirection.OUT,
            message: { transferredToNumber: '12025550777', answered: false, postDialHandled: false },
          });

          await postDirect().send({ CallUUID }).send({ HangupCause: 'NORMAL_CLEARING' });

          const [{ message }] = await getAllComms(ctx);
          expect(message.isMissed).to.be.true;

          expect(notify).to.have.been.calledWith(
            sinon.match({
              event: eventTypes.COMMUNICATION_UPDATE,
              data: { partyIds: [partyId], ids: [commId] },
              routing: { teams: [teamId] },
            }),
          );
        });
      });
    });

    describe('when call is comming from the queue', () => {
      it('should not make receivers available because the availability is handled elsewhere', async () => {
        const { id: userId } = await createAUser({ metadata: { status: DALTypes.UserStatus.BUSY } });

        const { messageId: CallUUID } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          message: { receiversEndpointsByUserId: { [userId]: [] }, isCallFromQueue: true },
        });

        await postDirect().send({ CallUUID }).send({ HangupCause: 'cancelled' });

        const user = await loadUserById(ctx, userId);
        expect(user.metadata.status).to.equal(DALTypes.UserStatus.BUSY);
      });
    });

    describe('when postDial was handled', () => {
      it('should not set owner to the party because the owner update is handled elsewhere', async () => {
        const { id: teamId } = await createATeam();
        const { id: userId } = await createAUser();
        await createATeamMember({ teamId, userId });
        const { id: partyId, userId: ownerId } = await createAParty({ teams: [teamId] });
        const { messageId: CallUUID } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          userId,
          parties: [partyId],
          message: { postDialHandled: true },
        });

        expect(ownerId).to.be.null;
        await postDirect().send({ CallUUID }).send({ HangupCause: 'cancelled' });

        const party = await loadPartyById(ctx, partyId);
        expect(party.userId).to.not.be.ok;
      });

      it('should not make receivers available because the availability is handled elsewhere', async () => {
        const { id: userId1 } = await createAUser({ metadata: { status: DALTypes.UserStatus.BUSY } });
        const { id: userId2 } = await createAUser({ metadata: { status: DALTypes.UserStatus.BUSY } });

        const { messageId: CallUUID } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          message: { receiversEndpointsByUserId: { [userId1]: [], [userId2]: [] }, postDialHandled: true },
        });

        await postDirect().send({ CallUUID }).send({ HangupCause: 'cancelled' });

        const users = await loadUsersByIds(ctx, [userId1, userId2]);
        expect(users.map(u => u.metadata.status)).to.deep.equal([DALTypes.UserStatus.BUSY, DALTypes.UserStatus.BUSY]);
      });
    });
  });

  describe('when receiving a request for an outgoing call', () => {
    const setupForOutgoing = async callRecordingSetup => {
      const username = 'John';

      const { id: userId, sipEndpoints } = await createAUser({
        name: username,
        status: DALTypes.UserStatus.AVAILABLE,
        sipEndpoints: [{ username, isUsedInApp: true }],
      });

      const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

      const { id: teamId } = await createATeam({ name: 'team', module: 'leasing', metadata: { callRecordingSetup } });
      await createATeamMember({ teamId, userId });

      const { id: propertyId } = await createAProperty();
      const teamPropertyDisplayPhone = tenantPhoneNumber;
      await createATeamPropertyProgram({
        teamId,
        propertyId,
        displayPhoneNumber: teamPropertyDisplayPhone,
        commDirection: DALTypes.CommunicationDirection.OUT,
      });

      const { id: partyId } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId });
      const memberPhoneNo = '12025550198';
      const contactInfo = enhance([{ type: 'phone', value: memberPhoneNo, id: newId() }]);
      await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

      return { memberPhoneNo, teamPropertyDisplayPhone, username, userId, partyId, sipUsername };
    };

    it('should save rawMessage data', async () => {
      const { memberPhoneNo, username, sipUsername } = await setupForOutgoing();

      const res = await postDirect()
        .send({ From: sipUsername })
        .send({ To: memberPhoneNo })
        .send({ CallerName: username })
        .send({ CallUUID: newId() })
        .send({ env: 'test' })
        .send({ token: 'test' })
        .send({ tenant: 'integration_test_tenant' });

      expect(res.status).to.equal(200);
      const [{ message }] = await getAllComms(ctx);

      expect(message).to.be.ok;
      expect(message.rawMessage).to.be.ok;

      expect(message.rawMessage).to.have.all.keys('From', 'To', 'CallerName', 'CallUUID');
      expect(message.rawMessage).to.not.have.any.keys('env', 'token', 'tenant');
    });

    [false, true].forEach(isPhoneToPhone =>
      it('response should contain dial instructions and the user should be marked as busy', async () => {
        const { memberPhoneNo, teamPropertyDisplayPhone, username, userId, partyId, sipUsername } = await setupForOutgoing();

        const res = await postDirect()
          .send({ From: sipUsername })
          .send({ To: memberPhoneNo })
          .send({ CallerName: username })
          .send({ isPhoneToPhone })
          .send({ CallUUID: newId() });

        expect(res.status).to.equal(200);

        const [{ id: commId }] = await getAllComms(ctx);

        const { postCallUrl, dialCallbackUrl } = await getTelephonyConfigs(ctx);

        const action = addParamsToUrl(postCallUrl, {
          isPhoneToPhone,
          commId,
          partyId,
        }).replace(/&/g, '&amp;');

        const callbackUrl = addParamsToUrl(dialCallbackUrl, {
          isPhoneToPhone,
          commId,
          partyId,
        }).replace(/&/g, '&amp;');

        const expectedResponse = `<Response><Dial callerId="${teamPropertyDisplayPhone}" callerName="${username}" action="${action}" callbackUrl="${callbackUrl}"><Number>${memberPhoneNo}</Number></Dial></Response>`;
        expect(res.text).to.equal(expectedResponse);
        const user = await loadUserById(ctx, userId);
        expect(user.metadata.status).to.equal(DALTypes.UserStatus.BUSY);
      }),
    );

    it('should respond with message when dialing a number that is not registered in the system', async () => {
      const { username, sipUsername } = await setupForOutgoing();

      const res = await postDirect().send({ From: sipUsername }).send({ To: '12025550777' }).send({ CallerName: username }).send({ CallUUID: newId() });

      expect(res.status).to.equal(200);
      expect(res.text).to.contain('<Speak');
      expect(res.text).to.contain(resources.OUTGOING_TO_UNKNOWN_NO);
    });

    describe('when the dialed number belongs to several persons in several parties', () => {
      const setup = async () => {
        const username = 'John';

        const { id: userId, sipEndpoints } = await createAUser({
          ctx,
          name: username,
          status: DALTypes.UserStatus.AVAILABLE,
          sipEndpoints: [{ username, isUsedInApp: true }],
        });

        const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

        const { id: teamId } = await createATeam();
        await createATeamMember({ teamId, userId });

        const personPhone = '12025550198';

        const { id: propertyId } = await createAProperty();
        const teamPropertyDisplayPhone = tenantPhoneNumber;
        await createATeamPropertyProgram({
          teamId,
          propertyId,
          displayPhoneNumber: teamPropertyDisplayPhone,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });

        const { id: partyId1 } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId });
        const contactInfo1 = enhance([{ type: 'phone', value: personPhone, id: newId() }]);
        const { personId: personId1 } = await createAPartyMember(partyId1, { fullName: 'Jim1', contactInfo: contactInfo1 });

        const { id: partyId2 } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId });
        const contactInfo2 = enhance([{ type: 'phone', value: personPhone, id: newId() }]);
        const { personId: personId2 } = await createAPartyMember(partyId2, { fullName: 'Jim2', contactInfo: contactInfo2 });

        return { sipUsername, personPhone, username, partyId1, partyId2, personId1, personId2 };
      };

      describe('when the request contains personId and partyId', () => {
        it('the created comm entry should be assigned to given person and party', async () => {
          const { sipUsername, personPhone, username, partyId1, partyId2, personId1, personId2 } = await setup();

          const res = await postDirect()
            .send({ From: sipUsername })
            .send({ To: personPhone })
            .send({ CallerName: username })
            .send({ 'X-PH-PartyId': partyId2 })
            .send({ 'X-PH-PersonId': personId2 })
            .send({ CallUUID: newId() });

          expect(res.status).to.equal(200);

          const [{ persons, parties }] = await getAllComms(ctx);

          expect(persons).to.include(personId2);
          expect(persons).to.not.include(personId1);

          expect(parties).to.include(partyId2);
          expect(parties).to.not.include(partyId1);
        });
      });

      describe('when the request does not specify personId or partyId', () => {
        // TODO: @mihai investigate this race condition
        xit('the created comm entry should be assigned to first person and party found', async () => {
          const { sipUsername, personPhone, username, partyId1, partyId2, personId1, personId2 } = await setup();

          const res = await postDirect().send({ From: sipUsername }).send({ To: personPhone }).send({ CallerName: username }).send({ CallUUID: newId() });

          expect(res.status).to.equal(200);

          const [{ persons, parties }] = await getAllComms(ctx);

          expect(persons).to.include(personId1);
          expect(persons).to.not.include(personId2);

          expect(parties).to.include(partyId1);
          expect(parties).to.not.include(partyId2);
        });
      });

      describe('when an agent calls a person from two parties and one is for a team he is member of', () => {
        it('the created comm entry should be assigned to the party for the team where he is member', async () => {
          const { id: userId, sipEndpoints } = await createAUser({ name: 'richie' });
          const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

          const { id: teamId } = await createATeam({ name: 'team a' });
          await createATeamMember({ teamId, userId });

          const personPhone = '12025550198';

          const contactInfo = enhance([{ type: 'phone', value: personPhone, id: newId() }]);
          const person = await createAPerson('John', 'J', contactInfo);

          const { id: propertyId } = await createAProperty();
          const teamPropertyDisplayPhone = tenantPhoneNumber;
          await createATeamPropertyProgram({
            teamId,
            propertyId,
            displayPhoneNumber: teamPropertyDisplayPhone,
            commDirection: DALTypes.CommunicationDirection.OUT,
          });

          const { id: partyFromUserTeam } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId });
          await createAPartyMember(partyFromUserTeam, { personId: person.id });

          const { id: anotherTeamId } = await createATeam({ name: 'team b' });
          const { id: partyFromAnotherTeam } = await createAParty({ userId, teams: [anotherTeamId], ownerTeam: anotherTeamId });
          await createAPartyMember(partyFromAnotherTeam, { personId: person.id });

          const res = await postDirect().send({ From: sipUsername }).send({ To: personPhone }).send({ CallerName: 'J' }).send({ CallUUID: newId() });

          expect(res.status).to.equal(200);

          const [{ parties }] = await getAllComms(ctx);

          expect(parties).to.include(partyFromUserTeam);
          expect(parties).to.not.include(partyFromAnotherTeam);
        });
      });

      describe('when an agent calls a person from a party for a team he is not a member of', () => {
        it('the created comm entry should be assigned to the party', async () => {
          const { id: userId, sipEndpoints } = await createAUser({ name: 'richie' });
          const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

          const { id: teamId } = await createATeam({ name: 'team a' });
          const personPhone = '12025550198';

          const contactInfo = enhance([{ type: 'phone', value: personPhone, id: newId() }]);
          const person = await createAPerson('John', 'J', contactInfo);

          const { id: propertyId } = await createAProperty();
          const teamPropertyDisplayPhone = tenantPhoneNumber;
          await createATeamPropertyProgram({
            teamId,
            propertyId,
            displayPhoneNumber: teamPropertyDisplayPhone,
            commDirection: DALTypes.CommunicationDirection.OUT,
          });

          const { id: partyFromAnotherTeam } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId });
          await createAPartyMember(partyFromAnotherTeam, { personId: person.id });

          const res = await postDirect().send({ From: sipUsername }).send({ To: personPhone }).send({ CallerName: 'J' }).send({ CallUUID: newId() });

          expect(res.status).to.equal(200);

          const [{ parties }] = await getAllComms(ctx);

          expect(parties).to.include(partyFromAnotherTeam);
        });
      });
    });

    describe('when the dialed number belongs to a person and a merged person', () => {
      it('should dial the person resulted from merge', async () => {
        const username = 'John';

        const { id: userId, sipEndpoints } = await createAUser({
          ctx,
          name: username,
          status: DALTypes.UserStatus.AVAILABLE,
          sipEndpoints: [{ username, isUsedInApp: true }],
        });

        const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

        const { id: teamId } = await createATeam();

        const { id: propertyId } = await createAProperty();
        const teamPropertyDisplayPhone = tenantPhoneNumber;
        await createATeamPropertyProgram({
          teamId,
          propertyId,
          displayPhoneNumber: teamPropertyDisplayPhone,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });

        const { id: partyId } = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId });

        const personPhone = '12025550198';
        const getContactInfo = () => enhance([{ type: 'phone', value: personPhone, id: newId() }]);

        const { id: mergedPersonId } = await createAPerson('Joe', 'Joe', getContactInfo());
        const { personId } = await createAPartyMember(partyId, { fullName: 'Jim', contactInfo: getContactInfo() });
        await markPersonAsMerged(ctx, personId, mergedPersonId);

        const res = await postDirect().send({ From: sipUsername }).send({ To: personPhone }).send({ CallerName: username }).send({ CallUUID: newId() });

        const [{ persons }] = await getAllComms(ctx);

        expect(res.status).to.equal(200);
        expect(persons).to.include(personId);
        expect(persons).to.not.include(mergedPersonId);
      });
    });

    describe('when the user is in two different teams and initiates an outgoing call', () => {
      it('response should use the correct team-property phone number as callerId', async () => {
        const username = 'John';

        const { id: userId, sipEndpoints } = await createAUser({
          ctx,
          name: username,
          email: 'user-email-test@domain.com',
          status: DALTypes.UserStatus.AVAILABLE,
          sipEndpoints: [{ username, isUsedInApp: true }],
        });

        const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

        const firstTeam = await createATeam({ name: 'team1', module: 'leasing' });
        await createATeamMember({ teamId: firstTeam.id, userId });

        const secondTeam = await createATeam({ name: 'team2', module: 'leasing' });
        await createATeamMember({ teamId: secondTeam.id, userId });

        const { id: propertyId } = await createAProperty();
        const firstTeamPropertyDisplayPhone = tenant.metadata.phoneNumbers[2].phoneNumber;
        await createATeamPropertyProgram({
          teamId: firstTeam.id,
          propertyId,
          displayPhoneNumber: firstTeamPropertyDisplayPhone,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });

        const { id: partyId } = await createAParty({ userId, teams: [secondTeam.id], ownerTeam: firstTeam.id, assignedPropertyId: propertyId });
        const memberPhoneNo = '12025550198';
        const contactInfo = enhance([{ type: 'phone', value: memberPhoneNo, id: newId() }]);
        await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

        await createACommunicationEntry({
          parties: [partyId],
          threadId: newId(),
          type: DALTypes.CommunicationMessageType.CALL,
          message: {
            to: [`${secondTeam.directPhoneIdentifier}`],
          },
        });

        const res = await postDirect()
          .send({ From: sipUsername })
          .send({ To: memberPhoneNo })
          .send({ CallerName: username })
          .send({ isPhoneToPhone: false })
          .send({ CallUUID: newId() });

        const [, { id: commId }] = await getAllComms(ctx);

        expect(res.status).to.equal(200);
        const { postCallUrl, dialCallbackUrl } = await getTelephonyConfigs(ctx);

        const action = addParamsToUrl(postCallUrl, {
          isPhoneToPhone: false,
          commId,
          partyId,
        }).replace(/&/g, '&amp;');

        const callbackUrl = addParamsToUrl(dialCallbackUrl, {
          isPhoneToPhone: false,
          commId,
          partyId,
        }).replace(/&/g, '&amp;');

        const expectedResponse = `<Response><Dial callerId="${firstTeamPropertyDisplayPhone}" callerName="${username}" action="${action}" callbackUrl="${callbackUrl}"><Number>${memberPhoneNo}</Number></Dial></Response>`;
        expect(res.text).to.equal(expectedResponse);
      });
    });

    describe("when the team's call recording setting is OUTBOUND", () => {
      it('response should contain recording instructions', async () => {
        const { memberPhoneNo, username, userId, sipUsername } = await setupForOutgoing(DALTypes.CallRecordingSetup.OUTBOUND);

        const isPhoneToPhone = false;

        const res = await postDirect()
          .send({ From: sipUsername })
          .send({ To: memberPhoneNo })
          .send({ CallerName: username })
          .send({ isPhoneToPhone })
          .send({ CallUUID: newId() });

        expect(res.status).to.equal(200);

        const [comm] = await getAllComms(ctx);
        const { callRecordingUrl } = await getTelephonyConfigs(ctx);
        const url = addParamsToUrl(callRecordingUrl, { commId: comm.id });

        const expectedRecordingInstructions = `<Record callbackUrl="${url}" maxLength="${telephony.callMaxRecordingDuration}" startOnDialAnswer="true" redirect="false"/>`;

        expect(res.text.replace(/amp;/g, '')).to.contain(expectedRecordingInstructions);

        const user = await loadUserById(ctx, userId);
        expect(user.metadata.status).to.equal(DALTypes.UserStatus.BUSY);
      });
    });
  });

  describe('given a request for an incoming call', () => {
    it('should save rawMessage data', async () => {
      const user = await createAUser();
      makeUsersSipEndpointsOnline([user]);
      const team = await createATeam({
        name: 'testTeam',
        module: 'leasing',
        email: 'leasing@asd.com',
      });

      await createProgram(team.id);
      await createATeamMember({ teamId: team.id, userId: user.id });

      const res = await postDirect()
        .send({ To: programPhoneIdentifier })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ From: phoneNo })
        .send({ CallUUID: newId() })
        .send({ env: 'test' })
        .send({ token: 'test' })
        .send({ tenant: 'integration_test_tenant' });

      expect(res.status).to.equal(200);
      const [{ message }] = await getAllComms(ctx);

      expect(message).to.be.ok;
      expect(message.rawMessage).to.be.ok;

      expect(message.rawMessage).to.have.all.keys('From', 'To', 'CallStatus', 'CallUUID');
      expect(message.rawMessage).to.not.have.any.keys('env', 'token', 'tenant');
    });

    describe('when dialed number does not belong to a team nor to a user', () => {
      it('should respond with a unused number message', async () => {
        const { status, text } = await postDirect()
          .send({ To: '12025550196' })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ From: phoneNo })
          .send({ CallUUID: newId() });

        expect(status).to.equal(200);
        expect(text).to.contain('<Speak');
        expect(text).to.contain(resources.INCOMING_TO_UNKNOWN_NO);
      });
    });

    it('will save in the comm message the called sipEndpoints group by userId', async () => {
      const userA = await createAUser();
      const userB = await createAUser();
      makeUsersSipEndpointsOnline([userA, userB]);
      const team = await createATeam({
        name: 'testTeam',
        module: 'leasing',
        metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY },
      });
      await createATeamMember({ teamId: team.id, userId: userA.id });
      await createATeamMember({ teamId: team.id, userId: userB.id });
      await createProgram(team.id);

      const messageId = newId();

      const res = await postDirect()
        .send({ To: programPhoneIdentifier })
        .send({ CallerName: 'Batman' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ From: '12025550198' })
        .send({ CallUUID: messageId });
      expect(res.status).to.equal(200);

      const { message } = await getCommunicationByMessageId(ctx, messageId);
      const userACalledEndpoints = message.receiversEndpointsByUserId[userA.id];
      const userBCalledEndpoints = message.receiversEndpointsByUserId[userB.id];
      expect(userACalledEndpoints).to.have.deep.members(userA.sipEndpoints);
      expect(userBCalledEndpoints).to.have.deep.members(userB.sipEndpoints);
    });

    it('will create a raw lead if needed', async () => {
      const user = await createAUser();
      makeUsersSipEndpointsOnline([user]);
      const team = await createATeam({ name: 'testTeam', module: 'leasing' });
      await createATeamMember({ teamId: team.id, userId: user.id });
      await createProgram(team.id);

      const res = await postDirect()
        .send({ To: programPhoneIdentifier })
        .send({ CallerName: 'Batman' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ From: '12025550198' })
        .send({ CallUUID: newId() });
      expect(res.status).to.equal(200);
      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
    });

    it('will create only one raw lead for same originator and same target', async () => {
      const user = await createAUser();
      makeUsersSipEndpointsOnline([user]);
      const team = await createATeam({ name: 'testTeam', module: 'leasing' });
      await createATeamMember({ teamId: team.id, userId: user.id });
      await createProgram(team.id);

      await postDirect()
        .send({ To: programPhoneIdentifier })
        .send({ CallerName: 'Batman' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ From: '12025550198' })
        .send({ CallUUID: newId() });

      await postDirect()
        .send({ To: programPhoneIdentifier })
        .send({ CallerName: 'Batman' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ From: '12025550198' })
        .send({ CallUUID: newId() });

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
    });

    it('the answer should contain dial timeout and post dial instructions', async () => {
      await setupForIncomingCall();

      const res = await postDirect()
        .send({ To: tenantPhoneNumber })
        .send({ CallerName: 'Batman' })
        .send({ CallStatus: CallStatus.RINGING })
        .send({ From: phoneNo })
        .send({ CallUUID: callId });

      expect(res.status).to.equal(200);
      expect(res.text).to.contain(`timeout="${telephony.ringTimeBeforeVoicemail}"`);
      const { postCallUrl } = await getTelephonyConfigs(ctx);
      // for some reason the action url has some encoded amps
      expect(res.text.replace(/amp;/g, '')).to.contain(`action="${postCallUrl}`);
    });

    const expectIvrResponse = async (text, expectedMessage, isMessageMp3) => {
      expect(text).to.not.contain('<Dial');

      const voiceMessageTag = isMessageMp3 ? '<Play' : '<Speak';
      expect(text).to.contain(voiceMessageTag);

      const voiceMessageRegex = isMessageMp3 ? /<Play/g : /<Speak/g;
      const speakOccurences = text.match(voiceMessageRegex) || [];
      expect(speakOccurences).to.have.lengthOf(10);

      expect(text).to.contain(expectedMessage);
      if (isMessageMp3) expect(expectedMessage).to.contain('.mp3');

      expect(text).to.contain('<GetDigits');

      const { digitsPressedUrl } = await getTelephonyConfigs(ctx);

      expect(text.replace(/amp;/g, '')).to.contain(`action="${digitsPressedUrl}`);
      expect(text).to.contain('numDigits="1"');
    };

    describe('when dialed number belongs to a team member', () => {
      const memberPhoneIdentfier = '12025550120';

      describe('when the call is made after bussiness hours', () => {
        const createTestData = async (withIvrMessages, areMessagesMp3 = false) => {
          const user = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
          const team = await createATeam({ officeHours: officeHoursAlwaysOff });
          const { id: voiceMessageId } = await createVoiceMessages(ctx, { withIvrMessages, areMessagesMp3 });
          const { id: teamMemberId } = await createATeamMember({
            teamId: team.id,
            userId: user.id,
            directPhoneIdentifier: memberPhoneIdentfier,
            voiceMessageId,
          });

          return { user, teamMemberId };
        };

        describe('when the after hours voice message is defined as IVR', () => {
          it('should respond with the after hours voice message in a loop ready for digits', async () => {
            const { user, teamMemberId } = await createTestData(true);
            const isMessageMp3 = false;

            makeUsersSipEndpointsOnline([user]);

            const { status, text } = await postDirect()
              .send({ To: memberPhoneIdentfier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            const { message: afterHours } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
            await expectIvrResponse(text, afterHours, isMessageMp3);
          });
        });

        describe('when the after hours voice message is defined as a recorded mp3 IVR', () => {
          it('should respond with the after hours voice message in a loop ready for digits', async () => {
            const isMessageMp3 = true;
            const { user, teamMemberId } = await createTestData(true, isMessageMp3);

            makeUsersSipEndpointsOnline([user]);

            const { status, text } = await postDirect()
              .send({ To: memberPhoneIdentfier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            const { message: afterHours } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
            await expectIvrResponse(text, afterHours, isMessageMp3);
          });
        });

        describe('when the after hours voice message is defined as voicemail', () => {
          it('should respond with the after hours voice message and instructions to record', async () => {
            const { user, teamMemberId } = await createTestData();

            makeUsersSipEndpointsOnline([user]);

            const { status, text } = await postDirect()
              .send({ To: memberPhoneIdentfier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);
            expect(text).to.not.contain('<Dial');

            expect(text).to.contain('<Speak');
            const { message: afterHours } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
            expect(text).to.contain(afterHours);
            expect(text).to.contain('<Record');
          });
        });

        describe('when the after hours voice message is defined as an mp3 recording', () => {
          it('should respond by playing the recording', async () => {
            const { user } = await createTestData(false, true);

            makeUsersSipEndpointsOnline([user]);

            const { status, text } = await postDirect()
              .send({ To: memberPhoneIdentfier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            expect(text).to.not.contain('<Speak');
            expect(text).to.contain('<Play');
            expect(text).to.contain('afterHours.mp3</Play>');
          });
        });
      });

      describe('when the user is not available', () => {
        it(`should respond with the unavailable message
           and should mark the call as missed, the communication as unread and assigned to the user`, async () => {
          const user = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });

          const team = await createATeam({ name: 'team', module: 'leasing' });

          const { id: teamMemberId } = await createATeamMember({
            teamId: team.id,
            userId: user.id,
            directPhoneIdentifier: memberPhoneIdentfier,
          });

          makeUsersSipEndpointsOnline([user]);

          const { status, text } = await postDirect()
            .send({ To: memberPhoneIdentfier })
            .send({ From: phoneNo })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ CallUUID: newId() });

          expect(status).to.equal(200);
          expect(text).to.not.contain('<Dial');
          expect(text).to.contain('<Speak');
          const { message } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
          expect(text).to.contain(message);

          const [comm] = await getAllComms(ctx);
          expect(comm.message.isMissed).to.equal(true);
          expect(comm.unread).to.equal(true);
          expect(comm.userId).to.equal(user.id);
        });
      });

      describe('when the user is available', () => {
        const setupForIncoming = async callRecordingSetup => {
          const user = await createAUser({
            name: 'user to be dialed when the user is the target',
            status: DALTypes.UserStatus.AVAILABLE,
            sipEndpoints: [{ username: 'inAppSipEndpointUsername', isUsedInApp: true }, { username: 'ipPhoneSipEndpointUsername' }],
          });
          const team = await createATeam({ metadata: { callRecordingSetup } });
          const teamMember = await createATeamMember({
            teamId: team.id,
            userId: user.id,
            directPhoneIdentifier: '12025550120',
          });

          makeUsersSipEndpointsOnline([user]);

          return { user, team, teamMember };
        };

        it('should respond with dial instructions for the user', async () => {
          const { user, teamMember } = await setupForIncoming();

          const { status, text } = await postDirect()
            .send({ To: teamMember.directPhoneIdentifier })
            .send({ From: phoneNo })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ CallerName: 'Batman' })
            .send({ CallUUID: newId() });

          expect(status).to.equal(200);
          expect(text).to.contain('<Dial');

          user.sipEndpoints.forEach(e => expect(text).to.contain(`<User>sip:${e.username}@phone.plivo.com</User>`));
        });

        describe('when a single receiver is determined', () => {
          it('should assign the call to the receiving agent', async () => {
            const user = await createAUser();
            const team = await createATeam();
            await createATeamMember({ teamId: team.id, userId: user.id });
            await createProgram(team.id);

            makeUsersSipEndpointsOnline([user]);

            const { status } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallerName: 'Batman' })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            const commEntries = await getAllComms(ctx);
            expect(commEntries).to.have.length(1);
            expect(commEntries[0].userId).to.equal(user.id);
          });
        });

        describe('when multiple receivers are determined', () => {
          it('should not assign the call', async () => {
            const userA = await createAUser();
            const userB = await createAUser();
            const team = await createATeam({ metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY } });

            await createATeamMember({ teamId: team.id, userId: userA.id });
            await createATeamMember({ teamId: team.id, userId: userB.id });
            await createProgram(team.id);

            makeUsersSipEndpointsOnline([userA, userB]);

            const { status } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallerName: 'Batman' })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            const commEntries = await getAllComms(ctx);
            expect(commEntries).to.have.length(1);
            expect(commEntries[0].userId).to.not.be.ok;
          });
        });

        describe("when the team's call recording setting is INBOUND", () => {
          it('response should contain recording instructions and recording notice', async () => {
            const { teamMember } = await setupForIncoming(DALTypes.CallRecordingSetup.INBOUND);
            const { message: callRecordingNotice } = await getVoiceMessage(ctx, {
              teamMemberId: teamMember.id,
              messageType: DALTypes.VoiceMessageType.RECORDING_NOTICE,
            });
            const { status, text } = await postDirect()
              .send({ To: teamMember.directPhoneIdentifier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallerName: 'Batman' })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            const [comm] = await getAllComms(ctx);
            const { callRecordingUrl } = await getTelephonyConfigs(ctx);
            const url = addParamsToUrl(callRecordingUrl, { commId: comm.id });
            const expectedRecordingInstructions = `<Record callbackUrl="${url}" maxLength="${telephony.callMaxRecordingDuration}" startOnDialAnswer="true" redirect="false"/>`;

            const formatedText = text.replace(/amp;/g, '');
            expect(formatedText).to.contain(expectedRecordingInstructions);

            expect(formatedText).to.contain('<Speak');
            expect(formatedText).to.contain(callRecordingNotice);
          });
        });
      });

      describe('when the caller phone number is marked as spam', () => {
        it(`should respond with the default unavailable message
            and no raw lead should be created
            and the communication should be saved in the spam communication table`, async () => {
          const user = await createAUser({
            ctx,
            name: 'user to be dialed when the user is the target',
            email: 'a@a.a',
            status: DALTypes.UserStatus.AVAILABLE,
          });
          const team = await createATeam({ name: 'team', module: 'leasing' });
          const teamMember = await createATeamMember({ teamId: team.id, userId: user.id, directPhoneIdentifier: '12025550120' });

          makeUsersSipEndpointsOnline([user]);
          const { id: personId } = await createAPerson();
          const contactInfos = [
            {
              type: 'phone',
              value: phoneNo,
              isSpam: true,
            },
          ];
          await saveContactInfo(ctx, contactInfos, personId);

          const { status, text } = await postDirect()
            .send({ To: teamMember.directPhoneIdentifier })
            .send({ From: phoneNo })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ CallerName: 'Batman' })
            .send({ CallUUID: newId() });

          expect(status).to.equal(200);
          expect(text).to.contain('<Speak');
          expect(text).to.contain(resources.DEFAULT_UNAVAILABLE_MESSAGE);

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(0);

          const commEntries = await getAllComms(ctx);
          expect(commEntries).to.have.length(0);

          const commSpamEntries = await getAllSpamCommunications(ctx);
          expect(commSpamEntries).to.have.length(1);
        });
      });
    });

    describe('when dialed number belongs to a program', () => {
      describe('when the call is after bussines hours', () => {
        describe('when there is a party for the caller assigned to another team', () => {
          it('should respond with the after hours voice message for the owner team', async () => {
            const { name: hubTeamVoiceMessages } = await createVoiceMessages(ctx, { messages: { afterHours: 'hub team specific message' } });
            const { name: coveTeamVoiceMessages } = await createVoiceMessages(ctx, { messages: { afterHours: 'cove team specific message' } });

            const hubTeam = await createATeam({ name: 'the hub', officeHours: officeHoursAlwaysOn, voiceMessage: hubTeamVoiceMessages });
            const coveTeam = await createATeam({ name: 'the cove', officeHours: officeHoursAlwaysOff, voiceMessage: coveTeamVoiceMessages });

            const hubAgent = await createAUser();
            await createATeamMember({
              teamId: hubTeam.id,
              userId: hubAgent.id,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const coveAgent = await createAUser();
            await createATeamMember({
              teamId: coveTeam.id,
              userId: coveAgent.id,
              roles: {
                mainRoles: [MainRoleDefinition.LA.name],
                functionalRoles: [FunctionalRoleDefinition.LD.name],
              },
            });

            const { id: programPropertyId } = await createAProperty();
            const { id: voiceMessageId } = await createVoiceMessages(ctx);

            await createATeamPropertyProgram({
              teamId: hubTeam.id,
              onSiteLeasingTeamId: coveTeam.id,
              propertyId: programPropertyId,
              directPhoneIdentifier: programPhoneIdentifier,
              commDirection: DALTypes.CommunicationDirection.IN,
              voiceMessageId,
            });

            const { id: partyId } = await createAParty({
              userId: coveAgent.id,
              teams: [coveTeam.id],
              ownerTeam: coveTeam.id,
              assignedPropertyId: programPropertyId,
            });
            const contactInfo = enhance([{ type: 'phone', value: phoneNo, id: newId() }]);
            await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

            const { status, text } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            const { message: coveAfterHours } = await getVoiceMessage(ctx, { teamId: coveTeam.id, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
            expect(text).to.contain(coveAfterHours);
          });
        });

        const createTestData = async withIvrMessages => {
          const user = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
          const team = await createATeam({ officeHours: officeHoursAlwaysOff });

          await createATeamMember({
            teamId: team.id,
            userId: user.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          });

          const { programId } = await createProgram(team.id, withIvrMessages);

          const { id: partyId } = await createAParty({ userId: user.id, teams: [team.id], ownerTeam: team.id });
          const contactInfo = enhance([{ type: 'phone', value: phoneNo, id: newId() }]);
          await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

          return { programId };
        };

        describe('when the after hours voice message is defined as IVR', () => {
          it('should respond with the after hours voice message in a loop ready for digits', async () => {
            const { programId } = await createTestData(true);

            const { status, text } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);

            const { message: afterHours } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
            await expectIvrResponse(text, afterHours);
          });
        });

        describe('when the after hours voice message is defined as voicemail', () => {
          it('should respond with the after hours voice message and instructions to record', async () => {
            const { programId } = await createTestData();

            const { status, text } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID: newId() });

            expect(status).to.equal(200);
            expect(text).to.not.contain('<Dial');

            expect(text).to.contain('<Speak');
            const { message: afterHours } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
            expect(text).to.contain(afterHours);
            expect(text).to.contain('<Record');
          });
        });
      });

      describe('when all of the team members are not available', () => {
        it('should respond with unavailable message', async () => {
          const user = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
          const team = await createATeam();

          await createATeamMember({
            teamId: team.id,
            userId: user.id,
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          });

          const { programId } = await createProgram(team.id);
          const { message: unavailableMessage } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });

          const { id: partyId } = await createAParty({ userId: user.id, teams: [team.id], ownerTeam: team.id });
          const contactInfo = enhance([{ type: 'phone', value: phoneNo, id: newId() }]);
          await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });
          makeUsersSipEndpointsOnline([user]);

          const { status, text } = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'Batman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: phoneNo })
            .send({ CallUUID: newId() });

          expect(status).to.equal(200);
          expect(text).to.not.contain('<Dial');
          expect(text).to.contain('<Speak');
          expect(text).to.contain(unavailableMessage);
        });
      });

      describe('when the target team has call queue enabled and the call is a transfer to a busy user', () => {
        it('should respond with voice mail instructions', async () => {
          const alfred = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          const bruce = await createAUser({ status: DALTypes.UserStatus.BUSY });

          const team = await createATeam({ name: 'waynes', metadata: { callQueue: { enabled: true } } });

          await createATeamMember({ teamId: team.id, userId: alfred.id });
          const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId: bruce.id });

          const { message: unavailableMessage } = await getVoiceMessage(ctx, {
            teamMemberId,
            messageType: DALTypes.VoiceMessageType.UNAVAILABLE,
          });

          makeUsersSipEndpointsOnline([alfred, bruce]);

          const getLiveCall = sinon.spy(() => ({ callUuid: callId }));
          setTelephonyOps({ getLiveCall });

          const { status, text } = await postDirect()
            .send({ transferTargetType: 'user' })
            .send({ transferTarget: bruce.id })
            .send({ transferredCallDirection: 'in' })
            .send({ transferredFrom: alfred.id })
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'catwoman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: phoneNo })
            .send({ CallUUID: callId });

          expect(status).to.equal(200);
          expect(text).to.not.contain('<Dial');
          expect(text).to.contain('<Speak');
          expect(text).to.contain(unavailableMessage);
        });
      });

      describe('when no one can be called and some of the team members are BUSY', () => {
        it('should respond with instructions to wait and dial again', async () => {
          const alfred = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });

          const bruce = await createAUser({ status: DALTypes.UserStatus.BUSY });

          const team = await createATeam({ metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY } });

          await createProgram(team.id);

          await createATeamMember({ teamId: team.id, userId: alfred.id });
          await createATeamMember({ teamId: team.id, userId: bruce.id });

          makeUsersSipEndpointsOnline([alfred, bruce]);

          const transferCall = sinon.spy();
          const getLiveCall = sinon.spy(() => ({ callUuid: callId }));
          setTelephonyOps({ transferCall, getLiveCall });

          const { status, text } = await postDirect()
            .send({ To: programPhoneIdentifier })
            .send({ CallerName: 'catwoman' })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ From: phoneNo })
            .send({ CallUUID: callId });

          expect(status).to.equal(200);
          expectToPlayRingingTone(text);

          await waitFor(telephony.timeoutBeforeRedial + 50);

          const comms = await getAllComms(ctx);
          const commsForCall = comms.filter(c => c.messageId === callId);

          const conf = await getTelephonyConfigs(ctx);
          const url = addParamsToUrl(conf.answerUrl, {
            redialAttemptNo: 1,
            isLeadCreated: true,
            redialForCommId: commsForCall[0].id,
          });

          const parties = await loadParties(ctx);
          expect(parties.length).to.equal(1);
          expect(getLiveCall).to.have.been.calledOnce;
          expect(transferCall).to.have.been.calledOnce;
          expect(transferCall).to.have.been.calledWith(conf.auth, { callId, alegUrl: url });
        });

        describe('when the call is a transfer', () => {
          it('should respond with instructions to wait and dial again and preserve transfer parameters', async () => {
            const alfred = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
            const bruce = await createAUser({ status: DALTypes.UserStatus.BUSY });

            const team = await createATeam({ metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY } });

            await createProgram(team.id);

            await createATeamMember({ teamId: team.id, userId: alfred.id });
            await createATeamMember({ teamId: team.id, userId: bruce.id });

            makeUsersSipEndpointsOnline([alfred, bruce]);

            const transferCall = sinon.spy();
            const getLiveCall = () => ({ callUuid: callId });
            setTelephonyOps({ transferCall, getLiveCall });

            const { id: originalCommId } = await createACommunicationEntry();

            const transferParams = {
              transferTargetType: TransferTargetType.TEAM,
              transferTarget: team.id,
              transferredCallDirection: DALTypes.CommunicationDirection.IN,
              transferredFrom: newId(),
              transferredFromCommId: originalCommId,
            };

            const { status, text } = await postDirect().send({
              To: programPhoneIdentifier,
              CallerName: 'catwoman',
              CallStatus: CallStatus.RINGING,
              From: phoneNo,
              CallUUID: callId,
              ...transferParams,
            });

            expect(status).to.equal(200);
            expectToPlayRingingTone(text);

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const conf = await getTelephonyConfigs(ctx);

            const comms = await getAllComms(ctx);
            const commsForCall = comms.filter(c => c.messageId === callId);

            const url = addParamsToUrl(conf.answerUrl, {
              ...transferParams,
              redialAttemptNo: 1,
              isLeadCreated: true,
              redialForCommId: commsForCall[0].id,
            });

            expect(transferCall).to.have.been.calledOnce;
            expect(transferCall).to.have.been.calledWith(conf.auth, { callId, alegUrl: url });
          });
        });

        describe('when caller hangs up during the wait phase', () => {
          it('should not try to transfer the call to answer webhook after wait period ended', async () => {
            const bruce = await createAUser({
              ctx,
              name: 'bruce',
              directEmailIdentifier: 'crm2',
              email: 'b@a.a',
              status: DALTypes.UserStatus.BUSY,
            });

            const team = await createATeam({
              name: 'waynes',
              module: 'leasing',
              email: 'a@a.a',
              metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY },
            });

            await createATeamMember({ teamId: team.id, userId: bruce.id });
            await createProgram(team.id);

            makeUsersSipEndpointsOnline([bruce]);

            const transferCall = sinon.spy();
            const getLiveCall = sinon.spy(() => ({ notFound: true }));
            setTelephonyOps({ transferCall, getLiveCall });

            const { status, text } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ From: phoneNo })
              .send({ CallUUID: callId });

            expect(status).to.equal(200);
            expectToPlayRingingTone(text);

            await waitFor(telephony.timeoutBeforeRedial + 20);

            expect(transferCall).to.not.have.been.called;
            expect(getLiveCall).to.have.been.calledOnce;
          });
        });

        describe('when maximum redial attempts have been reached', () => {
          it('should respond with unavailable message', async () => {
            const alfred = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });

            const bruce = await createAUser({ status: DALTypes.UserStatus.BUSY });

            const team = await createATeam({ name: 'waynes', module: 'leasing' });

            const { programId } = await createProgram(team.id);

            await createATeamMember({ teamId: team.id, userId: alfred.id });
            await createATeamMember({ teamId: team.id, userId: bruce.id });

            makeUsersSipEndpointsOnline([alfred, bruce]);
            const callIdTemp = newId();
            await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ From: phoneNo })
              .send({ CallUUID: callIdTemp });

            const communications = await getAllComms(ctx);
            expect(communications.length).to.equal(1);
            const comm = communications[0];

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const { status, text } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.IN_PROGRESS })
              .send({ From: phoneNo })
              .send({ CallUUID: callIdTemp })
              .send({ redialAttemptNo: telephony.incomingRedialMaxAttempts + 1 })
              .send({ redialForCommId: comm.id });

            expect(status).to.equal(200);
            expect(text).to.not.contain('<Dial');
            expect(text).to.contain('<Speak');
            const { message } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
            expect(text).to.contain(message);
          });
        });

        describe('when the call is a redial attempt and a user is available', () => {
          it('should respond with dial instructions', async () => {
            const alfred = await createAUser({ status: DALTypes.UserStatus.BUSY });

            const team = await createATeam({ name: 'waynes', module: 'leasing' });

            await createProgram(team.id);

            await createATeamMember({ teamId: team.id, userId: alfred.id });

            makeUsersSipEndpointsOnline([alfred]);

            const callId2 = newId();

            await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ From: phoneNo })
              .send({ CallUUID: callId2 })
              .send({ isLeadCreated: true });

            await updateUserStatus(ctx, alfred.id, DALTypes.UserStatus.AVAILABLE);
            makeUsersSipEndpointsOnline([alfred]);

            const communications = await getAllComms(ctx);
            expect(communications.length).to.equal(1);
            const comm = communications[0];

            const { status, text } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ From: phoneNo })
              .send({ CallUUID: callId2 })
              .send({ isLeadCreated: true })
              .send({ redialAttemptNo: 1 })
              .send({ redialForCommId: comm.id });

            expect(status).to.equal(200);
            expect(text).to.contain('<Dial');
            expect(text).to.contain(`<User>sip:${alfred.sipEndpoints[0].username}@phone.plivo.com</User>`);
          });
        });

        describe('when the call is a redial attempt and all users are busy', () => {
          it('should update the existing comm', async () => {
            const alfred = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });

            const bruce = await createAUser({ status: DALTypes.UserStatus.BUSY });

            const team = await createATeam({ metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY } });

            await createProgram(team.id);

            await createATeamMember({ teamId: team.id, userId: alfred.id });
            await createATeamMember({ teamId: team.id, userId: bruce.id });

            makeUsersSipEndpointsOnline([alfred, bruce]);

            const { status, text } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ From: phoneNo })
              .send({ CallUUID: callId });

            expect(status).to.equal(200);
            expectToPlayRingingTone(text);

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const communicationsBefore = await getAllComms(ctx);
            expect(communicationsBefore.length).to.equal(1);
            const commBefore = communicationsBefore[0];

            const { status: status2, text: text2 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.IN_PROGRESS })
              .send({ From: phoneNo })
              .send({ CallUUID: callId })
              .send({ isLeadCreated: true })
              .send({ redialAttemptNo: 1 })
              .send({ redialForCommId: commBefore.id });
            expect(status2).to.equal(200);
            expectToPlayRingingTone(text2);

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const { status: status3, text: text3 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallerName: 'catwoman' })
              .send({ CallStatus: CallStatus.IN_PROGRESS })
              .send({ From: phoneNo })
              .send({ CallUUID: callId })
              .send({ isLeadCreated: true })
              .send({ redialAttemptNo: 2 })
              .send({ redialForCommId: commBefore.id });
            expect(status3).to.equal(200);
            expectToPlayRingingTone(text3);

            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);
            const communications = await getAllComms(ctx);
            expect(communications.length).to.equal(1);
            const comm = communications[0];
            expect(comm.messageId).to.equal(callId);
            expect(comm.message.rawMessage.redialAttemptNo).to.equal('2');
          });
        });

        describe('when the call is a redial attempt from restricted number and all users are busy', () => {
          it('should update the existing comm', async () => {
            // added test for both annonymus and restricted number because i think that depending on the provider we get both in reva
            // i tested from my personal phone and the number appears as restricted, however when setting google voice to hide caller id
            // it appears as Anonymous
            const alfred = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
            const bruce = await createAUser({ status: DALTypes.UserStatus.BUSY });
            const team = await createATeam({ metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY } });

            await createProgram(team.id);

            await createATeamMember({ teamId: team.id, userId: alfred.id });
            await createATeamMember({ teamId: team.id, userId: bruce.id });

            makeUsersSipEndpointsOnline([alfred, bruce]);

            const call2Id = newId();
            const { status: status5, text: text5 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ From: 'Restricted' })
              .send({ CallUUID: call2Id });

            expect(status5).to.equal(200);
            expectToPlayRingingTone(text5);

            const communications = await getAllComms(ctx);
            expect(communications.length).to.equal(1);
            const comm = communications[0];

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const { status: status4, text: text4 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallStatus: CallStatus.IN_PROGRESS })
              .send({ From: 'Restricted' })
              .send({ CallUUID: call2Id })
              .send({ isLeadCreated: true })
              .send({ redialAttemptNo: 1 })
              .send({ redialForCommId: comm.id });
            expect(status4).to.equal(200);
            expectToPlayRingingTone(text4);

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const { status: status3, text: text3 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallStatus: CallStatus.IN_PROGRESS })
              .send({ From: 'Restricted' })
              .send({ CallUUID: call2Id })
              .send({ isLeadCreated: true })
              .send({ redialAttemptNo: 2 })
              .send({ redialForCommId: comm.id });

            expect(status3).to.equal(200);
            expectToPlayRingingTone(text3);

            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);
            const communications2 = await getAllComms(ctx);
            expect(communications2.length).to.equal(1);
            const comm2 = communications2[0];

            const persons2 = await getPersons(ctx);
            expect(persons2.length).to.equal(1);
            expect(persons2[0].fullName).to.equal('Restricted');
            expect(comm2.messageId).to.equal(call2Id);
            expect(comm2.message.rawMessage.redialAttemptNo).to.equal('2');
            expect(comm2.threadId).to.equal(comm.threadId);
          });
        });

        describe('when the call is a redial attempt from anonymous number and all users are busy', () => {
          it('should update the existing comm', async () => {
            // added test for both annonymus and restricted number because i think that depending on the provider we get both in reva
            // i tested from my personal phone and the number appears as restricted, however when setting google voice to hide caller id
            // it appears as anonymous
            const alfred = await createAUser({ status: DALTypes.UserStatus.NOT_AVAILABLE });
            const bruce = await createAUser({ status: DALTypes.UserStatus.BUSY });
            const team = await createATeam({ metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY } });

            await createProgram(team.id);

            await createATeamMember({ teamId: team.id, userId: alfred.id });
            await createATeamMember({ teamId: team.id, userId: bruce.id });

            makeUsersSipEndpointsOnline([alfred, bruce]);

            const call2Id = newId();
            const { status: status5, text: text5 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ From: 'Anonymous' })
              .send({ CallUUID: call2Id });

            expect(status5).to.equal(200);
            expectToPlayRingingTone(text5);

            const communications = await getAllComms(ctx);
            expect(communications.length).to.equal(1);
            const comm = communications[0];

            const persons = await getPersons(ctx);
            expect(persons.length).to.equal(1);
            expect(persons[0].fullName).to.equal('Anonymous');

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const { status: status4, text: text4 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallStatus: CallStatus.IN_PROGRESS })
              .send({ From: 'Anonymous' })
              .send({ CallUUID: call2Id })
              .send({ isLeadCreated: true })
              .send({ redialAttemptNo: 1 })
              .send({ redialForCommId: comm.id });
            expect(status4).to.equal(200);
            expectToPlayRingingTone(text4);

            await waitFor(telephony.timeoutBeforeRedial + 50);

            const { status: status3, text: text3 } = await postDirect()
              .send({ To: programPhoneIdentifier })
              .send({ CallStatus: CallStatus.IN_PROGRESS })
              .send({ From: 'Anonymous' })
              .send({ CallUUID: call2Id })
              .send({ isLeadCreated: true })
              .send({ redialAttemptNo: 2 })
              .send({ redialForCommId: comm.id });

            expect(status3).to.equal(200);
            expectToPlayRingingTone(text3);

            const parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);
            const communications2 = await getAllComms(ctx);
            expect(communications2.length).to.equal(1);
            const comm2 = communications2[0];

            const persons2 = await getPersons(ctx);
            expect(persons2.length).to.equal(1);
            expect(persons2[0].fullName).to.equal('Anonymous');
            expect(comm2.messageId).to.equal(call2Id);
            expect(comm2.message.rawMessage.redialAttemptNo).to.equal('2');
            expect(comm2.threadId).to.equal(comm.threadId);
          });
        });
      });
    });

    describe('when dialed number is a program phone number', () => {
      it(`should set the associated property to the newly created party
      and set the associated program to the communication`, async () => {
        const user = await createAUser();
        const team = await createATeam({ name: 'testTeam', module: 'leasing' });
        await createATeamMember({ teamId: team.id, userId: user.id });

        const teamPropertyProgram = await createProgram(team.id);

        const res = await postDirect()
          .send({ To: programPhoneIdentifier })
          .send({ CallerName: 'Batman' })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ From: '12025550198' })
          .send({ CallUUID: newId() });
        expect(res.status).to.equal(200);

        const parties = await loadParties(ctx);
        const messages = await getCommsByType({ tenantId: tenant.id }, DALTypes.CommunicationMessageType.CALL);

        expect(parties[0].assignedPropertyId).to.equal(teamPropertyProgram.propertyId);
        expect(parties[0].teamPropertyProgramId).to.equal(teamPropertyProgram.id);
        expect(parties[0].storedUnitsFilters).to.deep.equal({ propertyIds: [teamPropertyProgram.propertyId] });
        expect(messages[0].message.to[0]).to.equal(programPhoneIdentifier);
        expect(messages[0].teamPropertyProgramId).to.equal(teamPropertyProgram.id);
      });
    });
  });

  describe('given a request for a transferred call', () => {
    describe('when target is an external phone', () => {
      it('should respond with dial instructions for the external phone number and urls for webhooks', async () => {
        const user = await createAUser();
        const team = await createATeam();
        await createATeamMember({ teamId: team.id, userId: user.id });

        const { id: originalCommId } = await createACommunicationEntry();
        const { id: commId } = await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.IN,
          type: DALTypes.CommunicationMessageType.CALL,
          userId: user.id,
          transferredFromCommId: originalCommId,
        });

        const { status, text } = await postDirect()
          .send({ transferTarget: '12025550999' })
          .send({ transferTargetType: TransferTargetType.EXTERNAL_PHONE })
          .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
          .send({ transferredFromCommId: originalCommId })
          .send({ From: phoneNo })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ CallUUID: newId() });

        expect(status).to.equal(200);
        expect(text).to.contain('<Dial');
        expect(text).to.contain('<Number>12025550999</Number>');

        const { dialCallbackUrl } = await getTelephonyConfigs(ctx);
        const callbackUrl = addParamsToUrl(dialCallbackUrl, { commId }).replace(/&/g, '&amp;');

        expect(text).to.contain(`callbackUrl="${callbackUrl}"`);
      });

      it('should update the messageId because CallUUID might be different from initial call (outgoing call transferred)', async () => {
        const { id: originalCommId } = await createACommunicationEntry();
        await createACommunicationEntry({
          direction: DALTypes.CommunicationDirection.OUT,
          type: DALTypes.CommunicationMessageType.CALL,
          transferredFromCommId: originalCommId,
          messageId: newId(),
        });

        const transferredLegCallId = newId();
        const { status } = await postDirect()
          .send({ transferTarget: '12025550999' })
          .send({ transferTargetType: TransferTargetType.EXTERNAL_PHONE })
          .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
          .send({ transferredFromCommId: originalCommId })
          .send({ From: phoneNo })
          .send({ CallStatus: CallStatus.RINGING })
          .send({ CallUUID: transferredLegCallId });

        expect(status).to.equal(200);

        const [{ messageId }] = await loadLastMessage(ctx);
        expect(messageId).to.equal(transferredLegCallId);
      });
    });

    describe('when the transferred call is incoming', () => {
      describe('and transferred to a user', () => {
        it('should respond with dial instructions for the user', async () => {
          const userA = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          const userB = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          const team = await createATeam({ name: 'team', module: 'leasing' });
          await createATeamMember({ teamId: team.id, userId: userA.id, directPhoneIdentifier: '12025550120' });
          await createATeamMember({ teamId: team.id, userId: userB.id });

          makeUsersSipEndpointsOnline([userA, userB]);

          const { status, text } = await postDirect()
            .send({ transferTarget: userB.id })
            .send({ transferTargetType: TransferTargetType.USER })
            .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
            .send({ From: phoneNo })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ CallUUID: newId() });

          expect(status).to.equal(200);
          expect(text).to.contain('<Dial');
          expect(text).to.contain(`<User>sip:${userB.sipEndpoints[0].username}@phone.plivo.com</User>`);
        });

        it('should create a new comm for the transferred call, with the same messageId', async () => {
          const userA = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          const userB = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          const team = await createATeam({ name: 'team', module: 'leasing' });
          await createATeamMember({ teamId: team.id, userId: userA.id, directPhoneIdentifier: '12025550120' });
          await createATeamMember({ teamId: team.id, userId: userB.id });

          makeUsersSipEndpointsOnline([userA, userB]);

          const { id: commId } = await createACommunicationEntry({
            direction: DALTypes.CommunicationDirection.IN,
            type: DALTypes.CommunicationMessageType.CALL,
            userId: userA.id,
          });

          const CallUUID = newId();
          const { status } = await postDirect()
            .send({ transferTarget: userB.id })
            .send({ transferTargetType: TransferTargetType.USER })
            .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
            .send({ From: phoneNo })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ transferredFromCommId: commId })
            .send({ CallUUID });

          expect(status).to.equal(200);
          const [commCreatedForTransferredCall] = await getCommsByTransferredFrom(ctx, commId);
          expect(commCreatedForTransferredCall).to.be.ok;
          expect(commCreatedForTransferredCall.messageId).to.equal(CallUUID);
        });
      });

      describe('and transferred to a team', () => {
        it("should create a new comm, should not create a new party and should respond with dial instructions for the team's dispatcher", async () => {
          const targetTeam = await createATeam();

          const dispatcher = await createAUser({ name: 'dispatcher' });
          const roles = {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name],
          };
          await createATeamMember({ teamId: targetTeam.id, userId: dispatcher.id, roles });

          const originTeam = await createATeam();
          const originUser = await createAUser({ name: 'origin' });
          await createATeamMember({ teamId: originTeam.id, userId: originUser.id });

          const { id: partyId } = await createAParty({ teams: [originTeam.id], ownerTeam: originTeam.id });
          const contactInfo = enhance([{ type: 'phone', value: phoneNo, id: newId() }]);
          const { personId: callerId } = await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

          const { id: commId, messageId: CallUUID } = await createACommunicationEntry({
            direction: DALTypes.CommunicationDirection.IN,
            userId: originUser.id,
            parties: [partyId],
            persons: [callerId],
          });

          makeUsersSipEndpointsOnline([dispatcher, originUser]);

          const { status, text } = await postDirect()
            .send({ transferTarget: targetTeam.id })
            .send({ transferTargetType: TransferTargetType.TEAM })
            .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
            .send({ transferredFrom: originUser.id })
            .send({ transferredFromCommId: commId })
            .send({ From: phoneNo })
            .send({ CallStatus: CallStatus.RINGING })
            .send({ CallUUID });

          expect(status).to.equal(200);
          expect(text).to.contain('<Dial');
          expect(text).to.contain(`<User>sip:${dispatcher.sipEndpoints[0].username}@phone.plivo.com</User>`);

          const [commCreatedForTransfer] = await getCommsByTransferredFrom(ctx, commId);
          expect(commCreatedForTransfer).to.be.ok;
          expect(commCreatedForTransfer.messageId).to.equal(CallUUID);

          const parties = await loadParties(ctx);
          expect(parties).to.have.lengthOf(1);
          expect(parties[0].id).to.equal(partyId);
        });

        describe('and team call routing is "EVERYBODY"', () => {
          it('should exclude transfer initiator from users to call', async () => {
            const initiatorAgent = await createAUser({ name: 'initiator', status: DALTypes.UserStatus.AVAILABLE });

            const anotherAgent = await createAUser({ name: 'another', status: DALTypes.UserStatus.AVAILABLE });

            const { id: propertyId } = await createAProperty();
            const { id: teamId } = await createATeam({
              name: 'team',
              module: 'leasing',
              metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY },
            });

            await createATeamProperty(teamId, propertyId);

            await createATeamMember({ teamId, userId: initiatorAgent.id });
            await createATeamMember({ teamId, userId: anotherAgent.id });

            makeUsersSipEndpointsOnline([initiatorAgent, anotherAgent]);

            const { id: partyId } = await createAParty({ userId: initiatorAgent.id, teams: [teamId], assignedPropertyId: propertyId });
            const contactInfo = enhance([{ type: 'phone', value: phoneNo, id: newId() }]);
            await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

            const CallUUID = newId();

            const { id: commId } = await createACommunicationEntry({
              direction: DALTypes.CommunicationDirection.IN,
              type: DALTypes.CommunicationMessageType.CALL,
              userId: initiatorAgent.id,
            });

            const { status, text } = await postDirect()
              .send({ transferTarget: teamId })
              .send({ transferTargetType: TransferTargetType.TEAM })
              .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
              .send({ transferredFrom: initiatorAgent.id })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ transferredFromCommId: commId })
              .send({ CallUUID });

            expect(status).to.equal(200);
            expect(text).to.contain('<Dial');
            expect(text).to.contain(`<User>sip:${anotherAgent.sipEndpoints[0].username}@phone.plivo.com</User>`);
            expect(text).to.not.contain(`<User>sip:${initiatorAgent.sipEndpoints[0].username}@phone.plivo.com</User>`);
          });
        });

        describe('and team is outside office hours', () => {
          it('should respond with AFTER_HOURS message associated with the team', async () => {
            const { name: voiceMessage } = await createVoiceMessages();

            const { id: teamId } = await createATeam({ officeHours: officeHoursAlwaysOff, voiceMessage });
            const { id: userId } = await createAUser();
            const roles = {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            };
            await createATeamMember({ teamId, userId, roles });

            const CallUUID = newId();

            const { id: commId } = await createACommunicationEntry({
              direction: DALTypes.CommunicationDirection.IN,
              type: DALTypes.CommunicationMessageType.CALL,
              userId,
            });

            const { status, text } = await postDirect()
              .send({ transferTarget: teamId })
              .send({ transferTargetType: TransferTargetType.TEAM })
              .send({ transferredCallDirection: DALTypes.CommunicationDirection.IN })
              .send({ transferredFrom: userId })
              .send({ transferredFromCommId: commId })
              .send({ From: phoneNo })
              .send({ CallStatus: CallStatus.RINGING })
              .send({ CallUUID });

            expect(status).to.equal(200);
            expect(text).to.contain('<Speak');
            const { message: afterHours } = await getVoiceMessage(ctx, { teamId, messageType: DALTypes.VoiceMessageType.AFTER_HOURS });
            expect(text).to.contain(afterHours);
          });
        });
      });
    });

    describe('when an outgoing call is transferred', () => {
      describe('and transferred to a user', () => {
        it('should create a new comm, and respond with dial instructions for the user', async () => {
          const userA = await createAUser({ name: 'userA', status: DALTypes.UserStatus.AVAILABLE });

          const team = await createATeam({ name: 'team', module: 'leasing' });
          await createATeamMember({ teamId: team.id, userId: userA.id });

          const { id: partyId } = await createAParty({ userId: userA.id, teams: [team.id] });
          const contactInfo = enhance([{ type: 'phone', value: '12025550198', id: newId() }]);
          await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

          const userB = await createAUser({ name: 'userB', status: DALTypes.UserStatus.AVAILABLE });
          await createATeamMember({ teamId: team.id, userId: userB.id });

          makeUsersSipEndpointsOnline([userB]);

          const { id: commId } = await createACommunicationEntry({
            direction: DALTypes.CommunicationDirection.IN,
            type: DALTypes.CommunicationMessageType.CALL,
            userId: userA.id,
          });

          const CallUUID = newId();
          const { status, text } = await postDirect()
            .send({ transferTarget: userB.id })
            .send({ transferTargetType: TransferTargetType.USER })
            .send({ transferredCallDirection: DALTypes.CommunicationDirection.OUT })
            .send({ To: '12025550198' })
            .send({ transferredFromCommId: commId })
            .send({ CallUUID });

          expect(status).to.equal(200);
          expect(text).to.contain('<Dial');
          expect(text).to.contain(`<User>sip:${userB.sipEndpoints[0].username}@phone.plivo.com</User>`);
          const [commCreatedForTransfer] = await getCommsByTransferredFrom(ctx, commId);
          expect(commCreatedForTransfer).to.not.be.null;
          expect(commCreatedForTransfer.messageId).to.equal(CallUUID);
        });
      });

      describe(`and transferred to a team that manages other property then the one assigned to existing party
                 and the team doesn't have a party for that person`, () => {
        it("should respond with dial instructions for the team's dispatcher", async () => {
          const userA = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          const teamA = await createATeam({ name: 'team', module: 'leasing' });
          await createATeamMember({ teamId: teamA.id, userId: userA.id });

          const { id: partyId } = await createAParty({ userId: userA.id, teams: [teamA.id] });
          const contactInfo = enhance([{ type: 'phone', value: '12025550198', id: newId() }]);
          await createAPartyMember(partyId, { fullName: 'Batman', contactInfo });

          const userB = await createAUser({ status: DALTypes.UserStatus.AVAILABLE });
          const teamB = await createATeam({ name: 'teamB', module: 'leasing' });
          await createATeamMember({ teamId: teamB.id, userId: userB.id });

          const dispatcher = await createAUser({ name: 'dispatcher', status: DALTypes.UserStatus.AVAILABLE });
          const roles = {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
          };
          await createATeamMember({ teamId: teamB.id, userId: dispatcher.id, roles });

          makeUsersSipEndpointsOnline([dispatcher, userB]);

          const CallUUID = newId();

          const { id: commId } = await createACommunicationEntry({
            direction: DALTypes.CommunicationDirection.IN,
            type: DALTypes.CommunicationMessageType.CALL,
            userId: userA.id,
          });

          const { status, text } = await postDirect()
            .send({ transferTarget: teamB.id })
            .send({ transferTargetType: TransferTargetType.TEAM })
            .send({ transferredCallDirection: DALTypes.CommunicationDirection.OUT })
            .send({ transferredFrom: userA.id })
            .send({ To: '12025550198' })
            .send({ transferredFromCommId: commId })
            .send({ CallUUID });

          expect(status).to.equal(200);
          expect(text).to.contain('<Dial');
          expect(text).to.contain(`<User>sip:${dispatcher.sipEndpoints[0].username}@phone.plivo.com</User>`);
          const [commCreatedForTransfer] = await getCommsByTransferredFrom(ctx, commId);
          expect(commCreatedForTransfer).to.not.be.null;
          expect(commCreatedForTransfer.messageId).to.equal(CallUUID);
        });
      });
    });
  });

  describe('when receiving an incoming call from known originator but the party owner has been deactivated', async () => {
    const fromPhoneGuest = '12029990111';
    const directPhoneIdentifier = '12025550144';
    const teamMemberPhone = '12025550155';

    let partyOwnerUser;
    let dispatcherUser;
    let property;
    let mainTeam;

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

    it(`when incoming call is to program a raw lead will NOT be created and the existing
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

      makeUsersSipEndpointsOnline([dispatcherUser]);

      await postDirect().send({ To: directPhoneIdentifier }).send({ CallStatus: 'ringing' }).send({ From: fromPhoneGuest }).send({ CallUUID: newId() });

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(1);
      expect(parties[0].userId).to.equal(dispatcherUser.id);
    });

    it(`when call is to team member a raw lead will NOT be created and the existing
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

      makeUsersSipEndpointsOnline([dispatcherUser]);

      await postDirect().send({ To: teamMemberPhone }).send({ CallStatus: 'ringing' }).send({ From: fromPhoneGuest }).send({ CallUUID: newId() });

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(1);
      expect(parties[0].userId).to.equal(dispatcherUser.id);
    });
  });
});
