/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../../config';
import { errorHandler } from '../errorMiddleware';
import logger from '../../../common/helpers/logger';

import * as overrider from '../../../common/test-helpers/overrider';

const createMockResponse = () => ({
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
  redirect: jest.fn(),
});

describe('API/error handling middleware', () => {
  beforeEach(() => {
    const fn = jest.fn();
    const mockLogger = { error: fn, info: fn, debug: fn, warn: fn };
    overrider.override(logger, mockLogger);
  });

  afterEach(() => overrider.restore());

  describe('when error is String', () => {
    it('has status code 500', () => {
      const res = createMockResponse();
      errorHandler()('some error', {}, res, () => {});

      expect(res.status).toBeCalledWith(500);
    });

    it('has JSON string in body', () => {
      const res = createMockResponse();
      errorHandler()('some error', {}, res);

      expect(res.json).toBeCalledWith('some error');
    });
  });

  describe('when error is Object', () => {
    it('redirects if error has redirect location', () => {
      const error = {
        redirect: '/foo/bar',
      };
      const res = createMockResponse();
      errorHandler()(error, {}, res);

      expect(res.redirect).toBeCalledWith(error.redirect);
    });

    it('has status code 500 if other not specified', () => {
      const error = {};

      const res = createMockResponse();
      errorHandler()(error, {}, res);

      expect(res.status).toBeCalledWith(500);
    });

    it('has custom status code if specified', () => {
      const error = {
        status: 429,
      };

      const res = createMockResponse();
      errorHandler()(error, {}, res);

      expect(res.status).toBeCalledWith(error.status);
    });

    it('has JSON error object in body', () => {
      const error = {
        foo: 'bar',
      };

      const res = createMockResponse();
      errorHandler()(error, {}, res);

      expect(res.json).toBeCalledWith(error);
    });
  });

  describe('when error is Error', () => {
    it('redirects if error has redirect location', () => {
      const error = Object.assign(new Error(), { redirect: '/foo/bar' });
      const res = createMockResponse();
      errorHandler()(error, {}, res);

      expect(res.redirect).toBeCalledWith(error.redirect);
    });

    it('has status code 500 if other not specified', () => {
      const error = Object.assign(new Error(), {});
      const res = createMockResponse();
      errorHandler()(error, {}, res);

      expect(res.status).toBeCalledWith(500);
    });

    it('has custom status code if specified', () => {
      const error = Object.assign(new Error(), { status: 429 });
      const res = createMockResponse();
      errorHandler()(error, {}, res);

      expect(res.status).toBeCalledWith(error.status);
    });

    it('has JSON error object in body', () => {
      overrider.override(config, {
        isProdEnv: true,
      });

      const error = Object.assign(new Error(), {
        foo: 'bar',
        baz: 'moo',
      });
      const res = createMockResponse();
      errorHandler()(error, {}, res);

      const result = res.json.mock.calls[0][0];

      expect(result.foo).toBeUndefined();
      expect(result.baz).toBeUndefined();

      overrider.restore();
    });

    it('In dev env the error contain the stack info', () => {
      overrider.override(config, {
        isProdEnv: false,
      });
      const error = new Error();

      const res = createMockResponse();
      errorHandler()(error, {}, res);

      const result = res.json.mock.calls[0][0];

      expect(result.stack).toBeDefined();

      overrider.restore();
    });

    it('has no error stacktrace in body if in PROD mode', () => {
      overrider.override(config, {
        isProdEnv: true,
      });
      const error = new Error();

      const res = createMockResponse();
      errorHandler()(error, {}, res);

      const result = res.json.mock.calls[0][0];

      expect(result.stack).not.toBeDefined();

      overrider.restore();
    });

    it('does not filter the data property in prod', () => {
      overrider.override(config, {
        isProdEnv: true,
      });
      const data = { foo: 'foo', bar: 'bar' };
      const error = Object.assign(new Error(), { data });

      const res = createMockResponse();
      errorHandler()(error, {}, res);

      const result = res.json.mock.calls[0][0];

      expect(result.data).toEqual(data);

      overrider.restore();
    });

    it('should not filter the data property in dev', () => {
      overrider.override(config, {
        isProdEnv: false,
      });
      const data = { foo: 'foo', bar: 'bar' };
      const error = Object.assign(new Error(), { data });

      const res = createMockResponse();
      errorHandler()(error, {}, res);

      const result = res.json.mock.calls[0][0];

      expect(result.data).toEqual(data);

      overrider.restore();
    });
  });

  it('should handle JsonSchemaValidation errors differently than normal errors', () => {
    const error = Object.assign(new Error(), {
      name: 'JsonSchemaValidation',
      validations: {
        body: [
          {
            messages: ['is not one of enum values: prospect,bronze,silver,gold'],
            property: 'request.body.score',
            value: 'violet',
          },
        ],
      },
    });

    const res = createMockResponse();
    errorHandler()(error, {}, res);

    const result = res.json.mock.calls[0][0];

    expect(result).toMatchSnapshot();
  });

  describe('when config.logMiddlewareErrors is false', () => {
    describe('and no status is present in the error', () => {
      it('should default to erro 500', () => {
        overrider.override(config, {
          logMiddlewareErrors: false,
        });

        const error = new Error();

        const res = createMockResponse();
        errorHandler()(error, {}, res);
        expect(res.status).toBeCalledWith(500);

        overrider.restore();
      });
    });

    it('should call status with the error.status', () => {
      overrider.override(config, {
        logMiddlewareErrors: false,
      });

      const error = Object.assign(new Error(), { status: 430 });

      const res = createMockResponse();
      errorHandler()(error, {}, res);
      expect(res.status).toBeCalledWith(430);

      overrider.restore();
    });
  });

  describe('when config.logMiddlewareErrors is true', () => {
    it('should log 412 errors as warnings', () => {
      overrider.override(config, {
        logMiddlewareErrors: true,
      });

      const error = Object.assign(new Error(), { status: 412, token: 'SOME_TOKEN' });

      const res = createMockResponse();
      errorHandler()(error, {}, res);
      expect(res.status).toBeCalledWith(412);

      const warnLog = logger.warn.mock.calls[0][1];
      expect(warnLog).toMatchSnapshot();

      overrider.restore();
    });

    it('should log authorization errors as info', () => {
      overrider.override(config, {
        logMiddlewareErrors: true,
      });

      const error = Object.assign(new Error('ACCOUNT_BLOCKED'), { status: 401, token: 'ACCOUNT_BLOCKED' });

      const res = createMockResponse();
      errorHandler()(error, {}, res);
      expect(res.status).toBeCalledWith(401);

      const infoLog = logger.info.mock.calls[0][1];
      expect(infoLog).toMatchSnapshot();

      overrider.restore();
    });

    it('should log InvalidJWTError errors as info', () => {
      overrider.override(config, {
        logMiddlewareErrors: true,
      });

      const error = Object.assign(new Error('INVALID_TOKEN'), { status: 401, code: 'INVALID_TOKEN' });

      const res = createMockResponse();
      errorHandler()(error, {}, res);
      expect(res.status).toBeCalledWith(401);

      const infoLog = logger.info.mock.calls[0][1];
      expect(infoLog).toMatchSnapshot();

      overrider.restore();
    });

    it('should log errors with status code 498 as info', () => {
      overrider.override(config, {
        logMiddlewareErrors: true,
      });

      const error = Object.assign(new Error('INVALID_TOKEN'), { status: 498, message: 'INVALID_TOKEN' });

      const res = createMockResponse();
      errorHandler()(error, {}, res);
      expect(res.status).toBeCalledWith(498);

      const infoLog = logger.info.mock.calls[0][1];
      expect(infoLog).toMatchSnapshot();

      overrider.restore();
    });
  });
});
