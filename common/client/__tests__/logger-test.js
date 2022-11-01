/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { override, restore } from 'test-helpers/overrider';
import { deferred } from '../../helpers/deferred';
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('client/logger', () => {
  beforeEach(() => {
    mockModules({
      '../../helpers/globals': {
        window: {
          navigator: { userAgent: 'Mock User Agent' },
          location: { href: 'https://mock/location/to/resource' },
        },
      },
    });

    override(global.console, {
      log: () => {},
      debug: () => {},
      error: () => {},
      info: () => {},
      warn: () => {},
    });
  });

  afterEach(() => {
    jest.resetModules();
    restore();
  });

  describe('logger', () => {
    it('should not fail if used without initialization', () => {
      const mockConsole = { warn: jest.fn() };

      override(global.console, mockConsole);

      const { logger } = require('../logger');

      logger.trace('some method called 1');
      expect(mockConsole.warn).toHaveBeenCalledWith('logger not initialized', 'some method called 1');

      logger.error('some method called 2');
      expect(mockConsole.warn).toHaveBeenCalledWith('logger not initialized', 'some method called 2');

      logger.info('some method called 3');
      expect(mockConsole.warn).toHaveBeenCalledWith('logger not initialized', 'some method called 3');

      logger.warn('some method called 4');
      expect(mockConsole.warn).toHaveBeenCalledWith('logger not initialized', 'some method called 4');

      logger.debug('some method called 5');
      expect(mockConsole.warn).toHaveBeenCalledWith('logger not initialized', 'some method called 5');
    });
  });

  describe('initClientLogger', () => {
    it('should throw if not apiClient provided', () => {
      const { initClientLogger } = require('../logger');

      expect(() => initClientLogger()).toThrowError('apiClient parameter not provided');
    });

    it('should use the console object in development mode as well as the api endpoint only for error messages', () => {
      const { logger, initClientLogger } = require('../logger');

      const consoleMock = {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };

      override(global.console, consoleMock, /* allowNonExistent */ true);
      override(process.env, { NODE_ENV: 'development' });

      const apiClient = { post: jest.fn(() => Promise.resolve()) };

      initClientLogger({ apiClient });

      logger.trace('a trace message');
      logger.debug('a debug message');
      logger.info('an info message');
      logger.error('an error message');
      logger.warn('a warn message');

      expect(consoleMock.trace.mock.calls).toMatchSnapshot();
      expect(consoleMock.debug.mock.calls).toMatchSnapshot();
      expect(consoleMock.info.mock.calls).toMatchSnapshot();
      expect(consoleMock.error.mock.calls).toMatchSnapshot();
      expect(consoleMock.warn.mock.calls).toMatchSnapshot();

      expect(apiClient.post).toHaveBeenCalledTimes(1);

      const { data } = apiClient.post.mock.calls[0][1];

      expect(data[0].severity).toEqual('error');
      expect(data[0].loggingMessage).toEqual('an error message');
    });

    it('should do a post to the provided client api only for error severity', () => {
      const { logger, initClientLogger } = require('../logger');

      const apiClient = {
        post: jest.fn(() => Promise.resolve()),
      };

      initClientLogger({ apiClient });

      logger.trace('some method called 1');
      logger.debug('some method called 2');
      logger.warn('some method called 3');
      logger.info('some method called 4');
      logger.error('some methd called 5');

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post.mock.calls).toMatchSnapshot();
    });

    it('should also accept a extra object to be sent to the api endpoint in case of severity = error', () => {
      const { logger, initClientLogger } = require('../logger');

      const apiClient = {
        post: jest.fn(() => Promise.resolve()),
      };

      initClientLogger({ apiClient });

      logger.error({ custom: 'value', to: 'pass', for: 'logger' }, 'some method called 1');

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post.mock.calls).toMatchSnapshot();
    });

    it('failures to post messages should be logged as errors', async () => {
      const mockConsole = { error: jest.fn() };
      const d = deferred();

      override(global.console, mockConsole);

      const { logger, initClientLogger } = require('../logger');

      const apiClient = {
        post: jest.fn(() => d),
      };

      initClientLogger({ apiClient });

      logger.error({ custom: 'value', to: 'pass', for: 'logger' }, 'some method called 1');

      d.reject({ status: 500 }); // this object simulates a network error

      try {
        await d;
      } catch (ex) {
        // no needed to handle this during testing
      }

      expect(mockConsole.error).toHaveBeenCalled();
      expect(mockConsole.error.mock.calls).toMatchSnapshot();
    });

    it('should allow to add the user info', () => {
      const { logger, initClientLogger } = require('../logger');

      const apiClient = {
        post: jest.fn(() => Promise.resolve()),
      };

      initClientLogger({
        apiClient,
        getContextData: () =>
          // this function can return any object
          // and that will just be added as the contextData object
          // to the logger
          ({
            userId: 1,
            userName: 'Some name',
          }),
      });

      logger.error({ custom: 'value', to: 'pass', for: 'logger' }, 'some method called 1');

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post.mock.calls).toMatchSnapshot();
    });
  });
});
