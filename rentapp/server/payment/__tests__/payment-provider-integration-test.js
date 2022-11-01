/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const { mockModules } = require('test-helpers/mocker').default(jest); // eslint-disable-line

const DEFAULT_TEST_TIMEOUT = 10000;
const context = { tenantId: 'e94b3393-0ff3-55a7-0aed-1b56e450dd66' };

describe('Payment provider integration', () => {
  let paymentMock;
  let doAndRetryPayment;

  const setPaymentMocks = (throwError = true) => {
    jest.resetModules();
    paymentMock = {
      initiatePayment: jest.fn(() => {
        const throwGenericError = () => {
          throw new Error('GUEST_INTEGRATION_ID_REQUIRED');
        };

        throwError && throwGenericError();

        if (paymentMock.initiatePayment.mock.calls.length < 2) throwGenericError();

        return {
          guestId: 1234,
          link: 'https://example.com/p/13FUNfd7',
        };
      }),
    };
    mockModules({
      '../adapters/fake-provider.js': {
        FakeProvider: jest.fn().mockImplementation(() => ({
          initiatePayment: paymentMock.initiatePayment,
        })),
      },
      '../../../../server/services/tenantService.js': {
        getTenant: () => ({
          metadata: {},
        }),
      },
    });

    doAndRetryPayment = require('../payment-provider-integration').doAndRetryPayment; // eslint-disable-line
  };

  describe('When a create guest request fails', () => {
    it(
      'Should retry the request 3 times, before failing and throwing an SERVICE_UNAVAILABLE error',
      async () => {
        setPaymentMocks(true);
        try {
          await doAndRetryPayment(context);
          expect(false, 'this code should never be executed').to.be.true;
        } catch (error) {
          expect(error.token).toEqual('SERVICE_UNAVAILABLE');
          expect(error.status).toEqual(503);
        }
        expect(paymentMock.initiatePayment.mock.calls).toHaveLength(3);
      },
      DEFAULT_TEST_TIMEOUT,
    );

    it(
      'Should retry the request 2 times, before getting a success response',
      async () => {
        setPaymentMocks(false);

        const initPaymentResponse = await doAndRetryPayment(context);
        expect(initPaymentResponse.guestId).toEqual(1234);
        expect(paymentMock.initiatePayment.mock.calls).toHaveLength(2);
      },
      DEFAULT_TEST_TIMEOUT,
    );
  });
});
