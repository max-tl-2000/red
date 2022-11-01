/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';

describe('API/log', () => {
  function makeLogRequest(input) {
    return request(app).post('/log').set(getAuthHeader()).send(input);
  }

  describe('with empty body', () => {
    it('has status code 400', async () => {
      const result = await makeLogRequest();
      expect(result.status).to.equal(400);
      expect(result.body.token).to.equal('MISSING_MESSAGES');
    });
  });

  describe('with invalid body', () => {
    it('has status code 400', async () => {
      const result = await makeLogRequest({ somedata: [1, 2, 3] });
      expect(result.status).to.equal(400);
      expect(result.body.token).to.equal('MISSING_MESSAGES');
    });
  });

  describe('with single message', () => {
    it('has status code 200', async () => {
      const input = [{ loggingMessage: 'test', severity: 'error' }];
      await makeLogRequest(input).expect(200);
    });
  });

  describe('with multiple messages', () => {
    it('has status code 200', async () => {
      const input = [
        { loggingMessage: 'test1', severity: 'error' },
        { loggingMessage: 'test2', severity: 'info' },
      ];

      await makeLogRequest(input).expect(200);
    });
  });
});
