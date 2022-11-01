/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

chai.use(chaiAsPromised);
const { expect } = chai;

describe('webhook', () => {
  let handlePaymentNotification;

  const defaultMocks = () => ({
    sendMessage: jest.fn(),
  });

  const setupMocks = mocks => {
    mockModules({
      '../../../../server/services/pubsub': {
        sendMessage: mocks.sendMessage,
      },
    });
    const webhooks = require('../actions/webhooks'); // eslint-disable-line global-require
    handlePaymentNotification = webhooks.handlePaymentNotification;
  };

  describe('handlePaymentNotification', () => {
    let req;
    let mocks;

    beforeEach(() => {
      req = {
        body: {
          tenantId: newId(),
          personApplicationId: newId(),
        },
      };
    });

    it('should call sendMessage when there is a valid input', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);
      await handlePaymentNotification(req);
      expect(mocks.sendMessage.mock.calls.length).to.equal(1);
    });
  });
});
