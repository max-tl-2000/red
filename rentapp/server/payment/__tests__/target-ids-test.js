/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import chai from 'chai';
import { DALTypes } from '../../../../common/enums/DALTypes';
const { mockModules } = require('test-helpers/mocker').default(jest); // eslint-disable-line
const { expect } = chai;

const context = { tenantId: newId() };
const realTest = DALTypes.PaymentProviderMode.REAL_TEST;
const realProd = DALTypes.PaymentProviderMode.REAL_PROD;
const aptexxTargeIds = ['12007954', '12007959'];

describe('Get targets ids from PaymentProviderInterface', () => {
  let PaymentProviderInterface;

  const setupMocks = isProd => {
    jest.resetModules();
    mockModules({
      '../../../../server/services/tenantService': {
        getTenant: () => {
          if (isProd) {
            return {
              metadata: { paymentProviderMode: realProd },
            };
          }
          return { metadata: { paymentProviderMode: realTest } };
        },
      },
      '../../../../server/dal/propertyRepo': {
        getProperties: () => [
          { id: 1, paymentProvider: { aptexx: { accountIds: { hold: '12007954', application: '12007959' } } } },
          { id: 2, paymentProvider: { aptexx: { accountIds: { hold: '12007954', application: '12007959' } } } },
        ],
        getProperty: () => ({
          id: 1,
          paymentProvider: { aptexx: { accountIds: { hold: '12007954', application: '12007959' } } },
        }),
      },
    });

    PaymentProviderInterface = require('../adapters/payment-provider-interface').PaymentProviderInterface; // eslint-disable-line
  };

  describe(`Payment provider is ${realTest}`, () => {
    it('should be equal to realTestTargeIds for holdAccount and applicationAccount target ids', async () => {
      setupMocks(false);
      const paymentProviderInterface = new PaymentProviderInterface(realTest);
      const targetsIds = await paymentProviderInterface.getTargetIds(context);
      expect(targetsIds).to.eql(aptexxTargeIds);
    });
  });
  describe(`Payment provider is ${realProd}`, () => {
    it('should be equal to [12007954, 12007959] for holdAccount and applicationAccount target ids', async () => {
      setupMocks(true);
      const paymentProviderInterface = new PaymentProviderInterface(realProd);
      const targetsIds = await paymentProviderInterface.getTargetIds(context);
      expect(targetsIds).to.eql(aptexxTargeIds);
    });

    describe('Specific propertyId is used', () => {
      it('should be equal to [12007954, 12007959] for holdAccount and applicationAccount target ids', async () => {
        setupMocks(true);
        const paymentProviderInterface = new PaymentProviderInterface(realTest);
        const targetsIds = await paymentProviderInterface.getTargetIds(context, { propertyId: 1 });
        expect(targetsIds).to.eql(aptexxTargeIds);
      });
    });
  });

  describe('Payment provider was not provided', () => {
    it('should be equal to realTestTargeIds for holdAccount and applicationAccount target ids', async () => {
      setupMocks(false);
      const paymentProviderInterface = new PaymentProviderInterface();
      const targetsIds = await paymentProviderInterface.getTargetIds(context);
      expect(targetsIds).to.eql(aptexxTargeIds);
    });
  });
});
