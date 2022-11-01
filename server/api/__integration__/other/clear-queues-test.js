/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import app from '../../api';
import config from '../../../workers/config';
import serverConfig from '../../../config';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { sendMessage } from '../../../services/pubsub';
import { APP_EXCHANGE } from '../../../helpers/message-constants';

import { setupConsumers, getEnvQueueName } from '../../../workers/consumer';
import { chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';

const { apiToken } = serverConfig;

describe('API/test/clearQueues', () => {
  describe('given a request to clear the queues', () => {
    describe('when the apiToken query param is missing', () => {
      it('responds with status code 403 and API_TOKEN_REQUIRED token', async () => {
        const res = await request(app).post('/test/clearQueues').set(getAuthHeader('admin'));

        expect(res.status).to.equal(403);
        expect(res.body.token).to.equal('API_TOKEN_REQUIRED');
      });
    });

    describe('when the apiToken query param is not valid', () => {
      it('responds with status code 403 and API_TOKEN_INVALID token', async () => {
        const invalidApiToken = 'some-token';

        const res = await request(app).post(`/test/clearQueues?apiToken=${invalidApiToken}`).set(getAuthHeader('admin'));

        expect(res.status).to.equal(403);
        expect(res.body.token).to.equal('API_TOKEN_INVALID');
      });
    });

    describe('when the apiToken is valid', () => {
      beforeEach(async () => {
        const workers = Object.keys(config.workerConfig);
        const matcher = createResolverMatcher();
        await setupConsumers(chan(), matcher, workers, false);
      });

      it('responds with status code 200 and the queues are empty', async () => {
        const message = {
          type: 'in',
          msg: 'test message - second',
        };

        await sendMessage({
          exchange: APP_EXCHANGE,
          key: 'comm_inbound_email',
          message,
          ctx: {},
        });

        await request(app).post(`/test/clearQueues?apiToken=${apiToken}`).set(getAuthHeader('admin')).expect(200);

        const res = await Promise.all(
          Object.keys(config.workerConfig).map(async key => {
            const queueConfig = config.workerConfig[key];
            return await chan().get(getEnvQueueName(queueConfig.queue), {
              noAck: true,
            });
          }),
        );

        expect(res.every(p => p)).to.be.false;
      });
    });
  });
});
