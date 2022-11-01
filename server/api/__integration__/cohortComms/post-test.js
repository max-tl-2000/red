/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import request from 'supertest';
import getUUID from 'uuid/v4';
import path from 'path';
import { admin } from '../../../common/schemaConstants';
import app from '../../api';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { testCtx as ctx, createAUser, createATeam, createAPostRecipient } from '../../../testUtils/repoHelper';
import { chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { setupConsumers } from '../../../workers/consumer';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { updateTenant } from '../../../dal/tenantsRepo';
import { getAllPosts } from '../../../dal/cohortCommsRepo';
import { markPostAsSent } from '../../../services/cohortCommsService';
import { setNotificationFunction, resetNotificationFunction } from '../../../../common/server/notificationClient';
import eventTypes from '../../../../common/enums/eventTypes';

chai.use(sinonChai);
const expect = chai.expect;

const setupMsgQueueAndWaitFor = async (conditions, options = {}) => {
  const { resolvers, promises } = waitFor(conditions);
  const matcher = createResolverMatcher(resolvers);
  await setupConsumers(chan(), matcher, ['upload', 'importCohort']);

  if (options.individualTasks) return promises;
  return { task: Promise.all(promises) };
};

describe('API/cohortComms/post', async () => {
  const basePath = '/cohortComms/post';
  const adminCtx = { tenantId: admin.id };

  let user;
  let user2;
  let team;

  const filename = 'test-document.csv';
  const context = DALTypes.PostCategory.ANNOUNCEMENT;
  const retractedReason = 'Missing or incomplete information';

  const fetchDocuments = () => request(app).get('/documents').set(getAuthHeader()).expect(200);

  const uploadRecipientFile = postId =>
    request(app)
      .post(`${basePath}/recipient`)
      .type('form')
      .field('postId', postId)
      .field('context', context)
      .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
      .attach('files', path.resolve(path.dirname(__dirname), 'resources', filename));

  const createPost = category =>
    request(app)
      .post(basePath)
      .send({ category })
      .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]));

  beforeEach(async () => {
    user = await createAUser();
    user2 = await createAUser();
    team = await createATeam({
      name: 'testTeam',
      module: 'leasing',
    });

    await updateTenant(adminCtx, ctx.id, {
      settings: { ...ctx.settings, features: { enableCohortComms: true } },
    });
  });

  afterEach(() => resetNotificationFunction());

  describe('when create post endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .post(basePath)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('and is a CCA user', () => {
      it('should return 400 if NO category is sent', async () => {
        await request(app)
          .post(basePath)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('CATEGORY_REQUIRED'));
      });

      it('should create a draft post if category is sent', async () => {
        const res = await request(app)
          .post(basePath)
          .send({ category: DALTypes.PostCategory.ANNOUNCEMENT })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);
        const postKeys = [
          'id',
          'category',
          'title',
          'sentAt',
          'sentBy',
          'createdBy',
          'updatedBy',
          'retractedAt',
          'created_at',
          'updated_at',
          'messageDetails',
          'publicDocumentId',
          'message',
          'rawMessage',
          'rawMessageDetails',
          'metadata',
        ];

        expect(res.body).to.not.be.empty;
        expect(Object.keys(res.body)).to.have.members(postKeys);

        const posts = await getAllPosts(ctx);
        expect(posts[0].sentAt).to.be.null;
        expect(posts[0].sentBy).to.be.null;
        expect(posts.length).to.equal(1);
      });
    });
  });

  describe('when delete post endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .post(basePath)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('and is a CAA user', () => {
      let postResponse;
      beforeEach(async () => {
        postResponse = await createPost(DALTypes.PostCategory.ANNOUNCEMENT);
      });

      it('should return 400 if postId is not sent', async () => {
        await request(app)
          .delete(basePath)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('POST_ID_REQUIRED'));
      });

      it('should delete post if postId is sent', async () => {
        await request(app)
          .delete(basePath)
          .send({ postId: postResponse.body.id })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);

        const posts = await getAllPosts(ctx);
        expect(posts.length).to.equal(0);
      });
    });
  });

  describe('when retract post endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .patch(`${basePath}/retract`)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('and is a CAA user', () => {
      let postResponse;
      beforeEach(async () => {
        postResponse = await createPost(DALTypes.PostCategory.ANNOUNCEMENT);
      });

      it('should return 400 if postId is not sent', async () => {
        await request(app)
          .patch(`${basePath}/retract`)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('POST_ID_REQUIRED'));
      });

      it('should retract post if postId is sent', async () => {
        await request(app)
          .patch(`${basePath}/retract`)
          .send({ postId: postResponse.body.id, retractedReason })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);

        const posts = await getAllPosts(ctx);

        expect(posts.length).to.equal(1);
        expect(posts[0].metadata.retractDetails.retractedBy).to.equal('test');
        expect(posts[0].metadata.retractDetails.retractedReason).to.equal(retractedReason);
      });
    });
  });

  describe('when update post endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .patch(basePath)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('and is a CCA user', () => {
      let postResponse;
      beforeEach(async () => {
        postResponse = await createPost(DALTypes.PostCategory.ANNOUNCEMENT);
      });

      it('should return 400 is no postId is sent', async () => {
        await request(app)
          .patch(basePath)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('POST_ID_REQUIRED'));
      });

      it('should update post if postId is sent and there is not a recipient file uploaded', async () => {
        expect(postResponse.body.title).to.be.null;
        expect(postResponse.body.message).to.be.null;
        expect(postResponse.body.messageDetails).to.be.null;
        const postUpdatedResponse = await request(app)
          .patch(basePath)
          .send({ postId: postResponse.body.id, title: 'My title', message: 'My message', messageDetails: 'My message Details' })
          .set(getAuthHeader(ctx.id, user2.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);

        const postKeys = [
          'id',
          'category',
          'title',
          'sentAt',
          'sentBy',
          'createdBy',
          'updatedBy',
          'retractedAt',
          'created_at',
          'updated_at',
          'messageDetails',
          'publicDocumentId',
          'message',
          'rawMessage',
          'rawMessageDetails',
          'metadata',
        ];

        expect(Object.keys(postUpdatedResponse.body)).to.have.members(postKeys);

        expect(postUpdatedResponse.body.title).to.equal('My title');
        expect(postUpdatedResponse.body.message).to.equal('My message');
        expect(postUpdatedResponse.body.messageDetails).to.equal('My message Details');
        expect(postUpdatedResponse.body.updatedBy).to.equal(user2.id);
      });

      it('should update post if postId is sent and there is a recipient file uploaded', async () => {
        expect(postResponse.body.title).to.be.null;
        expect(postResponse.body.message).to.be.null;

        await uploadRecipientFile(postResponse.body.id);

        const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);
        await task;

        const postUpdatedResponse = await request(app)
          .patch(basePath)
          .send({ postId: postResponse.body.id, title: 'My title', message: 'My message', messageDetails: 'My message details' })
          .set(getAuthHeader(ctx.id, user2.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);

        const postKeys = [
          'id',
          'category',
          'title',
          'sentAt',
          'sentBy',
          'createdBy',
          'updatedBy',
          'retractedAt',
          'created_at',
          'updated_at',
          'messageDetails',
          'publicDocumentId',
          'rawMessage',
          'rawMessageDetails',
          'documentMetadata',
          'message',
          'metadata',
        ];

        expect(Object.keys(postUpdatedResponse.body)).to.have.members(postKeys);

        expect(postUpdatedResponse.body.title).to.equal('My title');
        expect(postUpdatedResponse.body.message).to.equal('My message');
        expect(postUpdatedResponse.body.messageDetails).to.equal('My message details');
        expect(postUpdatedResponse.body.updatedBy).to.equal(user2.id);
      });
    });
  });

  describe('when send post endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .post(`${basePath}/send`)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('and is a CCA user', () => {
      let postResponse;
      beforeEach(async () => {
        postResponse = await createPost(DALTypes.PostCategory.ANNOUNCEMENT);
      });
      it('should return 400 if postId is not sent', async () => {
        await request(app)
          .post(`${basePath}/send`)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('POST_ID_REQUIRED'));
      });

      it('should return 412 if post does not have title or message', async () => {
        await request(app)
          .post(`${basePath}/send`)
          .send({ postId: postResponse.body.id })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(412)
          .expect(res => expect(res.body.token).to.equal('TITLE_AND_MESSAGE_IS_REQUIRED'));
      });

      it('should return 412 if recipient file is missing for the post', async () => {
        await request(app)
          .post(`${basePath}/send`)
          .send({ postId: postResponse.body.id, message: 'My message', title: 'My title' })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(412)
          .expect(res => expect(res.body.token).to.equal('RECIPIENT_FILE_REQUIRED'));
      });

      it('should return 412 if post is already sent', async () => {
        const postId = postResponse.body.id;
        await uploadRecipientFile(postId);

        const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);
        await task;

        await markPostAsSent({ ...ctx, authUser: { id: user.id } }, postId);

        await request(app)
          .post(`${basePath}/send`)
          .send({ postId: postResponse.body.id })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(412)
          .expect(res => expect(res.body.token).to.equal('POST_ALREADY_SENT'));
      });

      it('should sentAt and sendBy be set when post is sent', async () => {
        const postId = postResponse.body.id;
        await uploadRecipientFile(postId);

        const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);
        await task;

        const sentPost = await request(app)
          .post(`${basePath}/send`)
          .send({ postId: postResponse.body.id, message: 'My message', title: 'My title' })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);

        expect(sentPost.body.sentAt).to.not.equal(null);
        expect(sentPost.body.sentBy).to.not.equal(null);
      });

      it('should notify via sockets and post should have sentAt set', async () => {
        const notify = sinon.spy();
        setNotificationFunction(notify);

        const postId = postResponse.body.id;
        await uploadRecipientFile(postId);

        const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;
        const importCohortCondition = msg => msg.jobDetails?.postId === postId;

        const [uploadTask, importCohortTask] = await setupMsgQueueAndWaitFor([queueCondition, importCohortCondition], { individualTasks: true });
        await uploadTask;

        await createAPostRecipient(postId);

        const sentPost = await request(app)
          .post(`${basePath}/send`)
          .send({ postId: postResponse.body.id, message: 'My message', title: 'My title' })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);

        await importCohortTask;

        expect(sentPost.status).to.equal(200);

        expect(notify).to.have.been.calledWith(
          sinon.match({
            event: eventTypes.POST_TO_RXP,
            data: { id: postId, sentAt: sinon.match.defined },
          }),
        );
      });
    });
  });

  describe('when upload recipient file endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .post(`${basePath}/recipient`)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('and is a CCA user', () => {
      let postResponse;
      beforeEach(async () => {
        postResponse = await createPost(DALTypes.PostCategory.ANNOUNCEMENT);
      });
      it('should return 400 if no postId is sent', async () => {
        await request(app)
          .post(`${basePath}/recipient`)
          .type('form')
          .field('context', context)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .attach('files', path.resolve(path.dirname(__dirname), 'resources', filename))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('POST_ID_REQUIRED'));
      });

      it('should return 400 if no files are sent', async () => {
        await request(app)
          .post(`${basePath}/recipient`)
          .type('form')
          .field('context', context)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('NO_FILES'));
      });

      it('should upload files is postId is sent', async () => {
        await request(app)
          .post(`${basePath}/recipient`)
          .type('form')
          .field('postId', postResponse.body.id)
          .field('context', context)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .attach('files', path.resolve(path.dirname(__dirname), 'resources', filename))
          .expect(200);

        const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);
        await task;

        const documents = await fetchDocuments();
        expect(documents.body.length).to.be.equal(1);

        const doc = documents.body[0];

        expect(doc.metadata.file.originalName).to.equal(filename);
        expect(doc.metadata.document.postId).to.equal(postResponse.body.id);
        expect(doc.metadata.document.context).to.equal(context);
      });
    });
  });

  describe('when delete recipient file endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .delete(`${basePath}/recipient`)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('and is a CCA user', () => {
      let postResponse;
      beforeEach(async () => {
        postResponse = await createPost(DALTypes.PostCategory.ANNOUNCEMENT);
      });

      it('should return 404 is document does not exist', async () => {
        await request(app)
          .delete(`${basePath}/recipient`)
          .send({ fileId: getUUID() })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('DOCUMENT_NOT_FOUND'));
      });

      it('should delete recipient file', async () => {
        await uploadRecipientFile(postResponse.body.id);
        const uploadQueueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

        const { task: uploadTask } = await setupMsgQueueAndWaitFor([uploadQueueCondition]);
        await uploadTask;

        const documents = await fetchDocuments();
        expect(documents.body.length).to.be.equal(1);

        await request(app)
          .delete(`${basePath}/recipient`)
          .send({ fileId: documents.body[0].uuid })
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200);
      });
    });

    describe('When download recipient file endpoint is called', () => {
      const docId = getUUID();

      it('should return 403 if it is not a CCA user', async () => {
        await request(app)
          .get(`${basePath}/${docId}/download`)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
          .expect(403)
          .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
      });

      describe('and is a CCA user', () => {
        it('should return 404 is document does not exist', async () => {
          await request(app)
            .get(`${basePath}/${docId}/download`)
            .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
            .expect(404)
            .expect(res => expect(res.body.token).to.equal('DOCUMENT_NOT_FOUND'));
        });
      });
    });
  });
});
