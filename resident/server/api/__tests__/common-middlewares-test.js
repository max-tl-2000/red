/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('common-middlewares', () => {
  let mocks;
  beforeEach(() => {
    mocks = {
      '../../dal/tenant-repo': {
        getTenantByName: () => ({ id: 'd8ebbb4d-6500-4568-ae2e-5b4154b10212', name: 'test' }),
      },
      '../../services/property': {
        markPropertyAsAccessed: jest.fn(),
      },
    };
    mockModules(mocks);
  });
  afterEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
  });
  describe('property-middleware', () => {
    it('should ignore urls that do not contain the propertyId as path parameters', () => {
      const req = {
        url: '/some/url',
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => ({}),
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      propertyMiddleware()(req);

      expect(propertyMiddleware.middlewareCtx).toBeUndefined();
    });

    it('should require the commonUserId to be present in the middlewareCtx object', async () => {
      const req = {
        url: '/properties/1231-2312312-1231-2312/paymentInfo',
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => ({}),
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      try {
        await propertyMiddleware()(req);
        throw new Error('This should never happen!');
      } catch (err) {
        expect(err.token).toEqual('MISSING_COMMON_USER_ID');
      }
    });

    it('should throw an error if fails to fetch user properties', async () => {
      const req = {
        url: '/properties/1231-2312312-1231-2312/paymentInfo',
        middlewareCtx: {
          consumerToken: {
            commonUserId: '12312-2131-32121-23121',
          },
        },
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => {
          throw new Error('SOME_ERROR_HAPPENED');
        },
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      try {
        await propertyMiddleware()(req);
        throw new Error('This should never happen!');
      } catch (err) {
        expect(err.token).toEqual('ERROR_FETCHING_PROPERTIES_FOR_USER');
        expect(err.status).toEqual(403);
      }
    });

    it('should throw an error if the property is not found', async () => {
      const req = {
        url: '/properties/1231-2312312-1231-2312/paymentInfo',
        middlewareCtx: {
          consumerToken: {
            commonUserId: '12312-2131-32121-23121',
          },
        },
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => [],
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      try {
        await propertyMiddleware()(req);
        throw new Error('This should never happen!');
      } catch (err) {
        expect(err.token).toEqual('PROPERTY_NOT_ASSOCIATED_TO_USER');
        expect(err.status).toEqual(403);
      }
    });

    it('should set the propertyId and propertyName to the middlewareCtx object', async () => {
      const req = {
        url: '/properties/1231-2312312-1231-2312/paymentInfo',
        middlewareCtx: {
          consumerToken: {
            commonUserId: '12312-2131-32121-23121',
          },
        },
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => [{ propertyName: 'Dummy property', propertyId: '1231-2312312-1231-2312' }],
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      await propertyMiddleware()(req);

      expect(req.middlewareCtx.propertyId).toEqual('1231-2312312-1231-2312');
      expect(req.middlewareCtx.propertyName).toEqual('Dummy property');
    });

    it('should throw an error if required feature is not found in the properties features', async () => {
      const req = {
        url: '/properties/1231-2312312-1231-2312/paymentInfo',
        middlewareCtx: {
          consumerToken: {
            commonUserId: '12312-2131-32121-23121',
          },
        },
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => [{ propertyName: 'Dummy property', propertyId: '1231-2312312-1231-2312' }],
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      try {
        await propertyMiddleware({ requiredFeatures: ['paymentModule'] })(req);
        throw new Error('This should never happen!');
      } catch (err) {
        expect(err.token).toEqual('MISSING_REQUIRED_FEATURES_IN_PROPERTY');
        expect(err.data).toEqual({ missingFeatures: ['paymentModule'] });
        expect(err.status).toEqual(403);
      }
    });

    it('should not throw if required feature is present in the property', async () => {
      const req = {
        url: '/properties/1231-2312312-1231-2312/paymentInfo',
        middlewareCtx: {
          consumerToken: {
            commonUserId: '12312-2131-32121-23121',
          },
        },
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => [{ propertyName: 'Dummy property', propertyId: '1231-2312312-1231-2312', features: { paymentModule: true } }],
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      try {
        await propertyMiddleware({ requiredFeatures: ['paymentModule'] })(req);
      } catch (err) {
        throw new Error('This should never happen!');
      }
    });

    it('should mark the property as accessed', async () => {
      const req = {
        url: '/properties/1231-2312312-1231-2312/post',
        middlewareCtx: {
          consumerToken: {
            commonUserId: '1111-2222-11111-22222',
          },
        },
      };

      jest.mock('../../services/common-user', () => ({
        getCommonUserProperties: () => [{ propertyName: 'Dummy property', propertyId: '1231-2312312-1231-2312', tenantName: 'test' }],
      }));

      const { propertyMiddleware } = require('../common-middlewares');

      await propertyMiddleware()(req);

      const expectedReqAfterPropertyMiddleware = {
        ...req,
        tenantId: 'd8ebbb4d-6500-4568-ae2e-5b4154b10212',
        tenantName: 'test',
        middlewareCtx: {
          ...req.middlewareCtx,
          tenantId: 'd8ebbb4d-6500-4568-ae2e-5b4154b10212',
          propertyId: '1231-2312312-1231-2312',
          tenantName: 'test',
        },
      };

      expect(mocks['../../services/property'].markPropertyAsAccessed).toHaveBeenCalledWith(expectedReqAfterPropertyMiddleware, {
        commonUserId: '1111-2222-11111-22222',
        propertyId: '1231-2312312-1231-2312',
      });
    });
  });
});
