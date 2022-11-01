/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import path from 'path';
import { admin } from '../../../common/schemaConstants';
import app from '../../api';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { testCtx as ctx, createAUser, createATeam } from '../../../testUtils/repoHelper';
import { chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { setupConsumers } from '../../../workers/consumer';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { updateTenant } from '../../../dal/tenantsRepo';

const setupMsgQueueAndWaitFor = async conditions => {
  const { resolvers, promises } = waitFor(conditions);
  const matcher = createResolverMatcher(resolvers);
  await setupConsumers(chan(), matcher, ['upload']);
  return { task: Promise.all(promises) };
};

const adminCtx = { tenantId: admin.id };
const basePath = '/cohortComms';
const draftPostsEndpointPath = `${basePath}/draftPosts`;
const createPostEndpointPath = `${basePath}/post`;
const uploadRecipientFileEndpointPath = `${basePath}/post/recipient`;
const filename = 'test-document.csv';

describe('API/cohortComms/draftPosts', async () => {
  let user;
  let team;

  const createPost = category =>
    request(app)
      .post(createPostEndpointPath)
      .send({ category })
      .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]));

  const uploadRecipientFile = (postId, context) =>
    request(app)
      .post(uploadRecipientFileEndpointPath)
      .type('form')
      .field('postId', postId)
      .field('context', context)
      .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
      .attach('files', path.resolve(path.dirname(__dirname), 'resources', filename));

  beforeEach(async () => {
    user = await createAUser();
    team = await createATeam({
      name: 'testTeam',
      module: 'leasing',
    });
    await updateTenant(adminCtx, ctx.id, {
      settings: { ...ctx.settings, features: { enableCohortComms: true } },
    });
  });

  describe('when draft posts endpoint is called', () => {
    it('should return 403 if it is not a CCA user', async () => {
      await request(app)
        .get(draftPostsEndpointPath)
        .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: [] }]))
        .expect(403)
        .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
    });

    describe('is a CCA user', () => {
      it('should return 200 and response an empty array if there is not data', async () => {
        await request(app)
          .get(draftPostsEndpointPath)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200)
          .expect(res => expect(res.body).to.have.lengthOf(0));
      });

      it('should return 200 and response an array of draft posts if there is data', async () => {
        const postResponse = await createPost(DALTypes.PostCategory.ANNOUNCEMENT);
        await uploadRecipientFile(postResponse.body.id, DALTypes.PostCategory.ANNOUNCEMENT);

        const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

        const { task } = await setupMsgQueueAndWaitFor([queueCondition]);
        await task;

        await request(app)
          .get(draftPostsEndpointPath)
          .set(getAuthHeader(ctx.id, user.id, [{ id: team.id, mainRoles: ['LA'], functionalRoles: ['CCA'] }]))
          .expect(200)
          .expect(res => expect(res.body).to.have.lengthOf(1));
      });
    });
  });
});
