/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import newId from 'uuid/v4';
import { expect } from 'chai';
import sinon from 'sinon';
import { mapSeries } from 'bluebird';

import app from '../../../../consumer/server/server';
import { getAuthHeader } from '../../../../server/testUtils/apiHelper';
import {
  createAProperty,
  createAPerson,
  createACommonUser,
  testCtx,
  createAParty,
  createAUser,
  createATeam,
  createATeamMember,
  createAPartyMember,
  createADirectMessage,
  createAPost,
  createAPostRecipient,
} from '../../../../server/testUtils/repoHelper';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import '../../../../server/testUtils/setupTestGlobalContext';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { ResidentPropertyState } from '../../../../common/enums/residentPropertyStates';
import { setRetrieveCommonUserPropertiesFunction, resetRetrieveCommonUserPropertiesFunction } from '../common-middlewares';
import { getCommunicationsByIds } from '../../../../server/dal/communicationRepo';
import { now } from '../../../../common/helpers/moment-utils';

describe('communication', () => {
  let property;
  let commonUserId;
  let propertyId;
  let token;
  let commonUser;
  let personId;
  let teamId;
  let userId;
  let partyId;

  const getPropertyRes = (withProperties = true) => {
    if (withProperties) {
      return [
        {
          propertyName: property.name,
          propertyId,
          tenantName: testCtx.name,
          tenantLegal: '',
          residentState: ResidentPropertyState.CURRENT,
          features: { paymentModule: true, maintenanceModule: true },
          personId,
          propertyTimezone: LA_TIMEZONE,
        },
      ];
    }
    return [];
  };

  beforeEach(async () => {
    const person = await createAPerson('Jane Doe', 'Jane');
    personId = person.id;

    const user = await createAUser({ name: 'Agent' });
    userId = user.id;

    const team = await createATeam();
    teamId = team.id;
    await createATeamMember({ teamId, userId });
    property = await createAProperty();
    propertyId = property.id;
    const party = await createAParty({ userId, teams: [teamId], ownerTeam: teamId, assignedPropertyId: propertyId, state: DALTypes.PartyStateType.RESIDENT });
    partyId = party.id;
    const contactInfo1 = enhance([{ type: 'email', value: 'jane@bro.wn', id: newId() }]);
    await createAPartyMember(partyId, { fullName: 'Jane Doe', contactInfo: contactInfo1, preferredName: 'Jane', personId });

    const result = await createACommonUser({
      tenantId: testCtx.tenantId,
      fullName: 'Jane Doe',
      preferredName: 'Jane',
      email: 'jane@bro.wn',
      personId,
    });
    commonUser = result.commonUser;
    commonUserId = commonUser.id;

    token = getAuthHeader(testCtx.tenantId, commonUserId, null, true, { email: commonUser.email, personId });
    const getCommonUserProperties = sinon.spy(() => getPropertyRes());
    setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);
  });

  afterEach(() => {
    resetRetrieveCommonUserPropertiesFunction();
  });

  describe('GET resident/api/userNotifications', () => {
    describe('given a request to retrieve the user notifications', () => {
      describe('when the email is missing', () => {
        it('responds with status code 400 and EMAIL_DOES_NOT_EXIST token', async () => {
          const newToken = getAuthHeader(testCtx.tenantId, newId(), null, true);
          const res = await request(app).get('/resident/api/userNotifications').set({ tenant: testCtx.name }).set(newToken);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('EMAIL_DOES_NOT_EXIST');
        });
      });

      describe('when the person does not exist', () => {
        it('responds with status code 404 and PERSON_DOES_NOT_EXIST token', async () => {
          const newToken = getAuthHeader(testCtx.tenantId, newId(), null, true, { email: 'sampleEmail@reva.tech' });
          const res = await request(app).get('/resident/api/userNotifications').set({ tenant: testCtx.name }).set(newToken);

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PERSON_DOES_NOT_EXIST');
        });
      });

      describe('when the property ids do not exist', () => {
        it('responds with status code 404 and PROPERTY_IDS_MISSING token', async () => {
          const res = await request(app).get('/resident/api/userNotifications').set({ tenant: testCtx.name }).set(token);

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PROPERTY_IDS_MISSING');
        });
      });

      describe('when the user exists', () => {
        it('returns no unread messages flag for the property where there are none', async () => {
          const res = await request(app).get(`/resident/api/userNotifications?propertyIds=${propertyId}`).set({ tenant: testCtx.name }).set(token);

          expect(res.status).to.equal(200);
          const body = res.body;
          expect(body[propertyId]).to.not.be.undefined;
          expect(body[propertyId].hasUnreadMessages).to.equal(false);
        });
      });

      describe('when the user exists', () => {
        it('returns unread messages flag to true for the property where there are unread messages', async () => {
          const directMessage = {
            from: {
              fullName: 'Jane Doe',
              personId,
            },
            text: 'Hello direct message',
          };
          await createADirectMessage({
            direction: DALTypes.CommunicationDirection.OUT,
            partyId,
            directMessage,
            userId,
            personId,
            teamId,
          });
          const res = await request(app).get(`/resident/api/userNotifications?propertyIds=${propertyId}`).set({ tenant: testCtx.name }).set(token);

          expect(res.status).to.equal(200);
          const body = res.body;
          expect(body[propertyId]).to.not.be.undefined;
          expect(body[propertyId].hasUnreadMessages).to.equal(true);
        });
      });
    });
  });

  describe('GET  resident/api/properties/:propertyId/directMessages', () => {
    describe('given a request to retrieve the direct messages', () => {
      describe('when common user does not exist', () => {
        it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
          const res = await request(app).get(`/resident/api/properties/${propertyId}/directMessages`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
        });
      });

      describe('when property is not associated to user', () => {
        it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, commonUserId, null, true);
          const res = await request(app).get(`/resident/api/properties/${propertyId}/directMessages`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
        });
      });

      describe('when request is correct', () => {
        it('responds with status code 200 and the direct message list', async () => {
          const directMessage = {
            from: {
              fullName: 'Jane Doe',
              personId,
            },
            text: 'Hello direct message',
          };

          await createADirectMessage({
            direction: DALTypes.CommunicationDirection.IN,
            partyId,
            directMessage,
            userId,
            personId,
            teamId,
          });

          await createADirectMessage({
            direction: DALTypes.CommunicationDirection.OUT,
            partyId,
            directMessage,
            userId,
            personId,
            teamId,
          });
          const res = await request(app).get(`/resident/api/properties/${propertyId}/directMessages`).set({ tenant: testCtx.name }).set(token);
          expect(res.status).to.equal(200);
          const body = res.body;

          expect(body.length).to.equal(2);

          const dmKeys = ['id', 'author', 'message', 'direction', 'threadId', 'createdAt', 'unread', 'propertyId'];
          expect(body[0]).to.have.all.keys(dmKeys);
          expect(body[1]).to.have.all.keys(dmKeys);
        });
      });
    });
  });

  describe('POST  resident/api/properties/:propertyId/directMessages', () => {
    describe('given a request for sending a direct message', () => {
      describe('when person does not exist', () => {
        it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
          const res = await request(app).post(`/resident/api/properties/${propertyId}/directMessages`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
        });
      });

      describe('when property is not associated to user', () => {
        it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, commonUserId, null, true);
          const res = await request(app).post(`/resident/api/properties/${propertyId}/directMessages`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
        });
      });

      describe('when message does not exist', () => {
        it('responds with status code 400 and MESSAGE_REQUIRED token', async () => {
          const res = await request(app).post(`/resident/api/properties/${propertyId}/directMessages`).set(token);
          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('MESSAGE_REQUIRED');
        });
      });
      describe('when request is correct', () => {
        it('responds with status code 200 and saves the DM in the communication table', async () => {
          const directMessage = {
            text: 'Hello direct message',
          };

          const res = await request(app)
            .post(`/resident/api/properties/${propertyId}/directMessages`)
            .set({ tenant: testCtx.name })
            .set(token)
            .send({ message: directMessage });
          expect(res.status).to.equal(200);
          const body = res.body;

          expect(body.length).to.equal(1);

          const dmKeys = ['id', 'author', 'message', 'direction', 'threadId', 'createdAt', 'unread', 'propertyId'];
          expect(body[0]).to.have.all.keys(dmKeys);

          const [comm] = await getCommunicationsByIds(testCtx, [body[0].id]);
          expect(comm.direction).to.equal(DALTypes.CommunicationDirection.IN);
          expect(comm.type).to.equal(DALTypes.CommunicationMessageType.DIRECT_MESSAGE);
        });
      });
    });
  });

  describe('GET  resident/api/properties/:propertyId/posts', () => {
    describe('given a request to retrieve the posts', () => {
      describe('when person does not exist', () => {
        it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
          const res = await request(app).get(`/resident/api/properties/${propertyId}/posts`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
        });
      });

      describe('when property is not associated to user', () => {
        it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, commonUserId, null, true);
          const res = await request(app).get(`/resident/api/properties/${propertyId}/posts`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
        });
      });

      describe('when request is correct', () => {
        it('responds with status code 200 and the posts list', async () => {
          const draftPostObjects = [
            {
              title: 'Draft post title 1',
              message: 'Draft post message 1',
              category: DALTypes.PostCategory.ANNOUNCEMENT,
              createdBy: userId,
              updatedBy: userId,
              sentAt: now(),
            },
            {
              title: 'Draft post title 2',
              message: 'Draft post message 2',
              category: DALTypes.PostCategory.EMERGENCY,
              createdBy: userId,
              updatedBy: userId,
              sentAt: now(),
            },
          ];
          await mapSeries(draftPostObjects, async post => {
            const savedPost = await createAPost(post);
            await createAPostRecipient(savedPost.id, personId, propertyId);
          });

          const res = await request(app).get(`/resident/api/properties/${propertyId}/posts`).set({ tenant: testCtx.name }).set(token);
          expect(res.status).to.equal(200);
          const body = res.body;

          expect(body.length).to.equal(2);
          const postKeys = [
            'id',
            'category',
            'title',
            'message',
            'sentAt',
            'publicDocumentId',
            'hasMessageDetails',
            'heroImageURL',
            'retractedAt',
            'unread',
            'propertyId',
            'metadata',
            'createdBy',
            'uuid',
            'physicalPublicDocumentId',
          ];
          expect(body[0]).to.have.all.keys(postKeys);
          expect(body[1]).to.have.all.keys(postKeys);
        });
      });
    });
  });

  describe('POST  resident/api/properties/:propertyId/posts/markAsRead', () => {
    describe('given a request for marking a post as read', () => {
      describe('when person does not exist', () => {
        it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
          const res = await request(app).post(`/resident/api/properties/${propertyId}/posts/markAsRead`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
        });
      });

      describe('when property is not associated to user', () => {
        it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, commonUserId, null, true);
          const res = await request(app).post(`/resident/api/properties/${propertyId}/posts/markAsRead`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
        });
      });

      describe('when postIds do not exist', () => {
        it('responds with status code 400 and POST_ID_REQUIRED token', async () => {
          const res = await request(app).post(`/resident/api/properties/${propertyId}/posts/markAsRead`).set({ tenant: testCtx.name }).set(token);
          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('POST_ID_REQUIRED');
        });
      });

      describe('when request is correct', () => {
        it('responds with status code 200 and marks posts as read', async () => {
          const draftPostObjects = [
            {
              title: 'Draft post title 1',
              message: 'Draft post message 1',
              category: DALTypes.PostCategory.ANNOUNCEMENT,
              createdBy: userId,
              updatedBy: userId,
              sentAt: now(),
            },
            {
              title: 'Draft post title 2',
              message: 'Draft post message 2',
              category: DALTypes.PostCategory.EMERGENCY,
              createdBy: userId,
              updatedBy: userId,
              sentAt: now(),
            },
          ];
          await mapSeries(draftPostObjects, async post => {
            const savedPost = await createAPost(post);
            await createAPostRecipient(savedPost.id, personId, propertyId);
          });

          const res = await request(app).get(`/resident/api/properties/${propertyId}/posts`).set({ tenant: testCtx.name }).set(token);
          expect(res.status).to.equal(200);
          const body = res.body;

          expect(body.length).to.equal(2);

          const firstPost = body[0];

          const res2 = await request(app)
            .post(`/resident/api/properties/${propertyId}/posts/markAsRead`)
            .set({ tenant: testCtx.name })
            .set(token)
            .send({ postIds: [firstPost.id] });

          expect(res2.status).to.equal(200);

          const res3 = await request(app).get(`/resident/api/properties/${propertyId}/posts`).set({ tenant: testCtx.name }).set(token);
          const body3 = res3.body;

          expect(body3.length).to.equal(2);

          const readPost = body3.find(p => p.id === firstPost.id);
          const unreadPost = body3.find(p => p.id !== firstPost.id);
          expect(readPost.unread).to.equal(false);
          expect(unreadPost.unread).to.equal(true);
        });
      });
    });
  });

  describe('POST  resident/api/properties/:propertyId/directMessages/markAsRead', () => {
    describe('given a request for marking a post as read', () => {
      describe('when person does not exist', () => {
        it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
          const res = await request(app).post(`/resident/api/properties/${propertyId}/directMessages/markAsRead`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
        });
      });

      describe('when property is not associated to user', () => {
        it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const newToken = getAuthHeader(testCtx.tenantId, commonUserId, null, true);
          const res = await request(app).post(`/resident/api/properties/${propertyId}/directMessages/markAsRead`).set({ tenant: testCtx.name }).set(newToken);
          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
        });
      });

      describe('when postIds do not exist', () => {
        it('responds with status code 400 and DIRECT_MESSAGE_ID_REQUIRED token', async () => {
          const res = await request(app).post(`/resident/api/properties/${propertyId}/directMessages/markAsRead`).set({ tenant: testCtx.name }).set(token);
          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('DIRECT_MESSAGE_ID_REQUIRED');
        });
      });

      describe('when request is correct', () => {
        it('responds with status code 200 and marks posts as read', async () => {
          const directMessage = {
            from: {
              fullName: 'Jane Doe',
              personId,
            },
            text: 'Hello direct message',
          };

          const dm1 = await createADirectMessage({
            direction: DALTypes.CommunicationDirection.IN,
            partyId,
            directMessage,
            userId,
            personId,
            teamId,
          });

          await createADirectMessage({
            direction: DALTypes.CommunicationDirection.OUT,
            partyId,
            directMessage,
            userId,
            personId,
            teamId,
          });

          const res2 = await request(app)
            .post(`/resident/api/properties/${propertyId}/directMessages/markAsRead`)
            .set({ tenant: testCtx.name })
            .set(token)
            .send({ messageIds: [dm1.id] });

          expect(res2.status).to.equal(200);

          const res3 = await request(app).get(`/resident/api/properties/${propertyId}/directMessages`).set({ tenant: testCtx.name }).set(token);
          const body3 = res3.body;

          expect(body3.length).to.equal(2);

          const readDM = body3.find(p => p.id === dm1.id);
          const unreadDM = body3.find(p => p.id !== dm1.id);
          expect(readDM.unread).to.equal(false);
          expect(unreadDM.unread).to.equal(true);
        });
      });
    });
  });
});
