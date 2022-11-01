/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import newId from 'uuid/v4';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import {
  testCtx as ctx,
  createAUser,
  createAParty,
  createAPartyMember,
  createATeam,
  createAProperty,
  createATeamPropertyProgram,
  createAProgram,
  createACommunicationEntry,
} from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { loadParty } from '../../../dal/partyRepo';
import { getActivityLogs, getActLogDisplayNo } from '../../../dal/activityLogRepo';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { storeMessage, loadMessageById, getAllComms } from '../../../dal/communicationRepo';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../../common/enums/activityLogTypes';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { init } from '../../../../common/helpers/cloudinary';
import { postDirect } from '../../../testUtils/telephonyHelper';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import { setDelayFunc } from '../../../services/telephony/hangup';

describe('Party Interactions', () => {
  let partyId;
  let primaryUser;
  let collaboratorUser;
  let defaultProgram;
  let team2Id;
  let property;

  beforeEach(async () => {
    init({ cloudName: 'test' });
    primaryUser = await createAUser();
    const team1 = await createATeam({
      name: 'team1',
      module: 'leasing',
      email: 'test1@test.a',
      phone: '15417544217',
    });
    const team2 = await createATeam({
      name: 'team2',
      module: 'residentServices',
      email: 'test2@test.a',
      phone: '15417543010',
    });
    team2Id = team2.id;

    defaultProgram = await createAProgram({ name: 'default', directPhoneIdentifier: '12223334444' });
    property = await createAProperty({ comms: { defaultOutgoingProgram: defaultProgram.id } });
    await createATeamPropertyProgram({
      teamId: team1.id,
      propertyId: property.id,
      commDirection: DALTypes.CommunicationDirection.OUT,
    });
    const party = await createAParty({
      userId: primaryUser.id,
      teams: [team1.id],
      assignedPropertyId: property.id,
      ownerTeam: team1.id,
    });
    partyId = party.id;
    collaboratorUser = await createAUser();
    collaboratorUser.teams = [team1, team2];

    setDelayFunc(async func => await func());
  });

  const checkInteractionsForNewComms = async (entityId, commType, subject) => {
    const logs = await getActivityLogs({ tenantId: tenant.id });
    expect(logs.length).to.equal(1);
    expect(logs[0].component).to.equal(commType);
    expect(logs[0].type).to.equal(ACTIVITY_TYPES.NEW);

    const { details } = logs[0];
    const seqDisplayNo = await getActLogDisplayNo(ctx);
    const activityLogBaseStructure = {
      id: entityId,
      to: ['John Doe'],
      seqDisplayNo,
      createdByType: DALTypes.CreatedByType.USER,
      partyId,
    };
    expect(details).to.deep.equal(commType === COMPONENT_TYPES.EMAIL ? { ...activityLogBaseStructure, subject } : activityLogBaseStructure);

    const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);
    expect(collaborators).to.deep.include(collaboratorUser.id);
  };
  describe('when the user initiates an outgoing call on a party', () => {
    it('the defaultOutgoingProgram should be used if there is no corresponding team/property in the TeamPropertyProgram table', async () => {
      const username = 'John';
      const { id: propertyId } = await createAProperty({ comms: { defaultOutgoingProgram: defaultProgram.id } });
      const { id: userId, sipEndpoints } = await createAUser({
        ctx,
        name: username,
        email: 'user-email-test@domain.com',
        status: DALTypes.UserStatus.AVAILABLE,
        sipEndpoints: [{ username, isUsedInApp: true }],
      });

      const sipUsername = `sip:${sipEndpoints[0].username}@phone.plivo.com`;

      const firstTeam = await createATeam({ name: 'team1', module: 'leasing' });

      const secondTeam = await createATeam({ name: 'team2', module: 'leasing' });

      await createATeamPropertyProgram({
        teamId: secondTeam.id,
        propertyId,
        commDirection: DALTypes.CommunicationDirection.OUT,
      });

      const party = await createAParty({ userId, ownerTeam: firstTeam.id, assignedPropertyId: propertyId });
      const memberPhoneNo = '12025550198';
      const contactInfo = enhance([{ type: 'phone', value: memberPhoneNo, id: newId() }]);
      await createAPartyMember(party.id, { fullName: 'Batman', contactInfo });

      await createACommunicationEntry({
        parties: [party.id],
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
        partyId: party.id,
      }).replace(/&/g, '&amp;');

      const callbackUrl = addParamsToUrl(dialCallbackUrl, {
        isPhoneToPhone: false,
        commId,
        partyId: party.id,
      }).replace(/&/g, '&amp;');

      const expectedResponse = `<Response><Dial callerId="${defaultProgram.displayPhoneNumber}" callerName="${username}" action="${action}" callbackUrl="${callbackUrl}"><Number>${memberPhoneNo}</Number></Dial></Response>`;
      expect(res.text).to.equal(expectedResponse);
    });
  });

  describe('when a user sends a new mail for a party', () => {
    it('a new activity log is saved and the user is added to the party collaborators list', async () => {
      const contactInfo = enhance([{ type: 'email', value: 'john.doe@test.com', id: newId() }]);
      const pm = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const contactInfos = [pm.contactInfo.defaultEmailId];

      const message = {
        partyId,
        recipients: { contactInfos },
        message: {
          subject: 'test subject',
          content: 'test content',
        },
        type: DALTypes.CommunicationMessageType.EMAIL,
      };

      const commRes = await request(app).post('/communications').set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams)).send(message);

      expect(commRes.status).to.equal(200);

      await checkInteractionsForNewComms(commRes.body[0].id, COMPONENT_TYPES.EMAIL, message.message.subject);
    });
  });

  describe('when a user sends a new sms for a party', () => {
    it('a new activity log is saved and the user is added to the party collaborators list', async () => {
      const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
      const pm = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const contactInfos = [pm.contactInfo.defaultPhoneId];

      const message = {
        partyId,
        recipients: { contactInfos },
        message: {
          subject: 'test sms',
          content: 'test sms content',
        },
        type: DALTypes.CommunicationMessageType.SMS,
      };

      const commRes = await request(app).post('/communications').set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams)).send(message);

      expect(commRes.status).to.equal(200);

      await checkInteractionsForNewComms(commRes.body[0].id, COMPONENT_TYPES.SMS);
    });

    it('the defaultOutgoingProgram should be used if there is no corresponding team/property in the TeamPropertyProgram table', async () => {
      const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
      const party = await createAParty({
        userId: primaryUser.id,
        teams: [team2Id],
        assignedPropertyId: property.id,
        ownerTeam: team2Id,
      });

      const pm = await createAPartyMember(party.id, {
        fullName: 'John Doe',
        contactInfo,
      });

      const contactInfos = [pm.contactInfo.defaultPhoneId];

      const message = {
        partyId: party.id,
        recipients: { contactInfos },
        message: {
          subject: 'test sms',
          content: 'test sms content',
        },
        type: DALTypes.CommunicationMessageType.SMS,
      };

      const commRes = await request(app).post('/communications').set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams)).send(message);

      const [body] = commRes.body;

      expect(commRes.status).to.equal(200);
      expect(body.message.from).to.equal(defaultProgram.displayPhoneNumber);
    });
  });

  describe('when a user answers a new call for a party', () => {
    it('a new activity log is saved and the user is added to the party collaborators list', async () => {
      const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
      const { personId } = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const call = {
        parties: [partyId],
        persons: [personId],
        type: DALTypes.CommunicationMessageType.CALL,
        direction: DALTypes.CommunicationDirection.IN,
        message: {
          to: ['16503381455'],
        },
        messageId: newId(),
        userId: collaboratorUser.id,
      };

      const commEntry = await storeMessage({ tenantId: tenant.id }, call);

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { message: { answered: true } } });

      expect(res.status).to.equal(200);

      const callDurationUpdateRes = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { message: { duration: '00:05' } } });

      expect(callDurationUpdateRes.status).to.equal(200);

      await postDirect().send({ CallUUID: call.messageId }).send({ HangupCause: 'NORMAL_CLEARING' });
      const seqDisplayNo = await getActLogDisplayNo(ctx);

      const logs = await getActivityLogs({ tenantId: tenant.id });

      expect(logs.length).to.equal(1);
      expect(logs[0].component).to.equal(COMPONENT_TYPES.CALL);
      expect(logs[0].type).to.equal(ACTIVITY_TYPES.TERMINATED);

      const { details } = logs[0];
      expect(details).to.deep.equal({
        id: commEntry.id,
        seqDisplayNo,
        createdByType: DALTypes.CreatedByType.USER,
        partyId,
        callDuration: '00:05',
        status: 'normal cleared',
      });

      const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);

      expect(collaborators).to.deep.include(collaboratorUser.id);
    });
  });

  describe('when a user updates notes for a call for a party', () => {
    it('a new activity log is saved and the user is added to the party collaborators list', async () => {
      const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
      const { personId } = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const call = {
        parties: [partyId],
        persons: [personId],
        type: DALTypes.CommunicationMessageType.CALL,
        direction: DALTypes.CommunicationDirection.IN,
      };

      const commEntry = await storeMessage({ tenantId: tenant.id }, call);

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { message: { notes: 'sample notes' } } });

      expect(res.status).to.equal(200);
      const seqDisplayNo = await getActLogDisplayNo(ctx);

      const logs = await getActivityLogs({ tenantId: tenant.id });
      expect(logs.length).to.equal(1);
      expect(logs[0].component).to.equal(COMPONENT_TYPES.CALL);
      expect(logs[0].type).to.equal(ACTIVITY_TYPES.UPDATE);

      const { details } = logs[0];
      expect(details).to.deep.equal({
        id: commEntry.id,
        notes: 'sample notes',
        seqDisplayNo,
        createdByType: DALTypes.CreatedByType.USER,
        partyId,
      });

      const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);
      expect(collaborators).to.deep.include(collaboratorUser.id);
    });
  });

  describe('when a user listenes to a voice message', () => {
    const createCommEntry = async () => {
      const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
      const { personId } = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const call = {
        parties: [partyId],
        persons: [personId],
        type: DALTypes.CommunicationMessageType.CALL,
        direction: DALTypes.CommunicationDirection.IN,
        message: { isVoiceMail: true },
      };

      return await storeMessage({ tenantId: tenant.id }, call);
    };

    it('a new activity log is saved and the user is added to the party collaborators list', async () => {
      const commEntry = await createCommEntry();

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { message: { listened: true } } });

      expect(res.status).to.equal(200);
      const seqDisplayNo = await getActLogDisplayNo(ctx);

      const logs = await getActivityLogs({ tenantId: tenant.id });
      expect(logs.length).to.equal(1);
      expect(logs[0].component).to.equal(COMPONENT_TYPES.CALL);
      expect(logs[0].type).to.equal(ACTIVITY_TYPES.LISTENED);

      const { details } = logs[0];
      expect(details).to.deep.equal({
        id: commEntry.id,
        from: ['John Doe'],
        seqDisplayNo,
        createdByType: DALTypes.CreatedByType.USER,
        partyId,
        recordingType: 'Voice message',
      });
      const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);
      expect(collaborators).to.deep.include(collaboratorUser.id);
    });

    it('should mark the comm as read if the user is the party owner', async () => {
      const commEntry = await createCommEntry();

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, primaryUser.id))
        .send({ delta: { message: { listened: true } } });

      expect(res.status).to.equal(200);
      const comm = await loadMessageById({ tenantId: tenant.id }, commEntry.id);
      expect(comm.unread).to.be.false;
    });

    it('should not mark the comm as read if the user is not the party owner', async () => {
      const commEntry = await createCommEntry();

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { message: { listened: true } } });

      expect(res.status).to.equal(200);
      const comm = await loadMessageById({ tenantId: tenant.id }, commEntry.id);
      expect(comm.unread).to.be.false;
    });
  });

  describe('when a user listenes to a call recording', () => {
    [DALTypes.CommunicationDirection.IN, DALTypes.CommunicationDirection.OUT].forEach(direction =>
      it('a new activity log is saved and the user is added to the party collaborators list', async () => {
        const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
        const { personId } = await createAPartyMember(partyId, {
          fullName: 'John Doe',
          contactInfo,
        });

        const call = {
          parties: [partyId],
          persons: [personId],
          type: DALTypes.CommunicationMessageType.CALL,
          direction,
          message: {},
        };

        const commEntry = await storeMessage({ tenantId: tenant.id }, call);

        const res = await request(app)
          .patch(`/communications/?id=${commEntry.id}`)
          .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
          .send({ delta: { message: { listened: true } } });

        expect(res.status).to.equal(200);
        const seqDisplayNo = await getActLogDisplayNo(ctx);

        const logs = await getActivityLogs({ tenantId: tenant.id });
        expect(logs.length).to.equal(1);
        expect(logs[0].component).to.equal(COMPONENT_TYPES.CALL);
        expect(logs[0].type).to.equal(ACTIVITY_TYPES.LISTENED);

        const guestsDirection = direction === DALTypes.CommunicationDirection.IN ? 'from' : 'to';
        const { details } = logs[0];
        expect(details).to.deep.equal({
          id: commEntry.id,
          [guestsDirection]: ['John Doe'],
          createdByType: DALTypes.CreatedByType.USER,
          seqDisplayNo,
          partyId,
          recordingType: 'Call recording',
        });

        const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);
        expect(collaborators).to.deep.include(collaboratorUser.id);
      }),
    );
  });
  describe('when a user updates other call info for a party', () => {
    it('a new activity log is not saved and the user is not added to the party collaborators list', async () => {
      const contactInfo = enhance([{ type: 'phone', value: '0016502736663', id: newId() }]);
      const { personId } = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const call = {
        parties: [partyId],
        persons: [personId],
        type: DALTypes.CommunicationMessageType.CALL,
        direction: DALTypes.CommunicationDirection.OUT,
      };

      const commEntry = await storeMessage({ tenantId: tenant.id }, call);

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { message: { duration: '0:04' } } });

      expect(res.status).to.equal(200);

      const logs = await getActivityLogs({ tenantId: tenant.id });
      expect(logs.length).to.equal(0);
      const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);
      expect(collaborators).to.not.deep.include(collaboratorUser.id);
    });
  });

  describe('when a user reads', () => {
    const checkCommLog = async (type, component) => {
      const contactInfo = enhance([{ type: 'email', value: 'john@doe.io', id: newId() }]);
      const { personId } = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      let comm = {
        message: {
          subject: 'The Hobbit',
          text: 'In a hole in the ground there lived a hobbit...',
        },
        unread: true,
        parties: [partyId],
        persons: [personId],
        type,
      };

      if (type === DALTypes.CommunicationMessageType.EMAIL) {
        comm = {
          ...comm,
          category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
        };
      }

      const commEntry = await storeMessage({ tenantId: tenant.id }, comm);

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { unread: false } });

      expect(res.status).to.equal(200);
      const seqDisplayNo = await getActLogDisplayNo(ctx);

      const logs = await getActivityLogs({ tenantId: tenant.id });
      expect(logs.length).to.equal(1);
      expect(logs[0].component).to.equal(component);
      expect(logs[0].type).to.equal(ACTIVITY_TYPES.READ);

      const { details } = logs[0];
      expect(details).to.deep.equal({
        id: commEntry.id,
        from: ['John Doe'],
        seqDisplayNo,
        createdByType: DALTypes.CreatedByType.USER,
        partyId,
      });

      const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);
      expect(collaborators).to.deep.include(collaboratorUser.id);
    };

    it('an email, a new activity log is saved and the user is added to the party collaborators list', async () => {
      await checkCommLog(DALTypes.CommunicationMessageType.EMAIL, COMPONENT_TYPES.EMAIL);
    });

    it('a sms, a new activity log is saved and the user is added to the party collaborators list', async () => {
      await checkCommLog(DALTypes.CommunicationMessageType.SMS, COMPONENT_TYPES.SMS);
    });
  });

  describe('when a user transfers a call', () => {
    it('a new activity log is saved', async () => {
      const contactInfo = enhance([{ type: 'phone', value: '12025550395', id: newId() }]);
      const { personId } = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const call = {
        parties: [partyId],
        persons: [personId],
        type: DALTypes.CommunicationMessageType.CALL,
        direction: DALTypes.CommunicationDirection.IN,
        messageId: newId(),
        userId: primaryUser.id,
        message: {},
        teams: [team2Id],
      };

      const commEntry = await storeMessage({ tenantId: tenant.id }, call);

      const res = await request(app)
        .post(`/communications/phone/${commEntry.id}/transfer`)
        .set(getAuthHeader(tenant.id, primaryUser.id))
        .send({ id: collaboratorUser.id });

      expect(res.status).to.equal(200);

      const res1 = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, primaryUser.id))
        .send({ delta: { message: { duration: '00:04' } } });

      expect(res1.status).to.equal(200);

      await postDirect().send({ CallUUID: call.messageId }).send({ HangupCause: 'NORMAL_CLEARING' });

      const logs = await getActivityLogs({ tenantId: tenant.id });
      expect(logs.length).to.equal(1);
      expect(logs[0].component).to.equal(COMPONENT_TYPES.CALL);
      expect(logs[0].type).to.equal(ACTIVITY_TYPES.TERMINATED);
      expect(logs[0].details.status).to.equal(DALTypes.CallTerminationStatus.TRANSFERRED);
    });
  });

  describe('when a user updates other comm info for a party', () => {
    it('a new activity log is not saved and the user is not added to the party collaborators list', async () => {
      const contactInfo = enhance([{ type: 'email', value: 'john@doe.io', id: newId() }]);
      const { personId } = await createAPartyMember(partyId, {
        fullName: 'John Doe',
        contactInfo,
      });

      const comm = {
        message: {
          subject: 'The Hobbit',
          text: 'In a hole in the ground there lived a hobbit...',
        },
        unread: true,
        parties: [partyId],
        persons: [personId],
        type: DALTypes.CommunicationMessageType.EMAIL,
        category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
      };

      const commEntry = await storeMessage({ tenantId: tenant.id }, comm);

      const res = await request(app)
        .patch(`/communications/?id=${commEntry.id}`)
        .set(getAuthHeader(tenant.id, collaboratorUser.id, collaboratorUser.teams))
        .send({ delta: { message: { text: 'some other text' } } });

      expect(res.status).to.equal(200);

      const logs = await getActivityLogs({ tenantId: tenant.id });
      expect(logs.length).to.equal(0);
      const { collaborators } = await loadParty({ tenantId: tenant.id }, partyId);
      expect(collaborators).to.not.deep.include(collaboratorUser.id);
    });
  });
});
