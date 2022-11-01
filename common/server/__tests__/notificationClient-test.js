/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';

/* eslint-disable global-require */
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('notificationClient', () => {
  let notify;
  let loggerMock;

  beforeEach(() => {
    jest.resetModules();

    loggerMock = {
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
    };
    mockModules({
      '../../helpers/logger': {
        child: () => loggerMock,
      },
    });

    notify = require('../notificationClient').notify;
  });

  describe('when tenantId, event or data are not in the first parameter', () => {
    it('should log an error', async () => {
      notify({});
      expect(loggerMock.error.mock.calls.length).toBe(2);
    });
  });

  describe('when tenantId, event or data are in the first parameter', () => {
    it('should not log any error', async () => {
      const ctx = { tenantId: newUUID() };
      const event = 'event';
      const data = {};
      const routing = {};
      notify({ ctx, event, data, routing });
      expect(loggerMock.error.mock.calls.length).toBe(0);
    });
  });
});
